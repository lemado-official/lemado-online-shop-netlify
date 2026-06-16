const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(cors()); 
app.use(express.json()); 

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
  password: { type: String, required: true }, 
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, default: 'user' }, // user, seller, admin
  status: { type: String, default: 'active' }, 
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 2. Do'konlar (Stores)
const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: String, required: true }, 
  description: String,
  category: { type: String, required: true },
  logo: { type: String, default: '' },
  isVerified: { type: Boolean, default: false }, 
  createdAt: { type: Date, default: Date.now }
});
const Store = mongoose.model('Store', storeSchema);

// 3. Mahsulotlar (Products)
const productSchema = new mongoose.Schema({
  storeId: { type: String, required: true }, // Moslashuvchanlik uchun String qilindi
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  image: { type: String, default: 'https://via.placeholder.com/150' },
  category: { type: String, required: true },
  store: String,
  emoji: { type: String, default: '📦' },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// 4. Buyurtmalar (Orders)
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  user: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  status: { type: String, default: 'Kutilmoqda' },
  date: { type: String, required: true }
});
const Order = mongoose.model('Order', orderSchema);

// ==========================================
// API ENDPOINTS (YO'NALIShLAR)
// ==========================================

// --- AUTHENTICATION ---

// Ro'yxatdan o'tish
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name || !email) {
      return res.status(400).json({ success: false, message: "Barcha maydonlar to'ldirilishi shart!" });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Bu username allaqachon band!" });
    }
    const newUser = new User({ username, password, name, email });
    await newUser.save();
    res.status(201).json({ success: true, message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
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
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- STORES MANAGEMENT ---

// Do'konlarni olish (Query orqali filtrlash: Admin ham, foydalanuvchi ham bitta joydan oladi)
app.get('/api/stores', async (req, res) => {
  try {
    const { all } = req.query;
    // Agar all=true bo'lsa hamma do'konni beradi (Admin uchun), aks holda faqat tasdiqlanganlarni
    let filter = all === 'true' ? {} : { isVerified: true };
    const stores = await Store.find(filter);
    res.status(200).json({ success: true, stores });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yangi do'kon ochish
app.post('/api/stores', async (req, res) => {
  try {
    const { name, owner, description, category, logo } = req.body;
    const newStore = new Store({ name, owner, description, category, logo });
    await newStore.save();
    // Foydalanuvchi rolini avtomat yangilash
    await User.findOneAndUpdate({ username: owner }, { role: 'seller' });
    res.status(201).json({ success: true, message: "Do'kon yaratildi!", store: newStore });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- PRODUCTS MANAGEMENT ---

// Barcha mahsulotlarni olish
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yangi mahsulot qo'shish (Real MongoDB saqlash)
app.post('/api/products', async (req, res) => {
  try {
    const { storeId, name, price, description, image, category, store, emoji } = req.body;
    const newProduct = new Product({ storeId, name, price, description, image, category, store, emoji });
    await newProduct.save();
    res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ORDERS MANAGEMENT ---

// Buyurtmalarni olish
app.get('/api/orders/:username', async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.username });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Buyurtma yaratish
app.post('/api/orders', async (req, res) => {
  try {
    const { orderId, user, items, total, date } = req.body;
    const newOrder = new Order({ orderId, user, items, total, date });
    await newOrder.save();
    res.status(201).json({ success: true, order: newOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ADMIN PANEL CONTROL ---

app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStores = await Store.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    res.status(200).json({
      success: true,
      stats: { totalUsers, totalStores, totalProducts, totalOrders }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/admin/stores/:id/verify', async (req, res) => {
  try {
    await Store.findByIdAndUpdate(req.params.id, { isVerified: true });
    res.status(200).json({ success: true, message: "Do'kon rasman tasdiqlandi!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// router.delete o'rniga app.delete yoziladi:
app.delete('/api/admin/stores/:id', async (req, res) => {
  try {
    const storeId = req.params.id;

    // MongoDB dan do'konni o'chirish
    const deletedStore = await Store.findByIdAndDelete(storeId);

    if (!deletedStore) {
      return res.status(404).json({ success: false, message: "Do'kon topilmadi" });
    }

    res.json({ success: true, message: "Do'kon muvaffaqiyatli o'chirildi" });
  } catch (error) {
    console.error("O'chirishda xatolik:", error);
    res.status(500).json({ success: false, message: "Serverda xatolik yuz berdi" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda gupirib ishlayapti...`));
