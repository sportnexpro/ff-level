// Formatting helpers shared by every page.

const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = {
  num: (n: unknown) => Number(n || 0).toLocaleString('en-US'),
  compact: (n: unknown) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0)),
  money: (n: unknown, cur = '৳') => `${cur}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,

  duration(hours: unknown) {
    const h = Number(hours || 0);
    if (h >= 24 && h % 24 === 0) { const d = h / 24; return `${d} day${d === 1 ? '' : 's'}`; }
    return `${h} hour${h === 1 ? '' : 's'}`;
  },

  /** Short remaining time: "3d 4h", "5h 12m", "9m". */
  remaining(secs: unknown) {
    const s = Math.max(0, Math.floor(Number(secs) || 0));
    if (!s) return 'Expired';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    return `${Math.max(m, 1)}m`;
  },

  /** Ticking clock: "12d 04h 09m 33s". */
  clock(secs: unknown) {
    const s = Math.max(0, Math.floor(Number(secs) || 0));
    if (!s) return 'Expired';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return d ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(x)}s` : `${pad(h)}h ${pad(m)}m ${pad(x)}s`;
  },

  /** Elapsed / estimated duration: "2d 3h", "4h 10m", "12m", "40s". */
  dur(secs: unknown) {
    const s = Math.max(0, Math.floor(Number(secs) || 0));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m`;
    return `${s}s`;
  },

  date: (ts: unknown) => ts ? new Date(Number(ts) * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
  day: (ts: unknown) => ts ? new Date(Number(ts) * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',

  ago(ts: unknown) {
    if (!ts) return 'never';
    const s = Math.max(0, Date.now() / 1000 - Number(ts));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  },

  uptime(secs: unknown) {
    const s = Number(secs) || 0;
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map(pad).join(':');
  },

  initials: (name: unknown) => String(name || '?').trim().slice(0, 2).toUpperCase(),

  /** Stable hue per name, for avatar colours. */
  hue(name: unknown) {
    let h = 0;
    for (const c of String(name)) h = (h * 31 + (c.codePointAt(0) || 0)) % 360;
    return h;
  },

  plural: (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`,
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function contactUrls(settings: any) {
  const tg = String(settings?.contact_telegram || '').trim();
  const wa = String(settings?.contact_whatsapp || '').trim();
  return {
    telegram: tg ? (tg.startsWith('http') ? tg : `https://t.me/${tg.replace(/^@/, '')}`) : '',
    whatsapp: wa ? (wa.startsWith('http') ? wa : `https://wa.me/${wa.replace(/[^\d]/g, '')}`) : '',
  };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
}
