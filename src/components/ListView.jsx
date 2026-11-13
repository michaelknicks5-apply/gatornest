import { useStore, getVisible, getListings, getLandmarks, selectListing, setUi, setTrack, quality } from '../store.js';
import { unverifiedFor } from '../filters.js';
import { Icon } from '../icons.jsx';
import { Modal, Seg } from './ui.jsx';
import { bestLink } from './ListingLink.jsx';
import { money, miles, shortDate, tri, TYPE_LABEL, plural } from '../format.js';

const SORTS = {
  pp: ['$/person', (a, b) => a.pp - b.pp],
  walk: ['Walk to Delta Chi', (a, b, id) => a.travel[id].walk.min - b.travel[id].walk.min],
  new: ['Newest', (a, b) => a.ageHours - b.ageHours],
  deal: ['Best deal', (a, b) => (b.deal?.pct ?? -9) - (a.deal?.pct ?? -9)],
};

export function ListView() {
  const s = useStore();
  const lms = getLandmarks(s);
  const anchor = (lms.find((x) => x.primary) || lms[0]).id;
  const anchorName = (lms.find((x) => x.id === anchor) || {}).short || (lms.find((x) => x.id === anchor) || {}).name;
  const rows = [...getVisible(s)].sort((a, b) => (a.status === 'gone') - (b.status === 'gone') || SORTS[s.ui.sort][1](a, b, anchor));
  const cmp = s.ui.compare;
  const toggleCmp = (id) => setUi({ compare: cmp.includes(id) ? cmp.filter((x) => x !== id) : cmp.length >= 4 ? cmp : [...cmp, id] });
  return (
    <section class="listview" aria-label="Listings">
      <div class="listview__head">
        <div class="sortchips">
          {Object.entries(SORTS).map(([k, [label]]) => <button type="button" key={k} class={'chip chip--sm' + (s.ui.sort === k ? ' is-on' : '')} onClick={() => setUi({ sort: k })}>{k === 'walk' ? `Walk to ${anchorName}` : label}</button>)}
        </div>
        {cmp.length > 0 && <button type="button" class="btn btn--primary btn--sm" disabled={cmp.length < 2} onClick={() => setUi({ panel: 'compare' })}><Icon name="compare" size={16} />Compare {cmp.length}</button>}
      </div>
      {rows.length === 0 && (
        <div class="empty"><b>No houses match these filters.</b><p>Loosen a filter or try the Wide Net preset.</p><button type="button" class="btn" onClick={() => setUi({ panel: 'filters' })}>Open filters</button></div>
      )}
      <div class="cards">
        {rows.map((l) => {
          const q = quality(l, s);
          const unv = unverifiedFor(l, s.filters);
          return (
            <article key={l.id} class={'lcard' + (l.status === 'gone' ? ' is-gone' : '') + (s.ui.selectedId === l.id ? ' is-selected' : '')} onClick={() => { setUi({ view: window.innerWidth >= 900 ? 'list' : 'map' }); selectListing(l.id); }}>
              <div class="lcard__img">
                {l.photos.length ? <img src={l.photos[0]} alt="" loading="lazy" decoding="async" /> : <span class="lcard__noimg"><Icon name="home" size={26} /></span>}
                {l.isNew && <span class="tag tag--new">New</span>}
              </div>
              <div class="lcard__body">
                <div class="lcard__top">
                  <span class={`ppill ppill--${q}`}>{l.status === 'gone' ? 'Off market' : <>{money(l.pp)}<small>/pp</small></>}</span>
                  <span class="lcard__total">{money(l.price)}/mo</span>
                  <button type="button" class={'iconbtn iconbtn--sm' + (l.track.fav ? ' is-fav' : '')} aria-label={l.track.fav ? 'Remove favorite' : 'Favorite'} onClick={(e) => { e.stopPropagation(); setTrack(l.id, { fav: !l.track.fav }); }}><Icon name="star" size={18} fill={!!l.track.fav} /></button>
                </div>
                <b class="lcard__addr">{l.address}</b>
                <span class="lcard__facts">{l.beds} bd · {l.baths ?? '?'} ba{l.sqft ? ` · ${l.sqft.toLocaleString()} sq ft` : ''} · {TYPE_LABEL[l.type] || l.type}</span>
                <span class="lcard__facts"><Icon name="walk" size={14} /> {l.travel[anchor].est ? '~' : ''}{l.travel[anchor].walk.min} min to {anchorName} · {miles(l.travel[anchor].mi)}</span>
                <div class="badges">
                  {(() => { const b = bestLink(l); return <a class={'tag tag--link' + (b.saved ? ' is-saved' : '')} href={b.href} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>{b.saved ? `Listing on ${b.label}` : 'Look up address'} ↗</a>; })()}
                  {l.deal?.label === 'good' && <span class="tag tag--deal-good">Good deal</span>}
                  {l.drop && <span class="tag tag--drop">Dropped {money(l.drop.from - l.drop.to)}</span>}
                  {l.track.status && l.track.status !== 'New' && <span class="tag">{l.track.status}</span>}
                  {unv.length > 0 && <span class="tag tag--unv">Unverified</span>}
                  {l.isTest && <span class="tag tag--test">Test</span>}
                  {l.track.fav && <button type="button" class={'tag tag--cmp' + (cmp.includes(l.id) ? ' is-on' : '')} onClick={(e) => { e.stopPropagation(); toggleCmp(l.id); }}>{cmp.includes(l.id) ? '✓ Comparing' : '+ Compare'}</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {rows.length > 0 && cmp.length === 0 && <p class="muted small center">Star 2 to 4 houses, then tap “+ Compare” on each to see them side by side.</p>}
    </section>
  );
}

export function Compare() {
  const s = useStore();
  const lms = getLandmarks(s);
  const all = getListings(s);
  const picks = s.ui.compare.map((id) => all.find((l) => l.id === id)).filter(Boolean);
  const rows = [
    ['Rent', (l) => `${money(l.price)}/mo`],
    ['Each with 4', (l) => money(l.pp4)],
    ['Each with 5', (l) => money(l.pp5)],
    ['Beds / baths', (l) => `${l.beds} / ${l.baths ?? '?'}`],
    ['Sq ft', (l) => (l.sqft ? l.sqft.toLocaleString() : '—')],
    ['Type', (l) => TYPE_LABEL[l.type] || l.type],
    ...lms.map((lm) => [`Walk to ${lm.short || lm.name}`, (l) => `${l.travel[lm.id].est ? '~' : ''}${l.travel[lm.id].walk.min} min`]),
    ['Deal', (l) => (l.deal ? (l.deal.label === 'good' ? 'Good' : l.deal.label === 'high' ? 'High' : 'Fair') : '—')],
    ['Furnished', (l) => tri(l.details.furnished)],
    ['Dogs', (l) => tri(l.details.dogs)],
    ['Parking', (l) => (l.details.parking != null ? plural(l.details.parking, 'spot') : 'Unverified')],
    ['Washer/dryer', (l) => tri(l.details.washerDryer)],
    ['Available', (l) => (l.details.availableDate ? shortDate(l.details.availableDate) : 'Unverified')],
    ['Flood zone', (l) => (l.flood ? l.flood.zone : 'Unverified')],
    ['My status', (l) => l.track.status || 'New'],
  ];
  return (
    <Modal wide title="Compare" sub={`${picks.length} favorites side by side`} onClose={() => setUi({ panel: null })} footer={<button type="button" class="btn" onClick={() => setUi({ compare: [], panel: null })}>Clear selection</button>}>
      <div class="cmp" style={{ '--cols': picks.length }}>
        <div class="cmp__row cmp__row--head"><span />{picks.map((l) => <button type="button" key={l.id} class="cmp__name" onClick={() => { setUi({ panel: null, view: 'map' }); selectListing(l.id); }}>{l.address}</button>)}</div>
        {rows.map(([label, fn]) => <div class="cmp__row" key={label}><span>{label}</span>{picks.map((l) => { const v = fn(l); return <b key={l.id} class={v === 'Unverified' ? 'is-unv' : ''}>{v}</b>; })}</div>)}
      </div>
    </Modal>
  );
}
