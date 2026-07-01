(() => {
  'use strict';

  const API = '/api';
  let currentUser = null;
  let currentCategory = 'Barchasi';
  let currentQuery = '';
  let sitesCache = [];

  // ---------- YORDAMCHI ----------
  function $(id) { return document.getElementById(id); }
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }
  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Xatolik yuz berdi');
    return data;
  }

  // ---------- AUTH ----------
  async function loadMe() {
    try {
      const data = await api('/auth/me');
      currentUser = data.user;
    } catch {
      currentUser = null;
    }
    renderAuthUI();
  }

  function renderAuthUI() {
    const loginBtn = $('loginBtn');
    const registerBtn = $('registerBtn');
    const avatarBtn = $('avatarBtn');
    const adminBtn = $('adminBtn');

    if (currentUser) {
      loginBtn.classList.add('hidden');
      registerBtn.classList.add('hidden');
      avatarBtn.classList.remove('hidden');
      avatarBtn.textContent = currentUser.username.slice(0, 2).toUpperCase();
      if (currentUser.role === 'admin') {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    } else {
      loginBtn.classList.remove('hidden');
      registerBtn.classList.remove('hidden');
      avatarBtn.classList.add('hidden');
      adminBtn.classList.add('hidden');
    }
  }

  function openModal(id) { $(id).classList.add('active'); }
  function closeModal(id) { $(id).classList.remove('active'); }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('active'); });
  });

  $('loginBtn').addEventListener('click', () => openModal('loginOverlay'));
  $('registerBtn').addEventListener('click', () => openModal('registerOverlay'));
  $('switchToRegister').addEventListener('click', () => { closeModal('loginOverlay'); openModal('registerOverlay'); });
  $('switchToLogin').addEventListener('click', () => { closeModal('registerOverlay'); openModal('loginOverlay'); });

  $('avatarBtn').addEventListener('click', async () => {
    if (confirm(`${currentUser.username} — tizimdan chiqmoqchimisiz?`)) {
      await api('/auth/logout', { method: 'POST' });
      currentUser = null;
      renderAuthUI();
    }
  });

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('loginError');
    errEl.classList.remove('show');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: $('loginEmail').value.trim(),
          password: $('loginPassword').value,
        }),
      });
      currentUser = data.user;
      renderAuthUI();
      closeModal('loginOverlay');
      e.target.reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  });

  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('registerError');
    errEl.classList.remove('show');
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: $('regUsername').value.trim(),
          email: $('regEmail').value.trim(),
          password: $('regPassword').value,
        }),
      });
      currentUser = data.user;
      renderAuthUI();
      closeModal('registerOverlay');
      e.target.reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  });

  $('adminBtn').addEventListener('click', () => { window.location.href = '/admin/'; });

  // ---------- KATEGORIYALAR ----------
  async function loadCategories() {
    try {
      const { categories } = await api('/sites/categories');
      const list = $('categoryList');
      list.innerHTML = `<div class="cat-item active" data-cat="Barchasi">🗂️ Barchasi</div>`;
      categories.forEach((cat) => {
        const div = document.createElement('div');
        div.className = 'cat-item';
        div.dataset.cat = cat;
        div.textContent = `📁 ${cat}`;
        list.appendChild(div);
      });
      list.querySelectorAll('.cat-item').forEach((el) => {
        el.addEventListener('click', () => {
          list.querySelectorAll('.cat-item').forEach((x) => x.classList.remove('active'));
          el.classList.add('active');
          currentCategory = el.dataset.cat;
          fetchSites();
          closeSidebarMobile();
        });
      });
    } catch (err) { console.error(err); }
  }

  // ---------- SAYTLAR KATALOGI ----------
  async function fetchSites() {
    const params = new URLSearchParams();
    if (currentQuery) params.set('q', currentQuery);
    if (currentCategory && currentCategory !== 'Barchasi') params.set('category', currentCategory);

    try {
      const data = await api('/sites?' + params.toString());
      sitesCache = data.sites;
      renderGrid(sitesCache);
      $('catalogTitle').textContent = currentQuery ? `"${currentQuery}" bo'yicha natijalar` : (currentCategory === 'Barchasi' ? 'Barcha xizmatlar' : currentCategory);
      $('catalogSub').textContent = `${data.count} ta sayt topildi`;
    } catch (err) {
      console.error(err);
    }
  }

  function renderGrid(sites) {
    const grid = $('siteGrid');
    const empty = $('emptyState');
    grid.innerHTML = '';

    if (!sites.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    sites.forEach((site) => {
      const isBookmarked = currentUser?.bookmarks?.includes(site._id);
      const card = document.createElement('div');
      card.className = 'site-card';
      card.innerHTML = `
        <div class="site-icon" style="background:${esc(site.color)}22;color:${esc(site.color)}">${esc(site.icon)}</div>
        <div class="site-name">${esc(site.name)}</div>
        <div class="site-desc">${esc(site.description || '')}</div>
        <div class="site-meta">
          <span class="site-tag">${esc(site.category)}</span>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${site._id}">${isBookmarked ? '★' : '☆'}</button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-btn')) return;
        openSite(site);
      });
      card.querySelector('.bookmark-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(site._id, e.target);
      });
      grid.appendChild(card);
    });
  }

  async function toggleBookmark(siteId, btn) {
    if (!currentUser) { openModal('loginOverlay'); return; }
    try {
      const data = await api(`/user/bookmarks/${siteId}`, { method: 'POST' });
      btn.classList.toggle('active', data.bookmarked);
      btn.textContent = data.bookmarked ? '★' : '☆';
      if (data.bookmarked) currentUser.bookmarks.push(siteId);
      else currentUser.bookmarks = currentUser.bookmarks.filter((id) => id !== siteId);
    } catch (err) { console.error(err); }
  }

  // ---------- IFRAME KO'RUVCHI ----------
  const viewer = $('viewer');
  const catalogView = $('catalogView');
  const frame = $('siteFrame');

  function openSite(site) {
    api(`/sites/${site._id}/click`, { method: 'POST' }).catch(() => {});

    catalogView.style.display = 'none';
    viewer.classList.add('active');
    $('viewerTitle').textContent = site.name;
    $('viewerUrl').textContent = site.url;
    $('iframeLoading').style.display = 'flex';
    $('iframeBlocked').classList.remove('show');

    if (!site.allowIframe) {
      frame.src = 'about:blank';
      $('iframeLoading').style.display = 'none';
      $('iframeBlocked').classList.add('show');
      $('blockedOpenBtn').onclick = () => window.open(site.url, '_blank', 'noopener,noreferrer');
      $('openNewTabBtn').onclick = () => window.open(site.url, '_blank', 'noopener,noreferrer');
      return;
    }

    frame.src = site.url;
    $('openNewTabBtn').onclick = () => window.open(site.url, '_blank', 'noopener,noreferrer');

    // Ba'zi saytlar X-Frame-Options/CSP bilan iframe'ni bloklaydi -> aniq bilib bo'lmaydi,
    // shuning uchun timeout orqali "yuklandi" deb hisoblaymiz; onload chaqirilmasa foydalanuvchiga xabar ko'rsatiladi
    let loaded = false;
    frame.onload = () => { loaded = true; $('iframeLoading').style.display = 'none'; };
    setTimeout(() => {
      if (!loaded) {
        $('iframeLoading').style.display = 'none';
      }
    }, 6000);
  }

  $('backBtn').addEventListener('click', () => {
    viewer.classList.remove('active');
    catalogView.style.display = '';
    frame.src = 'about:blank';
  });
  $('reloadBtn').addEventListener('click', () => {
    $('iframeLoading').style.display = 'flex';
    frame.src = frame.src;
  });

  // ---------- QIDIRUV ----------
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    currentQuery = $('searchInput').value.trim();
    fetchSites();
  });

  // ---------- SAQLANGANLAR / TARIX ----------
  $('bookmarksNav').addEventListener('click', async () => {
    if (!currentUser) { openModal('loginOverlay'); return; }
    try {
      const data = await api('/user/bookmarks');
      currentQuery = '';
      $('catalogTitle').textContent = '⭐ Saqlangan saytlar';
      $('catalogSub').textContent = `${data.bookmarks.length} ta saqlangan`;
      renderGrid(data.bookmarks);
      closeSidebarMobile();
    } catch (err) { console.error(err); }
  });

  $('historyNav').addEventListener('click', async () => {
    if (!currentUser) { openModal('loginOverlay'); return; }
    try {
      const data = await api('/user/history');
      $('catalogTitle').textContent = '🕓 Qidiruv tarixi';
      $('catalogSub').textContent = `${data.history.length} ta yozuv`;
      const grid = $('siteGrid');
      grid.innerHTML = '';
      $('emptyState').classList.toggle('hidden', data.history.length > 0);
      data.history.forEach((h) => {
        const card = document.createElement('div');
        card.className = 'site-card';
        card.innerHTML = `
          <div class="site-icon">🕓</div>
          <div class="site-name">${esc(h.query)}</div>
          <div class="site-desc">${h.resultSite ? esc(h.resultSite.name) : 'Natija topilmagan'}</div>
        `;
        if (h.resultSite) card.addEventListener('click', () => openSite(h.resultSite));
        grid.appendChild(card);
      });
      closeSidebarMobile();
    } catch (err) { console.error(err); }
  });

  // ---------- MOBIL SIDEBAR ----------
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  function closeSidebarMobile() {
    if (window.innerWidth <= 900) $('sidebar').classList.remove('open');
  }

  // ---------- ISHGA TUSHIRISH ----------
  (async function init() {
    await loadMe();
    await loadCategories();
    await fetchSites();
  })();
})();
