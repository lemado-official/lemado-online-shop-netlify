const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==========================================
// MIDDLEWARES (Xavfsizlik va Ma'lumotlar oqimi)
// ==========================================
app.use(cors()); // Turli domenlardan keladigan so'rovlarni ruxsat etish (CORS)
app.use(express.json()); // Kelayotgan JSON so'rovlarini o'qish

// ==========================================
// MONGODB ATLAS-GA ULANISH
// ==========================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🔥 Lemado DB: MongoDB Atlas-ga muvaffaqiyatli ulandi!'))
  .catch(err => console.error('❌ Baza ulanishida jiddiy xatolik:', err));

// ==========================================
// MA'LUMOTLAR MODELI (SCHEMAS)
// ==========================================

// 1. Foydalanuvchilar (Users)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Prototip uchun plaintext (Keyinchalik bcrypt tavsiya etiladi)
  role: { type: String, default: 'user' }, // user, seller, admin
  status: { type: String, default: 'active' }, // active, temp_block, blocked
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 2. Do'konlar (Stores)
const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: String, required: true }, // Do'kon egasining username'i
  description: String,
  category: { type: String, required: true },
  isVerified: { type: Boolean, default: false }, // Admin tomonidan tasdiqlanish holati
  createdAt: { type: Date, default: Date.now }
});
const Store = mongoose.model('Store', storeSchema);

// 3. Mahsulotlar (Products)
const productSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  image: { type: String, default: 'https://via.placeholder.com/150' },
  category: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);


// ==========================================
// API ENDPOINTS (YO'NALIShLAR)
// ==========================================

// --- AUTHENTICATION (Tizimga kirish va ro'yxatdan o'tish) ---

// [POST] Ro'yxatdan o'tish
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Kiberxavfsizlik testi: inputlarni tekshirish
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Maydonlar bo'sh bo'lishi mumkin emas!" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Bu username allaqachon band!" });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.status(201).json({ success: true, message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// [POST] Login (Tizimga kirish)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(400).json({ success: false, message: "Username yoki parol noto'g'ri!" });
    }

    if (user.status === 'blocked' || user.status === 'temp_block') {
      return res.status(403).json({ success: false, message: "Sizning profilingiz bloklangan!" });
    }

    res.status(200).json({
      success: true,
      message: "Xush kelibsiz!",
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- STORES MANAGEMENT (Do'konlar boshqaruvi) ---

// [GET] Barcha tasdiqlangan do'konlarni olish (Bosh sahifa uchun)
app.get('/api/stores', async (req, res) => {
  try {
    const stores = await Store.find({ isVerified: true });
    res.status(200).json({ success: true, stores });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// [POST] Yangi do'kon ochish
app.post('/api/stores', async (req, res) => {
  try {
    const { name, owner, description, category } = req.body;
    
    const newStore = new Store({ name, owner, description, category });
    await newStore.save();

    res.status(201).json({ success: true, message: "Do'kon yaratildi, admin tasdig'i kutilmoqda!", store: newStore });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- PRODUCTS MANAGEMENT (Mahsulotlar boshqaruvi) ---

// [GET] Barcha mahsulotlarni olish (Kategoriyalar bo'yicha filter bilan)
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    let filter = {};
    if (category && category !== 'Barchasi') {
      filter.category = category;
    }
    const products = await Product.find(filter);
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- ADMIN PANEL API (Faqat Admin boshqaruvi uchun) ---

// [GET] Admin Dashboard statistikasi
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStores = await Store.countDocuments();
    const totalProducts = await Product.countDocuments();

    res.status(200).json({
      success: true,
      stats: { totalUsers, totalStores, totalProducts, totalOrders: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// [PUT] Foydalanuvchi statusini o'zgartirish (Bloklash/O'chirish)
app.put('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // active, blocked va h.k.
    await User.findByIdAndUpdate(req.params.id, { status });
    res.status(200).json({ success: true, message: `Foydalanuvchi statusi '${status}' ga o'zgartirildi.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// [PUT] Do'konni rasmiy deb tasdiqlash (Verify Store)
app.put('/api/admin/stores/:id/verify', async (req, res) => {
  try {
    await Store.findByIdAndUpdate(req.params.id, { isVerified: true });
    res.status(200).json({ success: true, message: "Do'kon rasman tasdiqlandi!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==========================================
// PORT SOZLAMASI VA SERVERNI IShGA TUShIRISH
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Lemado Backend ${PORT}-portda muvaffaqiyatli ishlamoqda...`);
});
