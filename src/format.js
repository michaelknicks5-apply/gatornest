export const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Math.round(n).toLocaleString('en-US'));
export const miles = (n) => (n == null ? '—' : (n < 10 ? n.toFixed(1) : Math.round(n)) + ' mi');
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

export function ago(iso, now = Date.now()) {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export const TYPE_LABEL = { house: 'House', townhouse: 'Townhouse', duplex: 'Duplex', condo: 'Condo', apartment: 'Apartment' };
export const STATUS_STEPS = ['New', 'Interested', 'Contacted', 'Toured', 'Applied', 'Passed'];

// Three-state detail value -> short text. null means the source didn't say.
export const tri = (v, yes = 'Yes', no = 'No') => (v === true ? yes : v === false ? no : 'Unverified');

export function phonePretty(p) {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p || '';
}
