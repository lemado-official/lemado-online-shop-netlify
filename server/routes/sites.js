const express = require('express');
const { body, query, validationResult } = require('express-validator');
const xss = require('xss');
const Site = require('../models/Site');
const SearchHistory = require('../models/SearchHistory');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function sanitize(str) {
  return xss(String(str || '').trim());
}

// @route GET /api/sites  -> barcha faol saytlar (public), ?q= bilan qidiruv, ?category= bilan filter
router.get(
  '/',
  [query('q').optional().trim().isLength({ max: 150 })],
  optionalAuth,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { q, category } = req.query;
      const filter = { isActive: true };

      if (category && category !== 'Barchasi') {
        filter.category = sanitize(category);
      }

      let sites;
      if (q && q.trim()) {
        const safeQ = sanitize(q);
        filter.$text = { $search: safeQ };
        sites = await Site.find(filter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(50);

        // Agar text index natija bermasa, regex bilan qayta urinamiz (qisman moslik uchun)
        if (sites.length === 0) {
          const regexFilter = { isActive: true, name: { $regex: safeQ, $options: 'i' } };
          if (category && category !== 'Barchasi') regexFilter.category = sanitize(category);
          sites = await Site.find(regexFilter).limit(50);
        }

        if (req.user) {
          await SearchHistory.create({
            user: req.user._id,
            query: safeQ,
            resultSite: sites[0]?._id,
          });
        }
      } else {
        sites = await Site.find(filter).sort({ clicks: -1, createdAt: -1 }).limit(100);
      }

      res.json({ success: true, count: sites.length, sites });
    } catch (err) {
      next(err);
    }
  }
);

// @route GET /api/sites/categories -> mavjud kategoriyalar ro'yxati
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Site.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/sites/:id/click -> klik hisoblagichini oshirish
router.post('/:id/click', async (req, res, next) => {
  try {
    const site = await Site.findByIdAndUpdate(
      req.params.id,
      { $inc: { clicks: 1 } },
      { new: true }
    );
    if (!site) return res.status(404).json({ success: false, message: 'Sayt topilmadi' });
    res.json({ success: true, clicks: site.clicks });
  } catch (err) {
    next(err);
  }
});

// ---------- ADMIN CRUD ----------

const siteValidators = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Nomi 2-60 belgi bo\'lishi kerak'),
  body('url').trim().matches(/^https:\/\/.+/i).withMessage('URL https:// bilan boshlanishi shart'),
  body('description').optional().trim().isLength({ max: 200 }),
  body('category').optional().trim().isLength({ max: 40 }),
  body('icon').optional().trim().isLength({ max: 300 }),
  body('color').optional().trim().matches(/^#([0-9A-Fa-f]{3}){1,2}$/).withMessage('Rang HEX bo\'lishi kerak'),
  body('allowIframe').optional().isBoolean(),
];

// @route POST /api/sites -> yangi sayt qo'shish (faqat admin)
router.post('/', protect, adminOnly, siteValidators, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, url, description, category, icon, color, allowIframe } = req.body;

    const site = await Site.create({
      name: sanitize(name),
      url: url.trim(), // URL xss() bilan buzilmasligi uchun alohida, lekin regex bilan tekshirilgan
      description: sanitize(description),
      category: sanitize(category) || 'Umumiy',
      icon: sanitize(icon) || '🌐',
      color: color || '#ff6b35',
      allowIframe: allowIframe !== undefined ? allowIframe : true,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Sayt qo\'shildi', site });
  } catch (err) {
    next(err);
  }
});

// @route PUT /api/sites/:id -> tahrirlash (faqat admin)
router.put('/:id', protect, adminOnly, siteValidators, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, url, description, category, icon, color, allowIframe, isActive } = req.body;

    const site = await Site.findByIdAndUpdate(
      req.params.id,
      {
        name: sanitize(name),
        url: url.trim(),
        description: sanitize(description),
        category: sanitize(category) || 'Umumiy',
        icon: sanitize(icon) || '🌐',
        color: color || '#ff6b35',
        allowIframe: allowIframe !== undefined ? allowIframe : true,
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!site) return res.status(404).json({ success: false, message: 'Sayt topilmadi' });
    res.json({ success: true, message: 'Sayt yangilandi', site });
  } catch (err) {
    next(err);
  }
});

// @route DELETE /api/sites/:id -> o'chirish (faqat admin)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Sayt topilmadi' });
    res.json({ success: true, message: 'Sayt o\'chirildi' });
  } catch (err) {
    next(err);
  }
});

// @route GET /api/sites/admin/all -> admin uchun faol+nofaol barcha saytlar
router.get('/admin/all', protect, adminOnly, async (req, res, next) => {
  try {
    const sites = await Site.find().sort({ createdAt: -1 });
    res.json({ success: true, count: sites.length, sites });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
