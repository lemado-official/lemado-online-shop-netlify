(() => {
  'use strict';
  const API = '/api';

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

  let editingId = null;

  async function guardAdmin() {
    try {
      const data = await api('/auth/me');
      if (data.user.role !== 'admin') {
        $('guard').innerHTML = '<p>⛔ Bu sahifa faqat administratorlar uchun.</p>';
        return;
      }
      $('guard').classList.add('hidden');
      $('adminContent').classList.remove('hidden');
      loadSites();
    } catch {
      $('guard').innerHTML = '<p>🔒 Iltimos, admin hisobingiz bilan tizimga kiring. <br><br><a class="btn btn-primary" href="/">Bosh sahifaga qaytish</a></p>';
    }
  }

  async function loadSites() {
    const data = await api('/sites/admin/all');
    const tbody = $('siteTableBody');
    tbody.innerHTML = '';
    data.sites.forEach((site) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="status-dot ${site.isActive ? 'status-on' : 'status-off'}"></span>${site.isActive ? 'Faol' : 'Nofaol'}</td>
        <td>${esc(site.icon)}</td>
        <td>${esc(site.name)}</td>
        <td>${esc(site.category)}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(site.url)}</td>
        <td>${site.clicks}</td>
        <td class="row-actions">
          <button data-edit="${site._id}">Tahrirlash</button>
          <button data-toggle="${site._id}" data-active="${site.isActive}">${site.isActive ? 'O\'chirish' : 'Yoqish'}</button>
          <button data-del="${site._id}">O'chirib tashlash</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(data.sites.find((s) => s._id === btn.dataset.edit)));
    });
    tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleActive(data.sites.find((s) => s._id === btn.dataset.toggle)));
    });
    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => deleteSite(btn.dataset.del));
    });
  }

  function openCreate() {
    editingId = null;
    $('siteModalTitle').textContent = 'Yangi sayt';
    $('siteForm').reset();
    $('siteColor').value = '#ff6b35';
    $('statusField').style.display = 'none';
    $('siteFormError').classList.remove('show');
    $('siteOverlay').classList.add('active');
  }

  function openEdit(site) {
    editingId = site._id;
    $('siteModalTitle').textContent = 'Saytni tahrirlash';
    $('siteName').value = site.name;
    $('siteUrl').value = site.url;
    $('siteDesc').value = site.description || '';
    $('siteCategory').value = site.category;
    $('siteIcon').value = site.icon;
    $('siteColor').value = site.color;
    $('siteAllowIframe').value = String(site.allowIframe);
    $('siteIsActive').value = String(site.isActive);
    $('statusField').style.display = '';
    $('siteFormError').classList.remove('show');
    $('siteOverlay').classList.add('active');
  }

  async function toggleActive(site) {
    try {
      await api(`/sites/${site._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: site.name,
          url: site.url,
          description: site.description,
          category: site.category,
          icon: site.icon,
          color: site.color,
          allowIframe: site.allowIframe,
          isActive: !site.isActive,
        }),
      });
      loadSites();
    } catch (err) {
      alert(err.message);
    }
  }

  $('addBtn').addEventListener('click', openCreate);
  document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => $(btn.dataset.close).classList.remove('active')));

  $('siteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('siteFormError');
    errEl.classList.remove('show');

    const payload = {
      name: $('siteName').value.trim(),
      url: $('siteUrl').value.trim(),
      description: $('siteDesc').value.trim(),
      category: $('siteCategory').value.trim() || 'Umumiy',
      icon: $('siteIcon').value.trim() || '🌐',
      color: $('siteColor').value,
      allowIframe: $('siteAllowIframe').value === 'true',
    };
    if (editingId) payload.isActive = $('siteIsActive').value === 'true';

    try {
      if (editingId) {
        await api(`/sites/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/sites', { method: 'POST', body: JSON.stringify(payload) });
      }
      $('siteOverlay').classList.remove('active');
      loadSites();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  });

  async function deleteSite(id) {
    if (!confirm('Rostdan ham bu saytni butunlay o\'chirmoqchimisiz?')) return;
    try {
      await api(`/sites/${id}`, { method: 'DELETE' });
      loadSites();
    } catch (err) { alert(err.message); }
  }

  guardAdmin();
})();
