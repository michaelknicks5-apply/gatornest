// Enrichment for listings: travel times and routes (OpenRouteService), flood zone (FEMA NFHL),
// nearby essentials (OpenStreetMap via Overpass). Every step is optional: a failure adds a warning
// and leaves the field empty, and the app falls back to straight-line estimates.
import fs from 'node:fs';
import path from 'node:path';
import { http, log, sleep, readJson, writeJson, p, DATA } from './util.mjs';
import { haversineMi } from '../shared/geo.js';

const ORS = 'https://api.openrouteservice.org/v2';
const PROFILES = { walk: 'foot-walking', bike: 'cycling-regular', drive: 'driving-car' };
const r2 = (n) => Math.round(n * 100) / 100;

// ---------- travel times: one matrix call per mode per batch ----------
export async function enrichTravel(listings, landmarks, ctx) {
  const key = ctx.env.ORS_API_KEY;
  const ids = landmarks.map((l) => l.id);
  const todo = listings.filter((l) => l.status === 'active' && (l.source === 'manual' || (l.beds ?? 0) >= ctx.cfg.enrichMinBeds) && !ids.every((id) => l.enrich?.travel?.[id] && !l.enrich.travel[id].est));
  if (!todo.length) return 0;
  if (!key) { ctx.warn('OpenRouteService key is not set, so travel times are estimates'); return 0; }
  let done = 0;
  for (let i = 0; i < todo.length && i < 200; i += 40) {
    const batch = todo.slice(i, i + 40);
    const locations = [...batch.map((l) => [l.lng, l.lat]), ...landmarks.map((l) => [l.lng, l.lat])];
    const body = JSON.stringify({ locations, sources: batch.map((_, k) => k), destinations: landmarks.map((_, k) => batch.length + k), metrics: ['duration', 'distance'], units: 'mi' });
    const byMode = {};
    try {
      for (const [mode, profile] of Object.entries(PROFILES)) {
        const { data } = await http(`${ORS}/matrix/${profile}`, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' }, body });
        byMode[mode] = data;
        await sleep(ctx.pace ?? 1600);
      }
    } catch (e) { ctx.warn(`Travel times failed: ${e.message}`); break; }
    batch.forEach((l, s) => {
      const travel = { ...(l.enrich?.travel || {}) };
      landmarks.forEach((lm, d) => {
        const cell = { mi: r2(haversineMi(l, lm)) };
        let ok = true;
        for (const mode of Object.keys(PROFILES)) {
          const sec = byMode[mode].durations?.[s]?.[d];
          const dist = byMode[mode].distances?.[s]?.[d];
          if (sec == null) { ok = false; break; }
          cell[mode] = { min: Math.max(1, Math.round(sec / 60)), mi: dist != null ? r2(dist) : cell.mi };
        }
        if (ok) travel[lm.id] = cell;
      });
      l.enrich = { ...(l.enrich || {}), travel };
      done += 1;
    });
  }
  log(`travel: routed times for ${done} listing(s)`);
  return done;
}

// ---------- route shapes: 18 directions calls per listing, rationed per run and per day ----------
export async function enrichRoutes(listings, landmarks, ctx) {
  const key = ctx.env.ORS_API_KEY;
  if (!key) return 0;
  const dir = path.join(DATA, 'routes');
  fs.mkdirSync(dir, { recursive: true });
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  const ors = ctx.meta.ors && ctx.meta.ors.day === day ? ctx.meta.ors : { day, directions: 0 };
  ctx.meta.ors = ors;
  const anchor = landmarks.find((l) => l.primary) || landmarks[0];
  const want = (l) => landmarks.map((x) => x.id);
  const todo = listings
    .filter((l) => l.status === 'active' && l.enrich?.travel && haversineMi(l, anchor) <= ctx.cfg.routeMaxMiles)
    .filter((l) => { const have = readJson(path.join(dir, l.id + '.json'), null); return !have || !want(l).every((id) => have[id]); })
    .sort((a, b) => haversineMi(a, anchor) - haversineMi(b, anchor))
    .slice(0, ctx.cfg.routeListingsPerRun);
  let done = 0;
  outer: for (const l of todo) {
    const file = path.join(dir, l.id + '.json');
    const routes = readJson(file, {});
    for (const lm of landmarks) {
      if (routes[lm.id]) continue;
      const entry = {};
      for (const [mode, profile] of Object.entries(PROFILES)) {
        if (ors.directions >= ctx.cfg.orsDirectionsPerDay) { log('routes: daily directions budget reached; the rest continue next run'); break outer; }
        ors.directions += 1;
        try {
          const { data } = await http(`${ORS}/directions/${profile}/geojson`, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates: [[l.lng, l.lat], [lm.lng, lm.lat]], instructions: false }) });
          let coords = data.features?.[0]?.geometry?.coordinates || null;
          if (coords) {
            const step = Math.ceil(coords.length / 250);
            coords = coords.filter((_, k) => k % step === 0 || k === coords.length - 1).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
            entry[mode] = { coords };
          }
        } catch (e) {
          if (e.status === 429 || e.status === 403) { ctx.warn(`Route drawing paused: ${e.message}`); break outer; }
          // an unroutable pair is fine: the app draws a straight line for it
        }
        await sleep(ctx.pace ?? 1600);
      }
      routes[lm.id] = entry;
    }
    writeJson(file, routes, false);
    done += 1;
  }
  if (done) log(`routes: drew routes for ${done} listing(s); ${ors.directions} directions calls today`);
  return done;
}

// ---------- flood zone ----------
export async function enrichFlood(listings, ctx) {
  const todo = listings.filter((l) => l.status === 'active' && !l.enrich?.flood).slice(0, 80);
  let done = 0;
  let fails = 0;
  for (const l of todo) {
    const q = new URLSearchParams({ geometry: `${l.lng},${l.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF', returnGeometry: 'false', f: 'json' });
    let data = null;
    for (const base of ctx.cfg.femaUrls) {
      try { const r = await http(`${base}?${q}`, { timeout: 20000 }); if (r.data && !r.data.error) { data = r.data; break; } } catch { /* try the next URL */ }
    }
    if (!data) { if (++fails >= 3) { ctx.warn('FEMA flood lookup is not responding; flood zones will fill in on a later run'); break; } continue; }
    const a = data.features?.[0]?.attributes;
    const flood = a ? { zone: a.FLD_ZONE || 'Unknown', subtype: (a.ZONE_SUBTY || '').trim() || null, highRisk: a.SFHA_TF === 'T' } : { zone: 'Not mapped', subtype: null, highRisk: false };
    l.enrich = { ...(l.enrich || {}), flood };
    done += 1;
    await sleep(ctx.pace != null ? ctx.pace : 250);
  }
  if (done) log(`flood: looked up ${done} listing(s)`);
  return done;
}

// ---------- nearby essentials: one Overpass call a month, cached in data-cache/poi.json ----------
async function loadPois(ctx) {
  const file = p('data-cache/poi.json');
  const cache = readJson(file, null);
  if (cache && ctx.now - new Date(cache.fetchedAt).getTime() < 30 * 24 * 3600e3) return cache;
  const { center, searchRadiusMiles: r } = ctx.cfg;
  const dLat = (r + 1.5) / 69;
  const dLng = (r + 1.5) / (69 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = [center.lat - dLat, center.lng - dLng, center.lat + dLat, center.lng + dLng].map((n) => n.toFixed(4)).join(',');
  const query = `[out:json][timeout:60];(nwr["shop"="supermarket"]["name"~"Publix"](${bbox});nwr["leisure"="fitness_centre"](${bbox});nwr["amenity"="fuel"](${bbox});node["highway"="bus_stop"](${bbox}););out center tags;`;
  try {
    const { data } = await http(ctx.cfg.overpassUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GatorNest personal rental map' }, body: 'data=' + encodeURIComponent(query), timeout: 70000 });
    const out = { fetchedAt: new Date(ctx.now).toISOString(), publix: [], gym: [], gas: [], bus: [] };
    for (const el of data.elements || []) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null) continue;
      const t = el.tags || {};
      const kind = t.shop === 'supermarket' ? 'publix' : t.leisure === 'fitness_centre' ? 'gym' : t.amenity === 'fuel' ? 'gas' : t.highway === 'bus_stop' ? 'bus' : null;
      if (kind) out[kind].push({ name: t.name || t.brand || { publix: 'Publix', gym: 'Gym', gas: 'Gas station', bus: 'Bus stop' }[kind], lat: +lat.toFixed(5), lng: +lng.toFixed(5) });
    }
    writeJson(file, out, false);
    log(`nearby: cached ${out.publix.length} Publix, ${out.gym.length} gyms, ${out.gas.length} gas stations, ${out.bus.length} bus stops`);
    return out;
  } catch (e) {
    ctx.warn(`Nearby places lookup failed: ${e.message}`);
    return cache; // an old cache beats nothing
  }
}

export async function enrichNearby(listings, ctx) {
  const todo = listings.filter((l) => l.status === 'active' && !l.enrich?.nearby);
  if (!todo.length) return 0;
  const pois = await loadPois(ctx);
  if (!pois) return 0;
  for (const l of todo) {
    const nearby = {};
    for (const kind of ['publix', 'gym', 'gas', 'bus']) {
      let best = null;
      for (const poi of pois[kind] || []) { const mi = haversineMi(l, poi); if (!best || mi < best.mi) best = { name: poi.name, mi }; }
      if (best) nearby[kind] = { name: best.name, mi: r2(best.mi) };
    }
    l.enrich = { ...(l.enrich || {}), nearby };
  }
  return todo.length;
}
