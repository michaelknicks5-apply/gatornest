import { pointInPolygon } from '../shared/geo.js';

export const HOUSE_TYPES = ['house', 'townhouse', 'duplex', 'condo'];

export const DEFAULT_FILTERS = {
  // Money
  rentMin: null, rentMax: null, ppMax: 1100, utilIncl: false, netIncl: false, deal: 'any', dropped: false,
  // Space
  bedsMin: 4, bedsMax: null, bathsMin: null, bathRatioMin: null, sqftMin: null, ppsfMax: null,
  types: [...HOUSE_TYPES], hideComplexes: true,
  // Location: lm[landmarkId] = { mode: 'mi' | 'walk' | 'bike' | 'drive', max }
  lm: {}, area: null, hideFlood: false,
  // Must-haves
  furnished: false, pets: false, dogs: false, parkingMin: null, wd: false, ac: false, dishwasher: false, outdoor: false, pool: false,
  availBy: null, leaseMax: null,
  // Freshness and status
  fresh: null, domMax: null, hidePassed: true, favOnly: false, hasPhotos: false, showGone: true, q: '',
  // When true, anything the source didn't confirm counts as a miss.
  verifiedOnly: false,
};

const F = (over) => ({ ...DEFAULT_FILTERS, ...over });

export const STARTER_PRESETS = [
  { id: 'default', name: 'Default', emoji: '🏠', color: '#7B4DFF', alerts: true, starter: true,
    filters: F({ types: ['house'], furnished: true, ppMax: 1100, lm: { deltachi: { mode: 'mi', max: 1.4 }, marston: { mode: 'mi', max: 1.5 }, macdintons: { mode: 'mi', max: 1.5 } } }) },
  { id: 'walkable', name: 'Walkable', emoji: '🚶', color: '#16A866', alerts: false, starter: true,
    filters: F({ lm: { deltachi: { mode: 'walk', max: 10 } } }) },
  { id: 'widenet', name: 'Wide Search', emoji: '', color: '#F59E0B', alerts: false, starter: true,
    filters: F({ ppMax: 1250, lm: { deltachi: { mode: 'mi', max: 3 } } }) },
];

export const normalizeFilters = (f) => ({ ...DEFAULT_FILTERS, ...(f || {}), lm: { ...((f && f.lm) || {}) } });

// A yes/no/unknown check. Unknown passes unless "verified only" is on.
const need = (value, verifiedOnly) => (value === true ? true : value === false ? false : !verifiedOnly);
const atLeast = (value, min, verifiedOnly) => (value == null ? !verifiedOnly : value >= min);
const atMost = (value, max, verifiedOnly) => (value == null ? !verifiedOnly : value <= max);

// l is a decorated listing (see store.decorate).
export function matches(l, f) {
  const v = f.verifiedOnly;
  const d = l.details || {};
  if (l.status === 'gone' && !f.showGone) return false;
  if (f.rentMin != null && l.price < f.rentMin) return false;
  if (f.rentMax != null && l.price > f.rentMax) return false;
  if (f.ppMax != null && l.pp > f.ppMax) return false;
  if (f.utilIncl && !need(d.utilitiesIncluded, v)) return false;
  if (f.netIncl && !need(d.internetIncluded, v)) return false;
  if (f.deal !== 'any') {
    const lab = l.deal?.label;
    if (!lab) { if (v) return false; } else if (f.deal === 'good' ? lab !== 'good' : lab === 'high') return false;
  }
  if (f.dropped && !l.drop) return false;

  if (f.bedsMin != null && l.beds < f.bedsMin) return false;
  if (f.bedsMax != null && l.beds > f.bedsMax) return false;
  if (f.bathsMin != null && !atLeast(l.baths, f.bathsMin, v)) return false;
  if (f.bathRatioMin != null && !atLeast(l.bathRatio, f.bathRatioMin, v)) return false;
  if (f.sqftMin != null && !atLeast(l.sqft, f.sqftMin, v)) return false;
  if (f.ppsfMax != null && !atMost(l.ppsf, f.ppsfMax, v)) return false;
  if (f.types && f.types.length && !f.types.includes(l.type) && !(l.type === 'apartment' && !f.hideComplexes && f.types.length === HOUSE_TYPES.length)) return false;
  if (f.hideComplexes && (l.complex || l.type === 'apartment')) return false;

  for (const [id, rule] of Object.entries(f.lm || {})) {
    if (!rule || rule.max == null) continue;
    const t = l.travel[id];
    if (!t) continue;
    const val = rule.mode === 'mi' ? t.mi : t[rule.mode]?.min;
    if (val != null && val > rule.max) return false;
  }
  if (f.area && f.area.length > 2 && !pointInPolygon(l.lng, l.lat, f.area)) return false;
  if (f.hideFlood && l.flood?.highRisk) return false;

  if (f.furnished && !need(d.furnished, v)) return false;
  if (f.pets && !need(d.pets, v)) return false;
  if (f.dogs && !need(d.dogs, v)) return false;
  if (f.parkingMin != null && !atLeast(d.parking, f.parkingMin, v)) return false;
  if (f.wd && !need(d.washerDryer, v)) return false;
  if (f.ac && !need(d.centralAC, v)) return false;
  if (f.dishwasher && !need(d.dishwasher, v)) return false;
  if (f.outdoor && !need(d.yard, v)) return false;
  if (f.pool && !need(d.pool, v)) return false;
  if (f.availBy && !(d.availableDate == null ? !v : d.availableDate <= f.availBy)) return false;
  if (f.leaseMax != null && !atMost(d.leaseMonths, f.leaseMax, v)) return false;

  if (f.fresh != null && l.ageHours > f.fresh * 24) return false;
  if (f.domMax != null && l.dom > f.domMax) return false;
  if (f.hidePassed && l.track.status === 'Passed') return false;
  if (f.favOnly && !l.track.fav) return false;
  if (f.hasPhotos && !(l.photos && l.photos.length)) return false;
  if (f.q && f.q.trim()) {
    const hay = `${l.address} ${l.description || ''} ${l.type} ${l.contact?.office || ''} ${l.track.notes || ''}`.toLowerCase();
    for (const word of f.q.toLowerCase().split(/[\s,]+/).filter(Boolean)) if (!hay.includes(word)) return false;
  }
  return true;
}

// Which unknown details a listing is leaning on to pass the current filters.
export function unverifiedFor(l, f) {
  const d = l.details || {};
  const out = [];
  const chk = (on, val, label) => { if (on && val == null) out.push(label); };
  chk(f.furnished, d.furnished, 'furnished');
  chk(f.pets, d.pets, 'pets');
  chk(f.dogs, d.dogs, 'dogs');
  chk(f.parkingMin != null, d.parking, 'parking');
  chk(f.wd, d.washerDryer, 'washer/dryer');
  chk(f.ac, d.centralAC, 'A/C');
  chk(f.dishwasher, d.dishwasher, 'dishwasher');
  chk(f.outdoor, d.yard, 'yard');
  chk(f.pool, d.pool, 'pool');
  chk(f.utilIncl, d.utilitiesIncluded, 'utilities');
  chk(f.netIncl, d.internetIncluded, 'internet');
  chk(!!f.availBy, d.availableDate, 'move-in date');
  return out;
}

export function countActive(f) {
  const d = DEFAULT_FILTERS;
  let n = 0;
  for (const k of Object.keys(d)) {
    if (k === 'lm') n += Object.values(f.lm || {}).filter((r) => r && r.max != null).length;
    else if (k === 'types') n += f.types.length !== d.types.length ? 1 : 0;
    else if (k === 'area') n += f.area ? 1 : 0;
    else if (JSON.stringify(f[k]) !== JSON.stringify(d[k])) n += 1;
  }
  return n;
}

export const sameFilters = (a, b) => JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));

// Presets travel in the URL as base64url JSON holding only what differs from the defaults.
const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

export function encodePreset(p) {
  const diff = {};
  for (const k of Object.keys(DEFAULT_FILTERS)) if (JSON.stringify(p.filters[k]) !== JSON.stringify(DEFAULT_FILTERS[k])) diff[k] = p.filters[k];
  return b64.enc(JSON.stringify({ n: p.name, e: p.emoji, c: p.color, f: diff }));
}

export function decodePreset(str) {
  try {
    const o = JSON.parse(b64.dec(str));
    if (!o || typeof o !== 'object' || typeof o.f !== 'object') return null;
    const filters = normalizeFilters({});
    for (const k of Object.keys(DEFAULT_FILTERS)) if (k in o.f) filters[k] = o.f[k];
    return { id: 'p' + Date.now().toString(36), name: String(o.n || 'Shared preset').slice(0, 40), emoji: o.e == null ? '📍' : String(o.e).slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(o.c) ? o.c : '#7B4DFF', alerts: false, filters };
  } catch {
    return null;
  }
}
