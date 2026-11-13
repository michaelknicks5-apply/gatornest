import { useState } from 'preact/hooks';
import { useStore, setUi, setSettings, getLandmarks, baseLandmarkList, upsertPreset, deletePreset, importPresets, resetPresets, applyPreset, addManual, selectListing, toast, loadData, getState, syncPayload } from '../store.js';
import { encodePreset, normalizeFilters } from '../filters.js';
import { Icon, LandmarkBadge, LANDMARK_COLORS } from '../icons.jsx';
import { Modal, Seg, Switch, Section, Num, copyText } from './ui.jsx';
import { geocode } from '../geocode.js';
import { mapApi } from '../map/MapView.jsx';
import { addressKey, slug } from '../../shared/address.js';
import { describeFilters } from '../describe.js';
import { sameFilters } from '../filters.js';
import cfg from '../../config/settings.json';
import { ago, plural } from '../format.js';

const EMOJI = ['🏠', '🏆', '💸', '🐶', '🚶', '🎣', '🛋️', '🏊', '🅿️', '⭐', '🔥', '🌴'];
const COLORS = ['#7B4DFF', '#16A866', '#F59E0B', '#E5484D', '#0EA5C6', '#EC4899', '#2563EB', '#52525B'];

async function pickOnMap(back) {
  setUi({ panel: null, placing: true, view: 'map', selectedId: null, sheet: 'closed' });
  const pt = await mapApi.pickPoint();
  setUi({ panel: back, placing: false });
  return pt;
}

// ---------- preset editor (new or existing) ----------
export function PresetEditor() {
  const s = useStore();
  const isNew = s.ui.editPresetId === 'new';
  const existing = s.presets.find((p) => p.id === s.ui.editPresetId);
  const [p, setP] = useState(() => (existing ? { ...existing } : { id: 'p' + Date.now().toString(36), name: '', emoji: '🏆', color: COLORS[0], alerts: false, filters: s.filters }));
  const close = () => setUi({ panel: null, editPresetId: null });
  if (!isNew && !existing) return null;
  const save = (extra = {}) => {
    if (!p.name.trim()) { toast('Give it a name'); return; }
    const next = { ...p, ...extra, name: p.name.trim(), filters: normalizeFilters(extra.filters || p.filters) };
    upsertPreset(next);
    if (isNew) applyPreset(next.id);
    toast(isNew ? 'Preset saved' : 'Preset updated');
    close();
  };
  const link = `${location.origin}${location.pathname}#p=${encodePreset(p)}`;
  return (
    <Modal title={isNew ? 'Save as preset' : 'Edit preset'} sub={isNew ? 'Stores every filter as a one-tap chip' : null} onClose={close}
      footer={<><button type="button" class="btn" onClick={close}>Cancel</button><button type="button" class="btn btn--primary" onClick={() => save()}>Save</button></>}>
      <label class="num"><span>Name</span><span class="num__box"><input type="text" maxLength={24} placeholder="Dream House" value={p.name} onInput={(e) => setP({ ...p, name: e.currentTarget.value })} /></span></label>
      <div class="lbl">Emoji</div>
      <div class="swatches">
        <button type="button" class={'emoji emoji--none' + (!p.emoji ? ' is-on' : '')} onClick={() => setP({ ...p, emoji: '' })}>None</button>
        {EMOJI.map((e) => <button type="button" key={e} class={'emoji' + (p.emoji === e ? ' is-on' : '')} onClick={() => setP({ ...p, emoji: e })}>{e}</button>)}
        <input class="emoji emoji--in" aria-label="Custom emoji" maxLength={4} value={EMOJI.includes(p.emoji) ? '' : p.emoji} placeholder="…" onInput={(e) => e.currentTarget.value && setP({ ...p, emoji: e.currentTarget.value })} />
      </div>
      <div class="lbl">Color</div>
      <div class="swatches">{COLORS.map((c) => <button type="button" key={c} aria-label={c} class={'swatch' + (p.color === c ? ' is-on' : '')} style={{ background: c }} onClick={() => setP({ ...p, color: c })} />)}</div>
      <div class="lbl">What it shows</div>
      <ul class="pdesc">{describeFilters(p.filters, getLandmarks(s), s.settings.groupSize).map((t) => <li key={t}>{t}</li>)}</ul>
      <Switch on={p.alerts} onChange={(alerts) => setP({ ...p, alerts })} label="🔔 Push alerts" hint="Notify my phone when a new or price-dropped listing matches. After saving, tap Sync in Settings so the hourly job knows." />
      <Switch on={s.settings.defaultPresetId === p.id} onChange={(on) => setSettings({ defaultPresetId: on ? p.id : null })} label="Load this one when the app opens" />
      {!isNew && (
        <div class="stack">
          <button type="button" class="btn btn--block" onClick={() => save({ filters: s.filters })}><Icon name="check" size={17} />Update with the filters on screen now</button>
          <button type="button" class="btn btn--block" onClick={() => { upsertPreset({ ...p, id: 'p' + Date.now().toString(36), name: (p.name + ' copy').slice(0, 24), starter: false }); toast('Duplicated'); close(); }}><Icon name="copy" size={17} />Duplicate</button>
          <button type="button" class="btn btn--block" onClick={async () => toast((await copyText(link)) ? 'Share link copied' : 'Could not copy')}><Icon name="share" size={17} />Copy share link</button>
          <button type="button" class="btn btn--block btn--danger" onClick={() => { deletePreset(p.id); toast('Preset deleted'); close(); }}><Icon name="trash" size={17} />Delete</button>
        </div>
      )}
    </Modal>
  );
}

// ---------- what each preset does ----------
export function PresetInfo() {
  const s = useStore();
  const lms = getLandmarks(s);
  const close = () => setUi({ panel: null });
  return (
    <Modal title="Presets" sub="One tap applies every filter in a preset" onClose={close}
      footer={<button type="button" class="btn btn--block" onClick={() => setUi({ panel: 'preset', editPresetId: 'new' })}><Icon name="plus" size={17} />Save the current filters as a preset</button>}>
      {s.presets.map((p) => {
        const on = p.id === s.activePresetId;
        return (
          <article key={p.id} class={'pcard' + (on ? ' is-on' : '')} style={{ '--pc': p.color }}>
            <header>
              <span class="pcard__dot" />
              <b>{p.emoji ? p.emoji + ' ' : ''}{p.name}</b>
              {p.alerts && <span class="tag"><Icon name="bell" size={12} />&nbsp;Alerts on</span>}
              {s.settings.defaultPresetId === p.id && <span class="tag">Opens by default</span>}
              {on && <span class="tag tag--new">{sameFilters(p.filters, s.filters) ? 'On now' : 'On, with changes'}</span>}
            </header>
            <ul class="pdesc">{describeFilters(p.filters, lms, s.settings.groupSize).map((t) => <li key={t}>{t}</li>)}</ul>
            <div class="row">
              <button type="button" class="btn btn--sm btn--primary" onClick={() => { applyPreset(p.id); close(); }}>Use this</button>
              <button type="button" class="btn btn--sm" onClick={() => setUi({ panel: 'preset', editPresetId: p.id })}><Icon name="edit" size={15} />Edit</button>
            </div>
          </article>
        );
      })}
      <p class="muted small">Tip: long-press a preset chip on the map to edit, rename, share or delete it.</p>
    </Modal>
  );
}

// ---------- add a listing by link ----------
const BLANK = { url: '', address: '', price: null, beds: 4, baths: 2, sqft: null, type: 'house', furnished: null, lat: null, lng: null };

export function AddListing() {
  const s = useStore();
  const d = s.ui.draft || BLANK;
  const [busy, setBusy] = useState(false);
  const set = (patch) => setUi({ draft: { ...d, ...patch } });
  const close = () => setUi({ panel: null, draft: null });
  const find = async () => {
    if (!d.address.trim()) { toast('Type the address first'); return; }
    setBusy(true);
    const pt = await geocode(d.address);
    setBusy(false);
    if (pt) set(pt); else toast("Couldn't find that address. Place it on the map instead.");
  };
  const place = async () => { const pt = await pickOnMap('add'); if (pt) setUi({ draft: { ...(getState().ui.draft || d), ...pt } }); };
  const save = () => {
    if (!d.address.trim() || !d.price || !d.beds) { toast('Address, price and beds are required'); return; }
    if (d.lat == null) { toast('Find the address or place it on the map'); return; }
    const now = new Date().toISOString();
    const id = 'm-' + slug(addressKey(d.address));
    addManual({
      id, source: 'manual', address: d.address.trim(), city: 'Gainesville', state: 'FL', lat: d.lat, lng: d.lng,
      price: d.price, beds: d.beds, baths: d.baths, sqft: d.sqft, type: d.type, complex: false, status: 'active',
      listedDate: now, firstSeen: now, lastSeen: now, priceHistory: [{ date: now, price: d.price }],
      details: { furnished: d.furnished }, photos: [], contact: null, url: d.url.trim() || null, enrich: null,
    });
    setUi({ panel: null, draft: null, view: 'map' });
    selectListing(id);
    toast('Added. Travel times are estimates for now.');
  };
  return (
    <Modal title="Add by link" sub="Paste any listing: Zillow, a property manager's site, a Facebook post" onClose={close}
      footer={<><button type="button" class="btn" onClick={close}>Cancel</button><button type="button" class="btn btn--primary" onClick={save}>Add to map</button></>}>
      <label class="num"><span>Listing link</span><span class="num__box"><input type="url" placeholder="https://…" value={d.url} onInput={(e) => set({ url: e.currentTarget.value })} /></span></label>
      <label class="num"><span>Street address</span><span class="num__box"><input type="text" placeholder="1716 NW 3rd Ave" value={d.address} onInput={(e) => set({ address: e.currentTarget.value, lat: null, lng: null })} /></span></label>
      <div class="row">
        <button type="button" class="btn" disabled={busy} onClick={find}><Icon name="locate" size={17} />{busy ? 'Looking…' : 'Find address'}</button>
        <button type="button" class="btn" onClick={place}><Icon name="map" size={17} />Place on map</button>
      </div>
      <p class={'small ' + (d.lat != null ? 'ok' : 'muted')}>{d.lat != null ? `✓ Located at ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}` : 'Not located yet'}</p>
      <div class="grid2">
        <Num label="Rent per month" prefix="$" step={50} placeholder="Required" value={d.price} onChange={(price) => set({ price })} />
        <Num label="Bedrooms" placeholder="Required" value={d.beds} onChange={(beds) => set({ beds })} />
        <Num label="Bathrooms" step={0.5} placeholder="Optional" value={d.baths} onChange={(baths) => set({ baths })} />
        <Num label="Square feet" step={50} placeholder="Optional" value={d.sqft} onChange={(sqft) => set({ sqft })} />
      </div>
      <div class="row row--between"><span class="lbl">Type</span><Seg small value={d.type} options={[['house', 'House'], ['townhouse', 'Townhouse'], ['duplex', 'Duplex'], ['condo', 'Condo']]} onChange={(type) => set({ type })} /></div>
      <div class="row row--between"><span class="lbl">Furnished</span><Seg small value={d.furnished} options={[[true, 'Yes'], [false, 'No'], [null, 'Unknown']]} onChange={(furnished) => set({ furnished })} /></div>
      <p class="muted small">Saved on this device. You can fill in pets, parking and the rest from the listing's detail sheet.</p>
    </Modal>
  );
}

// ---------- settings ----------
function Landmarks() {
  const s = useStore();
  const lms = getLandmarks(s);
  const draft = s.ui.lmDraft || null; // kept in the store so it survives "place on map"
  const [busy, setBusy] = useState(false);
  const save = (list) => setSettings({ landmarks: list });
  const upd = (patch) => setUi({ lmDraft: { ...(getState().ui.lmDraft || {}), ...patch } });
  const done = () => setUi({ lmDraft: null });
  const commit = () => {
    if (!draft.name.trim() || draft.lat == null) { toast('Needs a name and a location'); return; }
    const item = { ...draft, name: draft.name.trim() };
    save(lms.some((x) => x.id === item.id) ? lms.map((x) => (x.id === item.id ? item : x)) : [...lms, item]);
    done();
  };
  return (
    <div class="lmedit">
      {lms.map((lm) => (
        <div class="lmedit__row" key={lm.id}>
          <LandmarkBadge icon={lm.icon} size={30} />
          <span><b>{lm.name}</b><small>{lm.address || `${lm.lat.toFixed(4)}, ${lm.lng.toFixed(4)}`}</small></span>
          <button type="button" class="iconbtn iconbtn--sm" aria-label={`Edit ${lm.name}`} onClick={() => upd({ ...lm })}><Icon name="edit" size={17} /></button>
          <button type="button" class="iconbtn iconbtn--sm" aria-label={`Remove ${lm.name}`} onClick={() => save(lms.filter((x) => x.id !== lm.id))}><Icon name="trash" size={17} /></button>
        </div>
      ))}
      {draft ? (
        <div class="lmedit__form">
          <label class="num"><span>Name</span><span class="num__box"><input type="text" value={draft.name} onInput={(e) => upd({ name: e.currentTarget.value })} /></span></label>
          <label class="num"><span>Address</span><span class="num__box"><input type="text" value={draft.address || ''} onInput={(e) => upd({ address: e.currentTarget.value })} /></span></label>
          <div class="swatches">{Object.keys(LANDMARK_COLORS).map((ic) => <button type="button" key={ic} class={'icopick' + (draft.icon === ic ? ' is-on' : '')} onClick={() => upd({ icon: ic })}><LandmarkBadge icon={ic} size={30} /></button>)}</div>
          <div class="row">
            <button type="button" class="btn btn--sm" disabled={busy} onClick={async () => { setBusy(true); const pt = await geocode(draft.address || draft.name); setBusy(false); pt ? upd(pt) : toast("Couldn't find it. Place it on the map."); }}>{busy ? 'Looking…' : 'Find address'}</button>
            <button type="button" class="btn btn--sm" onClick={async () => { const pt = await pickOnMap('settings'); if (pt) setUi({ lmDraft: { ...getState().ui.lmDraft, ...pt } }); }}>Place on map</button>
          </div>
          <p class={'small ' + (draft.lat != null ? 'ok' : 'muted')}>{draft.lat != null ? `✓ ${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : 'Not located yet'}</p>
          <div class="row"><button type="button" class="btn btn--sm" onClick={done}>Cancel</button><button type="button" class="btn btn--primary btn--sm" onClick={commit}>Save landmark</button></div>
          <p class="muted small">Landmarks added here get estimated travel times. Routed times need the landmark in the repo's config/landmarks.json.</p>
        </div>
      ) : (
        <div class="row">
          <button type="button" class="btn btn--sm" onClick={() => upd({ id: 'lm' + Date.now().toString(36), name: '', address: '', icon: 'pin', lat: null, lng: null })}><Icon name="plus" size={16} />Add landmark</button>
          {s.settings.landmarks && <button type="button" class="btn btn--ghost btn--sm" onClick={() => save(null)}>Reset to the original six</button>}
        </div>
      )}
    </div>
  );
}

function Sync() {
  const s = useStore();
  const payload = syncPayload(s);
  const meta = s.meta || {};
  const rc = meta.rentcast;
  const json = JSON.stringify(payload);
  const base = `https://github.com/${cfg.repo}/issues/new?title=${encodeURIComponent('GatorNest sync')}`;
  const send = async () => {
    const url = `${base}&body=${encodeURIComponent(json)}`;
    if (url.length < 7000) { window.open(url, '_blank', 'noopener'); return; }
    // Too long for a link: copy it and open a blank issue to paste into.
    toast((await copyText(json)) ? 'Copied. Paste it into the issue and submit.' : 'Could not copy');
    window.open(`${base}&body=${encodeURIComponent('Paste the copied text here, replacing this line.')}`, '_blank', 'noopener');
  };
  return (
    <div>
      <p class="muted small">The hourly job only knows what is in the repo. Sync sends it your 🔔 presets ({payload.presets.length}), listings you added ({payload.manual.length}) and details you filled in ({Object.keys(payload.overrides).length}). It opens a pre-filled GitHub issue: tap “Create” and a job applies it.</p>
      <div class="row">
        <button type="button" class="btn btn--primary btn--sm" onClick={send}><Icon name="share" size={16} />Sync to the repo</button>
        <button type="button" class="btn btn--sm" onClick={async () => toast((await copyText(json)) ? 'Copied' : 'Could not copy')}><Icon name="copy" size={16} />Copy JSON</button>
      </div>
      <p class="muted small">The repo is public, so synced presets, added listings and details are visible there. Favorites, statuses and notes never leave this device.</p>
      <p class="muted small"><b>Push alerts:</b> install the free ntfy app, tap +, and subscribe to the topic name you saved as the NTFY_TOPIC secret. Alerts fire for new and price-dropped listings that match a 🔔 preset.</p>
      <dl class="dl dl--one">
        <div><dt>Last check</dt><dd>{meta.lastRun ? ago(meta.lastRun, s.now) : 'Never'}</dd></div>
        <div><dt>Last RentCast pull</dt><dd>{meta.lastFetch ? ago(meta.lastFetch, s.now) : 'Never'}</dd></div>
        {rc && <div><dt>Requests this period</dt><dd>{rc.used} of {rc.budget}</dd></div>}
        {rc && rc.nextFetch && <div><dt>Next pull</dt><dd>{new Date(rc.nextFetch).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</dd></div>}
      </dl>
      {(meta.warnings || []).map((w) => <p class="small is-unv" key={w}>⚠ {w}</p>)}
      {(meta.notes || []).map((n) => <p class="small muted" key={n}>• {n}</p>)}
    </div>
  );
}

export function Settings() {
  const s = useStore();
  const close = () => setUi({ panel: null });
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'gatornest', version: 1, presets: s.presets }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'gatornest-presets.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importJson = async (e) => {
    const file = e.currentTarget.files[0];
    if (!file) return;
    try { const j = JSON.parse(await file.text()); const n = importPresets(Array.isArray(j) ? j : j.presets || []); toast(n ? `Imported ${n} presets` : 'No presets found in that file'); } catch { toast("That file isn't valid preset JSON"); }
    e.currentTarget.value = '';
  };
  return (
    <Modal title="Settings" onClose={close}>
      <Section title="Your group">
        <div class="row row--between"><span class="lbl">Group size</span><Seg small value={s.settings.groupSize} options={[[4, '4 people'], [5, '5 people']]} onChange={(groupSize) => setSettings({ groupSize })} /></div>
        <Num label="Budget per person (pins over this turn gray)" prefix="$" step={25} value={s.settings.budgetPP} onChange={(v) => setSettings({ budgetPP: v || 1100 })} />
      </Section>
      <Section title="Look">
        <div class="row row--between"><span class="lbl">Theme</span><Seg small value={s.settings.theme} options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} onChange={(theme) => setSettings({ theme })} /></div>
        <Switch on={s.settings.rings} onChange={(rings) => setSettings({ rings })} label="Distance rings around Delta Chi" hint="0.5, 1 and 1.4 miles" />
      </Section>
      <Section title="Landmarks"><Landmarks /></Section>
      <Section title="Presets">
        <p class="muted small">Tap a chip to apply it. Long-press (or right-click) a chip to edit, duplicate, share or delete it.</p>
        <div class="row">
          <button type="button" class="btn btn--sm" onClick={exportJson}><Icon name="download" size={16} />Export JSON</button>
          <label class="btn btn--sm"><Icon name="plus" size={16} />Import JSON<input type="file" accept="application/json,.json" hidden onChange={importJson} /></label>
          <button type="button" class="btn btn--ghost btn--sm" onClick={() => { resetPresets(); toast('Starter presets restored'); }}>Restore starters</button>
        </div>
      </Section>
      <Section title="Alerts and sync"><Sync /></Section>
      <Section title="Data">
        <div class="row row--between"><span class="lbl">Source</span><Seg small value={s.settings.dataMode} options={[['auto', 'Auto'], ['live', 'Live'], ['fixtures', 'Test data']]} onChange={(dataMode) => { setSettings({ dataMode }); loadData(); }} /></div>
        <p class="muted small">Auto shows live listings once the hourly job has run, and the labeled test listings until then.</p>
      </Section>
      <Section title="Install on iPhone">
        <p class="muted small">Open this page in Safari, tap Share, then “Add to Home Screen”. It opens full screen like an app.</p>
      </Section>
    </Modal>
  );
}
