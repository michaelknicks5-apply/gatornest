# GatorNest

A personal, mobile-first map of rental houses near UF. Stage 1 (the app, running on labeled test data) is done; the hourly pipeline and deploy are next.

## Run it
```
npm install
npm run dev        # http://127.0.0.1:5173  (add ?mock=1 for a stand-in basemap if tiles are blocked)
npm run build      # static site in dist/
```

## Where things live
- `config/landmarks.json`: the landmarks (add one here to get routed travel times)
- `config/settings.json`: search center and radius, `rentcastMonthlyBudget`, ring distance
- `public/fixtures/`: TEST listings (`npm run fixtures` regenerates them)
- `public/data/`: live data, written by the hourly pipeline (not built yet)
- `src/`: the app (Preact + MapLibre). `shared/`: code used by both the app and the pipeline
- `scripts/e2e.py`, `scripts/shots.py`: functional checks and screenshots

## Still to do
Pipeline (RentCast adapter, enrichment, ntfy alerts), GitHub Actions cron, GitHub Pages deploy, full README.
