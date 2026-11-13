// Applies a "GatorNest sync" issue (opened from the app's Settings screen) to the config files.
// The issue body is untrusted text: it is parsed as JSON, validated field by field, and never executed.
import { readJson, writeJson, p } from './util.mjs';
import { DEFAULT_FILTERS, normalizeFilters } from '../src/filters.js';
import { addressKey, slug } from '../shared/address.js';

const cfg = readJson(p('config/settings.json'), {});
const body = process.env.ISSUE_BODY || '';
const start = body.indexOf('{');
const end = body.lastIndexOf('}');
if (start < 0 || end <= start) { console.error('No JSON found in the issue body.'); process.exit(1); }
let payload;
try { payload = JSON.parse(body.slice(start, end + 1)); } catch (e) { console.error('The issue body is not valid JSON:', e.message); process.exit(1); }
if (!payload || payload.kind !== 'gatornest-sync') { console.error('Not a GatorNest sync payload.'); process.exit(1); }

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const httpUrl = (v) => (typeof v === 'string' && /^https?:\/\/[^\s"'<>]{4,500}$/.test(v) ? v : null);
const TRI = ['furnished', 'pets', 'dogs', 'washerDryer', 'centralAC', 'dishwasher', 'yard', 'pool', 'utilitiesIncluded', 'internetIncluded'];
function cleanDetails(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const k of TRI) if (typeof d[k] === 'boolean') out[k] = d[k];
  if (num(d.parking, 0, 20) != null) out.parking = d.parking;
  if (num(d.leaseMonths, 1, 36) != null) out.leaseMonths = d.leaseMonths;
  if (num(d.deposit, 0, 50000) != null) out.deposit = d.deposit;
  if (typeof d.availableDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.availableDate)) out.availableDate = d.availableDate;
  return out;
}
function cleanFilters(f) {
  const out = {};
  if (!f || typeof f !== 'object') return normalizeFilters({});
  for (const k of Object.keys(DEFAULT_FILTERS)) {
    if (!(k in f)) continue;
    const want = DEFAULT_FILTERS[k];
    const v = f[k];
    if (k === 'lm') { out.lm = {}; for (const [id, r] of Object.entries(v || {}).slice(0, 20)) if (r && ['mi', 'walk', 'bike', 'drive'].includes(r.mode) && num(r.max, 0, 100) != null) out.lm[slug(id)] = { mode: r.mode, max: r.max }; }
    else if (k === 'types') out.types = Array.isArray(v) ? v.filter((t) => DEFAULT_FILTERS.types.includes(t)) : want;
    else if (k === 'area') out.area = Array.isArray(v) ? v.slice(0, 80).filter((pt) => Array.isArray(pt) && num(pt[0], -180, 180) != null && num(pt[1], -90, 90) != null).map((pt) => [pt[0], pt[1]]) : null;
    else if (typeof want === 'boolean') out[k] = v === true;
    else if (k === 'q' || k === 'deal' || k === 'availBy') out[k] = v == null ? want : str(v, 60);
    else out[k] = v == null ? null : num(v, 0, 1e6);
  }
  return normalizeFilters(out);
}

const summary = [];
if (Array.isArray(payload.presets)) {
  const presets = payload.presets.slice(0, 20).filter((x) => x && x.alerts === true && str(x.name, 40)).map((x) => ({ id: slug(str(x.id, 40) || x.name), name: str(x.name, 40), emoji: str(x.emoji, 8) || '📍', alerts: true, filters: cleanFilters(x.filters) }));
  writeJson(p('config/alert-presets.json'), presets);
  summary.push(`${presets.length} alert preset(s): ${presets.map((x) => x.name).join(', ') || 'none'}`);
}
if (Array.isArray(payload.manual) || Array.isArray(payload.removeManual)) {
  const cur = new Map(readJson(p('config/manual-listings.json'), []).map((m) => [m.id, m]));
  for (const id of (payload.removeManual || []).slice(0, 200)) cur.delete(String(id));
  for (const m of (payload.manual || []).slice(0, 100)) {
    const address = str(m?.address, 120);
    const lat = num(m?.lat, cfg.center.lat - 1, cfg.center.lat + 1);
    const lng = num(m?.lng, cfg.center.lng - 1, cfg.center.lng + 1);
    const price = num(m?.price, 100, 100000);
    if (!address || lat == null || lng == null || price == null) continue;
    const id = 'm-' + slug(addressKey(address));
    cur.set(id, { id, address, lat, lng, price, beds: num(m.beds, 0, 20), baths: num(m.baths, 0, 20), sqft: num(m.sqft, 100, 20000), type: DEFAULT_FILTERS.types.includes(m.type) ? m.type : 'house', url: httpUrl(m.url), details: cleanDetails(m.details), listedDate: typeof m.listedDate === 'string' && !isNaN(Date.parse(m.listedDate)) ? new Date(m.listedDate).toISOString() : null });
  }
  writeJson(p('config/manual-listings.json'), [...cur.values()]);
  summary.push(`${cur.size} hand-added listing(s)`);
}
if (payload.overrides && typeof payload.overrides === 'object') {
  const cur = readJson(p('config/overrides.json'), {});
  let n = 0;
  for (const [rawId, ov] of Object.entries(payload.overrides).slice(0, 300)) {
    if (!/^[a-z0-9-]{3,120}$/.test(rawId) || !ov || typeof ov !== 'object') continue;
    const photos = Array.isArray(ov.photos) ? ov.photos.map(httpUrl).filter(Boolean).slice(0, 12) : [];
    cur[rawId] = { details: cleanDetails(ov.details), ...(photos.length ? { photos } : {}), ...(httpUrl(ov.url) ? { url: httpUrl(ov.url) } : {}) };
    n += 1;
  }
  writeJson(p('config/overrides.json'), cur);
  summary.push(`details for ${n} listing(s)`);
}
console.log('Synced: ' + (summary.join('; ') || 'nothing to change'));
