// GatorNest hourly pipeline.
//   node pipeline/run.mjs               normal run (spends a RentCast request only when the budget allows)
//   node pipeline/run.mjs --force       fetch from RentCast now (still stops at the monthly budget)
//   node pipeline/run.mjs --test-alert  send one test push to the ntfy topic and exit
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, log, p, DATA } from './util.mjs';
import adapters from './adapters/index.mjs';
import { applySource, flagComplexes, applyOverrides, purgeGone } from './merge.mjs';
import { enrichTravel, enrichRoutes, enrichFlood, enrichNearby } from './enrich.mjs';
import { sendAlerts, publish } from './notify.mjs';
import { computeDeals } from '../shared/deal.js';

export async function run({ env = process.env, argv = process.argv.slice(2), now = Date.now(), pace } = {}) {
  const cfg = readJson(p('config/settings.json'), {});
  const landmarks = readJson(p('config/landmarks.json'), []);
  const presets = readJson(p('config/alert-presets.json'), []);
  const overrides = readJson(p('config/overrides.json'), {});
  const prevMeta = readJson(path.join(DATA, 'meta.json'), {});
  const listings = readJson(path.join(DATA, 'listings.json'), []);
  const history = readJson(path.join(DATA, 'history.json'), []);
  const warnings = []; // problems worth a chip on the map (stale data, missing key, budget used up)
  const notes = []; // routine hiccups that fix themselves on a later run; shown only in Settings
  // Accept a topic pasted as a full URL (https://ntfy.sh/name) as well as the bare name.
  if (env.NTFY_TOPIC) env = { ...env, NTFY_TOPIC: String(env.NTFY_TOPIC).trim().replace(/^https?:\/\/[^/]+\//, '').replace(/^ntfy\.sh\//, '').replace(/\/+$/, '') };
  const meta = { ...prevMeta };
  const ctx = { cfg, env, now, meta, pace, force: argv.includes('--force') || env.FORCE_FETCH === 'true', warn: (w) => { warnings.push(w); log('warning:', w); }, note: (n) => { notes.push(n); log('note:', n); }, firstRun: !prevMeta.lastFetch };

  if (argv.includes('--test-alert') || env.TEST_ALERT === 'true') {
    if (!env.NTFY_TOPIC) throw new Error('NTFY_TOPIC is not set');
    await publish(env.NTFY_TOPIC, { title: 'GatorNest test alert', message: 'If you can read this on your phone, alerts are working.', click: cfg.siteUrl, tags: ['white_check_mark'], priority: 3 });
    log('test alert sent');
    if (argv.includes('--test-alert')) return { test: true };
  }

  // 1. Sources -> one merged, deduped list, diffed against the last run.
  const events = [];
  const sources = {};
  let fetched = false;
  for (const adapter of adapters) {
    try {
      const res = await adapter.fetch(ctx);
      if (!res) { sources[adapter.name] = { skipped: true }; continue; }
      applySource(listings, adapter.name, res.listings, { complete: res.complete, now, events });
      sources[adapter.name] = { count: res.listings.length, requests: res.requests };
      if (adapter.name !== 'manual') fetched = true;
    } catch (e) {
      ctx.warn(`Couldn't reach ${adapter.name === 'rentcast' ? 'RentCast' : adapter.name}, showing the last good listings`); // keep the last good data
      ctx.note(`${adapter.name}: ${String(e.message).slice(0, 200)}`);
      sources[adapter.name] = { error: true };
    }
  }
  applyOverrides(listings, overrides);
  flagComplexes(listings);
  const removed = purgeGone(listings, { now, retentionDays: cfg.goneRetentionDays || 14 });
  for (const l of removed) fs.rmSync(path.join(DATA, 'routes', l.id + '.json'), { force: true });

  // 2. Enrich whatever is still missing (new listings first run, backlog on later runs).
  await enrichTravel(listings, landmarks, ctx);
  await enrichNearby(listings, ctx);
  await enrichFlood(listings, ctx);
  const deals = computeDeals(listings);
  for (const l of listings) l.enrich = { ...(l.enrich || {}), deal: deals[l.id] || null };

  // 3. Alerts, then route shapes (slow, so they go last).
  const alerts = await sendAlerts({ events, listings, landmarks, presets, ctx });
  await enrichRoutes(listings, landmarks, ctx);

  // 4. Write. The site reads these three files.
  listings.sort((a, b) => (a.status === 'gone') - (b.status === 'gone') || a.id.localeCompare(b.id));
  const iso = new Date(now).toISOString();
  Object.assign(meta, {
    neverRun: !(meta.rentcast && meta.rentcast.lastFetch) && !listings.length,
    lastRun: iso,
    lastFetch: meta.rentcast?.lastFetch || prevMeta.lastFetch || null,
    counts: { active: listings.filter((l) => l.status === 'active').length, gone: listings.filter((l) => l.status === 'gone').length },
    sources, warnings, notes,
  });
  delete meta.note;
  const changed = writeJson(path.join(DATA, 'listings.json'), listings);
  const logged = events.filter((e) => e.type !== 'initial');
  if (logged.length) writeJson(path.join(DATA, 'history.json'), [...history, ...logged].slice(-600));
  else if (!fs.existsSync(path.join(DATA, 'history.json'))) writeJson(path.join(DATA, 'history.json'), []);
  writeJson(path.join(DATA, 'meta.json'), meta);
  const count = (t) => events.filter((e) => e.type === t).length;
  const initial = events.filter((e) => e.type === 'initial').length;
  if (initial) log(`first import: ${initial} listings`);
  log(`done: ${meta.counts.active} active, ${meta.counts.gone} taken · ${count('new')} new, ${count('price')} price changes, ${count('gone')} gone · ${alerts} alert(s) · listings.json ${changed ? 'updated' : 'unchanged'}`);
  return { events, meta, fetched, alerts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => { console.error('pipeline failed:', e.message); process.exit(1); });
}
