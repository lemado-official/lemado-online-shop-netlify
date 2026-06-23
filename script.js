// ==========================================
// CONFIG & GLOBAL STATE INITIALIZATION
// ==========================================
const API_URL = "https://lemado-online-shop-render.onrender.com/api";

let PRODUCTS = []; 
let STORES = [];   
let ORDERS = [];   
let currentUser = null; // Markaziy yagona foydalanuvchi o'zgaruvchisi
let currentPage = 'home';
let cart = [];
let isServerSleeping = false;

// Tizim holatini tekshirish funksiyasi (Faqat yagona lemado_user kalitidan foydalanamiz)
function initializeProfile() {
    const savedData = localStorage.getItem('lemado_user');
    if (savedData && savedData !== "undefined") {
        try {
            currentUser = JSON.parse(savedData);
            window.currentUser = currentUser; // Har ikkala holat uchun ham osonlik yaratamiz
            console.log("Profil muvaffaqiyatli yuklandi:", currentUser.username);
        } catch (e) {
            console.error("Xotiradagi ma'lumot buzilgan, tozalanmoqda...");
            localStorage.removeItem('lemado_user');
            currentUser = null;
            window.currentUser = null;
        }
    } else {
        currentUser = null;
        window.currentUser = null;
        console.log("Foydalanuvchi tizimga kirmagan (Mehmon).");
    }
}

// Sahifa yuklanishni boshlaganda darhol profillarni tekshiramiz
initializeProfile();

// HTML elementlar tayyor bo'lgach UI dizaynini yangilash
window.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        setCurrentUser(currentUser); // Navbardagi profil rasmi va menyuni to'g'rilaydi
    }
});


// UNIVERSAL YUKLASH TIZIMI (Faqat bitta bo'lishi shart!)
async function loadServerData() {
    const tagline = document.querySelector('.tagline');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 soniya kutish

        // Mahsulotlar va do'konlarni parallel ravishda tortib kelamiz
        const [productsResponse, storesResponse] = await Promise.all([
            fetch(`${API_URL}/products`, { signal: controller.signal }),
            fetch(`${API_URL}/stores`, { signal: controller.signal }).catch(err => {
                console.warn("Do'konlarni yuklashda xatolik:", err);
                return null;
            })
        ]);

        clearTimeout(timeoutId);

        // 1. Mahsulotlarni yozib olamiz
        if (productsResponse && productsResponse.ok) {
            const prodData = await productsResponse.json();
            PRODUCTS = prodData.products || prodData;
        }

        // 2. Do'konlarni yozib olamiz
        if (storesResponse && storesResponse.ok) {
            const storeData = await storesResponse.json();
            STORES = storeData.stores || storeData;
            console.log("Do'konlar va Mahsulotlar muvaffaqiyatli yuklandi!", STORES);
        }
        
        // 3. Mahsulotlar va Do'konlarni ekranga chizish buyruqlari
        if (typeof renderProducts === 'function') {
            renderProducts(); // Mahsulotlar mavjud bo'lsa chiziladi
        }
        
        // 🔥 MANA SHU YERDA YANGI FUNKSIYANI XAVFSIZ CHAQIRAMIZ:
        if (typeof renderStoresHome === 'function') {
            renderStoresHome(); 
        } else {
            console.error("⚠️ Diqqat: 'renderStoresHome' funksiyasi script.js ichida topilmadi!");
        }
        
        // 4. Ma'lumotlar kelganidan keyin UI tugmalarni yangilaymiz
        updateMainStoreButtonUI();
        
        if (tagline) tagline.innerText = "Xush kelibsiz!";
        return true;
    } catch (error) {
        console.warn("Server xatosi yoki vaqt tugadi:", error.message);
        if (tagline) tagline.innerText = "Server uyg'onmoqda, ozgina kuting...";
        
        // Server uxlab yotgan bo'lsa ham foydalanuvchiga bo'sh konteynerlarni ko'rsatish
        if (typeof renderStoresHome === 'function') renderStoresHome();
        
        updateMainStoreButtonUI();
        return false;
    }
}

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



// loadServerData() ichida yoki undan keyin:
if (isServerSleeping) {
    document.querySelector('.tagline').innerText = "Server uyg'onmoqda, ozgina kuting...";
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

// Admin uchun barcha mahsulotlarni yuklash
async function loadAllProductsForAdmin() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const data = await res.json();
    
    // Agar success: true kelsa, render qilsin
    if (data.success) {
      renderAdminProductsTable(data.products);
    }
  } catch (err) {
    console.error("Xatolik:", err);
  }
}

 // 1. Asosiy funksiya: Serverdan ma'lumotlarni yuklash
async function loadAdminData() {
    const loader = document.getElementById('loading-screen');
    try {
        console.log("Ma'lumotlar yuklanyapti...");
        
        const res = await fetch(`${API_URL}/products`);
        const data = await res.json();

        // 2. Ma'lumotlarni saralash (turli formatlar uchun)
        let productsList = [];
        if (data.success && data.products) productsList = data.products;
        else if (Array.isArray(data)) productsList = data;
        else if (data.data) productsList = data.data;

        // 3. Jadvalni chizish
        renderAdminProductsTable(productsList);

    } catch (err) {
        console.error("Mahsulotlarni yuklashda xatolik:", err);
        renderAdminProductsTable([]); // Xatolik bo'lsa bo'sh jadval
    } finally {
        // LOADING NI YOPISH (Har qanday holatda ishlaydi)
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }
}

// 4. Sahifa yuklanganda ishga tushirish
window.addEventListener('load', () => {
    loadAdminData();
});
// ==========================================
// GLOBAL STATE (Tizimning umumiy holati)
// ==========================================


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
    await loadAllStoresForAdmin();
    await loadAllUsersForAdmin();
    await loadAllProductsForAdmin(); // 👈 BU QATOR QO'SHILGAN BO'LISHI KERAK
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
// =======================================================
// 🏪 DO'KONLARNI FILTRLASH VA EKRAUGA CHIZISH TIZIMI
// =======================================================

// =======================================================
// 🏪 DO'KONLARNI FILTRLASH VA EKRAUGA CHIZISH TIZIMI (TOZA VARIANT)
// =======================================================
function renderStoresHome() {
    const officialGrid = document.getElementById('stores-grid-home');
    if (!officialGrid) {
        console.log("⚠️ 'stores-grid-home' elementi sahifada topilmadi!");
        return;
    }

    console.log("Do'konlarni chizish boshlandi. Jami do'konlar soni:", STORES.length);

    // 1. Faqat admin tomonidan tasdiqlangan do'konlar (isVerified === true)
    const verifiedStores = STORES.filter(s => s.isVerified === true);

    // Rasmiy do'konlar qismini chizamiz
    if (verifiedStores.length === 0) {
        officialGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--gray-500); padding: 24px; font-size: 14px; background: var(--gray-50); border-radius: var(--radius); border: 1px dashed var(--gray-300);">
                🔒 Hozircha rasmiy tasdiqlangan do'konlar mavjud emas. Admin tekshiruvidan so'ng shu yerda e'lon qilinadi.
            </div>`;
    } else {
        officialGrid.innerHTML = verifiedStores.map(s => createStoreCardHTML(s, true)).join('');
    }

    // 2. YANGI BO'LIM: "Yangi va Faol Do'konlar" (Hamma yangi ochilgan do'konlar chiqadigan joy)
    let allStoresSection = document.getElementById('all-stores-section-wrapper');
    
    // Agar HTML ichida bu yangi bo'lim hali mavjud bo'lmasa, uni dinamik ravishda yaratamiz
    if (!allStoresSection) {
        const officialSection = officialGrid.closest('.section');
        if (officialSection) {
            allStoresSection = document.createElement('div');
            allStoresSection.id = 'all-stores-section-wrapper';
            allStoresSection.className = 'section';
            allStoresSection.innerHTML = `
                <div class="section-title" style="margin-top: 40px; font-size: 20px; font-weight: 800;">Yangi va Faol Do'konlar 🛍️</div>
                <div class="stores-grid" id="stores-grid-all" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 16px;"></div>
            `;
            // Rasmiy do'konlar bo'limining aynan tagidan joylashtiramiz
            officialSection.parentNode.insertBefore(allStoresSection, officialSection.nextSibling);
        }
    }

    // Yangi ochilgan barcha do'konlar gridini to'ldiramiz
    const allGrid = document.getElementById('stores-grid-all');
    if (allGrid) {
        if (STORES.length === 0) {
            allGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--gray-400); padding: 20px;">
                    Hozircha platformada birorta ham do'kon ochilmagan.
                </div>`;
        } else {
            // Ushbu bo'limda hamma do'konlar teng ko'rinadi
            allGrid.innerHTML = STORES.map(s => createStoreCardHTML(s, s.isVerified)).join('');
        }
    }
}

// Do'kon kartochkalarining HTML shabloni (Xatoliksiz toza versiya)
function createStoreCardHTML(s, isOfficial) {
    const storeId = s._id || s.id;
    const fallbackLogo = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--gray-100); font-size:28px;">🏪</div>`;
    const sName = s.name || "Nomsiz do'kon";
    const sCategory = s.category || "Umumiy do'kon";

    return `
        <div class="store-card" onclick="handleStoreClick('${storeId}')" style="cursor:pointer; background:var(--white); border-radius:var(--radius); padding:16px; box-shadow:var(--shadow); transition:var(--transition); display:flex; align-items:center; gap:16px; border:1px solid var(--gray-100);">
            <div style="width:60px; height:60px; border-radius:12px; overflow:hidden; background:var(--gray-50); flex-shrink:0; display:flex; align-items:center; justify-content:center; border: 1px solid var(--gray-200);">
                ${s.logo ? `<img src="${s.logo}" alt="${sName}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='🏪'">` : fallbackLogo}
            </div>
            <div style="flex-grow:1; min-width:0;">
                <h4 style="margin:0 0 4px 0; font-size:16px; font-weight:700; color:var(--gray-900); display:flex; align-items:center; gap:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${sName} 
                    ${isOfficial ? '<span title="Rasmiy Tasdiqlangan Do\'kon" style="color:#28a745; font-size:14px; font-weight:bold;">✓</span>' : ''}
                </h4>
                <p style="margin:0; font-size:13px; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${sCategory}
                </p>
            </div>
        </div>
    `;
}

function handleStoreClick(storeId) {
    showToast("Do'kon ID: " + storeId);
}



// Do'kon kartochkalarining HTML shabloni (Chiroyli premium dizayn)
function createStoreCardHTML(s, isOfficial) {
    const storeId = s._id || s.id;
    const fallbackLogo = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--gray-100); font-size:28px;">🏪</div>`;
    
    return `
        <div class="store-card" onclick="handleStoreClick('${storeId}')" style="cursor:pointer; background:var(--white); border-radius:var(--radius); padding:16px; box-shadow:var(--shadow); transition:var(--transition); display:flex; align-items:center; gap:16px; border:1px solid var(--gray-100);">
            <div style="width:60px; height:60px; border-radius:12px; overflow:hidden; background:var(--gray-50); flex-shrink:0; display:flex; align-items:center; justify-content:center; border: 1px solid var(--gray-200);">
                ${s.logo ? `<img src="${sanitize(s.logo)}" alt="${sanitize(s.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='🏪'">` : fallbackLogo}
            </div>
            <div style="flex-grow:1; min-width:0;">
                <h4 style="margin:0 0 4px 0; font-size:16px; font-weight:700; color:var(--gray-900); display:flex; align-items:center; gap:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${sanitize(s.name)} 
                    ${isOfficial ? '<span title="Rasmiy Tasdiqlangan Do\'kon" style="color:#28a745; font-size:14px; font-weight:bold;">✓</span>' : ''}
                </h4>
                <p style="margin:0; font-size:13px; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${sanitize(s.category || "Umumiy do'kon")}
                </p>
            </div>
        </div>
    `;
}

// Do'kon kartochkasi bosilganda do'kon sahifasini ochish mantiqi
function handleStoreClick(storeId) {
    const store = STORES.find(s => (s._id || s.id) === storeId);
    if (!store) return;
    
    showToast(`🏪 ${store.name} do'koniga xush kelibsiz!`);
    
    // Kelajakda do'kon ichiga kirganda uning mahsulotlarini ko'rsatish uchun:
    // currentStoreId = storeId;
    // showPage('store-detail'); 
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
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
      <div style="width:70px;height:70px;border-radius:16px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:32px">
        ${store.logo ? `<img src="${sanitize(store.logo)}" style="width:70px;height:70px;border-radius:16px;object-fit:cover" onerror="this.parentElement.innerHTML='🏪'">` : '🏪'}
      </div>
      <div>
        <h2 style="font-size:24px;font-weight:800">${sanitize(store.name)}</h2>
        <div>${store.isVerified ? '<span class="verified-store">✓ Rasmiy do\'kon (Siz Super Admisiz)</span>' : '<span class="tag tag-orange">⏳ Tekshirilmoqda</span>'}</div>
      </div>
      <div style="margin-left:auto; display:flex; gap:10px;">
        <button class="btn" style="background:#ff9800; color:white;" onclick="openEditStoreModal('${storeId}')">⚙️ Do'konni tahrirlash</button>
        <button class="btn btn-red" onclick="openModal('product-modal')">+ Mahsulot qo'shish</button>
      </div>
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

// Vaqtincha tahrirlash oynasi funksiyasi
function openEditStoreModal(storeId) {
    showToast("Do'kon tahrirlash funksiyasi yaqin orada ishga tushadi!");
    // Bu yerda tahrirlash modalini ochish kodingizni yozishingiz mumkin
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
  
  // 🛡️ Xavfsiz tekshiruv: agar HTML da element bo'lsa, keyin yozadi
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) {
    cartCountEl.textContent = count;
  }

  const itemsEl = document.getElementById('cart-items');
  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);

  // Qolgan kodlar o'zgarishsiz qoladi...
  if (!cart.length) {
    if (itemsEl) itemsEl.innerHTML = '';
    if (document.getElementById('cart-empty')) document.getElementById('cart-empty').style.display = 'block';
    if (document.getElementById('cart-total-section')) document.getElementById('cart-total-section').style.display = 'none';
    return;
  }
  
  if (document.getElementById('cart-empty')) document.getElementById('cart-empty').style.display = 'none';
  if (document.getElementById('cart-total-section')) document.getElementById('cart-total-section').style.display = 'block';
  if (document.getElementById('cart-total-price')) document.getElementById('cart-total-price').textContent = total.toLocaleString() + ' so\'m';
  
  if (itemsEl) {
    itemsEl.innerHTML = cart.map((item, i) => `
      <div class="cart-item">
        <div class="cart-item-img">${item.emoji || '📦'}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">${sanitize(item.name)}</div>
          <div style="color:var(--red);font-weight:700">${(item.price * item.qty).toLocaleString()} so'm</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="changeQty(${i},-1)" class="qty-btn">-</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${i},1)" class="qty-btn">+</button>
        </div>
      </div>
    `).join('');
  }
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
  
  // HTMLdagi IDlar bilan moslash
  const el = document.getElementById('admin-tab-' + tab);
  if (el) el.classList.add('active');
  
  // Tabni faollashtirish
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  
  // Ma'lumotlarni yuklash
  if (tab === 'users') loadAllUsersForAdmin(); 
  if (tab === 'stores-admin') loadAllStoresForAdmin();
  if (tab === 'products-admin') loadAllProductsForAdmin(); 
}

// Admin uchun barcha foydalanuvchilarni bazadan yuklash
async function loadAllUsersForAdmin() {
  try {
    const res = await fetch(`${API_URL}/users`);
    
    // Serverdan HTML xatolik kelsa, JSON parse xatosi bermasligi uchun tekshiramiz
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Backenddan xato keldi:", errorText);
      renderUsersTable([]); // Xato bo'lsa bo'sh jadval yoki faqat adminni chiqaradi
      return;
    }

    const data = await res.json();
    
    let usersList = [];
    if (data.success && data.users) usersList = data.users;
    else if (Array.isArray(data)) usersList = data;
    else if (data.data) usersList = data.data;

    renderUsersTable(usersList);
  } catch (err) {
    console.error("Foydalanuvchilarni yuklashda xatolik:", err);
    renderUsersTable([]);
  }
}



function renderUsersTable(users) {
  const t = document.getElementById('users-table');
  if (!t) return;

  // Har doim joriy admin qatorini boshiga qo'shamiz
  let html = `<tr>
    <td><strong>${sanitize(currentUser.username)} (Siz)</strong></td>
    <td>Admin User</td>
    <td>admin@lemado.uz</td>
    <td><span class="tag tag-blue">admin</span></td>
    <td><span class="tag tag-green">active</span></td>
    <td><span style="color:var(--gray-400);font-size:12px">Boshqaruvchi</span></td>
  </tr>`;

  let isServerSleeping = false; // Boshlang'ich holat
  // Qolgan bazadan kelgan userlarni massiv bo'yicha aylantiramiz
  if (users && users.length > 0) {
    users.forEach(u => {
      // O'zimizni takroran chiqarmaslik uchun tekshiramiz
      if (u.username !== currentUser.username) {
        html += `<tr>
          <td><strong>${sanitize(u.username)}</strong></td>
          <td>${sanitize(u.name || u.firstName || '-')}</td>
          <td>${sanitize(u.email || '-')}</td>
          <td><span class="tag ${u.role === 'admin' ? 'tag-blue' : 'tag-orange'}">${u.role || 'user'}</span></td>
          <td><span class="tag tag-green">${u.status || 'active'}</span></td>
          <td>
            <span style="color:var(--gray-400); font-size:12px;">Ruxsat etilgan</span>
          </td>
        </tr>`;
      }
    });
  }
  
  t.innerHTML = html;
}

function renderStoresTable() {
  const t = document.getElementById('stores-table');
  if (!t) return;
  
  if (!STORES || STORES.length === 0) {
    t.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-400)">Hozircha do'konlar mavjud emas</td></tr>`;
    return;
  }

  t.innerHTML = STORES.map(s => {
    const sId = s._id || s.id;
    return `<tr>
      <td><strong>${sanitize(s.name)}</strong></td>
      <td>${sanitize(s.owner || 'Noma\'lum')}</td>
      <td>${sanitize(s.category || 'Umumiy')}</td>
      <td><span class="tag ${s.isVerified ? 'tag-green' : 'tag-orange'}">${s.isVerified ? 'Faol' : 'Kutilmoqda'}</span></td>
      <td>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${!s.isVerified ? `
            <button class="action-btn approve" style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;" onclick="verifyStore('${sId}')">✓ Tasdiqlash</button>
            <button class="action-btn reject" style="background:var(--red); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;" onclick="rejectStore('${sId}')">✕ Rad etish</button>
          ` : `
            <span style="font-size:12px;color:var(--gray-500); padding: 6px 0;">Tasdiqlangan</span>
            <button class="action-btn reject" style="background:var(--red-light); color:var(--red); border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; margin-left:10px;" onclick="rejectStore('${sId}')">O'chirish</button>
          `}
        </div>
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
      
      // SHU QATOR QO'SHILDI: Tugma holatini yangilash
      updateMainStoreButtonUI(); 
    }
  } catch (err) {
    showToast('Do\'konni tasdiqlashda xatolik yuz berdi.');
  }
}

async function rejectStore(id) {
  if (!confirm("Haqiqatdan ham ushbu do'kon arizasini rad etmoqchimisiz yoki o'chirmoqchimisiz?")) return;
  try {
    // Backend yo'lagiga mos ravishda /reject so'zi olib tashlandi
    const res = await fetch(`${API_URL}/admin/stores/${id}`, { 
      method: 'DELETE' 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Backenddan xato keldi:", errorText);
      showToast(`Xatolik: Server ${res.status} qaytardi`);
      return;
    }

    const data = await res.json();
    if (data.success || res.ok) {
      showToast('✕ Do\'kon muvaffaqiyatli rad etildi!');
      await loadServerData();
      await loadAllStoresForAdmin();
      await updateAdminStats();
    } else {
      showToast(data.message || 'Xatolik yuz berdi.');
    }
  } catch (err) {
    console.error("Koddagi xatolik:", err);
    showToast('Xatolik yuz berdi. Konsolni tekshiring.');
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

// Sahifadagi barcha elementlar va rasm/stillar yuklanib bo'lingach ishlaydi
window.addEventListener('load', () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    // Silliq yo'qolishi uchun opacity beramiz va 0.5 soniyadan keyin o'chiramiz
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.classList.add('hidden'); // yoki loadingScreen.remove();
    }, 500);
  }
});
// 🔄 KIRISH VA RO'YXATDAN O'TISH TABLARINI ALMASHISH FUNKSIYASI
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const modalTitle = document.querySelector('#login-modal h2');
  const modalNote = document.querySelector('#login-modal .form-note');
  
  // Tab tugmalarini topib olamiz
  const tabs = document.querySelectorAll('#login-modal .tab-btn');

  if (tab === 'login') {
    // 1. Formani almashtirish
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    
    // 2. Sarlavhalarni chiroyli yangilash
    if (modalTitle) modalTitle.innerText = 'Kirish';
    if (modalNote) modalNote.innerText = 'Lemado hisobingizga kiring';
    
    // 3. Aktiv tugma klassini to'g'rilash
    tabs.forEach((t, idx) => idx === 0 ? t.classList.add('active') : t.classList.remove('active'));
    
  } else if (tab === 'register') {
    // 1. Formani almashtirish
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    
    // 2. Sarlavhalarni chiroyli yangilash
    if (modalTitle) modalTitle.innerText = "Ro'yxatdan o'tish";
    if (modalNote) modalNote.innerText = 'Yangi Lemado hisobini yarating';
    
    // 3. Aktiv tugma klassini to'g'rilash
    tabs.forEach((t, idx) => idx === 1 ? t.classList.add('active') : t.classList.remove('active'));
  }
}
// HTML dagi Admin Panel tugmasi bosilganda ishlovchi ko'prik funksiya
function openAdminPanel() {
  if (typeof showAdmin === 'function') {
    showAdmin(true); // Sizning kodingizdagi original admin panel funksiyasi
  } else {
    console.error("showAdmin funksiyasi topilmadi!");
  }
}
// 👤 PROFIL AVATARI BOSILGANDA DROPDOWN MENYUNI OCHISH/YOPISH
function toggleDropdown(event) {
  if (event) {
    event.stopPropagation(); // Klik voqeasi "window" ga o'tib, menyuni darhol yopib qo'ymasligi uchun
  }
  
  const profileWrap = document.getElementById('user-profile-wrap');
  if (profileWrap) {
    profileWrap.classList.toggle('open');
  }
}

// Admin panel uchun barcha mahsulotlar jadvalini chizish
function renderAdminProductsTable(products) {
  // Yangi (to'g'ri) kodingiz:
  const t = document.getElementById('products-table-admin');
  if (!t) return;

  if (!products || products.length === 0) {
    t.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-400)">Hozircha mahsulotlar mavjud emas</td></tr>`;
    return;
  }

  t.innerHTML = products.map(p => {
    return `<tr>
      <td><strong>${sanitize(p.name)}</strong></td>
      <td>${sanitize(p.store || 'Lemado Do\'kon')}</td>
      <td><span class="tag tag-blue">${sanitize(p.category || 'Umumiy')}</span></td>
      <td><strong>${p.price.toLocaleString()} so'm</strong></td>
      <td>
        <span class="tag tag-green">Faol</span>
      </td>
    </tr>`;
  }).join('');
}

// 🌍 EKRANNING IXTIYORIY JOYI BOSILGANDA MENYUNI AVTOMAT YOPISH
window.addEventListener('click', (event) => {
  const profileWrap = document.getElementById('user-profile-wrap');
  
  // Agar menyu ochiq bo'lsa va bosilgan joy profil elementi ichida bo'lmasa:
  if (profileWrap && profileWrap.classList.contains('open')) {
    if (!profileWrap.contains(event.target)) {
      profileWrap.classList.remove('open');
    }
  }
});



// 2 soniyadan keyin loadingni majburan yopish
setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.display = 'none';
        console.log("Loading majburan yopildi.");
    }
}, 2000);







// 2. Loading-ni yopuvchi funksiya
function hideLoading() {
    const ls = document.getElementById('loading-screen');
    if (ls) {
        ls.style.opacity = '0';
        setTimeout(() => { ls.style.display = 'none'; }, 500);
    
        
    }
}



// =======================================================
// YAKUNIY ISHGA TUSHIRISH (Eng oxirgi qatorga shu qo'yiladi)
// =======================================================
window.addEventListener('load', async () => {
    console.log("Sahifa yuklandi. Tizim tekshirilmoqda...");
    
    // 1. Agar xotirada user bo'lsa (lemado_user), uni faollashtiramiz
    const savedUser = localStorage.getItem('lemado_user');
    if (savedUser) {
        try {
            setCurrentUser(JSON.parse(savedUser));
        } catch(e) {
            localStorage.removeItem('lemado_user');
        }
    }

    // 2. Serverdan ma'lumotlarni kutamiz
    await loadServerData();
    
    // 3. Loading ekranini yopamiz
    hideLoading();
});

// =======================================================
// DO'KON TUGMASINI DINAMIK BOSHQARISH
// =======================================================

// 1. Tugma bosilganda nima bo'lishini boshqarish
function handleMainStoreBtn() {
    if (!currentUser) {
        showToast("Do'kon ochish uchun avval tizimga kiring!");
        openModal('login-modal');
        return;
    }

    // Global STORES ichidan userning do'konini izlaymiz
    const userStore = STORES.find(s => s.owner === currentUser.username);

    if (userStore) {
        if (userStore.isVerified) {
            showPage('my-store'); // Tasdiqlangan bo'lsa "My Store" sahifasiga o'tadi
        } else {
            showToast("⏳ Do'koningiz hali admin tomonidan tasdiqlanmagan!");
        }
    } else {
        openModal('store-modal'); // Do'koni bo'lmasa yaratish oynasi ochiladi
    }
}

// 2. Tugma matni va holatini dinamik o'zgartirish
function updateMainStoreButtonUI() {
    const btn = document.getElementById('main-store-btn');
    if (!btn) return;

    if (currentUser && STORES && STORES.length > 0) {
        const userStore = STORES.find(s => s.owner === currentUser.username);
        
        if (userStore) {
            if (userStore.isVerified) {
                btn.innerHTML = "🏪 Do'konimga kirish";
                btn.style.background = "var(--green, #28a745)"; // Aktiv do'kon rangi
            } else {
                btn.innerHTML = "⏳ Do'konim (Tekshirilmoqda)";
                btn.style.background = "var(--orange, #ff9800)"; // Kutilayotgan do'kon rangi
            }
        } else {
            btn.innerHTML = "Do'kon ochish 🏪";
        }
    } else {
        btn.innerHTML = "Do'kon ochish 🏪";
    }
    
    // Tugma bosilganda tepadagi handle funksiyasini chaqiramiz
    btn.onclick = handleMainStoreBtn;
}

// DO'KON ICHIGA KIRGANDA SHARHLARNI VA 100 BALLIK SISTEMANI CHIZISH
function renderStoreReviewsSection(storeId) {
    const targetElement = document.getElementById('store-reviews-container'); // HTML dagi joylashadigan blok IDsi
    if (!targetElement) return;

    targetElement.innerHTML = `
        <div class="review-box" style="padding:20px; background:#fdfdfd; border:1px solid #eee; border-radius:12px; margin-top:20px;">
            <h3 style="margin-bottom:5px;">Lemado Reyting tizimi</h3>
            <p style="font-size:13px; color:#777; margin-bottom:15px;">Do'kon faoliyatini 1 dan 100 gacha bo'lgan ball tizimida baholang (Yulduzchalarsiz!):</p>
            
            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">
                    Sizning bahoingiz: <span id="live-score" style="color:#e91e63; font-size:20px; font-weight:bold;">50</span> / 100
                </label>
                <input type="range" id="score-slider" min="1" max="100" value="50" style="width:100%; cursor:pointer;"
                       oninput="document.getElementById('live-score').innerText = this.value">
            </div>

            <div style="margin-bottom:15px;">
                <textarea id="review-comment" rows="3" placeholder="Do'kon haqida izoh qoldiring..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc; font-family:inherit;"></textarea>
            </div>

            <button onclick="submit100BallReview('${storeId}')" style="background:#00bcd4; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">
                Baho va Sharhni Yuborish
            </button>
        </div>
    `;
}

// SHARHNI BACKENDGA YUBORISH
async function submit100BallReview(storeId) {
    if (!currentUser) {
        showToast("⚠️ Sharh yozish uchun avval tizimga kiring.");
        openModal('login-modal');
        return;
    }

    const score = parseInt(document.getElementById('score-slider').value);
    const comment = document.getElementById('review-comment').value.trim();

    if (!comment) {
        showToast("Iltimos, do'kon haqida biror fikr yozing.");
        return;
    }

    const reviewPayload = {
        username: currentUser.username,
        score: score, // 100 ballik baho
        text: comment,
        date: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/stores/${storeId}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload)
        });

        if (response.ok) {
            showToast("✓ Bahoingiz va sharhingiz saqlandi!");
            document.getElementById('review-comment').value = '';
            // Bu yerda do'kon sahifasini qayta yuklatish mumkin
        } else {
            showToast("Sharhni saqlashda xatolik yuz berdi.");
        }
    } catch (err) {
        showToast("Server bilan aloqa uzildi.");
    }
}

// =======================================================
// YAKUNIY ISHGA TUSHIRISH (Faqat bitta blokda)
// =======================================================
window.addEventListener('load', async () => {
    console.log("Lemado platformasi ishga tushdi...");
    
    // 1. Avvaldan saqlangan foydalanuvchi sessiyasini tekshirish
    const savedUser = localStorage.getItem('lemado_user');
    if (savedUser) {
        try {
            setCurrentUser(JSON.parse(savedUser));
        } catch(e) {
            localStorage.removeItem('lemado_user');
        }
    }

    // 2. Serverdan ma'lumotlarni yuklash va sahifani chizish
    await loadServerData();
    
    // 3. Yuklanish ekranini yopish
    if (typeof hideLoading === 'function') {
        hideLoading();
    } else {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }

    // 4. Ekran bo'ylab ixtiyoriy joy bosilganda ochiq qolgan profil menyusini avtomat yopish
    window.addEventListener('click', () => {
        const profileWrap = document.getElementById('user-profile-wrap');
        if (profileWrap) {
            profileWrap.classList.remove('open');
        }
    });
});
