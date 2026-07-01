# Ulemdo — mustaqil brauzer platformasi

Logotipingiz uslubida (to'q ko'k fon `#0f1729`, orange `#ff6b35`, oq aksent) qurilgan, o'z MongoDB bazasiga ega, admin panelli, xizmatlarni **iframe** ichida ochadigan mustaqil qidiruv-brauzer.

## Tuzilma

```
ulemdo/
├── server/              # Backend (Node.js + Express + MongoDB)
│   ├── config/          # DB ulanish, admin seed
│   ├── models/          # User, Site, SearchHistory (Mongoose)
│   ├── middleware/      # JWT auth, xato ushlash
│   ├── routes/          # /api/auth, /api/sites, /api/user
│   └── server.js
├── public/               # Frontend (vanilla HTML/CSS/JS)
│   ├── index.html        # Asosiy sahifa (qidiruv, katalog, iframe viewer)
│   ├── admin/             # Admin panel (saytlarni CRUD qilish)
│   ├── css/style.css
│   └── js/app.js
├── package.json
├── render.yaml
└── .env.example
```

## Xususiyatlar

- 🔍 **Qidiruv** — MongoDB text-index orqali saytlar katalogida qidiradi
- 🖼️ **Iframe viewer** — tanlangan xizmat sayt ichida (chrome-style toolbar: orqaga, yangilash, yangi oynada ochish) ochiladi
- 🔐 **Auth** — ro'yxatdan o'tish/login, parollar bcrypt bilan hash, JWT httpOnly cookie
- 🛡️ **Admin panel** — saytlarni qo'shish, tahrirlash, faollashtirish/o'chirish, butunlay o'chirish (faqat `role: admin`)
- ⭐ Bookmarklar, 🕓 qidiruv tarixi
- 📱 To'liq responsive (telefon/planshet/desktop)

## Xavfsizlik (purple-teaming asosida qurilgan)

| Xavf | Himoya |
|---|---|
| XSS | `xss` kutubxonasi bilan kirish ma'lumotlarini tozalash, CSP header, iframe `sandbox` atributi |
| NoSQL injection | `express-mongo-sanitize` — `$gt`, `$ne` kabi operatorlarni req'dan olib tashlaydi |
| Brute-force login | `express-rate-limit` (15 daqiqada 8 urinish) + hisobni vaqtincha bloklash (6 muvaffaqiyatsiz urinishdan keyin) |
| CSRF | httpOnly + `sameSite: lax` cookie, CORS `credentials` faqat belgilangan origin uchun |
| Clickjacking | `helmet` frameguard: DENY (bizning saytimiz boshqa joyda iframe qilinolmaydi) |
| Ochiq redirect / SSRF | Sayt qo'shishda faqat `https://` bilan boshlanuvchi URL qabul qilinadi |
| Parametr ifloslanishi | `hpp` middleware |
| Katta so'rovlar (DoS) | `express.json({ limit: '100kb' })` |
| Admin huquqi oshirilishi | Ro'yxatdan o'tishda rol har doim `user`; admin FAQAT seed skripti orqali (`npm run seed:admin`) yaratiladi |
| Parol saqlash | bcrypt, 12 round salt |

> **Eslatma:** iframe ichiga tashqi saytlarni to'liq "xavfsiz" qilib bo'lmaydi — ba'zi saytlar (masalan bank, ijtimoiy tarmoq) o'zlarining `X-Frame-Options`/`CSP: frame-ancestors` sozlamalari orqali iframe'da ochilishni bloklaydi. Bunday holatda tizim buni aniqlab, "Yangi oynada ochish" tugmasini ko'rsatadi. Admin panelda har bir sayt uchun `allowIframe: false` qilib, to'g'ridan-to'g'ri yangi oynada ochilishini oldindan belgilash mumkin.

## Lokal ishga tushirish

```bash
cd ulemdo
npm install
cp .env.example .env
# .env faylini MongoDB URI, JWT_SECRET va admin ma'lumotlari bilan to'ldiring

npm run seed:admin   # birinchi admin foydalanuvchini yaratadi
npm run dev           # http://localhost:5000
```

## MongoDB bazasini sozlash

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)da bepul cluster yarating (yoki lokal MongoDB o'rnating)
2. **Database Access**da user yarating, **Network Access**da `0.0.0.0/0` qo'shing (Render dinamik IP ishlatadi)
3. Connection stringni oling va `.env` dagi `MONGO_URI` ga qo'ying

## GitHub + Render'ga deploy qilish

1. Loyihani GitHub repo'siga yuklang:
   ```bash
   git init
   git add .
   git commit -m "Ulemdo - dastlabki versiya"
   git branch -M main
   git remote add origin https://github.com/<username>/ulemdo.git
   git push -u origin main
   ```
2. [Render.com](https://render.com) → **New +** → **Web Service** → GitHub repo'ni tanlang
3. Sozlamalar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment** bo'limida `.env.example`dagi barcha o'zgaruvchilarni qo'shing (`MONGO_URI`, `JWT_SECRET`, `COOKIE_SECRET`, `CLIENT_ORIGIN` — bu Render bergan URL, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
5. Deploy tugagach, Render **Shell** bo'limidan bir marta ishga tushiring:
   ```bash
   npm run seed:admin
   ```
6. Saytga kirib (`https://ulemdo.onrender.com`), admin email/parol bilan **Kirish** qiling — yuqori o'ng burchakda **⚙️ Admin** tugmasi chiqadi → `/admin/` sahifasidan saytlar qo'shing.

`render.yaml` fayli mavjud — Render'da "Blueprint" orqali ham avtomatik deploy qilish mumkin (Environment qiymatlarini `sync: false` bo'lgan joylarga qo'lda kiritasiz).

## Yangi xizmat (sayt) qo'shish

Admin panelda **+ Yangi sayt qo'shish**:
- **Nomi** — kartochkada ko'rinadi
- **URL** — `https://...` bilan boshlanishi shart
- **Kategoriya** — sidebar filteri avtomatik yangilanadi
- **Iframe'da ochilsinmi** — agar sayt iframe'ni bloklasa, "Yo'q" tanlang, u holda tugma bosilganda yangi oynada ochiladi

## Kengaytirish g'oyalari

- Har bir kategoriya uchun rang sxemasi
- PWA (offline, "Home screen"ga o'rnatish) qo'shish
- Foydalanuvchi profilida shaxsiy "tezkor bookmark" tartibini sudrab o'zgartirish
- Admin uchun statistik dashboard (eng ko'p qidirilgan so'zlar, eng ko'p bosilgan saytlar)
