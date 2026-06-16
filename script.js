// ==========================================
// CONFIG & CONFIGURATION
// ==========================================
const API_URL = "https://lemado-online-shop-render.onrender.com/api";

let currentUser = null;
let cart = [];
let currentPage = 'home';
let currentFilter = 'Barchasi';

let PRODUCTS = []; 
let STORES = [];   
let ORDERS = [];   

const blockedUsernames = new Set(['admin_fake', 'lemado_admin', 'root', 'system']);

// ==========================================
// KIBERXAVFSIZLIK & UTILS
// ==========================================
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"'/]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
  }[c]));
}

function validateUsername(u) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

function validatePassword(p) {
  return p.length >= 6;
}

function rateLimitCheck(action) {
  const key = 'rl_' + action;
  const now = Date.now();
  const attempts = JSON.parse(sessionStorage.getItem(key) || '[]').filter(t => now - t < 60000);
  if (attempts.length >= 5) return false;
  attempts.push(now);
  sessionStorage.setItem(key, JSON.stringify(attempts));
  return true;
}

// ==========================================
// SERVERDAN MA'LUMOTLARNI YUKLASH (FETCH)
// ==========================================
async function loadServerData() {
  try {
    const prodRes = await fetch(`${API_URL}/products`);
    const prodData = await prodRes.json();
    if (prodData.success) PRODUCTS = prodData.products;

    // Oddiy foydalanuvchilar uchun faqat tasdiqlangan do'konlar
    const storeRes = await fetch(`${API_URL}/stores`);
    const storeData = await storeRes.json();
    if (storeData.success) STORES = storeData.stores;

    filterCategory(currentFilter, document.querySelector('.chip.active'));
    renderStoresHome();
  } catch (err) {
    console.error("Serverdan ma'lumot yuklashda xatolik:", err);
    showToast("Ma'lumotlarni yuklashda xatolik yuz berdi!");
  }
}

// Admin hamma do'konlarni (tasdiqlanmaganlarini ham) ko'ra olishi uchun alohida funksiya
async function loadAllStoresForAdmin() {
  try {
    const storeRes = await fetch(`${API_URL}/stores?all=true`);
    const storeData = await storeRes.json();
    if (storeData.success) {
      STORES = storeData.stores;
      renderStoresTable();
    }
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// GLOBAL STATE (Tizimning umumiy holati)
// ==========================================
let currentUser = null; // Tizimga kirgan foydalanuvchi ma'lumotlarini saqlaydi

// ==========================================
// AUTHENTICATION (TIZIMGA KIRISH VA RO'YXATDAN O'TISH)
// ==========================================

async function login() {
  if (!rateLimitCheck('login')) { 
    showToast('⚠️ Juda ko\'p urinish. 1 daqiqa kuting.'); 
    return; 
  }
  
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-err');
  if (!usernameInput || !passwordInput || !errEl) return;

  // MUHIM: Login paytida ham username kichik harfga o'giriladi (toLowerCase)
  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  errEl.textContent = '';

  if (!username || !password) { 
    errEl.textContent = 'Username va parol kerak'; 
    return; 
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      // 💾 Brauzer xotirasiga saqlash (Sahifa yangilanganda saqlanib qolishi uchun)
      localStorage.setItem('lemado_user', JSON.stringify(data.user));
      
      // 🔄 Global holatni va Navbardagi UI elementlarini yangilash
      setCurrentUser(data.user);
      
      closeModal('login-modal');
      showToast('Xush kelibsiz, ' + sanitize(data.user.username) + '!');
      if (currentPage === 'my-store') renderMyStore();
    } else {
      errEl.textContent = data.message || "Xatolik yuz berdi";
    }
  } catch (err) {
    errEl.textContent = "Serverga ulanib bo'lmadi!";
  }
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const email = document.getElementById('reg-email').value.trim();
  const errEl = document.getElementById('reg-err');
  if (!errEl) return;
  errEl.textContent = '';

  if (!name || !username || !password || !email) { errEl.textContent = 'Barcha maydonlar to\'ldirilishi kerak'; return; }
  if (!validateUsername(username)) { errEl.textContent = 'Username: 3-20 harf, faqat a-z, 0-9, _'; return; }
  if (blockedUsernames.has(username)) { errEl.textContent = 'Bu username taqiqlangan'; return; }
  if (!validatePassword(password)) { errEl.textContent = 'Parol kamida 6 ta belgi'; return; }
  if (password !== password2) { errEl.textContent = 'Parollar mos emas'; return; }
  if (!/\S+@\S+\.\S+/.test(email)) { errEl.textContent = 'Email format noto\'g\'ri'; return; }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name, email })
    });

    const data = await response.json();

    if (data.success) {
      showToast(`🎉 Muvaffaqiyatli ro'yxatdan o'tdingiz! Endi tizimga kiring.`);
      switchAuthTab('login');
    } else {
      errEl.textContent = data.message;
    }
  } catch (err) {
    errEl.textContent = "Server ruxsat bermadi!";
  }
}

// ==========================================
// USER STATE & UI INTERACTION (MARKAZIY BOSHQARUV)
// ==========================================

function setCurrentUser(user) {
  currentUser = user; // Global o'zgaruvchini yangilaymiz

  // Navbardagi elementlarni ID orqali aniqlab olamiz
  const loginBtn = document.getElementById('auth-login-btn');
  const profileWrap = document.getElementById('user-profile-wrap');

  if (user) {
    // 🔓 FOYDALANUVCHI TIZIMGA KIRGANDA (Login muvaffaqiyatli bo'lsa)
    if (loginBtn) loginBtn.classList.add('hidden'); // Kirish tugmasini butunlay yashirish
    
    if (profileWrap) {
      profileWrap.classList.remove('hidden'); // Profil avatar konteynerini ko'rsatish
      
      // Avatarga foydalanuvchi ismining birinchi harfini katta qilib yozish
      const avatar = profileWrap.querySelector('.user-avatar');
      if (avatar) {
        const firstLetter = (user.name || user.username || 'L').charAt(0).toUpperCase();
        avatar.innerText = firstLetter;
      }

      // Agar foydalanuvchi roli admin bo'lsa, dropdown ichidagi Admin Panel tugmasini ko'rsatish
      const adminItem = profileWrap.querySelector('[onclick="openAdminPanel()"]');
      if (adminItem) {
        if (user.role === 'admin') {
          adminItem.classList.remove('hidden');
        } else {
          adminItem.classList.add('hidden');
        }
      }
    }
  } else {
    // 🔒 FOYDALANUVCHI TIZIMDAN CHIQGANDA (Logout bo'lsa yoki sessiya tugasa)
    if (loginBtn) loginBtn.classList.remove('hidden'); // Kirish tugmasini qaytarish
    if (profileWrap) {
      profileWrap.classList.add('hidden'); // Profil darchasini yashirish
      profileWrap.classList.remove('open'); // Ochiq qolgan dropdownni yopish
    }
  }
}

// 🚪 TIZIMDAN CHIQISH FUNKSIYASI
function logoutUser() {
  localStorage.removeItem('lemado_user'); // Brauzer xotirasini tozalaymiz
  setCurrentUser(null); // UI holatini boshlang'ich holatga qaytaramiz
  showToast('Tizimdan muvaffaqiyatli chiqdingiz.');
  if (typeof navigateTo === 'function') navigateTo('home'); // Bosh sahifaga qaytarish
}

// 👤 PROFIL AVATARI BOSILGANDA DROPDOWN MENYUNI OCHISH/YOPISH
function toggleDropdown(event) {
  if (event) event.stopPropagation(); // Klik oynaning boshqa qismlariga ta'sir qilmasligi uchun
  const profileWrap = document.getElementById('user-profile-wrap');
  if (profileWrap) {
    profileWrap.classList.toggle('open');
  }
}

// ==========================================
// AUTOMATIC SESSIONS & LISTENERS (YORDAMCHI KODLAR)
// ==========================================

// Sahifa yuklanayotganda ishga tushuvchi hodisalar
window.addEventListener('DOMContentLoaded', () => {
  // 1. Avvaldan saqlangan foydalanuvchi sessiyasi bormi yoki yo'qligini tekshirish (F5 bosilganda)
  const savedUser = localStorage.getItem('lemado_user');
  if (savedUser) {
    try {
      setCurrentUser(JSON.parse(savedUser));
    } catch (e) {
      localStorage.removeItem('lemado_user');
    }
  }

  // 2. Ekran bo'ylab ixtiyoriy joy bosilganda ochiq qolgan profil menyusini avtomat yopish
  window.addEventListener('click', () => {
    const profileWrap = document.getElementById('user-profile-wrap');
    if (profileWrap) {
      profileWrap.classList.remove('open');
    }
  });
});
// ==========================================
// PAGES & NAVIGATION
// ==========================================
function showPage(page) {
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('main-site').style.display = 'block';
  ['home', 'stores', 'orders', 'my-store'].forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  currentPage = page;
  if (page === 'stores') renderAllStores();
  if (page === 'orders') renderOrders();
  if (page === 'my-store') renderMyStore();
  window.scrollTo(0, 0);
  closeDropdown();
}

async function showAdmin(show = true) {
  if (show && (!currentUser || currentUser.role !== 'admin')) {
    openModal('login-modal');
    showToast('⚠️ Admin huquqi kerak');
    return;
  }
  document.getElementById('admin-panel').style.display = show ? 'block' : 'none';
  document.getElementById('main-site').style.display = show ? 'none' : 'block';
  if (show) {
    updateAdminStats();
    await loadAllStoresForAdmin(); // Admin kirganda barcha tasdiqlanmagan do'konlarni tortadi
    document.getElementById('admin-welcome').textContent = '👤 ' + currentUser.username;
  }
}

function exitAdmin() { showAdmin(false); showPage('home'); }

// ==========================================
// PRODUCTS LOGIC
// ==========================================
function renderProducts(prods) {
  const grid = document.getElementById('products-grid');
  if (!prods || !prods.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray-400)"><div style="font-size:48px">🔍</div><p style="margin-top:12px">Mahsulot topilmadi</p></div>';
    return;
  }
  grid.innerHTML = prods.map(p => {
    const pId = p._id || p.id;
    const storeObj = STORES.find(s => s._id === p.storeId || s.id === p.storeId);
    return `
      <div class="product-card" onclick="viewProduct('${pId}')">
        <div class="product-img">
          ${p.image ? `<img src="${sanitize(p.image)}" alt="${sanitize(p.name)}" onerror="this.parentElement.innerHTML='<span style=font-size:60px>${p.emoji || '📦'}</span>'">` : `<span style="font-size:60px">${p.emoji || '📦'}</span>`}
        </div>
        <div class="product-info">
          <div class="product-store">
            <span class="store-name">${sanitize(p.store || (storeObj ? storeObj.name : 'Lemado Do\'kon'))}</span>
            ${storeObj && storeObj.isVerified ? '<span class="verified-badge">✓</span>' : ''}
          </div>
          <div class="product-name">${sanitize(p.name)}</div>
          <div class="product-desc">${sanitize(p.description || '')}</div>
          <div class="product-footer">
            <div class="product-price">${p.price.toLocaleString()} so'm</div>
            <button class="add-cart" onclick="event.stopPropagation();addToCart('${pId}')">+ Savat</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterCategory(cat, el) {
  if (el) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }
  currentFilter = cat;
  const prods = cat === 'Barchasi' ? PRODUCTS : PRODUCTS.filter(p => p.category === cat);
  renderProducts(prods);
}

function searchProducts() {
  const q = document.getElementById('search-input').value.toLowerCase();
  if (!q) { filterCategory(currentFilter, null); return; }
  const prods = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  renderProducts(prods);
}

function viewProduct(id) {
  const p = PRODUCTS.find(x => x._id === id || x.id === id);
  if (!p) return;
  showToast(`📦 ${sanitize(p.name)} - ${p.price.toLocaleString()} so'm`);
}

// ==========================================
// STORES LOGIC
// ==========================================
function renderStoresHome() {
  const grid = document.getElementById('stores-grid-home');
  if (!grid) return;
  const verified = STORES.filter(s => s.isVerified).slice(0, 6);
  grid.innerHTML = verified.map(storeCard).join('');
}

function renderAllStores() {
  const grid = document.getElementById('all-stores-grid');
  if (!grid) return;
  grid.innerHTML = STORES.filter(s => s.isVerified).map(storeCard).join('');
}

function storeCard(s) {
  const sId = s._id || s.id;
  const prods = PRODUCTS.filter(p => p.storeId === sId);
  return `
    <div class="store-card" onclick="showToast('🏪 ${sanitize(s.name)} do\'koni')">
      <div class="store-header">
        <div class="store-logo">${s.logo ? `<img src="${sanitize(s.logo)}" onerror="this.parentElement.innerHTML='🏪'">` : '🏪'}</div>
        <div>
          <div class="store-title">${sanitize(s.name)}</div>
          <div class="store-cat">${sanitize(s.category)}</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--gray-600);margin-bottom:10px">${sanitize(s.description || '')}</div>
      ${s.isVerified ? '<div class="verified-store">✓ Rasmiy do\'kon</div>' : '<div style="font-size:12px;color:var(--gray-400)">⏳ Tekshirilmoqda</div>'}
      <div class="store-stats" style="margin-top:12px">
        <div class="stat"><div class="stat-val">${prods.length}</div><div class="stat-lbl">Mahsulot</div></div>
        <div class="stat"><div class="stat-val">4.9⭐</div><div class="stat-lbl">Reyting</div></div>
      </div>
    </div>
  `;
}

// ==========================================
// MY STORE MANAGEMENT (SOTUVCHILAR)
// ==========================================
function openStoreCreation() {
  if (!currentUser) { openModal('login-modal'); showToast('Avval kirish kerak'); return; }
  const existing = STORES.find(s => s.owner === currentUser.username);
  if (existing) { showPage('my-store'); return; }
  openModal('store-modal');
}

async function createStore() {
  if (!currentUser) return;
  const name = document.getElementById('store-name').value.trim();
  const category = document.getElementById('store-cat').value;
  const description = document.getElementById('store-desc').value.trim();
  const logo = document.getElementById('store-logo-url').value.trim();

  if (!name || !description) { showToast('⚠️ Barcha maydonlarni to\'ldiring'); return; }

  try {
    const response = await fetch(`${API_URL}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, owner: currentUser.username, description, category, logo })
    });
    const data = await response.json();
    if (data.success) {
      currentUser.role = 'seller';
      closeModal('store-modal');
      await loadServerData(); 
      showPage('my-store');
      showToast('🎉 Do\'kon yaratildi! Admin tasdiqlashini kuting.');
    } else {
      showToast('Xatolik: ' + data.message);
    }
  } catch (err) {
    showToast('Server xatoligi yuz berdi!');
  }
}

function renderMyStore() {
  const c = document.getElementById('my-store-content');
  if (!c) return;
  if (!currentUser) {
    c.innerHTML = '<div style="text-align:center;padding:60px"><p>Kirish kerak</p><button class="btn btn-red" style="margin-top:16px" onclick="openModal(\'login-modal\')">Kirish</button></div>';
    return;
  }
  const store = STORES.find(s => s.owner === currentUser.username);
  if (!store) {
    c.innerHTML = `<div style="text-align:center;padding:60px"><div style="font-size:48px">🏪</div><p style="margin:16px 0">Hali do'koningiz yo'q</p><button class="btn btn-red" onclick="openModal('store-modal')">Do'kon yaratish</button></div>`;
    return;
  }
  const storeId = store._id || store.id;
  const prods = PRODUCTS.filter(p => p.storeId === storeId);
  c.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px">
      <div style="width:70px;height:70px;border-radius:16px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:32px">
        ${store.logo ? `<img src="${sanitize(store.logo)}" style="width:70px;height:70px;border-radius:16px;object-fit:cover" onerror="this.parentElement.innerHTML='🏪'">` : '🏪'}
      </div>
      <div>
        <h2 style="font-size:24px;font-weight:800">${sanitize(store.name)}</h2>
        <div>${store.isVerified ? '<span class="verified-store">✓ Rasmiy do\'kon</span>' : '<span class="tag tag-orange">⏳ Tekshirilmoqda</span>'}</div>
      </div>
      <button class="btn btn-red" style="margin-left:auto" onclick="openModal('product-modal')">+ Mahsulot qo'shish</button>
    </div>
    <div class="section-title">Mahsulotlarim (${prods.length})</div>
    <div class="products-grid">
      ${prods.map(p => `
        <div class="product-card">
          <div class="product-img">${p.image ? `<img src="${sanitize(p.image)}" alt="${sanitize(p.name)}" onerror="this.parentElement.innerHTML='📦'">` : '📦'}</div>
          <div class="product-info">
            <div class="product-name">${sanitize(p.name)}</div>
            <div class="product-price">${p.price.toLocaleString()} so'm</div>
          </div>
        </div>`).join('') || '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">Hali mahsulot qo\'shilmagan</div>'}
    </div>
  `;
}

// MAHSULOTNI BAZAGA SAQLASH (YANGI FETCH)
async function addProduct() {
  if (!currentUser) return;
  const store = STORES.find(s => s.owner === currentUser.username);
  if (!store) { showToast('Avval do\'kon oching'); return; }

  const name = document.getElementById('prod-name').value.trim();
  const desc = document.getElementById('prod-desc').value.trim();
  const price = parseInt(document.getElementById('prod-price').value) || 0;
  const img = document.getElementById('prod-img').value.trim();
  const cat = document.getElementById('prod-cat').value;

  if (!name || !price) { showToast('⚠️ Nom va narx kiritilishi kerak'); return; }

  const np = {
    storeId: store._id || store.id,
    name: name,
    description: desc,
    price: price,
    image: img || 'https://via.placeholder.com/150',
    category: cat,
    store: store.name,
    emoji: '📦'
  };

  try {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(np)
    });
    const data = await res.json();
    if(data.success) {
      closeModal('product-modal');
      await loadServerData();
      renderMyStore();
      showToast('✅ Mahsulot muvaffaqiyatli qo\'shildi!');
    }
  } catch (err) {
    showToast('Xatolik yuz berdi.');
  }
}

// ==========================================
// CART & BASKET SYSTEM
// ==========================================
function addToCart(id) {
  const p = PRODUCTS.find(x => x._id === id || x.id === id);
  if (!p) return;
  const existing = cart.find(i => i._id === id || i.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...p, qty: 1 });
  updateCartUI();
  showToast('🛒 Savatchaga qo\'shildi: ' + sanitize(p.name));
}

function updateCartUI() {
  const count = cart.reduce((a, b) => a + b.qty, 0);
  document.getElementById('cart-count').textContent = count;
  const itemsEl = document.getElementById('cart-items');
  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);

  if (!cart.length) {
    itemsEl.innerHTML = '';
    document.getElementById('cart-empty').style.display = 'block';
    document.getElementById('cart-total-section').style.display = 'none';
    return;
  }
  document.getElementById('cart-empty').style.display = 'none';
  document.getElementById('cart-total-section').style.display = 'block';
  document.getElementById('cart-total-price').textContent = total.toLocaleString() + ' so\'m';
  
  itemsEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji || '📦'}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">${sanitize(item.name)}</div>
        <div style="color:var(--red);font-weight:700">${(item.price * item.qty).toLocaleString()} so'm</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="changeQty(${i},-1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--gray-300);background:white;cursor:pointer;font-weight:700">-</button>
        <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
        <button onclick="changeQty(${i},1)" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--red);color:white;cursor:pointer;font-weight:700">+</button>
        <button onclick="removeFromCart(${i})" style="background:var(--red-light);color:var(--red);border:none;padding:5px 9px;border-radius:8px;cursor:pointer;font-size:12px">✕</button>
      </div>
    </div>
  `).join('');
}

function changeQty(i, d) { if (cart[i]) { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); } updateCartUI(); }
function removeFromCart(i) { cart.splice(i, 1); updateCartUI(); }
function toggleCart() { document.getElementById('cart-sidebar').classList.toggle('open'); }

// BUYURTMANI MONGO-GA SAQLASH (YANGI FETCH)
async function checkout() {
  if (!currentUser) { toggleCart(); openModal('login-modal'); return; }
  if (!cart.length) return;
  
  const orderData = {
    orderId: 'ORD-' + Date.now(), 
    user: currentUser.username,
    items: [...cart], 
    total: cart.reduce((a, b) => a + b.price * b.qty, 0),
    date: new Date().toLocaleDateString('uz-UZ')
  };

  try {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const data = await res.json();
    if(data.success) {
      cart = []; 
      updateCartUI(); 
      toggleCart();
      await loadUserOrders();
      showToast('🎉 Buyurtma qabul qilindi va ma\'lumotlar bazasiga yozildi!');
    }
  } catch (err) {
    showToast('Buyurtmada xatolik yuz berdi.');
  }
}

async function loadUserOrders() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_URL}/orders/${currentUser.username}`);
    const data = await res.json();
    if (data.success) ORDERS = data.orders;
  } catch (err) {
    console.error(err);
  }
}

function renderOrders() {
  const el = document.getElementById('orders-list');
  if (!el) return;
  if (!currentUser) { el.innerHTML = '<div style="text-align:center;padding:40px"><button class="btn btn-red" onclick="openModal(\'login-modal\')">Kirish kerak</button></div>'; return; }
  if (!ORDERS.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)"><div style="font-size:48px">📦</div><p style="margin-top:12px">Hozircha buyurtma yo\'q</p></div>'; return; }
  el.innerHTML = ORDERS.map(o => `
    <div class="order-item">
      <div class="order-icon">📦</div>
      <div style="flex:1">
        <div style="font-weight:700">${sanitize(o.orderId)}</div>
        <div style="font-size:13px;color:var(--gray-500)">${o.items.length} mahsulot • ${o.date}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--red)">${o.total.toLocaleString()} so'm</div>
        <div><span class="tag tag-orange">${sanitize(o.status)}</span></div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// ADMIN CONTROL PANEL
// ==========================================
async function updateAdminStats() {
  try {
    const res = await fetch(`${API_URL}/admin/stats`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-users').textContent = data.stats.totalUsers;
      document.getElementById('stat-stores').textContent = data.stats.totalStores;
      document.getElementById('stat-products').textContent = data.stats.totalProducts;
      document.getElementById('stat-orders').textContent = data.stats.totalOrders;
    }
  } catch (err) {
    console.error("Admin statistikasi olishda muammo.");
  }
}

function showAdminTab(tab) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('admin-tab-' + tab);
  if (el) el.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  if (tab === 'users') renderUsersTable();
  if (tab === 'stores-admin') loadAllStoresForAdmin();
}

function renderUsersTable() {
  const t = document.getElementById('users-table');
  if (!t) return;
  t.innerHTML = `<tr><td><strong>${sanitize(currentUser.username)}</strong></td><td>Admin User</td><td>admin@lemado.uz</td><td><span class="tag tag-blue">admin</span></td><td><span class="tag tag-green">active</span></td><td><span style="color:var(--gray-400);font-size:12px">Boshqaruvchi</span></td></tr>`;
}

function renderStoresTable() {
  const t = document.getElementById('stores-table');
  if (!t) return;
  t.innerHTML = STORES.map(s => {
    const sId = s._id || s.id;
    return `<tr>
      <td><strong>${sanitize(s.name)}</strong></td>
      <td>${sanitize(s.owner)}</td>
      <td>${sanitize(s.category)}</td>
      <td><span class="tag ${s.isVerified ? 'tag-green' : 'tag-orange'}">${s.isVerified ? 'Faol' : 'Kutilmoqda'}</span></td>
      <td>
        ${!s.isVerified ? `<button class="action-btn approve" onclick="verifyStore('${sId}')">✓ Tasdiqlash</button>` : '<span style="font-size:12px;color:var(--gray-500)">Tasdiqlangan</span>'}
      </td>
    </tr>`;
  }).join('');
}

async function verifyStore(id) {
  try {
    const res = await fetch(`${API_URL}/admin/stores/${id}/verify`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast('✓ Do\'kon muvaffaqiyatli tasdiqlandi!');
      await loadServerData();
      await loadAllStoresForAdmin();
      await updateAdminStats();
    }
  } catch (err) {
    showToast('Do\'konni tasdiqlashda xatolik yuz berdi.');
  }
}

// ==========================================
// BACKGROUND MUSIC PLAYER
// ==========================================
const bgMusic = document.getElementById('bg-music');
let musicPlaying = false;
function toggleMusic() {
  if (!bgMusic) return;
  if (musicPlaying) { bgMusic.pause(); document.getElementById('play-btn').textContent = '▶'; musicPlaying = false; }
  else { bgMusic.play().catch(() => {}); document.getElementById('play-btn').textContent = '⏸'; musicPlaying = true; }
}
function closeMusicPlayer() { document.getElementById('music-player').style.display = 'none'; }
if(document.getElementById('music-volume')) {
  document.getElementById('music-volume').addEventListener('input', e => { if(bgMusic) bgMusic.volume = parseFloat(e.target.value); });
}

// ==========================================
// INTERFACE MODALS & TOAST UTILS
// ==========================================
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));
function toggleDropdown() { document.getElementById('dropdown-menu').parentElement.classList.toggle('open'); }
function closeDropdown() { document.querySelector('.dropdown') && document.querySelector('.dropdown').classList.remove('open'); }
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) closeDropdown(); });
function showToast(msg, dur = 2500) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), dur); }

// ==========================================
// INITIALIZATION ON PAGE LOAD
// ==========================================
window.addEventListener('load', () => {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) {
      ls.style.opacity = '0';
      setTimeout(() => { ls.style.display = 'none'; }, 600);
    }
  }, 2200);

  loadServerData();
});
// Sahifa har safar yuklanganda brauzer xotirasini tekshiramiz
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('lemado_session');
  
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      // Xotirada foydalanuvchi topilsa, uni qaytadan aktivlashtiramiz
      setCurrentUser(user);
    } catch (e) {
      console.error("Sessiyani yuklashda xatolik:", e);
      localStorage.removeItem('lemado_session');
    }
  }
});
