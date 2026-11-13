// Generates the TEST fixture data in public/fixtures. Every listing here is invented.
// Run: npm run fixtures
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineMi, estimateTravel } from '../shared/geo.js';
import { computeDeals } from '../shared/deal.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/fixtures');
const landmarks = JSON.parse(fs.readFileSync(path.join(root, 'config/landmarks.json'), 'utf8'));
const NOW = Date.now();
const H = 3600e3;
const D = 24 * H;
const iso = (ms) => new Date(ms).toISOString();

// [address, lat, lng, price, beds, baths, sqft, type, year, details, extra]
const U = null; // unknown
const rows = [
  ['1716 NW 3rd Ave', 29.6551, -82.3451, 3600, 4, 2, 1650, 'house', 1948, { furnished: true, pets: true, dogs: true, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3600 }, { listedDaysAgo: 9, photos: 3, desc: 'Classic College Park bungalow with a big fenced back yard, front porch and room for four cars. Fully furnished.' }],
  ['1824 NW 2nd Ave', 29.6541, -82.3468, 4750, 5, 3, 2100, 'house', 1962, { furnished: true, pets: false, dogs: false, parking: 5, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: true, availableDate: '2027-08-05', leaseMonths: 12, deposit: 4750 }, { firstSeenHoursAgo: 5, listedDaysAgo: 0.2, photos: 3, desc: 'Renovated five bedroom two blocks north of University Ave. Furnished, internet included, screened porch.' }],
  ['2018 NW 4th Ave', 29.6561, -82.3495, 4200, 4, 3, 1900, 'house', 1955, { furnished: U, pets: U, dogs: U, parking: U, washerDryer: U, centralAC: U, dishwasher: U, yard: U, pool: U, utilitiesIncluded: U, internetIncluded: U, availableDate: U, leaseMonths: U, deposit: U }, { listedDaysAgo: 3, photos: 0, desc: null }],
  ['1412 NW 5th Ave', 29.6565, -82.3405, 3300, 4, 2, 1480, 'house', 1939, { furnished: false, pets: true, dogs: true, parking: 3, washerDryer: true, centralAC: true, dishwasher: false, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3300 }, { listedDaysAgo: 21, photos: 2, desc: 'Unfurnished four bedroom with hardwood floors, fenced yard and a garage for bikes.' }],
  ['2235 NW 1st Ave', 29.6531, -82.3540, 4400, 4, 4, 1800, 'townhouse', 2016, { furnished: true, pets: false, dogs: false, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: false, pool: false, utilitiesIncluded: false, internetIncluded: true, availableDate: '2027-08-10', leaseMonths: 12, deposit: 2200 }, { listedDaysAgo: 6, photos: 3, desc: 'Newer townhouse, every bedroom has its own bath. Furnished, balcony, four assigned spots.' }],
  ['12 NW 26th St', 29.6526, -82.3587, 5250, 5, 4, 2400, 'house', 1971, { furnished: true, pets: true, dogs: true, parking: 5, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: true, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-07-28', leaseMonths: 12, deposit: 5250 }, { listedDaysAgo: 2, photos: 3, desc: 'Five bedroom with a pool and a huge porch, half a mile from Fraternity Row. Furnished. Lawn and pool care included.' }],
  ['2715 SW 3rd Pl', 29.6491, -82.3618, 4300, 4, 3, 2050, 'house', 1958, { furnished: true, pets: U, dogs: U, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: true, utilitiesIncluded: U, internetIncluded: U, availableDate: '2027-08-01', leaseMonths: 12, deposit: U }, { listedDaysAgo: 12, photos: 3, desc: 'Golfview ranch with pool and garage, steps from the golf course.' }],
  ['405 SW 27th St', 29.6480, -82.3612, 5500, 5, 3, 2600, 'house', 1964, { furnished: false, pets: true, dogs: true, parking: 6, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-15', leaseMonths: 12, deposit: 5500 }, { listedDaysAgo: 30, photos: 2, desc: 'Large five bedroom in Golfview. Unfurnished. Fenced yard, two-car garage.' }],
  ['1021 SW 4th Ave', 29.6480, -82.3355, 3480, 4, 2, 1400, 'house', 1941, { furnished: U, pets: true, dogs: false, parking: 2, washerDryer: false, centralAC: true, dishwasher: U, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3480 }, { listedDaysAgo: 4, photos: 2, desc: 'Four bedroom near Sorority Row. Cats OK. Street parking plus two off-street spots.' }],
  ['1238 SW 1st Ave', 29.6511, -82.3378, 2550, 3, 2, 1150, 'duplex', 1978, { furnished: true, pets: false, dogs: false, parking: 2, washerDryer: true, centralAC: true, dishwasher: true, yard: false, pool: false, utilitiesIncluded: true, internetIncluded: true, availableDate: '2027-08-01', leaseMonths: 12, deposit: 1500 }, { listedDaysAgo: 8, photos: 2, desc: 'Three bedroom duplex unit, all utilities and internet included.' }],
  ['3024 NW 1st Ave', 29.6532, -82.3672, 3100, 4, 2, 1550, 'house', 1957, { furnished: false, pets: true, dogs: true, parking: 3, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3100 }, { listedDaysAgo: 15, photos: 2, flood: 'AE', desc: 'Hibiscus Park four bedroom with a fenced yard. Dogs welcome.' }],
  ['2130 NW 7th Ln', 29.6588, -82.3515, 3900, 4, 3, 1750, 'house', 1960, { furnished: true, pets: true, dogs: true, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-03', leaseMonths: 12, deposit: 3900 }, { firstSeenHoursAgo: 40, listedDaysAgo: 1.6, photos: 3, desc: 'Furnished four bedroom, three bath in Florida Park. Fenced yard, fire pit, dogs OK.' }],
  ['1602 NW 7th Ave', 29.6585, -82.3432, 5700, 6, 3, 2500, 'house', 1935, { furnished: U, pets: U, dogs: U, parking: 5, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: U }, { listedDaysAgo: 18, photos: 2, desc: 'Six bedroom historic house with a wraparound porch.' }],
  ['2409 NW 13th Ave', 29.6645, -82.3560, 2800, 4, 2, 1500, 'house', 1968, { furnished: false, pets: true, dogs: true, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-07-15', leaseMonths: 12, deposit: 2800 }, { listedDaysAgo: 25, photos: 2, desc: 'Quiet street, big yard, carport. A longer bike ride to campus.' }],
  ['1710 SW 35th Pl #204', 29.6220, -82.3470, 3000, 4, 4, 1350, 'townhouse', 2008, { furnished: true, pets: true, dogs: true, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: false, pool: true, utilitiesIncluded: true, internetIncluded: true, availableDate: '2027-08-18', leaseMonths: 12, deposit: 800 }, { listedDaysAgo: 40, photos: 3, complex: true, desc: 'By-the-bed student community. Rate shown is four beds combined. Pool, gym, bus to campus.' }],
  ['4000 SW 37th Blvd #1112', 29.6205, -82.3800, 3400, 4, 4, 1420, 'apartment', 2014, { furnished: true, pets: true, dogs: true, parking: 4, washerDryer: true, centralAC: true, dishwasher: true, yard: false, pool: true, utilitiesIncluded: true, internetIncluded: true, availableDate: '2027-08-20', leaseMonths: 12, deposit: 600 }, { listedDaysAgo: 55, photos: 3, complex: true, desc: 'Large student apartment complex, individual leases.' }],
  ['625 NW 22nd St', 29.6578, -82.3530, 3650, 4, 2.5, 1700, 'house', 1952, { furnished: true, pets: false, dogs: false, parking: 3, washerDryer: true, centralAC: true, dishwasher: true, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3650 }, { listedDaysAgo: 34, photos: 3, drop: { from: 3900, daysAgo: 2 }, desc: 'Price reduced. Furnished four bedroom with a deck and a shed for bikes.' }],
  ['1518 NW 6th Pl', 29.6575, -82.3422, 3750, 5, 2, 1600, 'house', 1946, { furnished: U, pets: U, dogs: U, parking: 3, washerDryer: U, centralAC: U, dishwasher: U, yard: true, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: U, leaseMonths: 12, deposit: U }, { listedDaysAgo: 11, photos: 1, desc: 'Five bedrooms, two baths. Close to Midtown.' }],
  ['320 NW 19th St #B', 29.6549, -82.3477, 3800, 4, 3, 1500, 'condo', 2004, { furnished: true, pets: false, dogs: false, parking: 3, washerDryer: true, centralAC: true, dishwasher: true, yard: false, pool: false, utilitiesIncluded: false, internetIncluded: false, availableDate: '2027-08-01', leaseMonths: 12, deposit: 3800 }, { listedDaysAgo: 45, photos: 2, goneDaysAgo: 3, desc: 'Four bedroom condo. This one was taken.' }],
];

const agents = [
  ['Dana Whitfield', 'Swamp City Rentals (TEST)', '3525550101', 'dana@example.com'],
  ['Marcus Bell', 'Hogtown Property Group (TEST)', '3525550134', 'marcus@example.com'],
  ['Priya Nair', 'Paynes Prairie Realty (TEST)', '3525550167', 'priya@example.com'],
  ['Tom Okafor', 'Orange & Blue Leasing (TEST)', '3525550190', 'leasing@example.com'],
];

const essentials = {
  publix: [['Publix, University Ave & 13th St', 29.6524, -82.3398], ['Publix, Westgate', 29.6527, -82.3738], ['Publix, Butler Plaza', 29.6235, -82.3795]],
  gym: [['Southwest Rec Center', 29.6384, -82.3682], ['Student Rec & Fitness Center', 29.6497, -82.3470], ['Gym on NW 13th St', 29.6630, -82.3392]],
  gas: [['Gas station, W University Ave', 29.6521, -82.3560], ['Gas station, NW 13th St', 29.6600, -82.3392], ['Gas station, Archer Rd', 29.6300, -82.3640]],
  bus: null,
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const listings = rows.map((r, i) => {
  const [address, lat, lng, price, beds, baths, sqft, type, yearBuilt, details, x] = r;
  const id = 'fx-' + slug(address);
  const [name, office, phone, email] = agents[i % agents.length];
  const firstSeen = NOW - (x.firstSeenHoursAgo != null ? x.firstSeenHoursAgo * H : x.listedDaysAgo * D);
  const priceHistory = [{ date: iso(NOW - x.listedDaysAgo * D), price: x.drop ? x.drop.from : price }];
  if (x.drop) priceHistory.push({ date: iso(NOW - x.drop.daysAgo * D), price });
  const travel = {};
  for (const lm of landmarks) {
    const t = estimateTravel(haversineMi({ lat, lng }, lm));
    travel[lm.id] = {
      mi: +t.mi.toFixed(2),
      walk: { min: t.walk.min, mi: +t.walk.mi.toFixed(2) },
      bike: { min: t.bike.min, mi: +t.bike.mi.toFixed(2) },
      drive: { min: t.drive.min, mi: +t.drive.mi.toFixed(2) },
    };
  }
  const nearby = {};
  for (const [k, pts] of Object.entries(essentials)) {
    if (!pts) continue;
    const best = pts.map(([n, la, ln]) => ({ name: n, mi: haversineMi({ lat, lng }, { lat: la, lng: ln }) })).sort((a, b) => a.mi - b.mi)[0];
    nearby[k] = { name: best.name, mi: +best.mi.toFixed(2) };
  }
  nearby.bus = { name: 'RTS stop', mi: +(0.05 + ((i * 37) % 30) / 100).toFixed(2) };
  const zone = x.flood || 'X';
  return {
    id,
    source: 'fixture',
    isTest: true,
    address,
    city: 'Gainesville',
    state: 'FL',
    zip: lat > 29.652 ? '32603' : '32607',
    lat,
    lng,
    price,
    beds,
    baths,
    sqft,
    type,
    complex: !!x.complex,
    yearBuilt,
    status: x.goneDaysAgo ? 'gone' : 'active',
    goneSince: x.goneDaysAgo ? iso(NOW - x.goneDaysAgo * D) : null,
    listedDate: iso(NOW - x.listedDaysAgo * D),
    firstSeen: iso(firstSeen),
    lastSeen: iso(x.goneDaysAgo ? NOW - x.goneDaysAgo * D : NOW - 20 * 60e3),
    priceHistory,
    details,
    description: x.desc,
    photos: Array.from({ length: x.photos }, (_, k) => `fixtures/photos/h${((i + k) % 6) + 1}.svg`),
    contact: { name, office, phone, email, website: null },
    url: null,
    enrich: { travel, flood: { zone, highRisk: zone !== 'X' }, nearby },
  };
});

const deals = computeDeals(listings);
for (const l of listings) l.enrich.deal = deals[l.id] || null;

// Fake routes that follow the street grid (east-west, then north-south). Real routes come from the pipeline.
fs.mkdirSync(path.join(out, 'routes'), { recursive: true });
for (const l of listings) {
  const routes = {};
  for (const lm of landmarks) {
    const coords = [[l.lng, l.lat], [lm.lng, l.lat], [lm.lng, lm.lat]];
    routes[lm.id] = { walk: { coords }, bike: { coords }, drive: { coords } };
  }
  fs.writeFileSync(path.join(out, 'routes', l.id + '.json'), JSON.stringify(routes));
}

// Placeholder "photos": simple drawings, clearly marked as test images.
fs.mkdirSync(path.join(out, 'photos'), { recursive: true });
const palettes = [['#BFD9F2', '#F2E8D5', '#B5533C'], ['#CFE8D6', '#F6F1E7', '#3E6B8C'], ['#F3D9C4', '#FFF7EC', '#6B4E3D'], ['#D9D2F5', '#F4F3F0', '#5B2FD9'], ['#C9E4EE', '#EFE6D8', '#2F6F5E'], ['#F2DFA7', '#FBF6E9', '#8C4A2F']];
palettes.forEach(([sky, wall, roof], i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="${sky}"/><rect y="380" width="800" height="140" fill="#9CC48F"/><rect x="${200 + i * 12}" y="220" width="400" height="190" fill="${wall}"/><polygon points="${170 + i * 12},230 ${400 + i * 12},110 ${630 + i * 12},230" fill="${roof}"/><rect x="${370 + i * 12}" y="310" width="60" height="100" fill="${roof}"/><rect x="${240 + i * 12}" y="270" width="70" height="60" fill="#fff" opacity=".85"/><rect x="${490 + i * 12}" y="270" width="70" height="60" fill="#fff" opacity=".85"/><circle cx="${680 - i * 60}" cy="90" r="38" fill="#fff" opacity=".7"/><text x="400" y="490" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="26" fill="#1c1c28" opacity=".55">TEST PHOTO ${i + 1} · not a real listing</text></svg>`;
  fs.writeFileSync(path.join(out, 'photos', `h${i + 1}.svg`), svg);
});

fs.writeFileSync(path.join(out, 'listings.json'), JSON.stringify(listings, null, 1));
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({
  fixture: true,
  generatedAt: iso(NOW),
  lastRun: iso(NOW - 20 * 60e3),
  lastFetch: iso(NOW - 20 * 60e3),
  rentcast: { month: iso(NOW).slice(0, 7), used: 14, budget: 45 },
  counts: { active: listings.filter((l) => l.status === 'active').length, gone: 1 },
  warnings: [],
}, null, 1));
console.log(`wrote ${listings.length} fixture listings`);
