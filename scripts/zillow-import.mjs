// Validates a Zillow snapshot written by the scheduled Claude task and turns it into
// data-cache/zillow.json, which the pipeline's zillow adapter reads.
//
// Snapshot format (data-cache/zillow-snapshot.tsv), tab-separated:
//   # checked 2026-11-14T23:40:00Z
//   ## 4bd found=50 groups=1
//   zpid  line1  zip  price  beds  baths  sqft  homeType  lat  lng
//   ...
//   ## 5plus found=22 groups=0
//   ...
// "found" is the "Found N properties" count Zillow reported for that search, and "groups" is how
// many results in it were apartment groups (skipped). Rows + groups must equal found, so a
// transcription that dropped rows is caught and nothing is marked off-market from it.
//
// Usage: node scripts/zillow-import.mjs [snapshot.tsv]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || path.join(root, 'data-cache/zillow-snapshot.tsv');
const out = path.join(root, 'data-cache/zillow.json');
// Zillow calls a unit in a small building an "apartment"; big complexes come back as groups and are skipped.
const TYPES = { singleFamily: 'house', townhome: 'townhouse', condo: 'condo', multiFamily: 'duplex', apartment: 'apartment' };

const text = fs.readFileSync(src, 'utf8');
let checked = null;
const sections = [];
const problems = [];
for (const [i, raw] of text.split(/\r?\n/).entries()) {
  const line = raw.trimEnd();
  if (!line.trim()) continue;
  const m1 = line.match(/^#\s*checked\s+(\S+)/i);
  if (m1) { checked = m1[1]; continue; }
  const m2 = line.match(/^##\s*(\S+).*?found=(\d+).*?groups=(\d+)/i);
  if (m2) { sections.push({ name: m2[1], found: +m2[2], groups: +m2[3], rows: [] }); continue; }
  if (line.startsWith('#')) continue;
  if (!sections.length) { problems.push(`line ${i + 1}: row before any ## section`); continue; }
  const c = line.split('\t').map((s) => s.trim());
  if (c.length < 10) { problems.push(`line ${i + 1}: expected 10 tab-separated columns, got ${c.length}`); continue; }
  const [zpid, line1, zip, price, beds, baths, sqft, homeType, lat, lng] = c;
  const row = { zpid, line1, zip, price: +price, beds: +beds, baths: baths === '' ? null : +baths, sqft: sqft === '' ? null : +sqft, homeType, lat: +lat, lng: +lng };
  if (!/^\d+$/.test(zpid) || !line1 || !/^\d{5}$/.test(zip) || !(row.price > 0) || !(row.beds > 0) || !(Math.abs(row.lat - 29.65) < 0.3) || !(Math.abs(row.lng + 82.35) < 0.3)) {
    problems.push(`line ${i + 1}: bad value in "${line.slice(0, 80)}"`);
    continue;
  }
  sections[sections.length - 1].rows.push(row);
}

if (!checked || isNaN(Date.parse(checked))) problems.push('missing or bad "# checked <ISO time>" line');
if (!sections.length) problems.push('no "## <name> found=N groups=N" sections');
let complete = problems.length === 0;
for (const s of sections) {
  if (s.rows.length + s.groups !== s.found) {
    complete = false;
    problems.push(`section ${s.name}: ${s.rows.length} rows + ${s.groups} groups != found ${s.found}`);
  }
  if (s.found >= 100) { complete = false; problems.push(`section ${s.name}: ${s.found} results is at Zillow's display cap; split the search`); }
}

const seen = new Set();
const listings = [];
let perRoom = 0;
for (const s of sections) {
  for (const r of s.rows) {
    if (seen.has(r.zpid)) continue;
    seen.add(r.zpid);
    if (r.price / r.beds < 300) { perRoom += 1; continue; } // a by-the-room listing priced per bed
    const slug = `${r.line1.replace(/#/g, '').trim()} Gainesville FL ${r.zip}`.replace(/[^A-Za-z0-9]+/g, '-');
    listings.push({
      zpid: r.zpid, address: r.line1, zip: r.zip, price: r.price, beds: r.beds, baths: r.baths, sqft: r.sqft,
      type: TYPES[r.homeType] || 'house', complex: false, lat: r.lat, lng: r.lng,
      url: `https://www.zillow.com/homedetails/${slug}/${r.zpid}_zpid/`,
    });
  }
}

const result = { checked, complete, count: listings.length, skippedPerRoom: perRoom, problems, listings };
fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
console.log(`zillow import: ${listings.length} listings, complete=${complete}${perRoom ? `, skipped ${perRoom} by-the-room` : ''}`);
for (const p of problems) console.log('  problem:', p);
process.exit(problems.length ? 2 : 0);
