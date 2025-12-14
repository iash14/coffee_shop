const els = {
  offline: document.getElementById('offline'),
  grid: document.getElementById('menuGrid'),
  cartCount: document.getElementById('cartCount'),
  drawer: document.getElementById('drawer'),
  drawerClose: document.getElementById('drawerClose'),
  drawerX: document.getElementById('drawerX'),
  btnCart: document.getElementById('btnCart'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  btnCheckout: document.getElementById('btnCheckout'),
  btnClearCart: document.getElementById('btnClearCart'),
  btnUpdate: document.getElementById('btnUpdate'),
  btnOrderOffline: document.getElementById('btnOrderOffline'),
  toast: document.getElementById('toast'),
};

const CART_KEY = 'aromatna_cart_v1';
let menu = [];
let cart = loadCart();

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function openDrawer() {
  els.drawer.classList.add('open');
  els.drawer.setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  els.drawer.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
}

function formatUAH(n) {
  return `${n} ₴`;
}

// ---------------- Cart ----------------
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount() {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function cartTotal() {
  const byId = new Map(menu.map(m => [m.id, m]));
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = byId.get(id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
}

function updateCartUI() {
  els.cartCount.textContent = String(cartCount());

  // render rows
  els.cartItems.innerHTML = '';
  const byId = new Map(menu.map(m => [m.id, m]));
  const entries = Object.entries(cart);

  if (entries.length === 0) {
    els.cartItems.innerHTML = `<p class="muted">Кошик порожній. Додай щось смачне.</p>`;
  } else {
    for (const [id, qty] of entries) {
      const item = byId.get(id);
      if (!item) continue;

      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="muted">${formatUAH(item.price)} × ${qty}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="btn" style="background:rgba(0,0,0,.06)" data-act="dec" data-id="${id}">−</button>
          <button class="btn" style="background:rgba(0,0,0,.06)" data-act="inc" data-id="${id}">+</button>
          <button class="btn" style="background:rgba(139,69,19,.12); color:#8b4513" data-act="rm" data-id="${id}">✕</button>
        </div>
      `;
      els.cartItems.appendChild(row);
    }
  }

  els.cartTotal.textContent = formatUAH(cartTotal());
}

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  updateCartUI();
  toast('Додано в кошик');
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  updateCartUI();
}

function removeItem(id) {
  delete cart[id];
  saveCart();
  updateCartUI();
}

// ---------------- Menu render ----------------
function renderMenu() {
  els.grid.innerHTML = '';
  menu.forEach(item => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h4>${item.name}</h4>
          <p>${item.desc || ''}</p>
        </div>
        <div class="price">${formatUAH(item.price)}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" data-buy="${item.id}">Додати</button>
        <button class="btn" style="background:rgba(0,0,0,.06)" data-oneclick="${item.id}">
          Купити зараз
        </button>
      </div>
    `;
    els.grid.appendChild(card);
  });
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered', reg);
  } catch (e) {
    console.log('SW register error', e);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data) alert(event.data);
  });
}

async function updateSW() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return alert('Service Worker не знайдено');

  await reg.update();
  reg.addEventListener('updatefound', () => {
    const newSW = reg.installing;
    if (!newSW) return;

    newSW.addEventListener('statechange', () => {
      if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
        if (confirm('Нова версія доступна. Оновити зараз?')) {
          newSW.postMessage({ action: 'skipWaiting' });
        }
      }
    });
  });
}

async function placeOrder() {
  const reg = await navigator.serviceWorker.ready;
  if (!('sync' in reg)) return alert('Background Sync не підтримується в цьому браузері');

  await reg.sync.register('send-order');
  toast('Замовлення в черзі. Відправиться при появі інтернету.');
}

// ---------------- Offline banner ----------------
function setupOnlineOffline() {
  const set = () => {
    els.offline.style.display = navigator.onLine ? 'none' : 'block';
  };
  window.addEventListener('online', set);
  window.addEventListener('offline', set);
  set();
}

// ---------------- API load ----------------
async function loadMenu() {
  const res = await fetch('/api/menu.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Menu load failed: ${res.status}`);
  return res.json();
}

// ---------------- Events ----------------
function bindEvents() {
  els.btnCart.addEventListener('click', () => {
    updateCartUI();
    openDrawer();
  });
  els.drawerClose.addEventListener('click', closeDrawer);
  els.drawerX.addEventListener('click', closeDrawer);

  els.cartItems.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (!id || !act) return;

    if (act === 'inc') changeQty(id, +1);
    if (act === 'dec') changeQty(id, -1);
    if (act === 'rm') removeItem(id);
  });

  els.btnClearCart.addEventListener('click', () => {
    cart = {};
    saveCart();
    updateCartUI();
    toast('Кошик очищено');
  });

  els.btnCheckout.addEventListener('click', () => {
    if (cartCount() === 0) return toast('Кошик порожній');
    toast('Оформлення: демо-режим');
  });

  els.grid.addEventListener('click', (e) => {
    const buy = e.target.closest('[data-buy]');
    if (buy) return addToCart(buy.dataset.buy);

    const oneclick = e.target.closest('[data-oneclick]');
    if (oneclick) {
      addToCart(oneclick.dataset.oneclick);
      openDrawer();
    }
  });

  els.btnUpdate.addEventListener('click', updateSW);
  els.btnOrderOffline.addEventListener('click', placeOrder);
}

(async function init() {
  setupOnlineOffline();
  bindEvents();
  await registerSW();

  try {
    menu = await loadMenu();
  } catch (e) {
    console.warn(e);
    menu = [
      { id: 'latte', name: 'Лате', price: 65, desc: 'Fallback (нема меню з API).' }
    ];
    toast('Меню в fallback-режимі');
  }

  renderMenu();
  updateCartUI();
})();
