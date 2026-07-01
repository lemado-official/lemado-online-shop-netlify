const mongoose = require('mongoose');

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Zamonaviy mongoose 8 uchun qo'shimcha optionlar shart emas,
      // lekin xavfsizlik va barqarorlik uchun quyidagilarni belgilaymiz
      autoIndex: process.env.NODE_ENV !== 'production',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB ulandi: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB ulanishda xatolik:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
