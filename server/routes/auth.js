const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Brute-force himoya: login uchun qattiqroq limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 8,
  message: { success: false, message: 'Juda ko\'p urinish. 15 daqiqadan so\'ng qayta urinib ko\'ring.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Juda ko\'p ro\'yxatdan o\'tish urinishi. Keyinroq urinib ko\'ring.' },
});

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function sendTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true, // JS orqali o'qib bo'lmaydi -> XSS orqali token o'g'irlanmaydi
    secure: process.env.NODE_ENV === 'production', // faqat HTTPS
    sameSite: 'lax', // CSRF himoyasiga yordam
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// @route POST /api/auth/register
router.post(
  '/register',
  registerLimiter,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Foydalanuvchi nomi 3-30 belgi bo\'lishi kerak').matches(/^[a-zA-Z0-9_]+$/).withMessage('Faqat harf, raqam va _ belgisi'),
    body('email').trim().isEmail().withMessage('Email formati noto\'g\'ri').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Parol kamida 8 belgi').matches(/\d/).withMessage('Parolda kamida 1 ta raqam bo\'lishi kerak'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { username, email, password } = req.body;

      const existing = await User.findOne({ $or: [{ email }, { username }] });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Bu email yoki username allaqachon band' });
      }

      // Birinchi ro'yxatdan o'tuvchi avtomatik admin bo'lmaydi - xavfsizlik uchun
      // Admin faqat seed skripti orqali yaratiladi
      const user = await User.create({ username, email, password, role: 'user' });

      const token = signToken(user._id);
      sendTokenCookie(res, token);

      res.status(201).json({
        success: true,
        message: 'Ro\'yxatdan muvaffaqiyatli o\'tdingiz',
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

// @route POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().notEmpty().withMessage('Email kiritilishi shart'),
    body('password').notEmpty().withMessage('Parol kiritilishi shart'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });
      }

      if (user.isLocked) {
        return res.status(423).json({ success: false, message: 'Hisob vaqtincha bloklangan. Keyinroq urinib ko\'ring.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        user.loginAttempts += 1;
        if (user.loginAttempts >= 6) {
          user.lockUntil = Date.now() + 15 * 60 * 1000;
        }
        await user.save();
        return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Hisobingiz bloklangan' });
      }

      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLoginAt = new Date();
      await user.save();

      const token = signToken(user._id);
      sendTokenCookie(res, token);

      res.json({
        success: true,
        message: 'Muvaffaqiyatli kirdingiz',
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
        token,
      });
    } catch (err) {
      next(err);
    }
  }
);

// @route POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Chiqdingiz' });
});

// @route GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      bookmarks: req.user.bookmarks,
    },
  });
});

module.exports = router;
