/* FF Level — admin panel */
(() => {
  'use strict';
  const { $, $$, esc, api, withLoading, toast, copy, Modal, fmt, statusBadge, initials, emptyState, feedHTML, formData, Shell } = LV;

  const A = { settings: {}, me: null, plans: [], users: [], offset: 0 };
  const cur = () => A.settings.currency || '৳';

  // ---------- helpers ----------
  const toLocalInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fromLocalInput = (v) => (v ? new Date(v).getTime() / 1000 : null);

  function durationFields(prefix, hours = 720, label = 'Access duration') {
    const days = hours % 24 === 0;
    return `<div class="field"><label for="${prefix}-dur">${label}</label>
      <div style="display:grid;grid-template-columns:1fr 120px;gap:8px">
        <input class="input" id="${prefix}-dur" name="${prefix}_value" type="number" min="1" step="1" value="${days ? hours / 24 : hours}">
        <select class="select" name="${prefix}_unit" aria-label="Duration unit"><option value="24" ${days ? 'selected' : ''}>Days</option><option value="1" ${days ? '' : 'selected'}>Hours</option></select>
      </div></div>`;
  }
  const readDuration = (d, prefix) => Math.round(Number(d[`${prefix}_value`] || 0) * Number(d[`${prefix}_unit`] || 24));

  function planOptions(selected = '', includeCustom = true, includeNone = false) {
    return `${includeNone ? '<option value="">No access yet</option>' : ''}${
      A.plans.map((p) => `<option value="${p.id}" ${String(selected) === String(p.id) ? 'selected' : ''}>${esc(p.name)} — ${fmt.duration(p.duration_hours)}, ${p.max_accounts} acc</option>`).join('')
    }${includeCustom ? '<option value="custom">Custom…</option>' : ''}`;
  }

  function accessBadge(u) {
    if (u.role === 'admin') return '<span class="badge accent"><i class="fa-solid fa-crown" aria-hidden="true"></i>Owner</span>';
    if (u.is_banned) return '<span class="badge danger"><span class="dot"></span>Suspended</span>';
    if (u.active) return `<span class="badge success"><span class="dot"></span>${fmt.remaining(u.remaining)} left</span>`;
    if (u.expires_at) return '<span class="badge danger"><span class="dot"></span>Expired</span>';
    return '<span class="badge"><span class="dot"></span>No plan</span>';
  }

  const orderBadge = (s) => ({ pending: '<span class="badge warning"><span class="dot"></span>Pending</span>', approved: '<span class="badge success"><span class="dot"></span>Approved</span>', rejected: '<span class="badge danger"><span class="dot"></span>Rejected</span>' }[s] || esc(s));

  function stat(label, value, icon, tone, foot) {
    return `<div class="card stat"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${tone}"><i class="fa-solid ${icon}" aria-hidden="true"></i></span></div>
      <div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`;
  }

  async function reviewOrder(o, action, onDone) {
    if (action === 'approve') {
      const ok = await Modal.confirm({
        title: `Approve order #${o.id}?`,
        message: `<b>${esc(o.username)}</b> gets <b>${esc(o.plan_name)}</b> — ${fmt.duration(o.duration_hours)} and ${o.max_accounts} account slot(s). Make sure you received <b>${esc(fmt.money(o.amount, cur()))}</b> with Trx ID <span class="mono">${esc(o.trx_id)}</span>.`,
        confirmText: 'Approve & activate',
      });
      if (!ok) return;
      try { await api('/api/admin/orders/review', { id: o.id, action }); toast(`Order #${o.id} approved — access activated`); onDone(); } catch (e) { toast(e.message, 'error'); }
      return;
    }
    const dlg = Modal.open({
      title: `Reject order #${o.id}?`,
      sub: `${esc(o.username)} · ${esc(o.plan_name)} · Trx ${esc(o.trx_id)}`,
      body: `<div class="field"><label for="rj-note">Reason (shown to the user)</label><input class="input" id="rj-note" placeholder="e.g. Transaction ID not found"></div>`,
      foot: '<button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-danger" data-ok>Reject order</button>',
    });
    dlg.querySelector('[data-ok]').addEventListener('click', async (e) => {
      await withLoading(e.currentTarget, async () => {
        try { await api('/api/admin/orders/review', { id: o.id, action, note: dlg.querySelector('#rj-note').value.trim() }); dlg.close(); toast(`Order #${o.id} rejected`, 'info'); onDone(); } catch (ex) { toast(ex.message, 'error'); }
      });
    });
  }

  function pendingListHTML(orders) {
    if (!orders.length) return emptyState('fa-inbox', 'All caught up', 'New payment submissions will appear here for review.');
    return orders.map((o) => `
      <div class="feed-item" style="grid-template-columns:auto 1fr auto;align-items:center">
        <span class="avatar alt">${initials(o.username)}</span>
        <div style="min-width:0"><b>${esc(o.username)}</b> <span class="faint">· ${esc(o.plan_name)}</span>
          <div class="faint" style="font-size:12.5px">${esc(o.method)} · <span class="mono">${esc(o.trx_id)}</span> · ${fmt.ago(o.created_at)}</div></div>
        <div style="display:flex;gap:6px;align-items:center"><b style="margin-right:6px">${esc(fmt.money(o.amount, cur()))}</b>
          <button class="btn btn-success btn-sm btn-icon" data-approve="${o.id}" aria-label="Approve order #${o.id}" title="Approve"><i class="fa-solid fa-check" aria-hidden="true"></i></button>
          <button class="btn btn-danger btn-sm btn-icon" data-reject="${o.id}" aria-label="Reject order #${o.id}" title="Reject"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
      </div>`).join('');
  }

  function consoleHTML(logs) {
    if (!logs.length) return '<div class="faint">Waiting for bot activity…</div>';
    return logs.map((l) => `<div class="ln ${esc(l.level)}"><time>${esc(l.time)}</time><span>${esc(l.message)}</span></div>`).join('');
  }

  // ==================== OVERVIEW ====================
  function renderOverview(view) {
    view.innerHTML = `
      <div class="stats" id="kpi-1">${'<div class="card stat"><div class="skeleton" style="height:84px"></div></div>'.repeat(4)}</div>
      <div class="stats" id="kpi-2"></div>
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div><h3><i class="fa-solid fa-inbox" aria-hidden="true"></i>Pending payments</h3><div class="sub">Verify the Trx ID in your wallet app, then approve</div></div>
            <a class="btn btn-secondary btn-sm" href="/admin/orders">All orders</a></div>
          <div class="feed" id="pending"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><i class="fa-solid fa-terminal" aria-hidden="true"></i>Bot console</h3><a class="btn btn-ghost btn-sm" href="/admin/logs">Open</a></div>
          <div class="console" id="console" style="max-height:380px"></div>
        </div>
      </div>`;
    Shell.setActions('<a class="btn btn-primary btn-sm" href="/admin/keys"><i class="fa-solid fa-key" aria-hidden="true"></i><span class="hide-sm">Generate keys</span></a>');
    let pending = [];
    $('#pending').addEventListener('click', (e) => {
      const b = e.target.closest('[data-approve],[data-reject]');
      if (!b) return;
      const o = pending.find((x) => x.id === +(b.dataset.approve || b.dataset.reject));
      if (o) reviewOrder(o, b.dataset.approve ? 'approve' : 'reject', load);
    });
    async function load() {
      try {
        const d = await api('/api/admin/overview');
        if (Shell.current !== 'overview') return;
        const s = d.stats, t = d.totals;
        pending = d.pending;
        Shell.setCount('orders', s.pending_orders);
        $('#kpi-1').innerHTML = [
          stat('Revenue this month', esc(fmt.money(s.revenue_month, cur())), 'fa-sack-dollar', '', `${esc(fmt.money(s.revenue_total, cur()))} all time`),
          stat('Active subscribers', `${s.active_users}<span class="faint" style="font-size:16px"> / ${s.users}</span>`, 'fa-users', 'success', 'Users with time left'),
          stat('Pending orders', s.pending_orders, 'fa-hourglass-half', s.pending_orders ? 'warning' : 'info', s.pending_orders ? 'Waiting for your review' : 'Nothing to review'),
          stat('Running accounts', `${t.running}<span class="faint" style="font-size:16px"> / ${s.accounts}</span>`, 'fa-server', 'info', `${t.in_match} in match now`),
        ].join('');
        $('#kpi-2').innerHTML = [
          stat('EXP gained', `+${fmt.compact(t.gained_exp)}`, 'fa-arrow-trend-up', 'success', 'All accounts, this session'),
          stat('Matches played', fmt.num(t.matches), 'fa-crosshairs', '', 'This session'),
          stat('Unused keys', s.unused_keys, 'fa-key', 'warning', 'Ready to sell'),
          stat('Bot uptime', `<span class="mono" style="font-size:24px">${fmt.uptime(d.uptime)}</span>`, 'fa-clock', 'info', 'Since last restart'),
        ].join('');
        $('#pending').innerHTML = pendingListHTML(d.pending);
        const c = $('#console');
        const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
        c.innerHTML = consoleHTML(d.logs.slice(-40));
        if (stick) c.scrollTop = c.scrollHeight;
      } catch (e) { toast(e.message, 'error'); }
    }
    Shell.every(4000, load);
  }

  // ==================== USERS ====================
  async function loadUsers() {
    const d = await api('/api/admin/users');
    A.users = d.users;
    A.offset = d.now - Date.now() / 1000;
    return A.users;
  }

  function openAddUser(onDone) {
    const dlg = Modal.open({
      title: 'Add user',
      sub: 'Create a customer login and optionally give access right away.',
      body: `<form id="nu-form" class="form-grid" novalidate>
        <div class="form-row">
          <div class="field"><label for="nu-name">Username</label><input class="input" id="nu-name" name="username" autocomplete="off" placeholder="customer123"></div>
          <div class="field"><label for="nu-pass">Password</label>
            <div class="input-group"><input class="input mono" id="nu-pass" name="password" autocomplete="off" style="padding-right:48px">
              <button type="button" class="copy-btn input-action" data-gen aria-label="Generate password" title="Generate"><i class="fa-solid fa-dice" aria-hidden="true"></i></button></div></div>
        </div>
        <div class="field"><label for="nu-plan">Access</label><select class="select" id="nu-plan" name="plan">${planOptions('', true, true)}</select></div>
        <div class="form-row" data-custom hidden>
          ${durationFields('nu', 720)}
          <div class="field"><label for="nu-slots">Max accounts</label><input class="input" id="nu-slots" name="max_accounts" type="number" min="1" value="1"></div>
        </div>
        <div class="field"><label for="nu-note">Note <span class="faint">(only you see this)</span></label><input class="input" id="nu-note" name="note" placeholder="e.g. paid via bKash, Facebook: John"></div>
        <p class="form-error" id="nu-err" role="alert"></p>
      </form>`,
      foot: '<button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="nu-form"><i class="fa-solid fa-user-plus" aria-hidden="true"></i>Create user</button>',
    });
    const form = dlg.querySelector('#nu-form');
    const pass = dlg.querySelector('#nu-pass');
    const gen = () => { pass.value = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
    gen();
    dlg.querySelector('[data-gen]').addEventListener('click', gen);
    dlg.querySelector('#nu-plan').addEventListener('change', (e) => { dlg.querySelector('[data-custom]').hidden = e.target.value !== 'custom'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const payload = { username: d.username, password: d.password, note: d.note };
      if (d.plan === 'custom') { payload.duration_hours = readDuration(d, 'nu'); payload.max_accounts = +d.max_accounts; }
      else if (d.plan) payload.plan_id = +d.plan;
      await withLoading(dlg.querySelector('[form=nu-form]'), async () => {
        try {
          await api('/api/admin/users/create', payload);
          dlg.close();
          toast(`User ${d.username} created`);
          copy(`Username: ${d.username}\nPassword: ${d.password}\nLogin: ${location.origin}/login`, 'User created — login details copied');
          onDone();
        } catch (ex) { dlg.querySelector('#nu-err').textContent = ex.message; }
      });
    });
  }

  function openManageUser(u, onDone) {
    const isAdmin = u.role === 'admin';
    const dlg = Modal.open({
      title: u.username,
      sub: `Joined ${fmt.day(u.created_at)} · last login ${fmt.ago(u.last_login)} · ${u.used} account(s) added`,
      wide: true,
      body: `
        ${isAdmin ? '<div class="callout"><i class="fa-solid fa-crown" aria-hidden="true"></i><span>Owner accounts always have unlimited access. You can only change the password here.</span></div>' : `
        <div style="display:grid;gap:10px">
          <div class="label">Quick extend <span class="faint" id="mu-left" style="font-weight:500">— currently ${u.active ? `${fmt.remaining(u.remaining)} left` : 'no active access'}</span></div>
          <div class="chip-row">${[[1, '+1 hour'], [24, '+1 day'], [72, '+3 days'], [168, '+7 days'], [720, '+30 days']].map(([h, l]) => `<button type="button" class="chip" data-extend="${h}">${l}</button>`).join('')}</div>
        </div>
        <div style="display:grid;gap:10px">
          <div class="label">Give a plan <span class="faint" style="font-weight:500">— adds the plan’s time and sets its account limit</span></div>
          <div style="display:flex;gap:8px"><select class="select" id="mu-plan">${planOptions('', false)}</select><button type="button" class="btn btn-secondary" data-grant>Apply</button></div>
        </div>`}
        <form id="mu-form" class="form-grid" novalidate style="padding-top:6px;border-top:1px solid var(--line)">
          ${isAdmin ? '' : `
          <div class="form-row">
            <div class="field"><label for="mu-slots">Max accounts</label><input class="input" id="mu-slots" name="max_accounts" type="number" min="0" value="${u.max_accounts}"><span class="hint">How many Free Fire accounts this user can run.</span></div>
            <div class="field"><label for="mu-exp">Access expires</label><input class="input" id="mu-exp" name="expires_at" type="datetime-local" value="${toLocalInput(u.expires_at)}"><span class="hint">Leave empty for no access.</span></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="mu-planname">Plan label</label><input class="input" id="mu-planname" name="plan_name" value="${esc(u.plan_name || '')}" placeholder="e.g. Pro"></div>
            <div class="field"><label for="mu-note">Note</label><input class="input" id="mu-note" name="note" value="${esc(u.note || '')}"></div>
          </div>`}
          <div class="form-row">
            <div class="field"><label for="mu-pass">New password</label><input class="input" id="mu-pass" name="password" autocomplete="new-password" placeholder="Leave empty to keep"></div>
            ${isAdmin ? '' : `<div class="field" style="align-content:end"><label class="switch"><input type="checkbox" name="is_banned" ${u.is_banned ? 'checked' : ''}>Suspend this user</label><span class="hint">Suspended users can’t sign in and their accounts stop.</span></div>`}
          </div>
          <p class="form-error" id="mu-err" role="alert"></p>
        </form>
        ${isAdmin ? '' : `<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--line)">
          <button type="button" class="btn btn-secondary btn-sm" data-revoke><i class="fa-solid fa-ban" aria-hidden="true"></i>Revoke access now</button>
          <button type="button" class="btn btn-danger btn-sm" data-delete><i class="fa-solid fa-trash-can" aria-hidden="true"></i>Delete user</button></div>`}`,
      foot: '<button class="btn btn-secondary" data-close>Close</button><button class="btn btn-primary" type="submit" form="mu-form">Save changes</button>',
    });

    const syncFrom = async () => {
      await loadUsers();
      const fresh = A.users.find((x) => x.id === u.id);
      if (!fresh) return;
      Object.assign(u, fresh);
      const exp = dlg.querySelector('#mu-exp');
      if (exp) exp.value = toLocalInput(u.expires_at);
      const slots = dlg.querySelector('#mu-slots');
      if (slots) slots.value = u.max_accounts;
      const pn = dlg.querySelector('#mu-planname');
      if (pn) pn.value = u.plan_name || '';
      const left = dlg.querySelector('#mu-left');
      if (left) left.textContent = `— currently ${u.active ? `${fmt.remaining(u.remaining)} left` : 'no active access'}`;
      onDone();
    };

    dlg.querySelectorAll('[data-extend]').forEach((b) => b.addEventListener('click', () => withLoading(b, async () => {
      try { await api('/api/admin/users/update', { id: u.id, extend_hours: +b.dataset.extend }); toast(`${b.textContent} added to ${u.username}`); await syncFrom(); } catch (e) { toast(e.message, 'error'); }
    })));
    const grantBtn = dlg.querySelector('[data-grant]');
    if (grantBtn) grantBtn.addEventListener('click', () => withLoading(grantBtn, async () => {
      try { await api('/api/admin/users/grant', { id: u.id, plan_id: +dlg.querySelector('#mu-plan').value }); toast('Plan applied'); await syncFrom(); } catch (e) { toast(e.message, 'error'); }
    }));
    const revoke = dlg.querySelector('[data-revoke]');
    if (revoke) revoke.addEventListener('click', async () => {
      if (!await Modal.confirm({ title: 'Revoke access?', message: `${esc(u.username)}’s access ends now and all their accounts stop. Their accounts stay saved.`, confirmText: 'Revoke', danger: true })) return;
      try { await api('/api/admin/users/update', { id: u.id, expires_at: Date.now() / 1000 - 1 }); toast('Access revoked', 'info'); await syncFrom(); } catch (e) { toast(e.message, 'error'); }
    });
    const del = dlg.querySelector('[data-delete]');
    if (del) del.addEventListener('click', async () => {
      if (!await Modal.confirm({ title: `Delete ${esc(u.username)}?`, message: 'This permanently deletes the user, their accounts and order history. This can’t be undone.', confirmText: 'Delete permanently', danger: true })) return;
      try { await api('/api/admin/users/delete', { id: u.id }); dlg.close(); toast('User deleted', 'info'); onDone(); } catch (e) { toast(e.message, 'error'); }
    });

    const form = dlg.querySelector('#mu-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const payload = { id: u.id };
      if (!isAdmin) {
        payload.max_accounts = +d.max_accounts;
        payload.expires_at = fromLocalInput(d.expires_at);
        payload.plan_name = d.plan_name;
        payload.note = d.note;
        payload.is_banned = d.is_banned;
      }
      if (d.password) payload.password = d.password;
      await withLoading(dlg.querySelector('[form=mu-form]'), async () => {
        try { await api('/api/admin/users/update', payload); dlg.close(); toast('User updated'); onDone(); } catch (ex) { dlg.querySelector('#mu-err').textContent = ex.message; }
      });
    });
  }

  function renderUsers(view) {
    let filter = 'all', q = '';
    view.innerHTML = `
      <div class="toolbar">
        <div class="input-group"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input class="input" id="u-search" placeholder="Search users…" aria-label="Search users"></div>
        <div class="segmented" role="group" aria-label="Filter users">
          ${[['all', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['banned', 'Suspended']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="card"><div class="table-wrap" id="u-table"><div class="card-body"><div class="skeleton" style="height:160px"></div></div></div></div>`;
    Shell.setActions('<button class="btn btn-primary btn-sm" id="add-user"><i class="fa-solid fa-user-plus" aria-hidden="true"></i><span class="hide-sm">Add user</span></button>');

    const paint = () => {
      const list = A.users.filter((u) => {
        if (q && !`${u.username} ${u.note} ${u.plan_name || ''}`.toLowerCase().includes(q)) return false;
        if (filter === 'active') return u.active && u.role !== 'admin';
        if (filter === 'expired') return !u.active && !u.is_banned;
        if (filter === 'banned') return !!u.is_banned;
        return true;
      });
      $('#u-table').innerHTML = list.length ? `<table class="table"><thead><tr><th>User</th><th>Plan</th><th>Accounts</th><th>Access</th><th>Last login</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>${
        list.map((u) => {
          const max = u.role === 'admin' ? null : u.max_accounts;
          const pct = max ? Math.min(100, (u.used / max) * 100) : 0;
          return `<tr>
            <td><div class="user-cell"><span class="avatar ${u.role === 'admin' ? '' : 'alt'}">${initials(u.username)}</span><div style="min-width:0"><div class="name">${esc(u.username)}</div><div class="meta">${esc(u.note || `Joined ${fmt.day(u.created_at)}`)}</div></div></div></td>
            <td>${esc(u.role === 'admin' ? 'Owner' : (u.plan_name || '—'))}</td>
            <td style="min-width:120px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><b>${u.used}</b><span class="faint">/ ${max ?? '∞'}</span></div>${max !== null ? `<div class="progress${pct >= 100 ? ' full' : ''}" style="height:5px"><span style="width:${pct}%"></span></div>` : ''}</td>
            <td>${accessBadge(u)}${u.expires_at && u.role !== 'admin' ? `<div class="faint" style="font-size:12px;margin-top:4px">${fmt.date(u.expires_at)}</div>` : ''}</td>
            <td class="faint nowrap">${fmt.ago(u.last_login)}</td>
            <td class="actions"><button class="btn btn-secondary btn-sm" data-manage="${u.id}"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Manage</button></td></tr>`;
        }).join('')}</tbody></table>`
        : emptyState('fa-users', q || filter !== 'all' ? 'No matching users' : 'No users yet', 'Create a user or let customers register from the website.');
    };
    const reload = async () => { try { await loadUsers(); if (Shell.current === 'users') paint(); } catch (e) { toast(e.message, 'error'); } };

    $('#u-search').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $$('[data-f]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.f;
      $$('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));
    $('#u-table').addEventListener('click', (e) => {
      const b = e.target.closest('[data-manage]');
      if (b) openManageUser(A.users.find((u) => u.id === +b.dataset.manage), reload);
    });
    $('#add-user').addEventListener('click', () => openAddUser(reload));
    Shell.every(15000, reload);
  }

  // ==================== ACCOUNTS ====================
  function renderAccounts(view) {
    let q = '', accounts = [];
    view.innerHTML = `
      <div class="toolbar">
        <div class="input-group"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input class="input" id="a-search" placeholder="Search nickname, ID or owner…" aria-label="Search accounts"></div>
        <span class="spacer"></span><span class="faint" id="a-count" style="font-size:13px"></span>
      </div>
      <div class="card"><div class="table-wrap" id="a-table"><div class="card-body"><div class="skeleton" style="height:160px"></div></div></div></div>`;
    Shell.setActions('<a class="btn btn-secondary btn-sm" href="/panel/accounts"><i class="fa-solid fa-plus" aria-hidden="true"></i><span class="hide-sm">Add my account</span></a>');
    const paint = () => {
      const list = accounts.filter((a) => !q || `${a.nickname} ${a.game_id} ${a.login} ${a.owner}`.toLowerCase().includes(q));
      $('#a-count').textContent = `${accounts.filter((a) => a.running).length} running · ${accounts.length} total`;
      $('#a-table').innerHTML = list.length ? `<table class="table"><thead><tr><th>Account</th><th>Owner</th><th>Login</th><th class="num">Level</th><th class="num">EXP gained</th><th class="num">Matches</th><th>Status</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>${
        list.map((a) => `<tr>
          <td><div class="user-cell"><span class="avatar alt">${initials(a.nickname || a.login)}</span><div style="min-width:0"><div class="name">${esc(a.nickname || 'Logging in…')}</div><div class="meta mono">${esc(a.game_id || '—')}${a.region ? ` · ${esc(a.region)}` : ''}</div></div></div></td>
          <td>${esc(a.owner)}</td>
          <td><span class="faint">${a.kind === 'guest' ? 'Guest' : 'Token'}</span> <span class="mono" style="font-size:12.5px">${esc(a.login)}</span></td>
          <td class="num">${a.level ?? '—'}</td>
          <td class="num" style="color:var(--success)">+${fmt.num(a.gained_exp)}</td>
          <td class="num">${fmt.num(a.matches_played)}</td>
          <td>${statusBadge(a.status)}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm btn-icon" data-refresh="${a.id}" aria-label="Refresh stats" title="Refresh stats"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
            <button class="btn btn-danger btn-sm btn-icon" data-del="${a.id}" aria-label="Remove account" title="Remove"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td></tr>`).join('')
      }</tbody></table>` : emptyState('fa-gamepad', q ? 'No matching accounts' : 'No accounts yet', 'Accounts your customers add will show up here.');
    };
    $('#a-search').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); paint(); });
    $('#a-table').addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]'), ref = e.target.closest('[data-refresh]');
      if (del) {
        const a = accounts.find((x) => x.id === +del.dataset.del);
        if (!await Modal.confirm({ title: 'Remove this account?', message: `The bot stops playing on <b>${esc(a.nickname || a.login)}</b> (owner: ${esc(a.owner)}) and the slot is freed.`, confirmText: 'Remove', danger: true })) return;
        try { await api('/api/panel/accounts/delete', { id: a.id }); toast('Account removed'); load(); } catch (err) { toast(err.message, 'error'); }
      } else if (ref) {
        try { await api('/api/panel/accounts/refresh', { id: +ref.dataset.refresh }); toast('Refreshing stats…', 'info'); } catch (err) { toast(err.message, 'error'); }
      }
    });
    async function load() {
      try { accounts = (await api('/api/admin/accounts')).accounts; if (Shell.current === 'accounts') paint(); } catch (e) { toast(e.message, 'error'); }
    }
    Shell.every(5000, load);
  }

  // ==================== PLANS ====================
  function openPlan(plan, onDone) {
    const p = plan || { name: '', price: '', duration_hours: 720, max_accounts: 1, features: '', is_popular: 0, is_active: 1, sort_order: A.plans.length + 1 };
    const dlg = Modal.open({
      title: plan ? `Edit ${plan.name}` : 'New plan',
      sub: 'Customers see this on the website and in their panel.',
      body: `<form id="pl-form" class="form-grid" novalidate>
        <div class="form-row">
          <div class="field"><label for="pl-name">Plan name</label><input class="input" id="pl-name" name="name" value="${esc(p.name)}" placeholder="e.g. Pro"></div>
          <div class="field"><label for="pl-price">Price (${esc(cur())})</label><input class="input" id="pl-price" name="price" type="number" min="0" step="1" value="${p.price}" placeholder="450"></div>
        </div>
        <div class="form-row">
          ${durationFields('pl', p.duration_hours)}
          <div class="field"><label for="pl-slots">Max accounts</label><input class="input" id="pl-slots" name="max_accounts" type="number" min="1" value="${p.max_accounts}"><span class="hint">Free Fire accounts that can level up at once.</span></div>
        </div>
        <div class="field"><label for="pl-feat">Features <span class="faint">(one per line)</span></label><textarea class="textarea" id="pl-feat" name="features" rows="4">${esc(p.features)}</textarea></div>
        <div class="form-row">
          <div class="field"><label for="pl-sort">Display order</label><input class="input" id="pl-sort" name="sort_order" type="number" value="${p.sort_order}"></div>
          <div class="field" style="align-content:end;gap:12px">
            <label class="switch"><input type="checkbox" name="is_popular" ${p.is_popular ? 'checked' : ''}>Highlight as “Most popular”</label>
            <label class="switch"><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}>Visible to customers</label>
          </div>
        </div>
        <p class="form-error" id="pl-err" role="alert"></p>
      </form>`,
      foot: `<button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="pl-form">${plan ? 'Save plan' : 'Create plan'}</button>`,
    });
    const form = dlg.querySelector('#pl-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const payload = { id: plan?.id, name: d.name, price: +d.price, duration_hours: readDuration(d, 'pl'), max_accounts: +d.max_accounts, features: d.features, sort_order: +d.sort_order, is_popular: d.is_popular, is_active: d.is_active };
      await withLoading(dlg.querySelector('[form=pl-form]'), async () => {
        try { await api('/api/admin/plans/save', payload); dlg.close(); toast(plan ? 'Plan saved' : 'Plan created'); onDone(); } catch (ex) { dlg.querySelector('#pl-err').textContent = ex.message; }
      });
    });
  }

  function renderPlans(view) {
    view.innerHTML = '<div class="pricing" id="plans"></div>';
    Shell.setActions('<button class="btn btn-primary btn-sm" id="new-plan"><i class="fa-solid fa-plus" aria-hidden="true"></i>New plan</button>');
    const paint = () => {
      $('#plans').innerHTML = A.plans.length ? A.plans.map((p) => `
        <article class="card price-card${p.is_popular ? ' popular' : ''}" style="${p.is_active ? '' : 'opacity:.6'}">
          ${p.is_popular ? '<div class="ribbon"><span class="badge"><i class="fa-solid fa-fire" aria-hidden="true"></i>Most popular</span></div>' : ''}
          <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
            <div><div class="name">${esc(p.name)}</div><div class="price"><b>${esc(fmt.money(p.price, cur()))}</b><span>/ ${fmt.duration(p.duration_hours)}</span></div></div>
            ${p.is_active ? '<span class="badge success">Visible</span>' : '<span class="badge">Hidden</span>'}
          </div>
          <div class="quick"><span class="badge accent"><i class="fa-solid fa-gamepad" aria-hidden="true"></i>${p.max_accounts} account${p.max_accounts === 1 ? '' : 's'}</span><span class="badge"><i class="fa-regular fa-clock" aria-hidden="true"></i>${fmt.duration(p.duration_hours)}</span></div>
          <ul>${(p.features || '').split('\n').filter(Boolean).map((f) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${esc(f)}</span></li>`).join('')}</ul>
          <div style="display:flex;gap:8px"><button class="btn btn-secondary" style="flex:1" data-edit="${p.id}"><i class="fa-solid fa-pen" aria-hidden="true"></i>Edit</button>
            <button class="btn btn-danger btn-icon" data-del="${p.id}" aria-label="Delete ${esc(p.name)}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div>
        </article>`).join('') : `<div class="card">${emptyState('fa-crown', 'No plans yet', 'Create your first plan: set its price, how long access lasts and how many accounts it allows.')}</div>`;
    };
    const reload = async () => { A.plans = (await api('/api/admin/plans')).plans; if (Shell.current === 'plans') paint(); };
    paint();
    reload();
    $('#new-plan').addEventListener('click', () => openPlan(null, reload));
    $('#plans').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) openPlan(A.plans.find((p) => p.id === +ed.dataset.edit), reload);
      if (del) {
        const p = A.plans.find((x) => x.id === +del.dataset.del);
        if (!await Modal.confirm({ title: `Delete ${esc(p.name)}?`, message: 'Existing customers keep their current access. Tip: you can hide a plan instead of deleting it.', confirmText: 'Delete plan', danger: true })) return;
        try { await api('/api/admin/plans/delete', { id: p.id }); toast('Plan deleted', 'info'); reload(); } catch (err) { toast(err.message, 'error'); }
      }
    });
  }

  // ==================== ORDERS ====================
  function renderOrders(view) {
    let status = 'pending', orders = [];
    view.innerHTML = `
      <div class="toolbar"><div class="segmented" role="group" aria-label="Filter orders">
        ${[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${k === 'pending'}">${l}</button>`).join('')}
      </div></div>
      <div class="card"><div class="table-wrap" id="o-table"><div class="card-body"><div class="skeleton" style="height:160px"></div></div></div></div>`;
    const paint = () => {
      $('#o-table').innerHTML = orders.length ? `<table class="table"><thead><tr><th>Order</th><th>User</th><th>Plan</th><th class="num">Amount</th><th>Payment</th><th>Submitted</th><th>Status</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>${
        orders.map((o) => `<tr>
          <td class="mono faint">#${o.id}</td>
          <td><b>${esc(o.username || 'deleted')}</b></td>
          <td>${esc(o.plan_name)}<div class="faint" style="font-size:12.5px">${fmt.duration(o.duration_hours)} · ${o.max_accounts} acc</div></td>
          <td class="num"><b>${esc(fmt.money(o.amount, cur()))}</b></td>
          <td>${esc(o.method)} <span class="faint mono" style="font-size:12.5px">${esc(o.sender)}</span>
            <div><span class="key-code" style="font-size:12.5px">${esc(o.trx_id)}</span><button class="copy-btn" data-copy="${esc(o.trx_id)}" aria-label="Copy Trx ID"><i class="fa-regular fa-copy" aria-hidden="true"></i></button></div></td>
          <td class="nowrap faint">${fmt.date(o.created_at)}</td>
          <td>${orderBadge(o.status)}${o.admin_note ? `<div class="faint" style="font-size:12px;margin-top:4px">${esc(o.admin_note)}</div>` : ''}</td>
          <td class="actions">${o.status === 'pending' ? `
            <button class="btn btn-success btn-sm" data-approve="${o.id}"><i class="fa-solid fa-check" aria-hidden="true"></i>Approve</button>
            <button class="btn btn-danger btn-sm btn-icon" data-reject="${o.id}" aria-label="Reject order #${o.id}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('')
      }</tbody></table>` : emptyState('fa-inbox', status === 'pending' ? 'No pending orders' : 'No orders here', 'Orders customers submit from their panel appear here.');
    };
    async function load() {
      try {
        orders = (await api(`/api/admin/orders${status ? `?status=${status}` : ''}`)).orders;
        if (Shell.current !== 'orders') return;
        if (status === 'pending') Shell.setCount('orders', orders.length);
        paint();
      } catch (e) { toast(e.message, 'error'); }
    }
    $$('[data-s]').forEach((b) => b.addEventListener('click', () => {
      status = b.dataset.s;
      $$('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      load();
    }));
    $('#o-table').addEventListener('click', (e) => {
      const c = e.target.closest('[data-copy]');
      if (c) return copy(c.dataset.copy, 'Trx ID copied');
      const b = e.target.closest('[data-approve],[data-reject]');
      if (!b) return;
      const o = orders.find((x) => x.id === +(b.dataset.approve || b.dataset.reject));
      reviewOrder(o, b.dataset.approve ? 'approve' : 'reject', load);
    });
    Shell.every(10000, load);
  }

  // ==================== LICENSE KEYS ====================
  function renderKeys(view) {
    let keys = [], filter = 'unused';
    view.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div><h3><i class="fa-solid fa-key" aria-hidden="true"></i>Generate license keys</h3><div class="sub">Sell keys anywhere — customers redeem them in their panel.</div></div></div>
          <div class="card-body">
            <form id="k-form" class="form-grid" novalidate>
              <div class="form-row">
                <div class="field"><label for="k-plan">Key gives</label><select class="select" id="k-plan" name="plan">${planOptions(A.plans[0]?.id)}</select></div>
                <div class="field"><label for="k-count">How many keys</label><input class="input" id="k-count" name="count" type="number" min="1" max="200" value="5"></div>
              </div>
              <div class="form-row" data-custom hidden>
                ${durationFields('k', 720)}
                <div class="field"><label for="k-slots">Max accounts</label><input class="input" id="k-slots" name="max_accounts" type="number" min="1" value="1"></div>
              </div>
              <div class="field" data-custom hidden><label for="k-label">Plan label</label><input class="input" id="k-label" name="plan_name" placeholder="Custom"></div>
              <div class="field"><label for="k-note">Note <span class="faint">(optional)</span></label><input class="input" id="k-note" name="note" placeholder="e.g. Reseller batch — Rahim"></div>
              <p class="form-error" id="k-err" role="alert"></p>
              <div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>Generate keys</button></div>
            </form>
            <div id="k-result" hidden style="margin-top:18px;display:grid;gap:10px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span class="label">New keys</span><button class="btn btn-secondary btn-sm" id="k-copy-new"><i class="fa-regular fa-copy" aria-hidden="true"></i>Copy all</button></div>
              <textarea class="textarea mono" id="k-new" rows="5" readonly aria-label="Generated keys"></textarea>
            </div>
          </div>
        </div>
        <div class="card"><div class="card-body" id="k-summary" style="display:grid;gap:14px"></div></div>
      </div>
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Filter keys">${[['unused', 'Unused'], ['used', 'Redeemed'], ['all', 'All']].map(([k, l]) => `<button type="button" data-kf="${k}" aria-pressed="${k === 'unused'}">${l}</button>`).join('')}</div>
        <span class="spacer"></span><button class="btn btn-secondary btn-sm" id="k-copy-unused"><i class="fa-regular fa-copy" aria-hidden="true"></i>Copy unused</button>
      </div>
      <div class="card"><div class="table-wrap" id="k-table"></div></div>`;

    const form = $('#k-form');
    $('#k-plan').addEventListener('change', (e) => $$('[data-custom]', form).forEach((el) => { el.hidden = e.target.value !== 'custom'; }));
    const paint = () => {
      const unused = keys.filter((k) => !k.redeemed_at);
      $('#k-summary').innerHTML = `
        <div class="label">Inventory</div>
        ${[['Unused keys', unused.length, 'fa-key', 'warning'], ['Redeemed', keys.length - unused.length, 'fa-circle-check', 'success'], ['Total generated', keys.length, 'fa-layer-group', 'info']]
          .map(([l, v, i, t]) => `<div style="display:flex;align-items:center;gap:12px"><span class="stat-icon ${t}"><i class="fa-solid ${i}" aria-hidden="true"></i></span><span class="muted" style="flex:1">${l}</span><b style="font-size:20px">${v}</b></div>`).join('')}
        <div class="callout"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Redeeming a key adds its time on top of the customer’s remaining time and sets their account limit.</span></div>`;
      const list = keys.filter((k) => filter === 'all' || (filter === 'used' ? k.redeemed_at : !k.redeemed_at));
      $('#k-table').innerHTML = list.length ? `<table class="table"><thead><tr><th>Key</th><th>Gives</th><th>Note</th><th>Created</th><th>Status</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>${
        list.map((k) => `<tr>
          <td class="nowrap"><span class="key-code">${esc(k.code)}</span><button class="copy-btn" data-copy="${esc(k.code)}" aria-label="Copy key"><i class="fa-regular fa-copy" aria-hidden="true"></i></button></td>
          <td>${esc(k.plan_name)}<div class="faint" style="font-size:12.5px">${fmt.duration(k.duration_hours)} · ${k.max_accounts} acc</div></td>
          <td class="faint">${esc(k.note || '—')}</td>
          <td class="faint nowrap">${fmt.day(k.created_at)}</td>
          <td>${k.redeemed_at ? `<span class="badge success">Used</span><div class="faint" style="font-size:12px;margin-top:4px">${esc(k.redeemed_username || 'deleted user')} · ${fmt.day(k.redeemed_at)}</div>` : '<span class="badge warning">Unused</span>'}</td>
          <td class="actions"><button class="btn btn-ghost btn-sm btn-icon" data-kdel="${esc(k.code)}" aria-label="Delete key"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td></tr>`).join('')
      }</tbody></table>` : emptyState('fa-key', 'No keys here', 'Generate keys above and sell them to your customers.');
    };
    const load = async () => { try { keys = (await api('/api/admin/keys')).keys; if (Shell.current === 'keys') paint(); } catch (e) { toast(e.message, 'error'); } };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const payload = { count: +d.count, note: d.note };
      if (d.plan === 'custom') Object.assign(payload, { duration_hours: readDuration(d, 'k'), max_accounts: +d.max_accounts, plan_name: d.plan_name || 'Custom' });
      else payload.plan_id = +d.plan;
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try {
          const r = await api('/api/admin/keys/generate', payload);
          $('#k-err').textContent = '';
          $('#k-result').hidden = false;
          $('#k-new').value = r.codes.join('\n');
          toast(`${r.codes.length} key(s) generated`);
          load();
        } catch (ex) { $('#k-err').textContent = ex.message; }
      });
    });
    $('#k-copy-new').addEventListener('click', () => copy($('#k-new').value, 'Keys copied'));
    $('#k-copy-unused').addEventListener('click', () => {
      const codes = keys.filter((k) => !k.redeemed_at).map((k) => k.code);
      if (!codes.length) return toast('No unused keys', 'info');
      copy(codes.join('\n'), `${codes.length} unused key(s) copied`);
    });
    $$('[data-kf]').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.kf;
      $$('[data-kf]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));
    $('#k-table').addEventListener('click', async (e) => {
      const c = e.target.closest('[data-copy]');
      if (c) return copy(c.dataset.copy, 'Key copied');
      const del = e.target.closest('[data-kdel]');
      if (del && await Modal.confirm({ title: 'Delete this key?', message: `<span class="mono">${esc(del.dataset.kdel)}</span> will stop working. Access already granted by it is not affected.`, confirmText: 'Delete', danger: true })) {
        try { await api('/api/admin/keys/delete', { code: del.dataset.kdel }); toast('Key deleted', 'info'); load(); } catch (err) { toast(err.message, 'error'); }
      }
    });
    load();
  }

  // ==================== LOGS ====================
  function renderLogs(view) {
    let level = 'all';
    view.innerHTML = `
      <div class="toolbar"><div class="segmented" role="group" aria-label="Filter logs">
        ${[['all', 'All'], ['success', 'Success'], ['warning', 'Warnings'], ['error', 'Errors']].map(([k, l]) => `<button type="button" data-l="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}
      </div></div>
      <div class="card"><div class="card-head"><h3><i class="fa-solid fa-terminal" aria-hidden="true"></i>Live console</h3><span class="badge success live"><span class="dot"></span>Live</span></div>
        <div class="console" id="logs" style="max-height:calc(100vh - 280px);min-height:320px" aria-live="off"></div></div>`;
    let logs = [];
    const paint = () => {
      const c = $('#logs');
      const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
      c.innerHTML = consoleHTML(logs.filter((l) => level === 'all' || l.level === level));
      if (stick) c.scrollTop = c.scrollHeight;
    };
    $$('[data-l]').forEach((b) => b.addEventListener('click', () => {
      level = b.dataset.l;
      $$('[data-l]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    }));
    Shell.every(3000, async () => {
      try { logs = (await api('/api/admin/overview')).logs; if (Shell.current === 'logs') paint(); } catch (e) { /* keep last logs */ }
    });
  }

  // ==================== SETTINGS ====================
  function methodRowHTML(m = {}) {
    return `<div class="form-row" data-method style="grid-template-columns:1fr 1.3fr 1fr auto;align-items:end">
      <div class="field"><label>Method</label><input class="input" data-k="name" value="${esc(m.name || '')}" placeholder="bKash"></div>
      <div class="field"><label>Number</label><input class="input mono" data-k="number" value="${esc(m.number || '')}" placeholder="01XXXXXXXXX"></div>
      <div class="field"><label>Type</label><input class="input" data-k="type" value="${esc(m.type || '')}" placeholder="Personal"></div>
      <button type="button" class="btn btn-ghost btn-icon" data-rm aria-label="Remove method"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </div>`;
  }

  function renderSettings(view) {
    const s = A.settings;
    view.innerHTML = `
      <form id="st-form" novalidate style="display:grid;gap:22px">
        <div class="grid-2-even">
          <div class="card">
            <div class="card-head"><h3><i class="fa-solid fa-palette" aria-hidden="true"></i>Branding</h3></div>
            <div class="card-body form-grid">
              <div class="form-row">
                <div class="field"><label for="st-name">Site name</label><input class="input" id="st-name" name="site_name" value="${esc(s.site_name)}"></div>
                <div class="field"><label for="st-cur">Currency symbol</label><input class="input" id="st-cur" name="currency" value="${esc(s.currency)}" placeholder="৳"></div>
              </div>
              <div class="field"><label for="st-tag">Tagline</label><input class="input" id="st-tag" name="tagline" value="${esc(s.tagline)}"><span class="hint">Shown under the headline on the homepage.</span></div>
              <div class="field"><label for="st-ann">Announcement bar</label><input class="input" id="st-ann" name="announcement" value="${esc(s.announcement)}" placeholder="e.g. Eid offer: 20% off all plans!"><span class="hint">Shown at the top of every customer’s panel. Leave empty to hide.</span></div>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3><i class="fa-solid fa-headset" aria-hidden="true"></i>Support & sign-ups</h3></div>
            <div class="card-body form-grid">
              <div class="field"><label for="st-tg">Telegram</label><input class="input" id="st-tg" name="contact_telegram" value="${esc(s.contact_telegram)}" placeholder="@yourname or https://t.me/…"></div>
              <div class="field"><label for="st-wa">WhatsApp</label><input class="input" id="st-wa" name="contact_whatsapp" value="${esc(s.contact_whatsapp)}" placeholder="8801XXXXXXXXX"></div>
              <label class="switch"><input type="checkbox" name="allow_register" ${s.allow_register ? 'checked' : ''}>Allow customers to create accounts from the website</label>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3><i class="fa-solid fa-wallet" aria-hidden="true"></i>Payment methods</h3><div class="sub">Customers send money here and submit the Transaction ID for you to approve.</div></div>
            <button type="button" class="btn btn-secondary btn-sm" id="add-method"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add method</button></div>
          <div class="card-body form-grid">
            <div id="methods" class="form-grid">${(s.payment_methods || []).map(methodRowHTML).join('')}</div>
            <div class="field"><label for="st-note">Payment instructions</label><textarea class="textarea" id="st-note" name="payment_note" rows="3">${esc(s.payment_note)}</textarea></div>
          </div>
        </div>
        <div><button class="btn btn-primary btn-lg" type="submit"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>Save settings</button></div>
      </form>
      <div class="card">
        <div class="card-head"><div><h3><i class="fa-solid fa-chart-simple" aria-hidden="true"></i>Level EXP table</h3>
          <div class="sub">Levels 1–100 use the built-in Free Fire EXP table. Add a line here only if you need to correct a level or add levels above 100.</div></div></div>
        <div class="card-body form-grid">
          <form id="lv-form" class="form-grid" novalidate>
            <div class="field"><label for="lv-table">One level per line: <span class="mono">level total_exp</span></label>
              <textarea class="textarea mono" id="lv-table" name="table" rows="8" placeholder="101 34000000"></textarea>
              <span class="hint" id="lv-hint"></span></div>
            <p class="form-error" id="lv-err" role="alert"></p>
            <div><button class="btn btn-secondary" type="submit">Save level table</button></div>
          </form>
        </div>
      </div>
      <div class="card" style="max-width:560px">
        <div class="card-head"><h3><i class="fa-solid fa-lock" aria-hidden="true"></i>Your admin password</h3></div>
        <div class="card-body">
          <form id="pw-form" class="form-grid" novalidate>
            <div class="form-row">
              <div class="field"><label for="pw-cur">Current password</label><input class="input" id="pw-cur" name="current" type="password" autocomplete="current-password"></div>
              <div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" name="new" type="password" autocomplete="new-password"></div>
            </div>
            <p class="form-error" id="pw-err" role="alert"></p>
            <div><button class="btn btn-secondary" type="submit">Change password</button></div>
          </form>
        </div>
      </div>`;
    const methods = $('#methods');
    $('#add-method').addEventListener('click', () => { methods.insertAdjacentHTML('beforeend', methodRowHTML()); methods.lastElementChild.querySelector('input').focus(); });
    methods.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('[data-method]').remove(); });

    const form = $('#st-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      d.payment_methods = $$('[data-method]', methods).map((row) => Object.fromEntries($$('[data-k]', row).map((i) => [i.dataset.k, i.value.trim()]))).filter((m) => m.name);
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try { A.settings = (await api('/api/admin/settings', d)).settings; toast('Settings saved'); } catch (ex) { toast(ex.message, 'error'); }
      });
    });
    const paintLevels = (levels) => {
      $('#lv-table').value = levels.map((l) => `${l.level} ${Math.round(l.override ?? l.hi)}`).join('\n');
      $('#lv-hint').textContent = levels.length ? `${levels.length} custom level value(s) set.` : 'No custom values — the built-in table is used for every level.';
    };
    api('/api/admin/levels').then((r) => paintLevels(r.levels)).catch(() => {});
    const lv = $('#lv-form');
    lv.addEventListener('submit', async (e) => {
      e.preventDefault();
      await withLoading(lv.querySelector('[type=submit]'), async () => {
        try { paintLevels((await api('/api/admin/levels', { table: $('#lv-table').value })).levels); $('#lv-err').textContent = ''; toast('Level table saved'); } catch (ex) { $('#lv-err').textContent = ex.message; }
      });
    });
    const pw = $('#pw-form');
    pw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(pw);
      await withLoading(pw.querySelector('[type=submit]'), async () => {
        try { await api('/api/panel/password', d); pw.reset(); $('#pw-err').textContent = ''; toast('Password changed'); } catch (ex) { $('#pw-err').textContent = ex.message; }
      });
    });
  }

  // ==================== BOOT ====================
  async function boot() {
    try {
      const [me, st, pl] = await Promise.all([api('/api/me'), api('/api/admin/settings'), api('/api/admin/plans')]);
      A.me = me.user; A.settings = st.settings; A.plans = pl.plans;
    } catch (e) {
      document.getElementById('root').innerHTML = `<div style="padding:40px">${emptyState('fa-plug-circle-xmark', 'Could not load the admin panel', esc(e.message), '<a class="btn btn-primary" href="/admin">Try again</a>')}</div>`;
      return;
    }
    Shell.mount({
      settings: { ...A.settings, announcement: '' },
      base: '/admin',
      user: A.me,
      portal: 'Admin Panel',
      nav: [
        { section: 'Business' },
        { id: 'overview', path: '', label: 'Overview', icon: 'fa-chart-line' },
        { id: 'orders', label: 'Orders', icon: 'fa-inbox' },
        { id: 'users', label: 'Users', icon: 'fa-users' },
        { id: 'plans', label: 'Plans & pricing', icon: 'fa-crown' },
        { id: 'keys', label: 'License keys', icon: 'fa-key' },
        { section: 'Bot' },
        { id: 'accounts', label: 'All accounts', icon: 'fa-gamepad' },
        { id: 'logs', label: 'Live console', icon: 'fa-terminal' },
        { section: 'System' },
        { id: 'settings', label: 'Settings', icon: 'fa-gear' },
        { id: 'panel', label: 'My user panel', icon: 'fa-arrow-up-right-from-square', href: '/panel' },
      ],
    });
    Shell.start({
      overview: { title: 'Overview', sub: 'Revenue, subscribers and bot health at a glance', render: renderOverview },
      orders: { title: 'Orders', sub: 'Verify payments and activate plans', render: renderOrders },
      users: { title: 'Users', sub: 'Access time, account limits and suspensions', render: renderUsers },
      plans: { title: 'Plans & pricing', sub: 'Set price, access duration and account limit for each plan', render: renderPlans },
      keys: { title: 'License keys', sub: 'Generate keys to sell outside the website', render: renderKeys },
      accounts: { title: 'All accounts', sub: 'Every Free Fire account running on the bot', render: renderAccounts },
      logs: { title: 'Live console', sub: 'Real-time bot output', render: renderLogs },
      settings: { title: 'Settings', sub: 'Branding, payments and support', render: renderSettings },
    }, 'overview');
    api('/api/admin/orders?status=pending').then((r) => Shell.setCount('orders', r.orders.length)).catch(() => {});
  }

  boot();
})();
