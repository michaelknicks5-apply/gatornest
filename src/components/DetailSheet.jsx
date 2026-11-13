import { useRef, useState } from 'preact/hooks';
import { useStore, getListings, getLandmarks, selectListing, setUi, setTrack, setOverride, removeManual, toast, quality } from '../store.js';
import { unverifiedFor } from '../filters.js';
import { Icon, LandmarkBadge } from '../icons.jsx';
import { Modal, Seg, Num, copyText } from './ui.jsx';
import { money, miles, shortDate, tri, TYPE_LABEL, STATUS_STEPS, phonePretty, plural } from '../format.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function Carousel({ l }) {
  const [i, setI] = useState(0);
  if (!l.photos.length) {
    return (
      <div class="nophoto">
        <Icon name="photo" size={26} />
        <span>No photos from this source</span>
        <a class="btn btn--sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${l.lat},${l.lng}`}>Open Street View</a>
      </div>
    );
  }
  return (
    <div class="carousel">
      <div class="carousel__track" onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {l.photos.map((src, k) => <img key={src + k} src={src} alt={`${l.address} photo ${k + 1}`} loading="lazy" decoding="async" />)}
      </div>
      <span class="carousel__count">{i + 1}/{l.photos.length}</span>
    </div>
  );
}

function PriceChart({ history }) {
  if (!history || history.length < 2) return <p class="muted small">No price changes since it was listed.</p>;
  const W = 300, Hh = 64, pad = 8;
  const t0 = new Date(history[0].date).getTime();
  const t1 = Math.max(Date.now(), new Date(history[history.length - 1].date).getTime());
  const ps = history.map((h) => h.price);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  const x = (t) => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const y = (p) => (hi === lo ? Hh / 2 : pad + (1 - (p - lo) / (hi - lo)) * (Hh - pad * 2));
  let d = '';
  history.forEach((h, k) => {
    const X = x(new Date(h.date).getTime());
    d += k === 0 ? `M${X},${y(h.price)}` : `H${X}V${y(h.price)}`;
  });
  d += `H${x(t1)}`;
  return (
    <div class="pchart">
      <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" role="img" aria-label="Price history"><path d={d} /></svg>
      <ul>{history.map((h) => <li><span>{shortDate(h.date)}</span><b>{money(h.price)}</b></li>)}</ul>
    </div>
  );
}

const TRI = [[true, 'Yes'], [false, 'No'], [null, 'Unknown']];

function EditDetails({ l, onClose }) {
  const [d, setD] = useState({ ...l.details });
  const [photos, setPhotos] = useState((l.photos || []).filter((p) => /^https?:/.test(p)).join('\n'));
  const [url, setUrl] = useState(l.url || '');
  const up = (k) => (v) => setD({ ...d, [k]: v });
  const row = (k, label) => <div class="row row--between"><span class="lbl">{label}</span><Seg small value={d[k] ?? null} options={TRI} onChange={up(k)} /></div>;
  const save = () => {
    const ph = photos.split(/\s+/).filter((p) => /^https?:\/\//.test(p));
    setOverride(l.id, { details: d, photos: ph, url: url.trim() || null });
    toast('Details saved on this device');
    onClose();
  };
  return (
    <Modal title="Fill in details" sub={l.address} onClose={onClose} footer={<><button type="button" class="btn" onClick={onClose}>Cancel</button><button type="button" class="btn btn--primary" onClick={save}>Save</button></>}>
      <p class="muted small">Check the original listing or ask the landlord, then record what you learn. Saved on this device.</p>
      {row('furnished', 'Furnished')}{row('pets', 'Pets allowed')}{row('dogs', 'Dogs allowed')}{row('washerDryer', 'In-unit washer/dryer')}{row('centralAC', 'Central A/C')}{row('dishwasher', 'Dishwasher')}{row('yard', 'Yard or porch')}{row('pool', 'Pool')}{row('utilitiesIncluded', 'Utilities included')}{row('internetIncluded', 'Internet included')}
      <div class="grid2">
        <Num label="Parking spots" placeholder="Unknown" value={d.parking} onChange={up('parking')} />
        <Num label="Lease (months)" placeholder="Unknown" value={d.leaseMonths} onChange={up('leaseMonths')} />
        <Num label="Deposit" prefix="$" placeholder="Unknown" step={50} value={d.deposit} onChange={up('deposit')} />
        <label class="num"><span>Available from</span><span class="num__box"><input type="date" value={d.availableDate || ''} onInput={(e) => up('availableDate')(e.currentTarget.value || null)} /></span></label>
      </div>
      <label class="num"><span>Original listing link</span><span class="num__box"><input type="url" placeholder="https://…" value={url} onInput={(e) => setUrl(e.currentTarget.value)} /></span></label>
      <label class="num"><span>Photo links (one per line)</span><textarea rows="3" placeholder="https://…" value={photos} onInput={(e) => setPhotos(e.currentTarget.value)} /></label>
    </Modal>
  );
}

export function DetailSheet() {
  const s = useStore();
  const l = s.ui.selectedId && getListings(s).find((x) => x.id === s.ui.selectedId);
  const drag = useRef(null);
  const el = useRef(null);
  const [editing, setEditing] = useState(false);
  const state = l ? s.ui.sheet : 'closed';

  // Drag the sheet between half and full height (phones). Desktop shows it as a side panel.
  const onDown = (e) => {
    if (window.innerWidth >= 900) return;
    const inHead = e.target.closest('.sheet__grab');
    if (!inHead && state === 'full') return;
    if (e.target.closest('button, a, input, textarea') && !inHead) return;
    drag.current = { y: e.clientY, dy: 0 };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    drag.current.dy = e.clientY - drag.current.y;
    if (Math.abs(drag.current.dy) > 6) { el.current.style.transition = 'none'; el.current.style.setProperty('--drag', drag.current.dy + 'px'); }
  };
  const onUp = () => {
    if (!drag.current) return;
    const dy = drag.current.dy;
    drag.current = null;
    el.current.style.transition = '';
    el.current.style.setProperty('--drag', '0px');
    if (dy < -50) setUi({ sheet: 'full' });
    else if (dy > 50) state === 'full' ? setUi({ sheet: 'half' }) : selectListing(null);
  };

  if (!l) return <aside class="sheet is-closed" aria-hidden="true" />;

  const lms = getLandmarks(s);
  const d = l.details;
  const q = quality(l, s);
  const unv = unverifiedFor(l, s.filters);
  const route = s.ui.route;
  const anyEst = lms.some((lm) => l.travel[lm.id]?.est);
  const mates = s.settings.groupSize - 1;
  const msg = `Hi, I'm interested in ${l.address} for Aug 2027 with ${mates} roommates. Is it still available, and is it furnished?`;
  const phone = String(l.contact?.phone || '').replace(/\D/g, '');
  const sms = `sms:${phone ? '+1' + phone.slice(-10) : ''}${isIOS ? '&' : '?'}body=${encodeURIComponent(msg)}`;
  const mailto = l.contact?.email ? `mailto:${l.contact.email}?subject=${encodeURIComponent(l.address + ' for Aug 2027')}&body=${encodeURIComponent(msg)}` : null;
  const gq = `${l.lat},${l.lng}`;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`"${l.address}" Gainesville FL for rent`)}`;
  const share = async () => {
    const link = `${location.origin}${location.pathname}#l=${encodeURIComponent(l.id)}`;
    if (navigator.share && isIOS) { try { await navigator.share({ title: l.address, text: `${l.address}: ${money(l.price)}/mo`, url: link }); return; } catch { /* cancelled */ } }
    toast((await copyText(link)) ? 'Link copied' : 'Could not copy the link');
  };
  const status = l.track.status || 'New';
  const detailRows = [
    ['Available', d.availableDate ? shortDate(d.availableDate) : null],
    ['Lease', d.leaseMonths != null ? `${d.leaseMonths} months` : null],
    ['Furnished', d.furnished], ['Pets', d.pets], ['Dogs', d.dogs],
    ['Parking', d.parking != null ? plural(d.parking, 'spot') : null],
    ['Washer/dryer', d.washerDryer], ['Central A/C', d.centralAC], ['Dishwasher', d.dishwasher],
    ['Yard or porch', d.yard], ['Pool', d.pool], ['Utilities incl.', d.utilitiesIncluded], ['Internet incl.', d.internetIncluded],
    ['Deposit', d.deposit != null ? money(d.deposit) : null],
  ];

  return (
    <>
      <aside ref={el} class={`sheet is-${state}`} aria-label="Listing details" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div class="sheet__grab">
          <span class="sheet__handle" />
          <button type="button" class="iconbtn sheet__x" aria-label="Close" onClick={() => selectListing(null)}><Icon name="close" /></button>
          <button type="button" class="iconbtn sheet__exp" aria-label={state === 'full' ? 'Shrink' : 'Expand'} onClick={() => setUi({ sheet: state === 'full' ? 'half' : 'full' })}><Icon name="down" class={state === 'full' ? '' : 'flip'} /></button>
        </div>
        <div class="sheet__scroll">
          <Carousel l={l} />
          <div class="sheet__pad">
            <div class="badges">
              {l.isTest && <span class="tag tag--test">Test data</span>}
              {l.status === 'gone' && <span class="tag tag--gone">Taken {shortDate(l.goneSince)}</span>}
              {l.isNew && <span class="tag tag--new">New</span>}
              {l.drop && <span class="tag tag--drop">Dropped {money(l.drop.from - l.drop.to)}</span>}
              {l.source === 'manual' && <span class="tag">Added by you</span>}
              {unv.length > 0 && <span class="tag tag--unv" title={unv.join(', ')}>Unverified: {unv.join(', ')}</span>}
            </div>
            <div class="price">
              <div><b>{money(l.price)}</b><span>/mo</span></div>
              <span class={`ppill ppill--${q}`}>{money(l.pp)}<small>/person</small></span>
            </div>
            <p class="split">{money(l.pp4)} each with 4 · {money(l.pp5)} each with 5</p>
            <h2 class="addr">{l.address}</h2>
            <p class="facts">{l.beds} bd · {l.baths ?? '?'} ba{l.sqft ? ` · ${l.sqft.toLocaleString()} sq ft` : ''} · {TYPE_LABEL[l.type] || l.type}{l.yearBuilt ? ` · Built ${l.yearBuilt}` : ''}</p>

            <div class="actions">
              <button type="button" class={'act' + (l.track.fav ? ' is-on' : '')} onClick={() => setTrack(l.id, { fav: !l.track.fav })}><Icon name="star" fill={!!l.track.fav} />{l.track.fav ? 'Saved' : 'Favorite'}</button>
              {phone ? <a class="act" href={`tel:+1${phone.slice(-10)}`}><Icon name="phone" />Call</a> : <span class="act is-off"><Icon name="phone" />Call</span>}
              <a class="act" href={sms}><Icon name="chat" />Text</a>
              <button type="button" class="act" onClick={share}><Icon name="share" />Share</button>
            </div>

            <h3>Travel times <small>tap a time to draw the route</small></h3>
            <div class="tgrid" role="table">
              <div class="tgrid__row tgrid__row--head"><span /><span><Icon name="walk" size={18} /></span><span><Icon name="bike" size={18} /></span><span><Icon name="car" size={18} /></span></div>
              {lms.map((lm) => {
                const t = l.travel[lm.id];
                return (
                  <div class="tgrid__row" key={lm.id}>
                    <span class="tgrid__lm"><LandmarkBadge icon={lm.icon} size={26} /><span><b>{lm.short || lm.name}</b><small>{miles(t.mi)}</small></span></span>
                    {['walk', 'bike', 'drive'].map((mode) => {
                      const on = route && route.landmarkId === lm.id && route.mode === mode;
                      return <button type="button" class={'tcell' + (on ? ' is-on' : '')} aria-label={`${mode} to ${lm.name}: ${t[mode].min} minutes`} onClick={() => setUi({ route: on ? null : { landmarkId: lm.id, mode }, sheet: 'half' })}>{t.est ? '~' : ''}{t[mode].min}<small>min</small></button>;
                    })}
                  </div>
                );
              })}
            </div>
            {anyEst && <p class="muted small">~ means estimated from straight-line distance; routed times arrive with the next data refresh.</p>}

            <h3>Details <button type="button" class="linkbtn" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Fill in</button></h3>
            <dl class="dl">
              {detailRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd class={v == null ? 'is-unv' : v === false ? 'is-no' : ''}>{typeof v === 'boolean' || v == null ? tri(v) : v}</dd></div>)}
            </dl>

            <h3>Deal</h3>
            {l.deal ? <p class="deal"><span class={`tag tag--deal-${l.deal.label}`}>{l.deal.label === 'good' ? 'Good deal' : l.deal.label === 'high' ? 'Priced high' : 'Fair price'}</span> {l.deal.why}</p> : <p class="muted small">Not enough similar listings to score this one yet.</p>}
            <p class="muted small">Listed {plural(l.dom, 'day')} ago{l.ppsf ? ` · $${l.ppsf.toFixed(2)}/sq ft` : ''}</p>
            <PriceChart history={l.priceHistory} />

            {l.description && <><h3>About</h3><p class="desc">{l.description}</p></>}

            <h3>Contact</h3>
            {l.contact && (l.contact.name || l.contact.office) ? (
              <div class="contact">
                <div><b>{l.contact.name || l.contact.office}</b>{l.contact.name && l.contact.office && <small>{l.contact.office}</small>}{phone && <small>{phonePretty(phone)}</small>}</div>
                <div class="contact__btns">
                  {phone && <a class="btn btn--sm" href={`tel:+1${phone.slice(-10)}`}><Icon name="phone" size={16} />Call</a>}
                  {mailto && <a class="btn btn--sm" href={mailto}><Icon name="mail" size={16} />Email</a>}
                </div>
              </div>
            ) : <p class="muted small">No contact info from this source.</p>}
            <a class="btn btn--primary btn--block" href={sms}><Icon name="chat" size={18} />Text inquiry</a>
            <p class="muted small quote">“{msg}”</p>

            <h3>Links</h3>
            <div class="links">
              {l.url ? <a class="btn btn--sm" target="_blank" rel="noopener" href={l.url}><Icon name="external" size={16} />Original listing</a> : <a class="btn btn--sm" target="_blank" rel="noopener" href={search}><Icon name="external" size={16} />Search this address</a>}
              <a class="btn btn--sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${gq}`}><Icon name="map" size={16} />Google Maps</a>
              <a class="btn btn--sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${gq}`}><Icon name="photo" size={16} />Street View</a>
              <a class="btn btn--sm" target="_blank" rel="noopener" href={`https://www.google.com/maps/dir/?api=1&destination=${gq}`}><Icon name="route" size={16} />Directions</a>
            </div>

            <h3>Nearby</h3>
            <dl class="dl">
              {l.nearby ? [['Publix', l.nearby.publix], ['Gym', l.nearby.gym], ['Gas', l.nearby.gas], ['Bus stop', l.nearby.bus]].map(([k, v]) => v && <div key={k}><dt>{k}</dt><dd>{miles(v.mi)}<small>{v.name}</small></dd></div>) : <div><dt>Essentials</dt><dd class="is-unv">Arrives with the next data refresh</dd></div>}
              <div class="dl__wide"><dt>Flood zone</dt><dd class={l.flood ? (l.flood.highRisk ? 'is-no' : '') : 'is-unv'}>{l.flood ? `${l.flood.zone}${l.flood.highRisk ? ' · high risk' : ' · minimal risk'}` : 'Unverified'}</dd></div>
            </dl>

            <h3>My tracking</h3>
            <div class="pipeline">
              {STATUS_STEPS.map((st, k) => <button type="button" key={st} class={(st === status ? 'is-on ' : '') + (STATUS_STEPS.indexOf(status) > k && status !== 'Passed' ? 'is-done' : '') + (st === 'Passed' ? ' is-pass' : '')} onClick={() => setTrack(l.id, { status: st })}>{st}</button>)}
            </div>
            <textarea class="notes" rows="3" placeholder="Private notes (saved on this device)" value={l.track.notes || ''} onInput={(e) => setTrack(l.id, { notes: e.currentTarget.value })} />
            {l.source === 'manual' && <button type="button" class="btn btn--ghost btn--danger" onClick={() => { removeManual(l.id); selectListing(null); toast('Listing removed'); }}><Icon name="trash" size={16} />Remove this listing</button>}
          </div>
        </div>
      </aside>
      {editing && <EditDetails l={l} onClose={() => setEditing(false)} />}
    </>
  );
}
