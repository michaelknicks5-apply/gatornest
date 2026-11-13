// Plain-English summary of a preset's filters, built from the filters themselves so it stays
// accurate after a preset is edited.
import { DEFAULT_FILTERS, HOUSE_TYPES } from './filters.js';
import { money, TYPE_LABEL } from './format.js';

const listJoin = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const lower = (t) => TYPE_LABEL[t].toLowerCase() + 's';

export function describeFilters(f, landmarks, groupSize = 4) {
  const lines = [];
  const name = (id) => { const lm = landmarks.find((x) => x.id === id); return lm ? lm.short || lm.name : id; };

  // What kind of place
  let what = f.types.length === 1 && f.types[0] === 'house' ? 'Houses only' : f.types.length === HOUSE_TYPES.length ? 'Houses, townhouses, duplexes and condos' : listJoin(f.types.map(lower)).replace(/^./, (c) => c.toUpperCase());
  const beds = f.bedsMin != null && f.bedsMax != null ? `${f.bedsMin}–${f.bedsMax} bedrooms` : f.bedsMin != null ? `${f.bedsMin}+ bedrooms` : f.bedsMax != null ? `up to ${f.bedsMax} bedrooms` : null;
  if (beds) what += `, ${beds}`;
  if (f.bathsMin != null) what += `, ${f.bathsMin}+ baths`;
  if (f.bathRatioMin != null) what += `, at least ${f.bathRatioMin === 1 ? 'one bath per bedroom' : f.bathRatioMin === 0.75 ? '3 baths per 4 bedrooms' : 'one bath per 2 bedrooms'}`;
  if (f.sqftMin != null) what += `, ${f.sqftMin.toLocaleString()}+ sq ft`;
  lines.push(what);

  // Money
  const cost = [];
  if (f.ppMax != null) cost.push(`Up to ${money(f.ppMax)} per person (split ${groupSize} ways)`);
  if (f.rentMin != null || f.rentMax != null) cost.push(f.rentMin != null && f.rentMax != null ? `rent ${money(f.rentMin)}–${money(f.rentMax)}` : f.rentMax != null ? `rent up to ${money(f.rentMax)}` : `rent from ${money(f.rentMin)}`);
  if (f.ppsfMax != null) cost.push(`up to $${f.ppsfMax}/sq ft`);
  if (f.deal === 'good') cost.push('good deals only'); else if (f.deal === 'fair') cost.push('fair price or better');
  if (f.dropped) cost.push('price dropped recently');
  lines.push(cost.length ? cost.join(', ') : 'Any price');

  // Where
  const where = [];
  for (const [id, r] of Object.entries(f.lm || {})) {
    if (!r || r.max == null) continue;
    if (r.mode === 'mi') where.push(`${r.max} mi of ${name(id)}`);
    else where.push(`a ${r.max}-min ${r.mode} of ${name(id)}`);
  }
  if (where.length) lines.push('Within ' + listJoin(where));
  if (f.area) lines.push('Inside your drawn area');
  if (f.hideFlood) lines.push('Skips high-risk flood zones');

  // Must-haves
  const must = [];
  const add = (on, label) => on && must.push(label);
  add(f.furnished, 'furnished'); add(f.pets, 'pets allowed'); add(f.dogs, 'dogs allowed'); add(f.wd, 'in-unit washer/dryer');
  add(f.ac, 'central A/C'); add(f.dishwasher, 'dishwasher'); add(f.outdoor, 'yard or porch'); add(f.pool, 'pool');
  add(f.utilIncl, 'utilities included'); add(f.netIncl, 'internet included');
  if (f.parkingMin != null) must.push(`${f.parkingMin}+ parking spots`);
  if (f.availBy) must.push(`move-in by ${new Date(f.availBy + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
  if (f.leaseMax != null) must.push(`lease of ${f.leaseMax} months or less`);
  let mustLine = must.length ? 'Must be ' + listJoin(must).replace(/^/, '') : '';
  if (must.length) mustLine = 'Must have: ' + listJoin(must);
  if (!f.furnished) mustLine = mustLine ? mustLine + '. Furnished optional' : 'Furnished optional';
  lines.push(mustLine);
  if (must.length && !f.verifiedOnly) lines.push('Listings that don’t say still show, tagged Unverified');
  if (f.verifiedOnly) lines.push('Verified only: hides listings that don’t confirm the must-haves');

  // Freshness and the rest
  const other = [];
  if (f.fresh === 1) other.push('new in the last 24 hours'); else if (f.fresh === 7) other.push('new in the last 7 days');
  if (f.domMax != null) other.push(`listed ${f.domMax} days or less`);
  if (f.favOnly) other.push('favorites only');
  if (f.hasPhotos) other.push('has photos');
  if (!f.hideComplexes) other.push('includes big complexes');
  if (!f.hidePassed) other.push('includes ones you passed on');
  if (!f.showGone) other.push('hides taken listings');
  if (f.q && f.q.trim()) other.push(`mentions “${f.q.trim()}”`);
  if (other.length) lines.push(listJoin(other).replace(/^./, (c) => c.toUpperCase()));
  return lines;
}
