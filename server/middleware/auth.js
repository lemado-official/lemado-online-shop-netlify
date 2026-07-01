const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Cookie yoki Authorization header'dan tokenni o'qiydi
function extractToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
}

exports.protect = async function (req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Tizimga kirish talab qilinadi' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Foydalanuvchi topilmadi yoki bloklangan' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token yaroqsiz yoki muddati tugagan' });
  }
};

// Faqat admin uchun ruxsat
exports.adminOnly = function (req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bu amal uchun admin huquqi kerak' });
  }
  next();
};

// Token bo'lsa userni req'ga qo'shadi, bo'lmasa ham davom etadi (public+optional auth sahifalar uchun)
exports.optionalAuth = async function (req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
    next();
  } catch {
    next();
  }
};
