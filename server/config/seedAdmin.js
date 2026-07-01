// Ishlatish: npm run seed:admin
// .env faylidagi ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_USERNAME asosida
// birinchi admin foydalanuvchini yaratadi (agar mavjud bo'lmasa).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const User = require('../models/User');

(async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';

  if (!email || !password) {
    console.error('❌ .env faylida ADMIN_EMAIL va ADMIN_PASSWORD ko\'rsating');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
    console.log(`✅ Mavjud foydalanuvchi (${email}) admin qilib belgilandi`);
  } else {
    await User.create({ username, email, password, role: 'admin' });
    console.log(`✅ Yangi admin yaratildi: ${email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
})();
