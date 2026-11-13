// Push alerts through ntfy.sh. The topic name is the only secret, so it is never logged.
import { http, log } from './util.mjs';
import { decorate } from '../shared/decorate.js';
import { matches, normalizeFilters } from '../src/filters.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export async function publish(topic, msg) {
  await http('https://ntfy.sh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, ...msg }), as: 'text' });
}

// events: this run's new and price-drop events. Returns how many alerts were sent.
export async function sendAlerts({ events, listings, landmarks, presets, ctx }) {
  const topic = ctx.env.NTFY_TOPIC;
  const active = presets.filter((x) => x.alerts);
  const wanted = events.filter((e) => e.type === 'new' || e.type === 'back' || (e.type === 'price' && e.price < e.from));
  if (!wanted.length || !active.length) return 0;
  const anchor = landmarks.find((l) => l.primary) || landmarks[0];
  const hits = [];
  for (const e of wanted) {
    const raw = listings.find((l) => l.id === e.id);
    if (!raw || raw.status !== 'active') continue;
    const l = decorate(raw, { groupSize: ctx.cfg.groupSize, landmarks, now: ctx.now });
    const names = active.filter((pr) => matches(l, normalizeFilters(pr.filters))).map((pr) => pr.name);
    if (names.length) hits.push({ e, l, names });
  }
  if (!hits.length) return 0;
  if (!topic) { ctx.warn(`${hits.length} alert(s) not sent: the ntfy topic is not set`); return 0; }
  const link = (id) => `${ctx.cfg.siteUrl}#l=${encodeURIComponent(id)}`;
  const max = ctx.cfg.maxAlertsPerRun || 6;
  let sent = 0;
  try {
    if (ctx.firstRun || hits.length > max) {
      // Don't bury the phone: one summary instead of dozens of pushes.
      await publish(topic, { title: `GatorNest: ${hits.length} listings match your alerts`, message: hits.slice(0, 5).map((h) => `${money(h.l.pp)}/pp · ${h.l.beds} bd · ${h.l.address}`).join('\n') + (hits.length > 5 ? `\n…and ${hits.length - 5} more` : ''), click: ctx.cfg.siteUrl, tags: ['house'], priority: 3 });
      sent = 1;
    } else {
      for (const { e, l, names } of hits) {
        const t = l.travel[anchor.id];
        const drop = e.type === 'price';
        await publish(topic, {
          title: `${drop ? 'Price drop' : 'New'}: ${money(l.pp)}/pp · ${l.beds} bd · ${l.address}`,
          message: `${money(l.price)}/mo${drop ? ` (was ${money(e.from)})` : ''} · ${l.beds} bd ${l.baths ?? '?'} ba · ${t.est ? '~' : ''}${t.walk.min} min walk to ${anchor.short || anchor.name}\nMatches ${names.join(', ')}`,
          click: link(l.id), tags: [drop ? 'chart_with_downwards_trend' : 'house'], priority: drop ? 3 : 4,
        });
        sent += 1;
      }
    }
    log(`alerts: sent ${sent} push notification(s)`);
  } catch (err) {
    ctx.warn(`Push alert failed: ${err.message}`);
  }
  return sent;
}
