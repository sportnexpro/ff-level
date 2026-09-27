/* FF Level — shared client core (api, toasts, dialogs, formatters, app shell) */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  // ---------- API ----------
  async function api(path, body) {
    const opts = body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    let res;
    try {
      res = await fetch(path, { credentials: 'same-origin', ...opts });
    } catch {
      throw new Error('Network error — check your connection');
    }
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (res.status === 401 && !path.startsWith('/api/auth') && !path.startsWith('/api/public')) {
      location.href = '/login';
      throw new Error('Signed out');
    }
    if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function withLoading(btn, fn) {
    if (!btn) return fn();
    btn.classList.add('is-loading');
    btn.disabled = true;
    try { return await fn(); } finally { btn.classList.remove('is-loading'); btn.disabled = false; }
  }

  // ---------- toasts ----------
  const recentToasts = new Map();
  function toast(message, type = 'success') {
    // The panel polls every few seconds: show the same error at most once every 20s.
    const key = `${type}:${message}`;
    if (type === 'error' && Date.now() - (recentToasts.get(key) || 0) < 20000) return;
    recentToasts.set(key, Date.now());
    let host = $('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const icon = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' }[type] || 'fa-circle-info';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><div>${esc(message)}</div>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, type === 'error' ? 5200 : 3400);
  }

  async function copy(text, label = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    }
    toast(label, 'success');
  }

  // ---------- dialogs ----------
  const Modal = {
    open({ title, sub = '', body = '', foot = '', wide = false, onMount } = {}) {
      const dlg = document.createElement('dialog');
      dlg.className = `modal${wide ? ' wide' : ''}`;
      dlg.innerHTML = `
        <div class="modal-head">
          <div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
          <button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
      });
      dlg.addEventListener('close', () => dlg.remove());
      dlg.showModal();
      if (onMount) onMount(dlg);
      const first = dlg.querySelector('.modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea');
      if (first) first.focus();
      return dlg;
    },
    confirm({ title, message, confirmText = 'Confirm', danger = false }) {
      return new Promise((resolve) => {
        let result = false;
        const dlg = Modal.open({
          title,
          body: `<p class="muted">${message}</p>`,
          foot: `<button class="btn btn-secondary" data-close>Cancel</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>`,
        });
        dlg.querySelector('[data-ok]').addEventListener('click', () => { result = true; dlg.close(); });
        dlg.addEventListener('close', () => resolve(result));
        dlg.querySelector('[data-ok]').focus();
      });
    },
  };

  // ---------- formatters ----------
  const fmt = {
    num: (n) => Number(n || 0).toLocaleString('en-US'),
    compact: (n) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0)),
    money: (n, cur = '৳') => `${cur}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    duration(hours) {
      hours = Number(hours || 0);
      if (hours >= 24 && hours % 24 === 0) { const d = hours / 24; return `${d} day${d === 1 ? '' : 's'}`; }
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    },
    remaining(secs) {
      secs = Math.max(0, Math.floor(secs || 0));
      if (!secs) return 'Expired';
      const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
      if (d) return `${d}d ${h}h`;
      if (h) return `${h}h ${m}m`;
      return `${Math.max(m, 1)}m`;
    },
    date: (ts) => ts ? new Date(ts * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    day: (ts) => ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    ago(ts) {
      if (!ts) return 'never';
      const s = Math.max(0, Date.now() / 1000 - ts);
      if (s < 60) return 'just now';
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      return `${Math.floor(s / 86400)}d ago`;
    },
    uptime(secs) {
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
      return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
    },
  };

  const STATUS = {
    ONLINE: ['success live', 'Online'],
    IN_MATCH: ['accent live', 'In match'],
    SEARCHING: ['info live', 'Searching'],
    CONNECTING: ['warning', 'Connecting'],
    STARTING: ['warning', 'Starting'],
    ERROR: ['danger', 'Error'],
    OFFLINE: ['', 'Offline'],
    PAUSED: ['', 'Paused'],
  };
  function statusBadge(status) {
    const [cls, label] = STATUS[status] || ['', status || 'Unknown'];
    return `<span class="badge ${cls}"><span class="dot" aria-hidden="true"></span>${esc(label)}</span>`;
  }

  function countdownHTML(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    const parts = [
      [Math.floor(secs / 86400), 'Days'],
      [Math.floor((secs % 86400) / 3600), 'Hours'],
      [Math.floor((secs % 3600) / 60), 'Min'],
      [secs % 60, 'Sec'],
    ];
    return `<div class="countdown${secs ? '' : ' expired'}" role="timer" aria-label="${esc(fmt.remaining(secs))} remaining">${
      parts.map(([v, l]) => `<div class="unit"><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('')
    }</div>`;
  }

  function initials(name) { return esc(String(name || '?').trim().slice(0, 2).toUpperCase()); }

  function emptyState(icon, title, text, action = '') {
    return `<div class="empty"><div class="empty-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></div>
      <h4>${esc(title)}</h4><p>${text}</p>${action}</div>`;
  }

  function feedHTML(logs, emptyText = 'Activity from your accounts will show up here.') {
    if (!logs.length) return emptyState('fa-wave-square', 'No activity yet', emptyText);
    const icon = { success: 'fa-arrow-trend-up', warning: 'fa-triangle-exclamation', error: 'fa-xmark', info: 'fa-bolt' };
    return logs.slice().reverse().map((l) => `
      <div class="feed-item ${esc(l.level)}">
        <span class="ic"><i class="fa-solid ${icon[l.level] || 'fa-bolt'}" aria-hidden="true"></i></span>
        <span>${esc(l.message)}</span>
        <time>${esc(l.time)}</time>
      </div>`).join('');
  }

  // Reads a form into a plain object.
  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
    $$('input[type=checkbox][name]', form).forEach((c) => { out[c.name] = c.checked; });
    return out;
  }

  // ---------- app shell + router ----------
  const Shell = {
    timers: [],
    routes: {},
    current: null,
    base: '',

    // Clean URLs: '' -> /panel, 'accounts' -> /panel/accounts
    url(path = '') { return path ? `${this.base}/${path}` : this.base; },

    mount({ settings, user, nav, portal, base }) {
      this.base = base;
      const siteName = settings.site_name || 'FF Level';
      document.title = `${portal} · ${siteName}`;
      const navHTML = nav.map((item) => item.section
        ? `<div class="nav-label">${esc(item.section)}</div>`
        : `<a class="nav-item" href="${item.href || this.url(item.path ?? item.id)}" data-route="${item.id}">
             <i class="fa-solid ${item.icon}" aria-hidden="true"></i><span>${esc(item.label)}</span>
             <span class="count" data-count="${item.id}" hidden></span></a>`).join('');
      document.getElementById('root').innerHTML = `
        <div class="app" id="app">
          <aside class="sidebar" aria-label="Main navigation">
            <a class="brand" href="/"><span class="brand-mark"><i class="fa-solid fa-fire" aria-hidden="true"></i></span>
              <span>${esc(siteName)}<small>${esc(portal)}</small></span></a>
            <nav class="nav">${navHTML}</nav>
            <div class="sidebar-foot">
              <div class="me-card">
                <span class="avatar ${user.role === 'admin' ? '' : 'alt'}">${initials(user.username)}</span>
                <span class="who"><b>${esc(user.username)}</b><span>${esc(user.role)}</span></span>
                <a class="btn btn-ghost btn-icon btn-sm" href="/logout" aria-label="Sign out" title="Sign out"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i></a>
              </div>
            </div>
          </aside>
          <div class="scrim" data-close-nav></div>
          <main class="main">
            <header class="topbar">
              <button class="btn btn-secondary btn-icon menu-btn" data-open-nav aria-label="Open menu"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
              <div class="titles"><h1 id="page-title"></h1><p id="page-sub"></p></div>
              <div class="topbar-actions" id="topbar-actions"></div>
            </header>
            ${settings.announcement ? `<div class="announce" role="note"><i class="fa-solid fa-bullhorn" aria-hidden="true"></i><span>${esc(settings.announcement)}</span></div>` : ''}
            <section class="view" id="view" tabindex="-1"></section>
          </main>
        </div>`;
      const app = $('#app');
      $('[data-open-nav]').addEventListener('click', () => app.classList.add('nav-open'));
      $('[data-close-nav]').addEventListener('click', () => app.classList.remove('nav-open'));
      $$('.nav-item').forEach((a) => a.addEventListener('click', () => app.classList.remove('nav-open')));
    },

    setCount(id, n) {
      const el = document.querySelector(`[data-count="${id}"]`);
      if (!el) return;
      el.hidden = !n;
      el.textContent = n > 99 ? '99+' : n;
    },

    setActions(html) { $('#topbar-actions').innerHTML = html; },

    every(ms, fn) {
      fn();
      this.timers.push(setInterval(fn, ms));
    },

    // Route ids map to URL paths via `path` (defaults to the id; the fallback route lives at the base URL).
    start(routes, fallback) {
      this.routes = routes;
      const pathOf = (id) => routes[id].path ?? (id === fallback ? '' : id);
      const byPath = {};
      Object.keys(routes).forEach((id) => { byPath[pathOf(id)] = id; });

      const go = () => {
        // Old bookmarks like /panel#/accounts -> /panel/accounts
        const legacy = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
        if (legacy) history.replaceState(null, '', this.url(routes[legacy] ? pathOf(legacy) : ''));
        const rest = location.pathname.slice(this.base.length).replace(/^\/+|\/+$/g, '');
        let route = byPath[rest];
        if (!route) {
          route = fallback;
          history.replaceState(null, '', this.url(''));
        }
        this.timers.forEach(clearInterval);
        this.timers = [];
        this.current = route;
        const navId = routes[route].nav || route;
        $$('.nav-item').forEach((a) => {
          const active = a.dataset.route === navId;
          a.classList.toggle('active', active);
          if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        const r = routes[route];
        $('#page-title').textContent = r.title;
        $('#page-sub').textContent = r.sub || '';
        this.setActions('');
        // Fresh container per route so listeners from the previous page don't pile up.
        const old = $('#view');
        const view = old.cloneNode(false);
        old.replaceWith(view);
        const topActions = $('#topbar-actions');
        topActions.replaceWith(topActions.cloneNode(false));
        r.render(view);
        window.scrollTo({ top: 0 });
      };
      this._go = go;
      window.addEventListener('popstate', go);
      // Client-side navigation for links inside this app (no full reload, no # in the URL).
      document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest('a[href]');
        if (!a || a.target || a.hasAttribute('download')) return;
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin || (u.pathname !== this.base && !u.pathname.startsWith(`${this.base}/`))) return;
        e.preventDefault();
        this.navigate(u.pathname);
      });
      go();
    },

    navigate(path) {
      if (path !== location.pathname) history.pushState(null, '', path);
      this._go();
    },
  };

  window.LV = { $, $$, esc, api, withLoading, toast, copy, Modal, fmt, statusBadge, countdownHTML, initials, emptyState, feedHTML, formData, Shell };
})();
