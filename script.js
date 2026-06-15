// Render sizga bergan URL manzilini yozasiz (oxirida /api bilan)
const API_URL = "https://lemado-backend.onrender.com/api";
// ===================== DATA STORE =====================
const DB = {
  users: [
    {id:1, username:'admin', password:'Admin@2024!', name:'Administrator', email:'admin@lemado.uz', role:'admin', status:'active', createdAt:'2024-01-01'},
    {id:2, username:'john_uz', password:'John@123', name:'Jasur Toshmatov', email:'jasur@gmail.com', role:'seller', status:'active', createdAt:'2024-02-15'},
    {id:3, username:'malika_shop', password:'Malika@456', name:'Malika Yusupova', email:'malika@mail.ru', role:'seller', status:'active', createdAt:'2024-03-10'},
    {id:4, username:'akbar99', password:'Akbar@789', name:'Akbar Rahimov', email:'akbar@inbox.uz', role:'buyer', status:'active', createdAt:'2024-04-05'},
    {id:5, username:'testuser', password:'Test@001', name:'Test Foydalanuvchi', email:'test@test.com', role:'buyer', status:'blocked', createdAt:'2024-05-20'}
  ],
  stores: [
    {id:1, name:'TechZone UZ', owner:'john_uz', category:'Elektronika', desc:"O'zbekistonning top elektronika do'koni", logo:'https://i.imgur.com/Kcr8Hbf.png', verified:true, status:'active', products:0},
    {id:2, name:'Malika Fashion', owner:'malika_shop', category:'Kiyim-kechak', desc:'Zamonaviy kiyimlar va aksessuarlar', logo:'https://i.imgur.com/T5xdZ3C.png', verified:true, status:'active', products:0},
    {id:3, name:'FreshMart', owner:'akbar99', category:'Oziq-ovqat', desc:'Yangi va sifatli oziq-ovqat mahsulotlari', logo:'', verified:false, status:'pending', products:0}
  ],
  products: [
    {id:1, name:'iPhone 15 Pro', desc:'A17 Pro chip, titanium korpus, ProRAW kamera', price:12500000, img:'https://i.imgur.com/rBJ3kVc.png', category:'Elektronika', store:'TechZone UZ', storeId:1, emoji:'📱'},
    {id:2, name:'Samsung Galaxy S24', desc:'2K ekran, AI kamera, 5000mAh batareya', price:9800000, img:'https://i.imgur.com/BpAXKJG.png', category:'Elektronika', store:'TechZone UZ', storeId:1, emoji:'📱'},
    {id:3, name:'MacBook Air M3', desc:'Apple Silicon M3, 8GB RAM, 256GB SSD', price:18900000, img:'https://i.imgur.com/Xfh0hEf.png', category:'Elektronika', store:'TechZone UZ', storeId:1, emoji:'💻'},
    {id:4, name:'Yozgi ko\'ylak', desc:'100% paxta, qulay va chiroyli', price:185000, img:'https://i.imgur.com/Y7LFNCK.png', category:'Kiyim-kechak', store:'Malika Fashion', storeId:2, emoji:'👕'},
    {id:5, name:'Qishki Palto', desc:'Issiq va zamonaviy dizayn', price:890000, img:'https://i.imgur.com/4xpSc3t.png', category:'Kiyim-kechak', store:'Malika Fashion', storeId:2, emoji:'🧥'},
    {id:6, name:'Sport Krossovkalar', desc:'Nike Air Max, yugurishga ideal', price:1200000, img:'https://i.imgur.com/Uo3GkYh.png', category:'Sport', store:'TechZone UZ', storeId:1, emoji:'👟'},
    // LEMADO rasmiy mahsulotlari
    {id:7, name:'Lemado Premium Box', desc:'Lemado platformasining maxsus sovg\'a qutisi', price:250000, img:'https://i.imgur.com/9Zxq3Hv.png', category:'Boshqa', store:'Lemado Official', storeId:0, emoji:'🎁'},
    {id:8, name:'Lemado Gift Card', desc:'500,000 so\'mlik Lemado sovg\'a kartasi', price:500000, img:'https://i.imgur.com/kTpMZJz.png', category:'Boshqa', store:'Lemado Official', storeId:0, emoji:'🎴'},
    {id:9, name:'Simsiz Quloqchin', desc:'ANC, 30 soat batareya, bluetooth 5.3', price:650000, img:'https://i.imgur.com/HHqWJLy.png', category:'Elektronika', store:'TechZone UZ', storeId:1, emoji:'🎧'},
    {id:10, name:'Uzbek Plov Seti', desc:'Milliy taomlar uchun maxsus ziravorlar to\'plami', price:85000, img:'https://i.imgur.com/cWLxJKK.png', category:'Oziq-ovqat', store:'FreshMart', storeId:3, emoji:'🍲'}
  ],
  orders: [],
  sessions: {},
  blockedUsernames: new Set(['admin_fake','lemado_admin','root','system'])
};

let currentUser = null;
let cart = [];
let currentPage = 'home';
let currentFilter = 'Barchasi';

// ===================== SECURITY =====================
function sanitize(str) {
  if(typeof str !== 'string') return '';
  return str.replace(/[<>&"'\/]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#x27;','/':'&#x2F;'}[c]));
}
function validateUsername(u) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(u);
}
function validatePassword(p) {
  return p.length >= 6;
}
function rateLimitCheck(action) {
  const key = 'rl_'+action;
  const now = Date.now();
  const attempts = JSON.parse(sessionStorage.getItem(key)||'[]').filter(t=>now-t<60000);
  if(attempts.length >= 5) return false;
  attempts.push(now);
  sessionStorage.setItem(key, JSON.stringify(attempts));
  return true;
}

// ===================== AUTH =====================
function login() {
  if(!rateLimitCheck('login')) { showToast('⚠️ Juda ko\'p urinish. 1 daqiqa kuting.'); return; }
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  if(!username||!password){errEl.textContent='Username va parol kerak';return;}
  const user = DB.users.find(u=>u.username===username);
  if(!user){errEl.textContent='Noto\'g\'ri username yoki parol';return;}
  if(user.status==='blocked'){errEl.textContent='Hisobingiz bloklangan';return;}
  if(user.status==='temp_blocked'){errEl.textContent='Hisobingiz vaqtincha bloklangan';return;}
  if(user.password!==password){errEl.textContent='Noto\'g\'ri username yoki parol';return;}
  setCurrentUser(user);
  closeModal('login-modal');
  showToast('✅ Xush kelibsiz, '+sanitize(user.name)+'!');
}
function register() {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const email = document.getElementById('reg-email').value.trim();
  const errEl = document.getElementById('reg-err');
  errEl.textContent = '';
  if(!name||!username||!password||!email){errEl.textContent='Barcha maydonlar to\'ldirilishi kerak';return;}
  if(!validateUsername(username)){errEl.textContent='Username: 3-20 harf, faqat a-z, 0-9, _';return;}
  if(DB.blockedUsernames.has(username)){errEl.textContent='Bu username ishlatilmaydi';return;}
  if(DB.users.find(u=>u.username===username)){errEl.textContent='Bu username band';return;}
  if(!validatePassword(password)){errEl.textContent='Parol kamida 6 ta belgi';return;}
  if(password!==password2){errEl.textContent='Parollar mos emas';return;}
  if(!/\S+@\S+\.\S+/.test(email)){errEl.textContent='Email noto\'g\'ri';return;}
  const newUser = {
    id: Date.now(), username, password, name, email,
    role:'buyer', status:'active', createdAt: new Date().toISOString().split('T')[0]
  };
  DB.users.push(newUser);
  setCurrentUser(newUser);
  closeModal('login-modal');
  showToast('🎉 Ro\'yxatdan o\'tdingiz!');
}
function setCurrentUser(user) {
  currentUser = user;
  document.getElementById('auth-section').style.display='none';
  document.getElementById('user-section').style.display='block';
  document.getElementById('user-avatar').textContent=user.name.charAt(0).toUpperCase();
  if(user.role==='admin') document.getElementById('admin-btn').style.display='block';
  else document.getElementById('admin-btn').style.display='none';
}
function logout() {
  currentUser = null;
  document.getElementById('auth-section').style.display='block';
  document.getElementById('user-section').style.display='none';
  document.getElementById('admin-btn').style.display='none';
  showAdmin(false);
  showPage('home');
  showToast('👋 Chiqildi');
}
function switchAuthTab(tab) {
  document.getElementById('login-form').style.display = tab==='login'?'block':'none';
  document.getElementById('register-form').style.display = tab==='register'?'block':'none';
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{b.classList.toggle('active',(i===0&&tab==='login')||(i===1&&tab==='register'));});
}

// ===================== PAGES =====================
function showPage(page) {
  document.getElementById('admin-panel').style.display='none';
  document.getElementById('main-site').style.display='block';
  ['home','stores','orders','my-store'].forEach(p=>{
    const el=document.getElementById('page-'+p);
    if(el) el.style.display = p===page?'block':'none';
  });
  currentPage = page;
  if(page==='stores') renderAllStores();
  if(page==='orders') renderOrders();
  if(page==='my-store') renderMyStore();
  window.scrollTo(0,0);
  closeDropdown();
}
function showAdmin(show=true) {
  if(show&&(!currentUser||currentUser.role!=='admin')){openModal('login-modal');showToast('⚠️ Admin kirish kerak');return;}
  document.getElementById('admin-panel').style.display=show?'block':'none';
  document.getElementById('main-site').style.display=show?'none':'block';
  if(show) { updateAdminStats(); renderAdminTables(); document.getElementById('admin-welcome').textContent='👤 '+currentUser.name; }
}
function exitAdmin(){showAdmin(false);showPage('home');}

// ===================== PRODUCTS =====================
const PRODUCTS = DB.products;

function renderProducts(prods) {
  const grid = document.getElementById('products-grid');
  if(!prods||!prods.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray-400)"><div style="font-size:48px">🔍</div><p style="margin-top:12px">Mahsulot topilmadi</p></div>';return;}
  grid.innerHTML = prods.map(p=>`
    <div class="product-card" onclick="viewProduct(${p.id})">
      <div class="product-img">
        ${p.img?`<img src="${sanitize(p.img)}" alt="${sanitize(p.name)}" onerror="this.parentElement.innerHTML='<span style=font-size:60px>${p.emoji||'📦'}</span>'">`:`<span style="font-size:60px">${p.emoji||'📦'}</span>`}
      </div>
      <div class="product-info">
        <div class="product-store">
          <span class="store-name">${sanitize(p.store)}</span>
          ${DB.stores.find(s=>s.id===p.storeId&&s.verified)?'<span class="verified-badge">✓</span>':''}
          ${p.storeId===0?'<span class="verified-badge" style="background:var(--red)">★</span>':''}
        </div>
        <div class="product-name">${sanitize(p.name)}</div>
        <div class="product-desc">${sanitize(p.desc)}</div>
        <div class="product-footer">
          <div class="product-price">${p.price.toLocaleString()} so'm</div>
          <button class="add-cart" onclick="event.stopPropagation();addToCart(${p.id})">+ Savat</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterCategory(cat, el) {
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  currentFilter = cat;
  const prods = cat==='Barchasi' ? PRODUCTS : PRODUCTS.filter(p=>p.category===cat);
  renderProducts(prods);
}

function searchProducts() {
  const q = document.getElementById('search-input').value.toLowerCase();
  if(!q){filterCategory(currentFilter,null);return;}
  const prods = PRODUCTS.filter(p=>p.name.toLowerCase().includes(q)||p.desc.toLowerCase().includes(q)||p.store.toLowerCase().includes(q));
  renderProducts(prods);
}

function viewProduct(id) {
  const p = PRODUCTS.find(x=>x.id===id);
  if(!p) return;
  showToast(`📦 ${sanitize(p.name)} - ${p.price.toLocaleString()} so'm`);
}

// ===================== STORES =====================
function renderStoresHome() {
  const grid = document.getElementById('stores-grid-home');
  const verified = DB.stores.filter(s=>s.verified&&s.status==='active').slice(0,6);
  grid.innerHTML = verified.map(storeCard).join('');
}
function renderAllStores() {
  const grid = document.getElementById('all-stores-grid');
  grid.innerHTML = DB.stores.filter(s=>s.status==='active').map(storeCard).join('');
}
function storeCard(s){
  const prods = PRODUCTS.filter(p=>p.storeId===s.id);
  return `<div class="store-card" onclick="showToast('🏪 ${sanitize(s.name)} do\\'koni')">
    <div class="store-header">
      <div class="store-logo">${s.logo?`<img src="${sanitize(s.logo)}" onerror="this.parentElement.innerHTML='🏪'">`:'🏪'}</div>
      <div>
        <div class="store-title">${sanitize(s.name)}</div>
        <div class="store-cat">${sanitize(s.category)}</div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--gray-600);margin-bottom:10px">${sanitize(s.desc)}</div>
    ${s.verified?'<div class="verified-store">✓ Rasmiy do\'kon</div>':'<div style="font-size:12px;color:var(--gray-400)">⏳ Tekshirilmoqda</div>'}
    <div class="store-stats" style="margin-top:12px">
      <div class="stat"><div class="stat-val">${prods.length}</div><div class="stat-lbl">Mahsulot</div></div>
      <div class="stat"><div class="stat-val">4.8⭐</div><div class="stat-lbl">Reyting</div></div>
    </div>
  </div>`;
}

// ===================== MY STORE =====================
function openStoreCreation() {
  if(!currentUser){openModal('login-modal');showToast('Avval kirish kerak');return;}
  const existing = DB.stores.find(s=>s.owner===currentUser.username);
  if(existing){showPage('my-store');return;}
  openModal('store-modal');
}
function createStore() {
  if(!currentUser){return;}
  const name = document.getElementById('store-name').value.trim();
  const cat = document.getElementById('store-cat').value;
  const desc = document.getElementById('store-desc').value.trim();
  const logo = document.getElementById('store-logo-url').value.trim();
  if(!name||!desc){showToast('⚠️ Barcha maydonlarni to\'ldiring');return;}
  const newStore = {
    id: Date.now(), name: sanitize(name), owner: currentUser.username,
    category: cat, desc: sanitize(desc), logo: logo,
    verified: false, status: 'pending', products: 0
  };
  DB.stores.push(newStore);
  currentUser.role = 'seller';
  closeModal('store-modal');
  showPage('my-store');
  showToast('🎉 Do\'kon yaratildi! Admin tasdiqlashini kuting.');
}
function renderMyStore() {
  const c = document.getElementById('my-store-content');
  if(!currentUser){c.innerHTML='<div style="text-align:center;padding:60px"><p>Kirish kerak</p><button class="btn btn-red" style="margin-top:16px" onclick="openModal(\'login-modal\')">Kirish</button></div>';return;}
  const store = DB.stores.find(s=>s.owner===currentUser.username);
  if(!store){c.innerHTML=`<div style="text-align:center;padding:60px"><div style="font-size:48px">🏪</div><p style="margin:16px 0">Hali do'koningiz yo'q</p><button class="btn btn-red" onclick="openModal('store-modal')">Do'kon yaratish</button></div>`;return;}
  const prods = PRODUCTS.filter(p=>p.storeId===store.id);
  c.innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px">
      <div style="width:70px;height:70px;border-radius:16px;background:var(--red-light);display:flex;align-items:center;justify-content:center;font-size:32px">${store.logo?`<img src="${sanitize(store.logo)}" style="width:70px;height:70px;border-radius:16px;object-fit:cover" onerror="this.parentElement.innerHTML='🏪'">`:'🏪'}</div>
      <div>
        <h2 style="font-size:24px;font-weight:800">${sanitize(store.name)}</h2>
        <div>${store.verified?'<span class="verified-store">✓ Rasmiy do\'kon</span>':'<span class="tag tag-orange">⏳ Tekshirilmoqda</span>'}</div>
      </div>
      <button class="btn btn-red" style="margin-left:auto" onclick="openModal('product-modal')">+ Mahsulot qo'shish</button>
    </div>
    <div class="section-title">Mahsulotlarim (${prods.length})</div>
    <div class="products-grid">${prods.map(p=>`
      <div class="product-card">
        <div class="product-img">${p.img?`<img src="${sanitize(p.img)}" alt="${sanitize(p.name)}" onerror="this.parentElement.innerHTML='<span style=font-size:60px>${p.emoji||'📦'}</span>'">`:`<span style="font-size:60px">${p.emoji||'📦'}</span>`}</div>
        <div class="product-info">
          <div class="product-name">${sanitize(p.name)}</div>
          <div class="product-price">${p.price.toLocaleString()} so'm</div>
        </div>
      </div>`).join('')||'<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">Hali mahsulot qo\'shilmagan</div>'}</div>
  `;
}
function addProduct() {
  if(!currentUser){return;}
  const store = DB.stores.find(s=>s.owner===currentUser.username);
  if(!store){showToast('Avval do\'kon oching');return;}
  const name = document.getElementById('prod-name').value.trim();
  const desc = document.getElementById('prod-desc').value.trim();
  const price = parseInt(document.getElementById('prod-price').value)||0;
  const img = document.getElementById('prod-img').value.trim();
  const cat = document.getElementById('prod-cat').value;
  if(!name||!price){showToast('⚠️ Nom va narx kiritilishi kerak');return;}
  const np = {id:Date.now(),name:sanitize(name),desc:sanitize(desc),price,img,category:cat,store:store.name,storeId:store.id,emoji:'📦'};
  PRODUCTS.push(np);
  closeModal('product-modal');
  renderMyStore();
  showToast('✅ Mahsulot qo\'shildi!');
}

// ===================== CART =====================
function addToCart(id) {
  const p = PRODUCTS.find(x=>x.id===id);
  if(!p) return;
  const existing = cart.find(i=>i.id===id);
  if(existing) existing.qty++;
  else cart.push({...p,qty:1});
  updateCartUI();
  showToast('🛒 Savatchaga qo\'shildi: '+sanitize(p.name));
}
function updateCartUI() {
  const count = cart.reduce((a,b)=>a+b.qty,0);
  document.getElementById('cart-count').textContent=count;
  const itemsEl = document.getElementById('cart-items');
  const total = cart.reduce((a,b)=>a+b.price*b.qty,0);
  if(!cart.length){
    itemsEl.innerHTML='';
    document.getElementById('cart-empty').style.display='block';
    document.getElementById('cart-total-section').style.display='none';
    return;
  }
  document.getElementById('cart-empty').style.display='none';
  document.getElementById('cart-total-section').style.display='block';
  document.getElementById('cart-total-price').textContent=total.toLocaleString()+' so\'m';
  itemsEl.innerHTML=cart.map((item,i)=>`
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji||'📦'}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">${sanitize(item.name)}</div>
        <div style="color:var(--red);font-weight:700">${(item.price*item.qty).toLocaleString()} so'm</div>
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
function changeQty(i,d){if(cart[i]){cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);}updateCartUI();}
function removeFromCart(i){cart.splice(i,1);updateCartUI();}
function toggleCart(){document.getElementById('cart-sidebar').classList.toggle('open');}
function checkout() {
  if(!currentUser){toggleCart();openModal('login-modal');return;}
  if(!cart.length) return;
  const order = {
    id: 'ORD-'+Date.now(), user: currentUser.username,
    items: [...cart], total: cart.reduce((a,b)=>a+b.price*b.qty,0),
    status:'Kutilmoqda', date: new Date().toLocaleDateString('uz-UZ')
  };
  DB.orders.push(order);
  cart=[];updateCartUI();toggleCart();
  showToast('🎉 Buyurtma qabul qilindi! ID: '+order.id);
}

// ===================== ORDERS =====================
function renderOrders() {
  const el = document.getElementById('orders-list');
  if(!currentUser){el.innerHTML='<div style="text-align:center;padding:40px"><button class="btn btn-red" onclick="openModal(\'login-modal\')">Kirish kerak</button></div>';return;}
  const orders = DB.orders.filter(o=>o.user===currentUser.username);
  if(!orders.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--gray-400)"><div style="font-size:48px">📦</div><p style="margin-top:12px">Hozircha buyurtma yo\'q</p></div>';return;}
  el.innerHTML=orders.map(o=>`
    <div class="order-item">
      <div class="order-icon">📦</div>
      <div style="flex:1">
        <div style="font-weight:700">${sanitize(o.id)}</div>
        <div style="font-size:13px;color:var(--gray-500)">${o.items.length} mahsulot • ${o.date}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--red)">${o.total.toLocaleString()} so'm</div>
        <div><span class="tag tag-orange">${sanitize(o.status)}</span></div>
      </div>
    </div>
  `).join('');
}

// ===================== ADMIN =====================
function updateAdminStats() {
  document.getElementById('stat-users').textContent=DB.users.length;
  document.getElementById('stat-stores').textContent=DB.stores.length;
  document.getElementById('stat-products').textContent=PRODUCTS.length;
  document.getElementById('stat-orders').textContent=DB.orders.length;
}
function showAdminTab(tab) {
  document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(n=>n.classList.remove('active'));
  const el=document.getElementById('admin-tab-'+tab);
  if(el) el.classList.add('active');
  event.currentTarget&&event.currentTarget.classList.add('active');
  if(tab==='users') renderUsersTable();
  if(tab==='stores-admin') renderStoresTable();
  if(tab==='products-admin') renderProductsTable();
  if(tab==='orders-admin') renderOrdersTable();
}
function renderAdminTables(){renderUsersTable();renderStoresTable();renderProductsTable();renderOrdersTable();}
function renderUsersTable() {
  const t=document.getElementById('users-table');
  t.innerHTML=DB.users.map(u=>`<tr>
    <td><strong>${sanitize(u.username)}</strong></td>
    <td>${sanitize(u.name)}</td>
    <td>${sanitize(u.email)}</td>
    <td><span class="tag ${u.role==='admin'?'tag-blue':u.role==='seller'?'tag-green':'tag-blue'}">${sanitize(u.role)}</span></td>
    <td><span class="tag ${u.status==='active'?'tag-green':u.status==='blocked'?'tag-red':'tag-orange'}">${sanitize(u.status)}</span></td>
    <td>
      ${u.role!=='admin'?`
        <button class="action-btn block" onclick="adminUserAction('${sanitize(u.username)}','temp_block')" title="Vaqtincha bloklash">⏸</button>
        <button class="action-btn block" onclick="adminUserAction('${sanitize(u.username)}','block')" title="Bloklash">🚫</button>
        <button class="action-btn delete" onclick="adminUserAction('${sanitize(u.username)}','delete')" title="O'chirish">🗑</button>
        ${u.status!=='active'?`<button class="action-btn approve" onclick="adminUserAction('${sanitize(u.username)}','unblock')" title="Faollashtirish">✅</button>`:''}
      `:'<span style="color:var(--gray-400);font-size:12px">Admin</span>'}
    </td>
  </tr>`).join('');
}
function adminUserAction(username, action) {
  const user = DB.users.find(u=>u.username===username);
  if(!user||user.role==='admin') return;
  if(action==='delete') {
    if(!confirm('Foydalanuvchini o\'chirmoqchimisiz?')) return;
    DB.users.splice(DB.users.indexOf(user),1);
    showToast('🗑 Foydalanuvchi o\'chirildi');
  } else if(action==='block'){user.status='blocked';showToast('🚫 Bloklandi');}
  else if(action==='temp_block'){user.status='temp_blocked';showToast('⏸ Vaqtincha bloklandi');}
  else if(action==='unblock'){user.status='active';showToast('✅ Faollashtirildi');}
  renderUsersTable(); updateAdminStats();
}
function renderStoresTable() {
  const t=document.getElementById('stores-table');
  t.innerHTML=DB.stores.map(s=>`<tr>
    <td><strong>${sanitize(s.name)}</strong></td>
    <td>${sanitize(s.owner)}</td>
    <td>${sanitize(s.category)}</td>
    <td><span class="tag ${s.status==='active'?'tag-green':s.status==='pending'?'tag-orange':'tag-red'}">${sanitize(s.status)}</span>${s.verified?' <span class="tag tag-blue">✓ Rasmiy</span>':''}</td>
    <td>
      ${!s.verified?`<button class="action-btn verify" onclick="verifyStore(${s.id})">✓ Tasdiqlash</button>`:''}
      <button class="action-btn block" onclick="blockStore(${s.id})">🚫</button>
      <button class="action-btn delete" onclick="deleteStore(${s.id})">🗑</button>
    </td>
  </tr>`).join('');
}
function verifyStore(id){const s=DB.stores.find(x=>x.id===id);if(s){s.verified=true;s.status='active';showToast('✓ Do\'kon tasdiqlandi');renderStoresTable();renderStoresHome();}}
function blockStore(id){const s=DB.stores.find(x=>x.id===id);if(s){s.status='blocked';showToast('🚫 Do\'kon bloklandi');renderStoresTable();}}
function deleteStore(id){if(!confirm('Do\'konni o\'chirmoqchimisiz?'))return;const i=DB.stores.findIndex(x=>x.id===id);if(i>-1){DB.stores.splice(i,1);showToast('🗑 O\'chirildi');renderStoresTable();updateAdminStats();}}
function renderProductsTable() {
  const t=document.getElementById('products-table-admin');
  t.innerHTML=PRODUCTS.map(p=>`<tr>
    <td><span style="font-size:20px;margin-right:8px">${p.emoji||'📦'}</span><strong>${sanitize(p.name)}</strong></td>
    <td>${sanitize(p.store)}</td>
    <td>${p.price.toLocaleString()} so'm</td>
    <td>${sanitize(p.category)}</td>
    <td><button class="action-btn delete" onclick="deleteProduct(${p.id})">🗑 O'chirish</button></td>
  </tr>`).join('');
}
function deleteProduct(id){if(!confirm('Mahsulotni o\'chirmoqchimisiz?'))return;const i=PRODUCTS.findIndex(x=>x.id===id);if(i>-1){PRODUCTS.splice(i,1);showToast('🗑 O\'chirildi');renderProductsTable();updateAdminStats();}}
function renderOrdersTable() {
  const t=document.getElementById('orders-table-admin');
  if(!DB.orders.length){t.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:30px">Hozircha buyurtma yo\'q</td></tr>';return;}
  t.innerHTML=DB.orders.map(o=>`<tr>
    <td><strong>${sanitize(o.id)}</strong></td>
    <td>${sanitize(o.user)}</td>
    <td>${o.items.length} ta</td>
    <td>${o.total.toLocaleString()} so'm</td>
    <td><span class="tag tag-orange">${sanitize(o.status)}</span></td>
    <td>${sanitize(o.date)}</td>
  </tr>`).join('');
}

// ===================== MUSIC =====================
const bgMusic = document.getElementById('bg-music');
let musicPlaying = false;
function toggleMusic() {
  if(musicPlaying){bgMusic.pause();document.getElementById('play-btn').textContent='▶';musicPlaying=false;}
  else{bgMusic.play().catch(()=>{});document.getElementById('play-btn').textContent='⏸';musicPlaying=true;}
}
function closeMusicPlayer(){document.getElementById('music-player').style.display='none';}
document.getElementById('music-volume').addEventListener('input',e=>{bgMusic.volume=parseFloat(e.target.value);});

// ===================== UTILS =====================
function openModal(id){document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id).classList.remove('active');}
function openLink(url){window.open(url,'_blank');}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('active');}));
function toggleDropdown(){document.getElementById('dropdown-menu').parentElement.classList.toggle('open');}
function closeDropdown(){document.querySelector('.dropdown')&&document.querySelector('.dropdown').classList.remove('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.dropdown'))closeDropdown();});
function showToast(msg,dur=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

// ===================== INIT =====================
window.addEventListener('load',()=>{
  setTimeout(()=>{
    const ls=document.getElementById('loading-screen');
    ls.style.opacity='0';
    setTimeout(()=>{ls.style.display='none';},600);
  },2500);
  filterCategory('Barchasi',document.querySelector('.chip.active'));
  renderStoresHome();
});
