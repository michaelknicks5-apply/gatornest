// Listings added by hand in the app and synced to config/manual-listings.json.
import { readJson, p } from '../util.mjs';
import { addressKey, slug } from '../../shared/address.js';

export default {
  name: 'manual',
  async fetch() {
    const rows = readJson(p('config/manual-listings.json'), []);
    const listings = rows.filter((r) => r && r.address && r.price > 0 && r.lat && r.lng).map((r) => {
      const key = addressKey(r.address);
      return {
        id: r.id || 'm-' + slug(key), key, source: 'manual',
        address: r.address, city: r.city || 'Gainesville', state: r.state || 'FL', zip: r.zip || null, lat: r.lat, lng: r.lng,
        price: r.price, beds: r.beds ?? null, baths: r.baths ?? null, sqft: r.sqft ?? null, type: r.type || 'house', complex: false, yearBuilt: r.yearBuilt ?? null,
        listedDate: r.listedDate || null, details: r.details || {}, description: r.description || null, photos: r.photos || [], contact: r.contact || null, url: r.url || null,
      };
    });
    return { listings, complete: true, requests: 0 };
  },
};
