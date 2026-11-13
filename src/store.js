import { useEffect, useState } from 'preact/hooks';
import baseLandmarks from '../config/landmarks.json';
import { haversineMi, estimateTravel } from '../shared/geo.js';
import { STARTER_PRESETS, normalizeFilters, matches, decodePreset } from './filters.js';

const ls = {
  get(k, d) { try { const v = localStorage.getItem('gn.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gn.' + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};

const DEFAULT_SETTINGS = { groupSize: 4, budgetPP: 1100, theme: 'auto', dataMode: 'auto', rings: false, defaultPresetId: 'default', landmarks: null };

const settings = { ...DEFAULT_SETTINGS, ...ls.get('settings', {}) };
const presets = (ls.get('presets', null) || STARTER_PRESETS).map((p) => ({ ...p, filters: normalizeFilters(p.filters) }));
const startPreset = presets.find((p) => p.id === settings.defaultPresetId) || presets[0];

let state = {
  ready: false, loadError: null, usingCache: false, dataSource: null,
  listings: [], meta: null,
  settings, presets,
  activePresetId: startPreset ? startPreset.id : null,
  filters: normalizeFilters(startPreset ? startPreset.filters : {}),
  track: ls.get('track', {}), overrides: ls.get('overrides', {}), manual: ls.get('manual', []),
  lastVisit: ls.get('lastVisit', null),
  now: Date.now(),
  ui: { selectedId: null, sheet: 'closed', panel: null, view: 'map', route: null, drawing: false, toast: null, sort: 'pp', compare: [], editPresetId: null, placing: null },
};

const subs = new Set();
export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export const setUi = (patch) => setState((s) => ({ ui: { ...s.ui, ...patch } }));
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return state;
}

let toastTimer;
export function toast(msg) {
  clearTimeout(toastTimer);
  setUi({ toast: msg });
  toastTimer = setTimeout(() => setUi({ toast: null }), 2600);
}

// ---------- data loading ----------
const H = 3600e3;

async function fetchPack(dir) {
  const get = async (f) => {
    const r = await fetch(`${dir}/${f}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${dir}/${f} ${r.status}`);
    if (r.headers.get('X-From-Cache')) stale = true; // the service worker answered from its saved copy
    return r.json();
  };
  let stale = false;
  const [listings, meta] = await Promise.all([get('listings.json'), get('meta.json')]);
  if (!Array.isArray(listings)) throw new Error('listings.json is not a list');
  return { listings, meta: meta || {}, dir, stale };
}

// Fixture dates are stored relative to when the fixtures were generated; slide them to "now".
function shiftFixtureDates(pack) {
  const delta = Date.now() - new Date(pack.meta.generatedAt).getTime();
  const sh = (iso) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : iso);
  for (const l of pack.listings) {
    l.listedDate = sh(l.listedDate); l.firstSeen = sh(l.firstSeen); l.lastSeen = sh(l.lastSeen); l.goneSince = sh(l.goneSince);
    l.priceHistory = (l.priceHistory || []).map((p) => ({ ...p, date: sh(p.date) }));
  }
  pack.meta.lastRun = sh(pack.meta.lastRun); pack.meta.lastFetch = sh(pack.meta.lastFetch);
}

export async function loadData() {
  const mode = state.settings.dataMode;
  try {
    let pack = null;
    if (mode !== 'fixtures') {
      try { pack = await fetchPack('data'); } catch (e) { if (mode === 'live') throw e; }
    }
    if (mode === 'fixtures' || (mode === 'auto' && (!pack || pack.meta.neverRun))) {
      pack = await fetchPack('fixtures');
      shiftFixtureDates(pack);
    }
    if (!pack.stale) ls.set('cache', { listings: pack.listings, meta: pack.meta, dir: pack.dir, savedAt: Date.now() });
    const saved = ls.get('cache', null);
    setState({ ready: true, listings: pack.listings, meta: pack.meta, dataSource: pack.dir, usingCache: pack.stale ? (saved && saved.savedAt) || Date.now() : false, loadError: null, now: Date.now() });
  } catch (e) {
    // Never blank the map: fall back to the last good copy saved on this device.
    const cache = ls.get('cache', null);
    if (cache && cache.listings) setState({ ready: true, listings: cache.listings, meta: cache.meta, dataSource: cache.dir, usingCache: cache.savedAt, loadError: String(e.message || e), now: Date.now() });
    else setState({ ready: true, listings: [], meta: null, loadError: String(e.message || e), now: Date.now() });
  }
}

// ---------- derived data ----------
export const getLandmarks = (s = state) => s.settings.landmarks || baseLandmarks;
export const baseLandmarkList = baseLandmarks;

let memo = { key: null, value: [] };
export function getListings(s = state) {
  const lms = getLandmarks(s);
  const key = [s.listings, s.overrides, s.manual, s.track, s.settings.groupSize, lms, s.now];
  if (memo.key && key.every((k, i) => k === memo.key[i])) return memo.value;
  const all = [...s.listings, ...s.manual];
  const value = all.map((l) => decorate(l, s, lms));
  memo = { key, value };
  return value;
}

function decorate(l, s, lms) {
  const ov = s.overrides[l.id] || {};
  const details = { ...(l.details || {}), ...(ov.details || {}) };
  const photos = ov.photos && ov.photos.length ? ov.photos : l.photos || [];
  const travel = {};
  for (const lm of lms) {
    const routed = l.enrich?.travel?.[lm.id];
    travel[lm.id] = routed || estimateTravel(haversineMi(l, lm));
  }
  const hist = l.priceHistory || [];
  let drop = null;
  if (hist.length > 1) {
    const a = hist[hist.length - 2];
    const b = hist[hist.length - 1];
    if (b.price < a.price && s.now - new Date(b.date).getTime() < 14 * 24 * H) drop = { from: a.price, to: b.price, date: b.date };
  }
  const first = new Date(l.firstSeen || l.listedDate || s.now).getTime();
  return {
    ...l, details, photos, url: ov.url || l.url, travel,
    pp: l.price / s.settings.groupSize, pp4: l.price / 4, pp5: l.price / 5,
    ppsf: l.sqft ? l.price / l.sqft : null,
    bathRatio: l.beds && l.baths != null ? l.baths / l.beds : null,
    ageHours: (s.now - first) / H,
    isNew: l.status !== 'gone' && s.now - first < 24 * H,
    dom: Math.max(0, Math.floor((s.now - new Date(l.listedDate || l.firstSeen || s.now).getTime()) / (24 * H))),
    drop, deal: l.enrich?.deal || null, flood: l.enrich?.flood || null, nearby: l.enrich?.nearby || null,
    track: s.track[l.id] || {},
    edited: !!s.overrides[l.id],
  };
}

let vmemo = { key: null, value: [] };
export function getVisible(s = state) {
  const all = getListings(s);
  const key = [all, s.filters];
  if (vmemo.key && key.every((k, i) => k === vmemo.key[i])) return vmemo.value;
  const value = all.filter((l) => matches(l, s.filters));
  vmemo = { key, value };
  return value;
}

export const quality = (l, s = state) => (l.status === 'gone' ? 'gone' : l.pp > s.settings.budgetPP ? 'over' : l.deal?.label === 'good' ? 'good' : 'normal');

export function newSinceLastVisit(s = state) {
  if (!s.lastVisit) return 0;
  return getListings(s).filter((l) => l.status !== 'gone' && new Date(l.firstSeen).getTime() > s.lastVisit).length;
}
export function markVisited() { ls.set('lastVisit', Date.now()); }

// ---------- actions ----------
export function setFilters(patch) {
  setState((s) => ({ filters: normalizeFilters({ ...s.filters, ...patch }) }));
}
export function setLandmarkRule(id, rule) {
  setState((s) => {
    const lm = { ...s.filters.lm };
    if (!rule || rule.max == null) delete lm[id]; else lm[id] = rule;
    return { filters: { ...s.filters, lm } };
  });
}
export function applyPreset(id) {
  const p = state.presets.find((x) => x.id === id);
  if (!p) return;
  setState({ activePresetId: id, filters: normalizeFilters(p.filters) });
}
function savePresets(presets) { ls.set('presets', presets); setState({ presets }); }
export function upsertPreset(p) {
  const exists = state.presets.some((x) => x.id === p.id);
  savePresets(exists ? state.presets.map((x) => (x.id === p.id ? p : x)) : [...state.presets, p]);
}
export function deletePreset(id) {
  savePresets(state.presets.filter((x) => x.id !== id));
  if (state.activePresetId === id) setState({ activePresetId: null });
}
export function importPresets(list) {
  const clean = list.filter((p) => p && p.name && p.filters).map((p, i) => ({ id: p.id || 'imp' + Date.now().toString(36) + i, name: String(p.name), emoji: p.emoji || '📍', color: p.color || '#7B4DFF', alerts: !!p.alerts, filters: normalizeFilters(p.filters) }));
  const byId = new Map(state.presets.map((p) => [p.id, p]));
  clean.forEach((p) => byId.set(p.id, p));
  savePresets([...byId.values()]);
  return clean.length;
}
export function resetPresets() { savePresets(STARTER_PRESETS.map((p) => ({ ...p }))); applyPreset('default'); }

export function setSettings(patch) {
  const next = { ...state.settings, ...patch };
  ls.set('settings', next);
  setState({ settings: next });
}
export function setTrack(id, patch) {
  const track = { ...state.track, [id]: { ...(state.track[id] || {}), ...patch, updatedAt: Date.now() } };
  ls.set('track', track);
  setState({ track });
}
export function setOverride(id, patch) {
  const overrides = { ...state.overrides, [id]: { ...(state.overrides[id] || {}), ...patch } };
  ls.set('overrides', overrides);
  setState({ overrides });
}
export function addManual(listing) {
  const manual = [...state.manual.filter((m) => m.id !== listing.id), listing];
  ls.set('manual', manual);
  setState({ manual });
}
export function removeManual(id) {
  const manual = state.manual.filter((m) => m.id !== id);
  ls.set('manual', manual);
  setState({ manual });
}

export function selectListing(id, sheet = 'half') {
  setUi({ selectedId: id, sheet: id ? sheet : 'closed', route: null });
  const base = location.pathname + location.search;
  history.replaceState(null, '', id ? `${base}#l=${encodeURIComponent(id)}` : base);
}

// Deep links: #l=<listing id> opens a listing, #p=<encoded preset> applies a shared preset.
export function readHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (h.get('p')) {
    const p = decodePreset(h.get('p'));
    if (p) {
      setState({ activePresetId: null, filters: p.filters });
      setUi({ sharedPreset: p });
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  return h.get('l');
}

export const theme = (s = state) => (s.settings.theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.settings.theme);
