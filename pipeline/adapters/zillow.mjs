// Zillow source, fed by a scheduled Claude task that searches Zillow through the official connector
// twice a day and commits data-cache/zillow-snapshot.tsv (converted to zillow.json by scripts/zillow-import.mjs).
// This adapter only reads that file, so it costs nothing per hourly run.
import { readJson, p } from '../util.mjs';
import { addressKey, slug, prettyAddress } from '../../shared/address.js';

const EMPTY_DETAILS = { furnished: null, pets: null, dogs: null, parking: null, washerDryer: null, centralAC: null, dishwasher: null, yard: null, pool: null, utilitiesIncluded: null, internetIncluded: null, availableDate: null, leaseMonths: null, deposit: null };

export default {
  name: 'zillow',
  // Zillow nudges some prices by a few dollars between searches; ignore changes smaller than this.
  priceNoise: (from, to) => Math.abs(to - from) < Math.max(150, from * 0.03),
  async fetch(ctx) {
    const snap = readJson(p('data-cache/zillow.json'), null);
    if (!snap || !snap.listings) return null;
    const age = ctx.now - Date.parse(snap.checked);
    if (age > 3 * 24 * 3600e3) ctx.note(`The Zillow check last ran ${Math.round(age / 86400e3)} days ago`);
    const listings = snap.listings.map((z) => {
      const key = addressKey(z.address);
      return {
        id: 'zw-' + slug(key), key, source: 'zillow', sourceId: z.zpid,
        address: prettyAddress(z.address), city: 'Gainesville', state: 'FL', zip: z.zip, lat: z.lat, lng: z.lng,
        price: z.price, beds: z.beds, baths: z.baths, sqft: z.sqft, type: z.type, complex: !!z.complex, yearBuilt: null,
        listedDate: null, details: { ...EMPTY_DETAILS }, description: null, photos: [], contact: null, url: z.url,
      };
    });
    // Only a validated, complete snapshot may mark Zillow-only listings off-market.
    return { listings, complete: !!snap.complete, requests: 0, checkedAt: snap.checked };
  },
};
