const express = require('express');
const User = require('../models/User');
const Site = require('../models/Site');
const SearchHistory = require('../models/SearchHistory');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route GET /api/user/history -> foydalanuvchi qidiruv tarixi (oxirgi 30 ta)
router.get('/history', protect, async (req, res, next) => {
  try {
    const history = await SearchHistory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('resultSite', 'name icon url');
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

// @route DELETE /api/user/history -> tarixni tozalash
router.delete('/history', protect, async (req, res, next) => {
  try {
    await SearchHistory.deleteMany({ user: req.user._id });
    res.json({ success: true, message: 'Tarix tozalandi' });
  } catch (err) {
    next(err);
  }
});

// @route POST /api/user/bookmarks/:siteId -> saqlab qo'yish / olib tashlash (toggle)
router.post('/bookmarks/:siteId', protect, async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.siteId);
    if (!site) return res.status(404).json({ success: false, message: 'Sayt topilmadi' });

    const user = await User.findById(req.user._id);
    const idx = user.bookmarks.findIndex((id) => id.toString() === req.params.siteId);

    let bookmarked;
    if (idx === -1) {
      user.bookmarks.push(site._id);
      bookmarked = true;
    } else {
      user.bookmarks.splice(idx, 1);
      bookmarked = false;
    }
    await user.save();

    res.json({ success: true, bookmarked, message: bookmarked ? 'Saqlandi' : 'Olib tashlandi' });
  } catch (err) {
    next(err);
  }
});

// @route GET /api/user/bookmarks -> saqlangan saytlar
router.get('/bookmarks', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('bookmarks');
    res.json({ success: true, bookmarks: user.bookmarks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
