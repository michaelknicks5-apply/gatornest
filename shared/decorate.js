// Turns a stored listing into the shape the filters expect. Used by the app and by the alert matcher.
import { haversineMi, estimateTravel } from './geo.js';

const H = 3600e3;

export function decorate(l, { groupSize = 4, landmarks = [], now = Date.now(), override = null, track = null } = {}) {
  const ov = override || {};
  const details = { ...(l.details || {}), ...(ov.details || {}) };
  const photos = ov.photos && ov.photos.length ? ov.photos : l.photos || [];
  const travel = {};
  for (const lm of landmarks) travel[lm.id] = l.enrich?.travel?.[lm.id] || estimateTravel(haversineMi(l, lm));
  const hist = l.priceHistory || [];
  let drop = null;
  if (hist.length > 1) {
    const a = hist[hist.length - 2];
    const b = hist[hist.length - 1];
    if (b.price < a.price && now - new Date(b.date).getTime() < 14 * 24 * H) drop = { from: a.price, to: b.price, date: b.date };
  }
  const first = new Date(l.firstSeen || l.listedDate || now).getTime();
  return {
    ...l, details, photos, url: ov.url || l.url, travel,
    pp: l.price / groupSize, pp4: l.price / 4, pp5: l.price / 5,
    ppsf: l.sqft ? l.price / l.sqft : null,
    bathRatio: l.beds && l.baths != null ? l.baths / l.beds : null,
    ageHours: (now - first) / H,
    isNew: l.status !== 'gone' && now - first < 24 * H,
    dom: Math.max(0, Math.floor((now - new Date(l.listedDate || l.firstSeen || now).getTime()) / (24 * H))),
    drop, deal: l.enrich?.deal || null, flood: l.enrich?.flood || null, nearby: l.enrich?.nearby || null,
    track: track || {},
    edited: !!override,
  };
}
