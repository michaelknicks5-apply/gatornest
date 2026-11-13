# GatorNest

A personal, mobile-first map of rental houses near UF. A scheduled job checks for listings every hour, enriches the new ones, and publishes a static site.

- **Live site:** https://michaelknicks5-apply.github.io/gatornest/
- **Cost:** $0 on free tiers. The only paid option is a bigger RentCast plan for more frequent pulls.

## How it works

```
GitHub Actions (hourly, :17)                         GitHub Pages
  pipeline/run.mjs                                     static site (Vite + Preact + MapLibre)
    1. sources   RentCast (quota-aware) + hand-added     reads data/listings.json, data/meta.json,
    2. merge     dedupe by address, diff vs last run     data/routes/<id>.json
    3. enrich    travel times, flood zone, nearby,
                 deal score, route shapes
    4. alerts    ntfy push for 🔔 presets
    5. commit    public/data/*  ->  build  ->  deploy
```

Everything personal (favorites, statuses, notes) stays in the browser's localStorage. API keys live only in GitHub Actions secrets and never reach the site.

## Add the keys

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Where it comes from |
|---|---|
| `RENTCAST_API_KEY` | app.rentcast.io → API dashboard → Select Plan (Developer, free) → Create API Key |
| `ORS_API_KEY` | account.heigit.org → sign up → create a key (OpenRouteService) |
| `NTFY_TOPIC` | A hard-to-guess name you make up, e.g. `gatornest-` plus 12 random characters. Subscribe to the same name in the ntfy phone app. Anyone who knows it can read the alerts. |

Then **Settings → Pages → Source: GitHub Actions** (one time).

Run it once by hand: **Actions → Refresh listings and deploy → Run workflow**. Tick "Send a test push" to confirm alerts reach your phone, and "Fetch from RentCast now" to pull immediately.

The pipeline runs fine with any key missing. It skips that step, shows a warning chip in the app, and the app falls back to estimates (or to the labeled test listings if there is no live data yet).

## Change the refresh budget

RentCast's free Developer plan includes 50 requests a month and bills for extra ones, so the job treats the budget as a hard stop and spreads requests evenly over the billing period.

- `config/settings.json` → `rentcastMonthlyBudget` (default `45`, about one pull every 16 hours).
- Or, without a commit: **Settings → Secrets and variables → Actions → Variables** → `RENTCAST_MONTHLY_BUDGET`.
- On a paid plan, raise the number. At 720 or more the job pulls on every hourly run.
- `rentcastBillingDay`: the day of the month your RentCast plan was activated (the quota resets then).
- `rentcastBedrooms` (default `3:*`) keeps each pull to 3+ bedrooms so one request covers the area. `searchRadiusMiles` (default `4`) sets the radius around campus.

The app shows "Updated X min ago · Y calls left" on the map, and Settings shows the next scheduled pull.

## Add a landmark

Edit `config/landmarks.json`:

```json
{ "id": "swamp", "name": "The Swamp", "short": "Stadium", "address": "157 Gale Lemerand Dr", "lat": 29.6500, "lng": -82.3486, "icon": "pin" }
```

Icons: `dx`, `house`, `wave`, `golf`, `book`, `pint`, `pin`. On the next run every listing gets routed walk, bike and drive times to it, and it appears as a filter. (Landmarks added in the app's Settings work right away with estimated times, but only on that device.)

## Add a new data source

Sources are adapters in `pipeline/adapters/`. Write a module and add it to `pipeline/adapters/index.mjs`:

```js
export default {
  name: 'myfeed',
  async fetch(ctx) {            // ctx: { cfg, env, now, meta, warn(), force }
    const rows = await getRows();
    return {
      listings: rows.map(toListing), // see the Listing shape below
      complete: true,                // true = anything missing from this pull is marked "gone"
      requests: 1,
    };                               // or return null to skip this run
  },
};
```

The UI needs no changes: it reads the merged `listings.json`. Only use feeds whose terms allow it. Do not scrape Zillow, Apartments.com, Realtor.com, Craigslist or Facebook.

**Listing shape** (what an adapter returns):

```js
{
  id, key,                 // key = addressKey(address, unit) from shared/address.js; id = '<prefix>-' + slug(key)
  source: 'myfeed',
  address, city, state, zip, lat, lng,
  price, beds, baths, sqft, type,   // type: house | townhouse | duplex | condo | apartment
  complex: false, yearBuilt, listedDate,
  details: {               // true / false / null. null means "the source didn't say" and shows as Unverified
    furnished, pets, dogs, parking, washerDryer, centralAC, dishwasher, yard, pool,
    utilitiesIncluded, internetIncluded, availableDate, leaseMonths, deposit
  },
  description, photos: [], contact: { name, office, phone, email, website }, url
}
```

The pipeline adds `status`, `firstSeen`, `lastSeen`, `goneSince`, `priceHistory` and `enrich` (travel, flood, nearby, deal).

## Phone → repo sync

RentCast does not publish photos, furnished, pets, parking, move-in dates or a link to the original listing, so those start as **Unverified**. Fill them in from a listing's sheet ("Fill in"), or add a listing by link. To share that with roommates and with the alert job, open **Settings → Sync to the repo**: it opens a pre-filled issue, and the `Sync from the app` workflow writes it to `config/alert-presets.json`, `config/manual-listings.json` and `config/overrides.json`. Only accounts with write access are accepted, and the issue text is validated as data.

Because the repo is public, anything synced is public. Favorites, statuses and notes are never synced.

## Develop

```
npm install
npm run dev                      # http://127.0.0.1:5173   (?mock=1 swaps in a stand-in basemap)
npm run build                    # static site in dist/
npm run fixtures                 # regenerate the labeled TEST listings
node scripts/test-pipeline.mjs   # pipeline end to end against simulated services (no keys needed)
python3 scripts/e2e.py http://127.0.0.1:5173/?mock=1   # app checks (needs Playwright + Chrome)
```

| Path | What |
|---|---|
| `config/` | landmarks, settings, alert presets, hand-added listings, filled-in details |
| `pipeline/` | the hourly job: adapters, merge, enrich, notify |
| `shared/` | code used by both the app and the pipeline (geometry, deal score, address keys) |
| `src/` | the app |
| `public/data/` | live data, written by the pipeline |
| `public/fixtures/` | invented test listings, shown until the first live pull (or via Settings → Data → Test data) |

## Known limits

- GitHub's schedule is best effort: runs can start late or be skipped when GitHub is busy.
- Route shapes are rationed (OpenRouteService allows 2,000 directions a day), so a big first pull fills in over several runs. Until then a route draws as a straight line with a `~` estimate.
- The deal score compares a listing with similar listings in the same pull. It needs at least three comparables.
- Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Flood zones from FEMA's National Flood Hazard Layer.
