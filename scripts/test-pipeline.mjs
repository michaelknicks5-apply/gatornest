// End-to-end test of the pipeline against mocked services (no network, no keys).
// Run: node scripts/test-pipeline.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-test-'));
fs.cpSync(path.join(repo, 'config'), path.join(tmp, 'config'), { recursive: true });
// Pin the billing day so the test doesn't depend on the real config.
{ const f = path.join(tmp, 'config/settings.json'); const c = JSON.parse(fs.readFileSync(f, 'utf8')); c.rentcastBillingDay = 1; fs.writeFileSync(f, JSON.stringify(c)); }
fs.mkdirSync(path.join(tmp, 'public/data'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'public/data/listings.json'), '[]');
fs.writeFileSync(path.join(tmp, 'public/data/meta.json'), '{"neverRun":true}');
process.env.GN_ROOT = tmp;

const { haversineMi } = await import('../shared/geo.js');
const rc = (addr, lat, lng, price, beds, extra = {}) => ({ id: addr.replace(/\W+/g, '-') + ',-Gainesville,-FL', formattedAddress: `${addr}, Gainesville, FL 32603`, addressLine1: addr, addressLine2: extra.unit || null, city: 'Gainesville', state: 'FL', zipCode: '32603', latitude: lat, longitude: lng, propertyType: extra.type || 'Single Family', bedrooms: beds, bathrooms: extra.baths ?? 2, squareFootage: 1600, yearBuilt: 1950, status: 'Active', price, listedDate: '2026-11-01T00:00:00.000Z', listingAgent: { name: 'Pat Agent', phone: '3525550100', email: 'pat@example.com' }, listingOffice: { name: 'Test Realty' } });
let rentcastRows = [
  rc('1716 NW 3rd Avenue', 29.6551, -82.3451, 3600, 4),
  rc('2018 NW 4th Ave', 29.6561, -82.3495, 4200, 4),
  rc('625 NW 22nd St', 29.6578, -82.3530, 3900, 4),
  rc('405 SW 27th St', 29.6480, -82.3612, 5500, 5),
  rc('1710 SW 35th Pl', 29.6220, -82.3470, 3000, 4, { unit: 'Apt 204', type: 'Apartment' }),
  rc('1710 SW 35th Pl', 29.6220, -82.3470, 3050, 4, { unit: 'Apt 310', type: 'Apartment' }),
  rc('1710 SW 35th Pl', 29.6220, -82.3470, 3100, 4, { unit: '#112', type: 'Condo' }),
];
let rentcastFail = false;
const calls = { rentcast: 0, matrix: 0, directions: 0, fema: 0, overpass: 0, ntfy: [] };
const json = (data, headers = {}) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.host === 'api.rentcast.io') {
    calls.rentcast++;
    if (opts.headers['X-Api-Key'] !== 'test-key') return new Response('{"error":"auth"}', { status: 401 });
    if (rentcastFail) return new Response('upstream down', { status: 503 });
    if (u.searchParams.get('bedrooms') !== '3:*' || u.searchParams.get('status') !== 'Active' || u.searchParams.get('limit') !== '500') throw new Error('unexpected RentCast query: ' + u.search);
    return json(rentcastRows, { 'X-Total-Count': String(rentcastRows.length) });
  }
  if (u.host === 'api.openrouteservice.org') {
    const body = JSON.parse(opts.body);
    if (u.pathname.includes('/matrix/')) {
      calls.matrix++;
      const speed = u.pathname.includes('foot') ? 3 : u.pathname.includes('cycling') ? 10 : 20;
      const pt = (i) => ({ lng: body.locations[i][0], lat: body.locations[i][1] });
      const distances = body.sources.map((s) => body.destinations.map((d) => haversineMi(pt(s), pt(d)) * 1.25));
      return json({ distances, durations: distances.map((row) => row.map((mi) => (mi / speed) * 3600)) });
    }
    calls.directions++;
    const [a, b] = body.coordinates;
    return json({ features: [{ geometry: { type: 'LineString', coordinates: [a, [b[0], a[1]], b] } }] });
  }
  if (u.host === 'hazards.fema.gov') {
    calls.fema++;
    if (u.pathname.includes('/arcgis/')) return new Response('moved', { status: 404 }); // first URL fails; the fallback must work
    const [lng] = u.searchParams.get('geometry').split(',').map(Number);
    return json({ features: [{ attributes: lng < -82.36 ? { FLD_ZONE: 'AE', ZONE_SUBTY: null, SFHA_TF: 'T' } : { FLD_ZONE: 'X', ZONE_SUBTY: 'AREA OF MINIMAL FLOOD HAZARD', SFHA_TF: 'F' } }] });
  }
  if (u.host === 'overpass-api.de') {
    calls.overpass++;
    return json({ elements: [
      { type: 'node', lat: 29.6524, lon: -82.3398, tags: { shop: 'supermarket', name: 'Publix Super Market at University Village' } },
      { type: 'way', center: { lat: 29.6497, lon: -82.347 }, tags: { leisure: 'fitness_centre', name: 'Student Rec' } },
      { type: 'node', lat: 29.6521, lon: -82.356, tags: { amenity: 'fuel', brand: 'Shell' } },
      { type: 'node', lat: 29.6553, lon: -82.3455, tags: { highway: 'bus_stop', name: 'NW 3rd Ave @ NW 17th St' } },
    ] });
  }
  if (u.host === 'ntfy.sh') { calls.ntfy.push(JSON.parse(opts.body)); return new Response('{}', { status: 200 }); }
  throw new Error('unmocked request to ' + u.host);
};

const { run } = await import('../pipeline/run.mjs');
const read = (f) => JSON.parse(fs.readFileSync(path.join(tmp, 'public/data', f), 'utf8'));
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  [' + detail + ']' : ''}`); };
const quiet = async (fn) => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const env = { RENTCAST_API_KEY: 'test-key', ORS_API_KEY: 'ors', NTFY_TOPIC: 'secret-topic' };
const T0 = Date.UTC(2026, 10, 14, 15, 17);
const H = 3600e3;

// --- no keys at all: nothing breaks, the app keeps showing test data
await quiet(() => run({ env: {}, now: T0 - H, pace: 0 }));
check('no keys: run succeeds and the site stays on test data', read('meta.json').neverRun === true && read('listings.json').length === 0 && read('meta.json').warnings.some((w) => /RentCast key/.test(w)));

// --- first real run
await quiet(() => run({ env, now: T0, pace: 0 }));
let ls = read('listings.json'); let meta = read('meta.json');
const by = (addr) => ls.find((l) => l.address.startsWith(addr));
check('first run stores all 7 listings', ls.length === 7, String(ls.length));
check('one RentCast request spent and counted', calls.rentcast === 1 && meta.rentcast.used === 1 && meta.rentcast.budget === 45);
check('directions shown in caps', by('1716').address === '1716 NW 3rd Avenue', by('1716').address);
check('first import is dated by listing date, not marked new', by('1716').firstSeen === '2026-11-01T00:00:00.000Z' && read('history.json').length === 0);
check('address normalized into a stable id', !!ls.find((l) => l.id === 'rc-1716-nw-3rd-ave'), ls.map((l) => l.id).join(' '));
check('units dedupe separately and 3 units at one address flag a complex', ls.filter((l) => l.complex).length === 3);
check('unknown details stay null (unverified)', by('1716').details.furnished === null && by('1716').details.parking === null);
check('contact carried through', by('1716').contact.phone === '3525550100');
check('routed travel times for every landmark', Object.keys(by('1716').enrich.travel).length === 6 && by('1716').enrich.travel.deltachi.walk.min > 0 && !by('1716').enrich.travel.deltachi.est, JSON.stringify(by('1716').enrich.travel.deltachi));
check('one matrix call per mode per batch', calls.matrix === 3, String(calls.matrix));
check('flood zone via the fallback FEMA URL', by('1716').enrich.flood.zone === 'X' && by('405').enrich.flood.highRisk === true);
check('nearby essentials from one Overpass call', calls.overpass === 1 && /Publix/.test(by('1716').enrich.nearby.publix.name) && by('1716').enrich.nearby.bus.mi < 0.1);
check('deal score computed without API calls', ['good', 'fair', 'high'].includes(by('1716').enrich.deal.label));
check('route shapes written for nearby listings', fs.existsSync(path.join(tmp, 'public/data/routes/rc-1716-nw-3rd-ave.json')) && calls.directions > 0, `${calls.directions} directions calls`);
check('first run sends one summary push, not a flood', calls.ntfy.length === 1 && /match your alerts/.test(calls.ntfy[0].title) && calls.ntfy[0].topic === 'secret-topic', calls.ntfy[0]?.title);
check('meta ready for the app', meta.neverRun === false && meta.counts.active === 7 && !!meta.lastFetch);

// --- an hour later: quota says wait, nothing is spent, nothing re-enriched
const before = { ...calls, ntfy: calls.ntfy.length };
await quiet(() => run({ env, now: T0 + H, pace: 0 }));
meta = read('meta.json');
check('next hourly run skips RentCast (budget pacing)', calls.rentcast === before.rentcast && meta.rentcast.used === 1 && !!meta.rentcast.nextFetch, meta.rentcast.nextFetch);
check('enrichment is not repeated for known listings', calls.matrix === before.matrix && calls.fema === before.fema && calls.overpass === before.overpass);
check('lastRun advances even when nothing was fetched', meta.lastRun === new Date(T0 + H).toISOString());

// --- a later fetch: one price drop, one listing gone, one new
rentcastRows = rentcastRows.filter((r) => r.addressLine1 !== '2018 NW 4th Ave').map((r) => (r.addressLine1 === '625 NW 22nd St' ? { ...r, price: 3650 } : r));
rentcastRows.push(rc('1412 NW 5th Ave', 29.6565, -82.3405, 3300, 4));
calls.ntfy.length = 0;
await quiet(() => run({ env, now: T0 + 12 * H, argv: ['--force'], pace: 0 }));
ls = read('listings.json'); meta = read('meta.json');
check('price change recorded with history', by('625').price === 3650 && by('625').priceHistory.length === 2);
check('missing listing marked gone, kept for 14 days', by('2018').status === 'gone' && !!by('2018').goneSince);
check('new listing added and enriched', by('1412').status === 'active' && !!by('1412').enrich.travel.deltachi && !!by('1412').enrich.flood);
check('only the new listing was sent for travel times', calls.matrix === before.matrix + 3);
const titles = calls.ntfy.map((n) => n.title);
check('push for the new listing with price/pp, beds, walk time and deep link', calls.ntfy.some((n) => /^New: \$825\/pp · 4 bd · 1412 NW 5th Ave/.test(n.title) && /min walk to Delta Chi/.test(n.message) && n.click.endsWith('#l=rc-1412-nw-5th-ave')), titles.join(' | '));
check('push for the price drop', calls.ntfy.some((n) => /^Price drop: \$913\/pp/.test(n.title) && /was \$3,900/.test(n.message)), titles.join(' | '));
check('no push for listings outside the alert preset', calls.ntfy.length === 2, String(calls.ntfy.length));
check('history.json logs the events', read('history.json').filter((e) => ['price', 'gone'].includes(e.type)).length === 2);

// --- RentCast outage: last good data survives, the app gets a warning
rentcastFail = true;
await quiet(() => run({ env, now: T0 + 30 * H, argv: ['--force'], pace: 0 }));
rentcastFail = false;
check('outage keeps the last good listings and records a warning', read('listings.json').length === ls.length && read('meta.json').warnings.some((w) => /RentCast/.test(w)) && read('meta.json').notes.some((n) => /503/.test(n)), read('meta.json').warnings.join('; '));

// --- budget exhausted: no request is made even when forced
const n = calls.rentcast;
await quiet(() => run({ env: { ...env, RENTCAST_MONTHLY_BUDGET: '3' }, now: T0 + 40 * H, argv: ['--force'], pace: 0 }));
check('monthly budget is a hard stop', calls.rentcast === n && read('meta.json').rentcast.used === 3, `used ${read('meta.json').rentcast.used}`);

// --- manual listing + shared details from config
fs.writeFileSync(path.join(tmp, 'config/manual-listings.json'), JSON.stringify([{ address: '12 NW 26th St', lat: 29.6526, lng: -82.3587, price: 5250, beds: 5, baths: 4, type: 'house', url: 'https://example.com/listing', details: { furnished: true } }]));
fs.writeFileSync(path.join(tmp, 'config/overrides.json'), JSON.stringify({ 'rc-1716-nw-3rd-ave': { details: { furnished: true, parking: 4 }, url: 'https://example.com/1716' } }));
await quiet(() => run({ env, now: T0 + 41 * H, pace: 0 }));
ls = read('listings.json');
check('manual listing joins the map and is enriched', by('12 NW 26th').source === 'manual' && by('12 NW 26th').details.furnished === true && !!by('12 NW 26th').enrich.travel.deltachi);
check('synced details apply to the shared data', by('1716').details.furnished === true && by('1716').details.parking === 4 && by('1716').url === 'https://example.com/1716');

// --- 17 days after it vanished, the gone listing is dropped; new billing period resets the count
await quiet(() => run({ env, now: T0 + 18 * 24 * H, pace: 0 }));
ls = read('listings.json'); meta = read('meta.json');
check('gone listing removed after the retention window', !by('2018'));
check('new billing period resets the request count and fetches', meta.rentcast.used === 1 && meta.rentcast.periodStart.startsWith('2026-12-01'), `${meta.rentcast.used} since ${meta.rentcast.periodStart}`);

// --- test alert
calls.ntfy.length = 0;
await quiet(() => run({ env, argv: ['--test-alert'], now: T0 }));
check('test alert publishes to the topic', calls.ntfy.length === 1 && /test alert/i.test(calls.ntfy[0].title));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
