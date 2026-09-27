/* FF Level — user panel */
(() => {
  'use strict';
  const { $, esc, api, withLoading, toast, copy, Modal, fmt, statusBadge, initials, emptyState, formData, Shell } = LV;

  const S = { settings: {}, plans: [], user: null, data: null, offset: 0 };
  const cur = () => S.settings.currency || '৳';
  const sub = () => (S.data ? S.data.user : S.user).subscription;
  const nowServer = () => Date.now() / 1000 + S.offset;
  const remaining = () => Math.max(0, (sub().expires_at || 0) - nowServer());

  async function refresh() {
    const data = await api('/api/panel/overview');
    S.data = data;
    S.user = data.user;
    S.offset = data.now - Date.now() / 1000;
    return data;
  }

  // ---------- small helpers ----------
  function clock(secs) {
    secs = Math.max(0, Math.floor(secs));
    if (!secs) return 'Expired';
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    const p = (n) => String(n).padStart(2, '0');
    return d ? `${d}d ${p(h)}h ${p(m)}m ${p(s)}s` : `${p(h)}h ${p(m)}m ${p(s)}s`;
  }

  function dur(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${secs}s`;
  }

  function levelPct(a) {
    if (a.max_level) return 100;
    return a.level_pct === null || a.level_pct === undefined ? null : Math.min(100, Math.max(0, a.level_pct));
  }

  function etaText(a) {
    if (!a.running) return 'Paused';
    return a.eta_seconds ? `about ${dur(a.eta_seconds)} left` : '';
  }

  // Status as one quiet line: coloured dot + words (+ live match count).
  function statusLine(a) {
    const map = {
      IN_MATCH: ['match', 'In match'], SEARCHING: ['search', 'Finding a match'], ONLINE: ['online', 'Online'],
      CONNECTING: ['wait', 'Connecting'], STARTING: ['wait', 'Starting'], ERROR: ['error', 'Login error'],
      OFFLINE: ['off', 'Offline'], PAUSED: ['off', 'Paused'],
    };
    const [cls, label] = map[a.status] || ['off', a.status || 'Unknown'];
    const live = a.running && a.active_matches ? ` · ${a.active_matches} live` : '';
    return `<span class="st st-${cls}"><i aria-hidden="true"></i>${esc(label)}${live}</span>`;
  }

  // Slim level bar (dashboard list).
  function levelBlock(a) {
    if (!a.level) {
      return `<div class="lvl"><div class="lvl-line"><span class="lvl-now">${a.running ? 'Signing in…' : 'Paused'}</span></div></div>`;
    }
    if (a.max_level) {
      return `<div class="lvl"><div class="lvl-line"><span class="lvl-now">Level ${a.level}</span><span>Max level</span></div>
        <div class="lvl-bar"><span style="width:100%"></span></div></div>`;
    }
    const pct = levelPct(a);
    return `<div class="lvl">
      <div class="lvl-line"><span class="lvl-now">Level ${a.level}</span><span>${pct !== null ? `${Math.floor(pct)}% to level ${a.next_level}` : `Next: level ${a.next_level}`}</span></div>
      <div class="lvl-bar" role="progressbar" aria-valuenow="${Math.round(pct || 0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to level ${a.next_level}"><span style="width:${pct || 0}%"></span></div>
      <div class="lvl-meta"><span>${a.exp_to_next ? `${fmt.num(a.exp_to_next)} EXP to go` : `${fmt.num(a.current_exp)} EXP`}</span><span>${etaText(a)}</span></div>
    </div>`;
  }

  // Level ring (account cards): the level number inside, progress to the next level around it.
  function levelRing(a) {
    const pct = levelPct(a) || 0;
    const R = 34, C = 2 * Math.PI * R;
    const label = a.level ? `Level ${a.level}${levelPct(a) !== null ? `, ${Math.floor(pct)}% to level ${a.next_level}` : ''}` : 'Level unknown';
    return `<div class="ring" role="img" aria-label="${label}">
      <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-track" cx="40" cy="40" r="${R}"/>${pct ? `<circle class="ring-fill" cx="40" cy="40" r="${R}" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/>` : ''}</svg>
      <div class="ring-in"><b>${a.level ?? '–'}</b><small>level</small></div>
    </div>`;
  }

  function nameHue(name) {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) % 360;
    return h;
  }

  function avatar(name, cls = '') {
    return `<span class="acc-avatar ${cls}" style="--h:${nameHue(name)}" aria-hidden="true">${initials(name)}</span>`;
  }

  function contactLinks(cls = 'btn btn-secondary btn-sm') {
    const out = [];
    const tg = (S.settings.contact_telegram || '').trim();
    const wa = (S.settings.contact_whatsapp || '').trim();
    if (tg) out.push(`<a class="${cls}" target="_blank" rel="noopener" href="${esc(tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`)}"><i class="fa-brands fa-telegram" aria-hidden="true"></i>Telegram</a>`);
    if (wa) out.push(`<a class="${cls}" target="_blank" rel="noopener" href="${esc(wa.startsWith('http') ? wa : `https://wa.me/${wa.replace(/[^\d]/g, '')}`)}"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i>WhatsApp</a>`);
    return out.join('');
  }

  function subBadge(s) {
    if (s.banned) return '<span class="badge danger"><span class="dot"></span>Suspended</span>';
    if (s.unlimited) return '<span class="badge accent"><i class="fa-solid fa-crown" aria-hidden="true"></i>Owner</span>';
    if (s.active) return '<span class="badge success"><span class="dot"></span>Active</span>';
    return '<span class="badge danger"><span class="dot"></span>Expired</span>';
  }

  function slotInfo(s) {
    if (s.unlimited) return { used: s.used, max: '∞', pct: 0, free: 'Unlimited', full: false };
    const max = s.max_accounts || 0;
    return { used: s.used, max, pct: max ? Math.min(100, (s.used / max) * 100) : 0, free: `${Math.max(0, max - s.used)} free`, full: s.used >= max };
  }

  // ==================== ADD ACCOUNT (dialog) ====================
  function openAddAccount(onDone) {
    const s = sub();
    const slots = slotInfo(s);
    if (!s.active || slots.full) {
      return Modal.open({
        title: !s.active ? 'No active plan' : 'All slots in use',
        body: `<div class="locked-panel" style="padding:8px 0 4px">
          <div class="lock"><i class="fa-solid ${!s.active ? 'fa-lock' : 'fa-layer-group'}" aria-hidden="true"></i></div>
          <p>${!s.active ? 'Buy a plan or redeem a license key to start adding accounts.' : `Your plan allows ${s.max_accounts} account${s.max_accounts === 1 ? '' : 's'}. Upgrade for more slots, or remove an account first.`}</p></div>`,
        foot: '<button class="btn btn-secondary" data-close>Close</button><a class="btn btn-primary" href="/panel/billing" data-close>See plans</a>',
      });
    }
    const dlg = Modal.open({
      title: 'Add account',
      sub: 'The bot logs in and starts playing right away.',
      body: `<form id="add-form" class="form-grid" novalidate>
          <div class="segmented" role="group" aria-label="Login type" style="width:100%">
            <button type="button" data-kind="guest" aria-pressed="true" style="flex:1">Guest UID</button>
            <button type="button" data-kind="token" aria-pressed="false" style="flex:1">Access token</button>
          </div>
          <div class="form-grid" data-for="guest">
            <div class="field"><label for="f-uid">Guest UID</label><input class="input mono" id="f-uid" name="uid" inputmode="numeric" autocomplete="off" placeholder="4012345678"></div>
            <div class="field"><label for="f-pw">Password</label><input class="input" id="f-pw" name="password" type="password" autocomplete="new-password" placeholder="Guest account password"></div>
          </div>
          <div class="field" data-for="token" hidden><label for="f-token">Access token</label>
            <textarea class="textarea mono" id="f-token" name="token" rows="3" placeholder="Paste the access token"></textarea></div>
          <p class="form-error" id="add-err" role="alert"></p>
        </form>`,
      foot: `<span class="faint" style="margin-right:auto;font-size:13px;align-self:center">${slots.used} / ${slots.max} slots used</span>
             <button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" type="submit" form="add-form"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>`,
    });
    const form = dlg.querySelector('#add-form');
    let kind = 'guest';
    form.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.kind;
      form.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      form.querySelectorAll('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== kind; });
      form.querySelector(kind === 'guest' ? '#f-uid' : '#f-token').focus();
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const err = dlg.querySelector('#add-err');
      err.textContent = '';
      if (kind === 'guest' && (!/^\d+$/.test(d.uid) || !d.password)) { err.textContent = 'Enter the numeric guest UID and its password.'; return; }
      if (kind === 'token' && d.token.length < 20) { err.textContent = 'Paste a valid access token.'; return; }
      const payload = kind === 'guest' ? { kind, uid: d.uid, password: d.password } : { kind, token: d.token };
      await withLoading(dlg.querySelector('[form=add-form]'), async () => {
        try {
          await api('/api/panel/accounts/add', payload);
          dlg.close();
          toast('Account added — the bot is logging in');
          if (onDone) onDone();
        } catch (ex) { err.textContent = ex.message; }
      });
    });
    return dlg;
  }

  // ==================== DASHBOARD ====================
  function planCardHTML() {
    const s = sub();
    const line = s.unlimited ? 'Unlimited accounts, lifetime access'
      : s.active ? `Expires ${fmt.date(s.expires_at)}`
      : s.expires_at ? `Expired ${fmt.date(s.expires_at)} — accounts paused`
      : 'Buy a plan or redeem a key to get started';
    return `
      <div style="position:relative;z-index:1;min-width:0">
        <div class="eyebrow">Current plan</div>
        <div class="plan-name">${esc(s.plan_name || 'No plan')} ${subBadge(s)}</div>
        <p class="muted" style="font-size:14px">${line}</p>
      </div>
      <div class="plan-time">
        <div class="eyebrow">Time left</div>
        <div class="time-big${!s.unlimited && !remaining() ? ' expired' : ''}" id="cd">${s.unlimited ? 'Lifetime' : clock(remaining())}</div>
        <a class="btn btn-primary btn-sm" href="/panel/billing">${s.active ? 'Renew' : 'Get a plan'}</a>
      </div>`;
  }

  function slotsCardHTML() {
    const s = sub();
    const slots = slotInfo(s);
    return `
      <div class="eyebrow">Account slots</div>
      <div class="slots-row"><span class="slots-big">${slots.used}<span> / ${slots.max}</span></span><span class="faint" style="font-size:13.5px">${slots.free}</span></div>
      <div class="progress${slots.full ? ' full' : ''}" role="progressbar" aria-valuenow="${Math.round(slots.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Account slots used"><span style="width:${slots.pct}%"></span></div>
      <div><button class="btn btn-secondary btn-sm" data-add><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button></div>`;
  }

  function liveNum(n) {
    return `<span class="live-num${n ? ' on' : ''}">${fmt.num(n)}</span>`;
  }

  function statsHTML(t) {
    return [
      ['EXP gained', `+${fmt.num(t.gained_exp)}`, 'fa-arrow-trend-up', 'gain'],
      ['EXP per hour', t.exp_per_hour ? `+${fmt.num(t.exp_per_hour)}` : '—', 'fa-gauge-high', 'rate'],
      ['Live matches', liveNum(t.in_match), 'fa-tower-broadcast', ''],
      ['Matches played', fmt.num(t.matches), 'fa-crosshairs', ''],
      ['Highest level', t.top_level || '—', 'fa-trophy', ''],
    ].map(([label, value, icon, cls]) => `
      <div class="card stat">
        <span class="stat-label"><i class="fa-solid ${icon}" aria-hidden="true"></i>${label}</span>
        <div class="stat-value ${cls}">${value}</div>
      </div>`).join('');
  }

  function accountItemsHTML(accounts) {
    if (!accounts.length) {
      return emptyState('fa-gamepad', 'No accounts yet', 'Add your first Free Fire account and the bot starts leveling it up right away.',
        '<button class="btn btn-primary btn-sm" data-add><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>');
    }
    return accounts.map((a) => {
      const name = a.nickname || a.login;
      return `<div class="acc-item">
        ${avatar(name)}
        <div class="who">
          <div class="row1"><b>${esc(a.nickname || 'Signing in…')}</b>${statusLine(a)}</div>
          <div class="row2"><span class="mono">${esc(a.game_id || a.login)}</span>${a.running && a.running_seconds ? `<span class="run">Running for ${dur(a.running_seconds)}</span>` : ''}</div>
        </div>
        <div class="nums">
          <div><small>EXP gained</small><b${a.gained_exp ? ' style="color:var(--success)"' : ''}>${a.gained_exp ? '+' : ''}${fmt.num(a.gained_exp)}</b></div>
          <div><small>Matches</small><b>${fmt.num(a.matches_played)}</b></div>
        </div>
        ${levelBlock(a)}
      </div>`;
    }).join('');
  }

  function renderOverview(view) {
    view.innerHTML = `
      <div class="dash">
        <div class="dash-main">
          <div class="card plan-card" id="plan-card"><div class="skeleton" style="height:92px;grid-column:1/-1"></div></div>
          <div class="stats five" id="stats">${'<div class="card stat"><div class="skeleton" style="height:56px"></div></div>'.repeat(5)}</div>
          <div class="card">
            <div class="card-head"><h3><i class="fa-solid fa-gamepad" aria-hidden="true"></i>Your accounts</h3><a class="btn btn-ghost btn-sm" href="/panel/accounts">Manage <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div>
            <div class="acc-items" id="acc-list"></div>
          </div>
        </div>
        <aside class="dash-side">
          <div class="card slots-card" id="slots-card"><div class="skeleton" style="height:92px"></div></div>
          <div class="card">
            <div class="card-head"><h3><i class="fa-solid fa-wave-square" aria-hidden="true"></i>Recent activity</h3><span class="badge success live"><span class="dot"></span>Live</span></div>
            <div class="feed" id="feed" style="max-height:520px"></div>
          </div>
        </aside>
      </div>`;
    const load = async () => {
      try {
        const d = await refresh();
        if (Shell.current !== 'overview') return;
        $('#plan-card').innerHTML = planCardHTML();
        $('#slots-card').innerHTML = slotsCardHTML();
        $('#stats').innerHTML = statsHTML(d.totals);
        $('#acc-list').innerHTML = accountItemsHTML(d.accounts);
        $('#feed').innerHTML = LV.feedHTML(d.logs.slice(-12), 'EXP gains and finished matches from your accounts show up here.');
      } catch (e) { toast(e.message, 'error'); }
    };
    view.addEventListener('click', (e) => { if (e.target.closest('[data-add]')) openAddAccount(load); });
    Shell.every(4000, load);
    Shell.every(1000, () => {
      const cd = $('#cd');
      if (cd && S.data && !sub().unlimited) cd.textContent = clock(remaining());
    });
  }

  // ==================== ACCOUNTS ====================
  function accountCardHTML(a, index, s) {
    const overLimit = !s.unlimited && index >= (s.max_accounts || 0);
    let note = '';
    if (a.status === 'PAUSED') note = !s.active ? 'Paused until you renew your plan' : overLimit ? 'Paused: over your plan’s account limit' : 'Paused';
    const name = a.nickname || a.login;
    const idLine = a.game_id || (a.kind === 'guest' ? `UID ${a.login}` : 'Token login');
    const added = new Date(a.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const pct = levelPct(a);

    let title, meta;
    if (!a.level) {
      title = a.running ? 'Signing in to Free Fire' : 'Not running';
      meta = a.running ? 'Stats appear after the first login.' : '';
    } else if (a.max_level) {
      title = 'Max level reached';
      meta = `${fmt.num(a.current_exp)} total EXP`;
    } else if (a.exp_to_next) {
      title = `${fmt.num(a.exp_to_next)} EXP to level ${a.next_level}`;
      const progress = pct !== null ? `${fmt.num(a.current_exp - a.level_start_exp)} of ${fmt.num(a.level_next_exp - a.level_start_exp)} this level` : `${fmt.num(a.current_exp)} total EXP`;
      meta = [progress, a.running && a.eta_seconds ? `about ${dur(a.eta_seconds)}` : ''].filter(Boolean).join(' · ');
    } else {
      title = `Level ${a.level}`;
      meta = `${fmt.num(a.current_exp)} total EXP`;
    }

    const stat = (label, value, cls = '') => `<div><dt>${label}</dt><dd class="${cls}">${value}</dd></div>`;
    return `
      <article class="card acc2${a.status === 'PAUSED' ? ' locked' : ''}">
        <header class="acc2-top">
          ${avatar(name)}
          <div class="acc2-id">
            <div class="acc2-name">${esc(a.nickname || 'New account')}</div>
            <div class="acc2-sub">${esc(idLine)}${a.region ? ` · ${esc(a.region)}` : ''}</div>
          </div>
          ${statusLine(a)}
        </header>
        <div class="acc2-level">
          ${levelRing(a)}
          <div class="acc2-next">
            <div class="t">${esc(title)}</div>
            ${note ? `<div class="m warn">${esc(note)}</div>` : meta ? `<div class="m">${esc(meta)}</div>` : ''}
          </div>
        </div>
        <dl class="acc2-stats">
          ${stat('EXP gained', a.gained_exp ? `+${fmt.compact(a.gained_exp)}` : '0', a.gained_exp ? 'up' : '')}
          ${stat('Matches', fmt.num(a.matches_played))}
          ${stat('Per hour', a.exp_per_hour ? `+${fmt.compact(a.exp_per_hour)}` : 'soon', a.exp_per_hour ? '' : 'none')}
        </dl>
        <footer class="acc2-foot">
          <span>${a.running && a.running_seconds ? `Running for ${dur(a.running_seconds)} · ` : ''}Added ${esc(added)}</span>
          <div class="btns">
            <button class="btn btn-ghost btn-sm btn-icon" data-refresh="${a.id}" aria-label="Refresh stats" title="Refresh stats"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
            <button class="btn btn-ghost btn-sm btn-icon danger-hover" data-del="${a.id}" aria-label="Remove account" title="Remove account"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
          </div>
        </footer>
      </article>`;
  }

  function summaryHTML(d) {
    const s = d.user.subscription;
    const slots = slotInfo(s);
    return `<div class="grow">
        <div class="row"><span>Slots used</span><b>${slots.used} / ${slots.max}</b></div>
        <div class="progress${slots.full ? ' full' : ''}"><span style="width:${slots.pct}%"></span></div>
      </div>
      <span class="st st-online"><i aria-hidden="true"></i>${d.totals.running} running</span>
      <span class="st ${d.totals.in_match ? 'st-match' : 'st-off'}"><i aria-hidden="true"></i>${d.totals.in_match} live match${d.totals.in_match === 1 ? '' : 'es'}</span>
      ${s.unlimited ? '' : `<span class="faint" style="font-size:13.5px">${s.active ? `Plan ends in <b style="color:var(--text)">${fmt.remaining(remaining())}</b>` : 'No active plan'}</span>`}`;
  }

  function renderAccounts(view) {
    view.innerHTML = `
      <div class="card summary-bar" id="summary"><div class="skeleton" style="height:28px;flex:1"></div></div>
      <div class="acc-grid" id="acc-grid"><div class="card acc-card"><div class="skeleton" style="height:150px"></div></div></div>`;
    Shell.setActions('<button class="btn btn-primary btn-sm" data-add><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>');
    const load = async () => {
      try {
        const d = await refresh();
        if (Shell.current !== 'accounts') return;
        const s = d.user.subscription;
        $('#summary').innerHTML = summaryHTML(d);
        $('#acc-grid').innerHTML = d.accounts.length
          ? d.accounts.map((a, i) => accountCardHTML(a, i, s)).join('')
          : `<div class="card" style="grid-column:1/-1">${emptyState('fa-gamepad', 'No accounts yet', 'Add a guest UID + password or an access token. Each account uses one slot of your plan.',
              '<button class="btn btn-primary btn-sm" data-add><i class="fa-solid fa-plus" aria-hidden="true"></i>Add account</button>')}</div>`;
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#topbar-actions').onclick = (e) => { if (e.target.closest('[data-add]')) openAddAccount(load); };
    view.addEventListener('click', async (e) => {
      if (e.target.closest('[data-add]')) return openAddAccount(load);
      const del = e.target.closest('[data-del]');
      const ref = e.target.closest('[data-refresh]');
      if (del) {
        const ok = await Modal.confirm({ title: 'Remove this account?', message: 'The bot stops playing on it and the slot becomes free.', confirmText: 'Remove', danger: true });
        if (!ok) return;
        try { await api('/api/panel/accounts/delete', { id: +del.dataset.del }); toast('Account removed'); load(); } catch (err) { toast(err.message, 'error'); }
      } else if (ref) {
        await withLoading(ref, async () => {
          try { await api('/api/panel/accounts/refresh', { id: +ref.dataset.refresh }); toast('Refreshing stats…', 'info'); } catch (err) { toast(err.message, 'error'); }
        });
      }
    });
    Shell.every(4000, load);
  }

  // ==================== BILLING (plans + key + orders) ====================
  function priceCardHTML(p) {
    const s = sub();
    const feats = (p.features || '').split('\n').filter(Boolean);
    const isCurrent = s.active && !s.unlimited && s.plan_name === p.name;
    return `
      <article class="card price-card${p.is_popular ? ' popular' : ''}${isCurrent ? ' current' : ''}">
        ${p.is_popular ? '<div class="ribbon"><span class="badge">Most popular</span></div>' : ''}
        <div>
          <div class="name">${esc(p.name)} ${isCurrent ? '<span class="badge success">Current</span>' : ''}</div>
          <div class="price"><b>${esc(fmt.money(p.price, cur()))}</b><span>/ ${fmt.duration(p.duration_hours)}</span></div>
        </div>
        <div class="quick">
          <span class="badge accent"><i class="fa-solid fa-gamepad" aria-hidden="true"></i>${p.max_accounts} account${p.max_accounts === 1 ? '' : 's'}</span>
          <span class="badge"><i class="fa-regular fa-clock" aria-hidden="true"></i>${fmt.duration(p.duration_hours)}</span>
        </div>
        <ul>${feats.map((f) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${esc(f)}</span></li>`).join('')}</ul>
        <button class="btn ${p.is_popular ? 'btn-primary' : 'btn-secondary'} btn-block" data-buy="${p.id}">${isCurrent ? 'Renew' : 'Buy now'}</button>
      </article>`;
  }

  function openBuy(plan) {
    const methods = S.settings.payment_methods || [];
    const methodsHTML = methods.length ? methods.map((m) => `
      <div class="pay-method">
        <span class="logo">${esc(m.name.slice(0, 2).toUpperCase())}</span>
        <div class="info"><b>${esc(m.name)}${m.type ? ` <span class="faint" style="font-weight:600;font-size:12.5px">· ${esc(m.type)}</span>` : ''}</b><span>${esc(m.number)}</span></div>
        <button class="btn btn-secondary btn-sm" type="button" data-copy="${esc(m.number)}"><i class="fa-regular fa-copy" aria-hidden="true"></i>Copy</button>
      </div>`).join('') : `<div class="callout warning"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>No payment method is set up yet. Please contact the seller.</span></div>`;

    const dlg = Modal.open({
      title: `Buy ${plan.name}`,
      sub: `${plan.max_accounts} account${plan.max_accounts === 1 ? '' : 's'} · ${fmt.duration(plan.duration_hours)}`,
      body: `
        <div class="amount-box"><span>Amount to send</span><b>${esc(fmt.money(plan.price, cur()))}</b></div>
        <div style="display:grid;gap:10px"><div class="label">1. Send the payment to</div>${methodsHTML}</div>
        ${S.settings.payment_note ? `<p class="faint" style="font-size:13px">${esc(S.settings.payment_note)}</p>` : ''}
        <form id="order-form" class="form-grid" novalidate>
          <div class="label">2. Enter your payment details</div>
          <div class="form-row">
            <div class="field"><label for="o-method">Method</label>
              <select class="select" id="o-method" name="method">${methods.map((m) => `<option>${esc(m.name)}</option>`).join('') || '<option>Other</option>'}</select></div>
            <div class="field"><label for="o-sender">Sender number</label><input class="input mono" id="o-sender" name="sender" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></div>
          </div>
          <div class="field"><label for="o-trx">Transaction ID</label><input class="input mono" id="o-trx" name="trx_id" autocomplete="off" placeholder="BKA7X9Q2M1"></div>
          <p class="form-error" id="order-err" role="alert"></p>
        </form>`,
      foot: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" type="submit" form="order-form">Submit order</button>`,
    });
    dlg.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, 'Number copied')));
    const form = dlg.querySelector('#order-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const err = dlg.querySelector('#order-err');
      if (d.sender.length < 4 || d.trx_id.length < 4) { err.textContent = 'Enter the sender number and Transaction ID from your payment.'; return; }
      await withLoading(dlg.querySelector('[form=order-form]'), async () => {
        try {
          await api('/api/panel/orders/create', { plan_id: plan.id, method: d.method, sender: d.sender, trx_id: d.trx_id.toUpperCase() });
          dlg.close();
          toast('Order submitted! Your plan activates once the payment is verified.');
          await loadOrders();
          document.getElementById('orders-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (ex) { err.textContent = ex.message; }
      });
    });
  }

  const orderBadge = (status) => ({ pending: '<span class="badge warning">Pending</span>', approved: '<span class="badge success">Approved</span>', rejected: '<span class="badge danger">Rejected</span>' }[status] || esc(status));

  async function loadOrders() {
    const box = document.getElementById('orders');
    if (!box) return;
    try {
      const { orders } = await api('/api/panel/orders');
      box.innerHTML = orders.length ? `<table class="table"><thead><tr><th>Plan</th><th class="num">Amount</th><th>Payment</th><th>Date</th><th>Status</th></tr></thead><tbody>${
        orders.map((o) => `<tr>
          <td><b>${esc(o.plan_name)}</b><div class="faint" style="font-size:12.5px">${fmt.duration(o.duration_hours)} · ${o.max_accounts} acc</div></td>
          <td class="num"><b>${esc(fmt.money(o.amount, cur()))}</b></td>
          <td>${esc(o.method)}<div class="faint mono" style="font-size:12.5px">${esc(o.trx_id)}</div></td>
          <td class="nowrap faint">${fmt.date(o.created_at)}</td>
          <td>${orderBadge(o.status)}${o.admin_note ? `<div class="faint" style="font-size:12.5px;margin-top:4px">${esc(o.admin_note)}</div>` : ''}</td></tr>`).join('')
      }</tbody></table>` : '<p class="faint" style="padding:20px;font-size:14px">No orders yet. Orders you place will show up here.</p>';
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderBilling(view) {
    const plans = S.plans;
    const s = sub();
    view.innerHTML = `
      ${s.active && !s.unlimited ? `<div class="card summary-bar"><span class="muted" style="font-size:14px">You're on <b style="color:var(--text)">${esc(s.plan_name || 'a plan')}</b> · ${fmt.remaining(remaining())} left. Renewing adds time on top.</span></div>` : ''}
      <div class="pricing" id="pricing">${plans.length ? plans.map(priceCardHTML).join('') : `<div class="card">${emptyState('fa-crown', 'No plans available', 'The seller hasn’t published any plans yet.')}</div>`}</div>
      <div class="card">
        <div class="card-head"><div><h3><i class="fa-solid fa-key" aria-hidden="true"></i>Have a license key?</h3><div class="sub">Redeem it to activate your plan instantly.</div></div></div>
        <div class="card-body">
          <form id="redeem-form" novalidate style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="input-group" style="flex:1;min-width:220px"><i class="fa-solid fa-key" aria-hidden="true"></i><input class="input mono" id="r-code" name="code" placeholder="LVL-XXXX-XXXX-XXXX" autocomplete="off" aria-label="License key"></div>
            <button class="btn btn-primary" type="submit" style="height:44px">Redeem</button>
          </form>
          <p class="form-error" id="redeem-err" role="alert" style="margin-top:10px"></p>
        </div>
      </div>
      <div class="card" id="orders-card">
        <div class="card-head"><h3><i class="fa-solid fa-receipt" aria-hidden="true"></i>Order history</h3>${contactLinks() ? `<div class="chip-row">${contactLinks()}</div>` : ''}</div>
        <div class="table-wrap" id="orders"><div class="card-body"><div class="skeleton" style="height:60px"></div></div></div>
      </div>`;
    $('#pricing').addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) openBuy(plans.find((p) => p.id === +b.dataset.buy));
    });
    const form = $('#redeem-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = formData(form).code.toUpperCase();
      const err = $('#redeem-err');
      err.textContent = '';
      if (!code) { err.textContent = 'Enter your license key.'; return; }
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try {
          const r = await api('/api/panel/redeem', { code });
          form.reset();
          toast(`Activated ${r.plan_name}: ${fmt.duration(r.duration_hours)}, ${r.max_accounts} account(s)`);
          await refresh();
          Shell.navigate('/panel');
        } catch (ex) { err.textContent = ex.message; }
      });
    });
    loadOrders().then(() => {
      if (Shell.current === 'orders') $('#orders-card')?.scrollIntoView({ block: 'start' });
    });
  }

  // ==================== PROFILE ====================
  function renderProfile(view) {
    const u = S.user;
    view.innerHTML = `
      <div class="card profile">
        <div class="profile-cover" aria-hidden="true"></div>
        <div class="profile-head">
          <span class="profile-avatar" style="--h:${nameHue(u.username)}" aria-hidden="true">${initials(u.username)}</span>
          <div class="profile-id">
            <h2>${esc(u.username)} <span id="pf-badge"></span></h2>
            <p><span><i class="fa-regular fa-calendar" aria-hidden="true"></i>Joined ${fmt.day(u.created_at)}</span><span id="pf-plan"></span></p>
          </div>
          <div class="profile-actions"><a class="btn btn-secondary btn-sm" href="/panel/billing"><i class="fa-solid fa-crown" aria-hidden="true"></i>Manage plan</a></div>
        </div>
        <div class="profile-stats" id="pf-stats">${'<div><div class="skeleton" style="height:44px"></div></div>'.repeat(4)}</div>
      </div>
      <div class="grid-2-even">
        <div class="card">
          <div class="card-head"><h3><i class="fa-solid fa-id-card" aria-hidden="true"></i>Account details</h3></div>
          <div class="detail-list" id="pf-details"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><i class="fa-solid fa-shield-halved" aria-hidden="true"></i>Security</h3></div>
          <div class="card-body">
            <form id="pw-form" class="form-grid" novalidate>
              <div class="field"><label for="pw-cur">Current password</label><input class="input" id="pw-cur" name="current" type="password" autocomplete="current-password"></div>
              <div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" name="new" type="password" autocomplete="new-password"><span class="hint">At least 6 characters. Other devices will be signed out.</span></div>
              <p class="form-error" id="pw-err" role="alert"></p>
              <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">Update password</button>
                <a class="btn btn-ghost" href="/logout"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>Sign out</a></div>
            </form>
          </div>
        </div>
      </div>
      ${contactLinks() ? `<div class="card summary-bar"><div class="grow"><b style="font-size:15px">Need help?</b><span class="faint" style="font-size:13.5px">Message support and we will get back to you.</span></div><div class="chip-row">${contactLinks()}</div></div>` : ''}`;

    const detail = (icon, k, v) => `<div class="detail-row"><span class="ic"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><span class="k">${k}</span><span class="v">${v}</span></div>`;
    const paint = (d) => {
      const s = d.user.subscription;
      $('#pf-badge').innerHTML = subBadge(s);
      $('#pf-plan').innerHTML = `<i class="fa-solid fa-crown" aria-hidden="true"></i>${esc(s.plan_name || 'No plan')}`;
      $('#pf-stats').innerHTML = [
        ['Accounts', `${s.used}<span> / ${s.unlimited ? '∞' : s.max_accounts}</span>`, ''],
        ['EXP gained', `+${fmt.compact(d.totals.gained_exp)}`, 'gain'],
        ['Matches', fmt.num(d.totals.matches), ''],
        ['Time left', s.unlimited ? 'Lifetime' : fmt.remaining(remaining()), !s.unlimited && !s.active ? 'bad' : ''],
      ].map(([k, v, cls]) => `<div><small>${k}</small><b class="${cls}">${v}</b></div>`).join('');
      $('#pf-details').innerHTML = [
        detail('fa-user', 'Username', esc(u.username)),
        detail('fa-crown', 'Plan', esc(s.plan_name || '—')),
        detail('fa-clock', 'Access until', s.unlimited ? 'Lifetime' : fmt.date(s.expires_at)),
        detail('fa-layer-group', 'Account slots', `${s.used} / ${s.unlimited ? '∞' : s.max_accounts}`),
        detail('fa-calendar', 'Member since', fmt.day(u.created_at)),
      ].join('');
    };
    refresh().then((d) => { if (Shell.current === 'profile' || Shell.current === 'settings') paint(d); }).catch((e) => toast(e.message, 'error'));

    const form = $('#pw-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(form);
      const err = $('#pw-err');
      err.textContent = '';
      if (d.new.length < 6) { err.textContent = 'New password must be at least 6 characters.'; return; }
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try { await api('/api/panel/password', d); form.reset(); toast('Password updated'); } catch (ex) { err.textContent = ex.message; }
      });
    });
  }

  // ==================== BOOT ====================
  async function boot() {
    try {
      const [info, me] = await Promise.all([api('/api/public/info'), api('/api/me')]);
      S.settings = info.settings;
      S.plans = info.plans;
      S.user = me.user;
    } catch (e) {
      document.getElementById('root').innerHTML = `<div style="padding:40px">${emptyState('fa-plug-circle-xmark', 'Could not load the panel', esc(e.message), '<a class="btn btn-primary" href="/panel">Try again</a>')}</div>`;
      return;
    }
    const nav = [
      { id: 'overview', path: '', label: 'Dashboard', icon: 'fa-house' },
      { id: 'accounts', label: 'Accounts', icon: 'fa-gamepad' },
      { id: 'plans', path: 'billing', label: 'Billing', icon: 'fa-credit-card' },
      { id: 'profile', label: 'Profile', icon: 'fa-user' },
    ];
    if (S.user.role === 'admin') nav.push({ id: 'admin', label: 'Admin panel', icon: 'fa-shield-halved', href: '/admin' });
    Shell.mount({ settings: S.settings, user: S.user, nav, portal: 'Dashboard', base: '/panel' });
    Shell.start({
      overview: { title: `Welcome back, ${S.user.username}`, sub: '', render: renderOverview },
      accounts: { title: 'Accounts', sub: '', render: renderAccounts },
      plans: { title: 'Billing', sub: '', render: renderBilling, path: 'billing' },
      orders: { title: 'Billing', sub: '', render: renderBilling, nav: 'plans' },
      profile: { title: 'Profile', sub: '', render: renderProfile },
      settings: { title: 'Profile', sub: '', render: renderProfile, nav: 'profile' },
    }, 'overview');
  }

  boot();
})();
