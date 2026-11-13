// RentCast source adapter. Quota-aware: it only spends a request when the monthly budget allows.
// Docs: https://developers.rentcast.io/reference/rental-listings-long-term
import { http, log } from '../util.mjs';
import { addressKey, slug, prettyAddress } from '../../shared/address.js';

const TYPE = { 'Single Family': 'house', Townhouse: 'townhouse', Condo: 'condo', 'Multi-Family': 'duplex', Apartment: 'apartment', Manufactured: 'house' };
const H = 3600e3;

// The quota period starts on the day of the month the RentCast plan was activated.
export function quotaPeriod(now, billingDay) {
  const d = new Date(now);
  const day = Math.min(Math.max(1, billingDay || 1), 28);
  let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day);
  if (start > now) start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, day);
  const s = new Date(start);
  const end = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, day);
  return { start: new Date(start).toISOString(), end };
}

// Spread the remaining requests evenly over the rest of the period.
export function fetchDecision({ now, quota, budget, periodEnd, force }) {
  const remaining = budget - quota.used;
  if (remaining <= 0) return { go: false, why: `monthly budget of ${budget} is used up`, remaining: 0 };
  if (force) return { go: true, why: 'forced', remaining };
  if (!quota.lastFetch) return { go: true, why: 'first fetch', remaining };
  const last = new Date(quota.lastFetch).getTime();
  const perFetch = Math.max(1, quota.lastPages || 1);
  const interval = ((periodEnd - last) / Math.max(1, Math.floor(remaining / perFetch)));
  const due = last + interval;
  if (now >= due - 10 * 60e3) return { go: true, why: 'due', remaining };
  return { go: false, why: `next fetch in ${((due - now) / H).toFixed(1)} h (${remaining} requests left this period)`, remaining, nextFetch: new Date(due).toISOString() };
}

export function normalize(r) {
  const address = r.addressLine1 || (r.formattedAddress || '').split(',')[0];
  const unit = (r.addressLine2 || '').replace(/^(apt|unit|ste|suite|#)\.?\s*/i, '').trim();
  const key = addressKey(address, unit);
  const agent = r.listingAgent || {};
  const office = r.listingOffice || {};
  return {
    id: 'rc-' + slug(key), key, source: 'rentcast', sourceId: r.id,
    address: prettyAddress(unit ? `${address} #${unit}` : address), city: r.city, state: r.state, zip: r.zipCode,
    lat: r.latitude, lng: r.longitude,
    price: r.price, beds: r.bedrooms ?? null, baths: r.bathrooms ?? null, sqft: r.squareFootage ?? null,
    type: TYPE[r.propertyType] || 'house', complex: r.propertyType === 'Apartment', yearBuilt: r.yearBuilt ?? null,
    listedDate: r.listedDate || r.createdDate || null,
    // RentCast does not publish these; they stay unknown until someone fills them in.
    details: { furnished: null, pets: null, dogs: null, parking: null, washerDryer: null, centralAC: null, dishwasher: null, yard: null, pool: null, utilitiesIncluded: null, internetIncluded: null, availableDate: null, leaseMonths: null, deposit: null },
    description: null, photos: [],
    contact: agent.name || office.name ? { name: agent.name || null, office: office.name || null, phone: agent.phone || office.phone || null, email: agent.email || office.email || null, website: agent.website || office.website || null } : null,
    url: null,
  };
}

export default {
  name: 'rentcast',
  async fetch(ctx) {
    const { cfg, meta, now, env, force } = ctx;
    const budget = Number(env.RENTCAST_MONTHLY_BUDGET || cfg.rentcastMonthlyBudget || 45);
    const period = quotaPeriod(now, cfg.rentcastBillingDay);
    const quota = meta.rentcast && meta.rentcast.periodStart === period.start ? { ...meta.rentcast } : { periodStart: period.start, used: 0, lastFetch: meta.rentcast?.lastFetch || null, lastPages: meta.rentcast?.lastPages || 1 };
    quota.budget = budget;
    meta.rentcast = quota;
    if (!env.RENTCAST_API_KEY) { ctx.warn('RentCast key is not set, so no live listings yet'); return null; }
    const decision = fetchDecision({ now, quota, budget, periodEnd: period.end, force });
    quota.nextFetch = decision.nextFetch || null;
    log(`rentcast: ${decision.go ? 'fetching' : 'skipping'} (${decision.why})`);
    if (!decision.go) return null;

    const all = [];
    let total = null;
    let pages = 0;
    const limit = 500;
    while (pages < (cfg.rentcastMaxPages || 2) && quota.used < budget) {
      const q = new URLSearchParams({ latitude: cfg.center.lat, longitude: cfg.center.lng, radius: cfg.searchRadiusMiles, status: 'Active', limit, offset: pages * limit, includeTotalCount: 'true' });
      if (cfg.rentcastBedrooms) q.set('bedrooms', cfg.rentcastBedrooms);
      quota.used += 1; // count the attempt even if it fails; RentCast may still bill it
      pages += 1;
      let res;
      try {
        res = await http(`https://api.rentcast.io/v1/listings/rental/long-term?${q}`, { headers: { 'X-Api-Key': env.RENTCAST_API_KEY, Accept: 'application/json' } });
      } catch (e) {
        // A rejected key (no plan, wrong key) isn't a billable request, so give it back.
        if (e.status === 401 || e.status === 403) quota.used -= 1;
        if (/subscription-inactive/.test(e.message)) e.message = 'the RentCast key has no active plan. Activate the free Developer plan on the RentCast API dashboard';
        throw e;
      }
      const { data, headers } = res;
      if (!Array.isArray(data)) throw new Error('RentCast returned something other than a list');
      all.push(...data);
      const t = Number(headers.get('x-total-count'));
      if (Number.isFinite(t) && t > 0) total = t;
      if (data.length < limit || (total != null && all.length >= total)) break;
    }
    quota.lastFetch = new Date(now).toISOString();
    quota.lastPages = pages;
    const listings = all.filter((r) => r.latitude && r.longitude && r.price > 0).map(normalize);
    const complete = total == null ? all.length < pages * limit : all.length >= total;
    if (!complete) ctx.note(`RentCast has ${total ?? 'more'} listings in range; fetched the newest ${all.length}`);
    log(`rentcast: ${listings.length} listings in ${pages} request(s), ${budget - quota.used} left this period`);
    return { listings, complete, requests: pages };
  },
};
