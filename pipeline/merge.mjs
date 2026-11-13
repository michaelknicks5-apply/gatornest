// Dedupe incoming listings by address key and diff them against the last run.
const DETAIL_KEYS = ['furnished', 'pets', 'dogs', 'parking', 'washerDryer', 'centralAC', 'dishwasher', 'yard', 'pool', 'utilitiesIncluded', 'internetIncluded', 'availableDate', 'leaseMonths', 'deposit'];

function fillDetails(base, extra) {
  const out = { ...(base || {}) };
  for (const k of DETAIL_KEYS) if (out[k] == null && extra && extra[k] != null) out[k] = extra[k];
  return out;
}

// state: the listings array (mutated). Returns nothing; pushes events.
export function applySource(state, name, incoming, { complete, now, events }) {
  const iso = new Date(now).toISOString();
  // On a source's first import everything is "new" to us; date those by when they were listed instead.
  const initial = !state.some((l) => l.source === name);
  const byKey = new Map(state.map((l) => [l.key, l]));
  const seen = new Set();
  for (const inc of incoming) {
    if (seen.has(inc.key)) continue; // duplicate within one pull
    seen.add(inc.key);
    const cur = byKey.get(inc.key);
    if (!cur) {
      const firstSeen = initial && inc.listedDate && Date.parse(inc.listedDate) < now ? new Date(inc.listedDate).toISOString() : iso;
      const l = { ...inc, status: 'active', goneSince: null, firstSeen, lastSeen: iso, listedDate: inc.listedDate || iso, priceHistory: [{ date: iso, price: inc.price }], enrich: null };
      state.push(l);
      byKey.set(l.key, l);
      events.push({ t: iso, type: initial ? 'initial' : 'new', id: l.id, address: l.address, price: l.price });
      continue;
    }
    if (cur.source !== name) {
      // Same house from a second source: keep the first record, borrow whatever it was missing.
      cur.details = fillDetails(cur.details, inc.details);
      if (!cur.url && inc.url) cur.url = inc.url;
      if ((!cur.photos || !cur.photos.length) && inc.photos?.length) cur.photos = inc.photos;
      if (!cur.description && inc.description) cur.description = inc.description;
      continue;
    }
    if (cur.status === 'gone') {
      cur.status = 'active'; cur.goneSince = null;
      events.push({ t: iso, type: 'back', id: cur.id, address: cur.address, price: inc.price });
    }
    if (inc.price !== cur.price) {
      events.push({ t: iso, type: 'price', id: cur.id, address: cur.address, from: cur.price, price: inc.price });
      cur.priceHistory = [...(cur.priceHistory || []), { date: iso, price: inc.price }];
      cur.price = inc.price;
    }
    for (const k of ['beds', 'baths', 'sqft', 'type', 'complex', 'yearBuilt', 'contact', 'sourceId', 'city', 'state', 'zip']) if (inc[k] != null) cur[k] = inc[k];
    cur.details = fillDetails(inc.details, cur.details); // a value the source states wins; otherwise keep what we had
    if (inc.url) cur.url = inc.url;
    if (inc.photos?.length) cur.photos = inc.photos;
    if (inc.description) cur.description = inc.description;
    cur.lastSeen = iso;
  }
  if (complete) {
    for (const l of state) {
      if (l.source === name && l.status === 'active' && !seen.has(l.key)) {
        l.status = 'gone'; l.goneSince = iso;
        events.push({ t: iso, type: 'gone', id: l.id, address: l.address, price: l.price });
      }
    }
  }
}

// Mark big complexes: three or more units listed at one street address.
export function flagComplexes(state) {
  const count = new Map();
  const base = (l) => l.key.split(' unit ')[0];
  for (const l of state) if (l.status === 'active') count.set(base(l), (count.get(base(l)) || 0) + 1);
  for (const l of state) if (count.get(base(l)) >= 3) l.complex = true;
}

export function applyOverrides(state, overrides) {
  for (const l of state) {
    const ov = overrides[l.id];
    if (!ov) continue;
    for (const k of DETAIL_KEYS) if (ov.details && ov.details[k] != null) l.details[k] = ov.details[k];
    if (ov.photos?.length) l.photos = ov.photos;
    if (ov.url) l.url = ov.url;
  }
}

export function purgeGone(state, { now, retentionDays }) {
  const cutoff = now - retentionDays * 24 * 3600e3;
  const removed = [];
  for (let i = state.length - 1; i >= 0; i--) {
    const l = state[i];
    if (l.status === 'gone' && new Date(l.goneSince).getTime() < cutoff) { removed.push(l); state.splice(i, 1); }
  }
  return removed;
}
