// Deal score: compares a listing's rent to similar listings in the same pull.
// It spends no API calls. A listing needs at least 3 comparables to get a score.
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeDeals(listings) {
  const pool = listings.filter((l) => l.status !== 'gone' && l.price > 0 && l.beds > 0);
  const out = {};
  for (const l of listings) {
    if (!(l.price > 0 && l.beds > 0)) continue;
    const comps = pool.filter((c) => c.id !== l.id && Math.abs(c.beds - l.beds) <= 1);
    if (comps.length < 3) continue;
    const perBed = median(comps.map((c) => c.price / c.beds));
    const estRent = Math.round((perBed * l.beds) / 25) * 25;
    const pct = (estRent - l.price) / estRent;
    const label = pct >= 0.08 ? 'good' : pct <= -0.08 ? 'high' : 'fair';
    const p = Math.round(Math.abs(pct) * 100);
    const money = (n) => '$' + n.toLocaleString('en-US');
    const why =
      label === 'fair'
        ? `${money(l.price)} is in line with about ${money(estRent)} for similar ${l.beds}-bed listings.`
        : `${money(l.price)} is ${p}% ${pct > 0 ? 'below' : 'above'} about ${money(estRent)} for similar ${l.beds}-bed listings.`;
    out[l.id] = { estRent, pct: Math.round(pct * 1000) / 1000, label, why, comps: comps.length };
  }
  return out;
}
