// Source adapters, in priority order. To add a feed: write a module that exports
//   { name, async fetch(ctx) -> { listings, complete, requests } | null }
// where each listing follows the Listing shape (see README), then add it to this list.
// `complete: true` means "this is everything the source has", so anything missing is marked gone.
// Return null to skip a run (for example when a quota says wait).
import rentcast from './rentcast.mjs';
import manual from './manual.mjs';

export default [rentcast, manual];
