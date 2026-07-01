require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const userRoutes = require('./routes/user');

const app = express();

connectDB();

// --- XAVFSIZLIK MIDDLEWARE ---
app.set('trust proxy', 1); // Render kabi reverse-proxy orqasida to'g'ri IP olish uchun

app.use(
  helmet({
    // Sayt o'zi boshqa saytlarni iframe'da ochadi -> frameguard'ni o'chiramiz,
    // lekin bizning saytimizni boshqalar iframe qilishini DENY qilamiz (clickjacking himoyasi)
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        // Katalogdagi saytlar HAR XIL domenlardan bo'lishi mumkin -> iframe manbasini cheklab bo'lmaydi,
        // shu sababli frame-src'ni https: bilan ochiq qoldiramiz (lekin sandbox atributi HTML tarafda qo'llanadi)
        frameSrc: ['https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // ba'zi tashqi saytlar bilan mos kelishi uchun
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' })); // katta body orqali DoS'ni cheklash
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize()); // NoSQL injection ($gt, $ne kabi operatorlarni req'dan tozalaydi
app.use(hpp()); // HTTP parametr ifloslanishidan himoya

// Umumiy API rate-limit (qo'shimcha, login uchun alohida qattiqrog'i mavjud)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Juda ko\'p so\'rov yuborildi, birozdan so\'ng qayta urinib ko\'ring' },
  })
);

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/user', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Ulemdo server ishlayapti', time: new Date().toISOString() });
});

// --- STATIK FRONTEND (bitta Render xizmatida frontend+backend birga bo'lsa) ---
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 - API uchun
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Bunday endpoint topilmadi' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Ulemdo server ${PORT}-portda ishga tushdi (${process.env.NODE_ENV || 'development'})`);
});
