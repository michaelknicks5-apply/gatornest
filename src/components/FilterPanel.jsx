import { useStore, setFilters, setLandmarkRule, setSettings, setUi, getVisible, getLandmarks, applyPreset } from '../store.js';
import { HOUSE_TYPES, DEFAULT_FILTERS, countActive } from '../filters.js';
import { Chip, Seg, Range, Switch, Modal, Section, Num } from './ui.jsx';
import { LandmarkBadge, Icon } from '../icons.jsx';
import { money, TYPE_LABEL } from '../format.js';

const MODES = [['mi', 'Miles'], ['walk', 'Walk'], ['bike', 'Bike'], ['drive', 'Drive']];

function LandmarkRule({ lm, rule }) {
  const mode = rule?.mode || 'mi';
  const isMi = mode === 'mi';
  return (
    <div class="lmrule">
      <div class="lmrule__head">
        <LandmarkBadge icon={lm.icon} size={30} />
        <b>{lm.short || lm.name}</b>
        <Seg small value={mode} options={MODES} onChange={(m) => setLandmarkRule(lm.id, { mode: m, max: rule?.max == null ? null : m === 'mi' ? 1.5 : m === 'walk' ? 15 : 10 })} />
      </div>
      <Range label={isMi ? 'Within' : `Max ${mode} time`} value={rule?.max ?? null} min={isMi ? 0.2 : 2} max={isMi ? 5 : 45} step={isMi ? 0.1 : 1}
        fmt={(v) => (isMi ? `${v.toFixed(1)} mi` : `${v} min`)} anyLabel="Any distance"
        onChange={(max) => setLandmarkRule(lm.id, max == null ? null : { mode, max })} />
    </div>
  );
}

export function FilterPanel() {
  const s = useStore();
  const f = s.filters;
  const n = getVisible(s).filter((l) => l.status !== 'gone').length;
  const set = (k) => (v) => setFilters({ [k]: v });
  const flip = (k) => () => setFilters({ [k]: !f[k] });
  const lms = getLandmarks(s);
  const close = () => setUi({ panel: null });
  const toggleType = (t) => {
    const types = f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t];
    setFilters({ types: types.length ? types : [...HOUSE_TYPES] });
  };

  return (
    <Modal title="Filters" sub={`${n} ${n === 1 ? 'house matches' : 'houses match'}`} onClose={close}
      footer={<>
        <button type="button" class="btn" onClick={() => setUi({ panel: 'preset', editPresetId: 'new' })}><Icon name="star" size={17} />Save as preset</button>
        <button type="button" class="btn btn--primary" onClick={close}>Show {n} {n === 1 ? 'house' : 'houses'}</button>
      </>}>
      <div class="quick">
        <Chip on={f.furnished} onClick={flip('furnished')}>🛋️ Furnished</Chip>
        <Chip on={f.dogs} onClick={flip('dogs')}>🐶 Dogs OK</Chip>
        <Chip on={f.wd} onClick={flip('wd')}>🧺 In-unit W/D</Chip>
        <Chip on={f.dropped} onClick={flip('dropped')}>📉 Price dropped</Chip>
        <Chip on={f.fresh === 1} onClick={() => setFilters({ fresh: f.fresh === 1 ? null : 1 })}>✨ New today</Chip>
        <Chip on={f.favOnly} onClick={flip('favOnly')}>⭐ Favorites</Chip>
      </div>

      <Section title="Money">
        <Range label={`Rent per person (group of ${s.settings.groupSize})`} value={f.ppMax} min={500} max={2000} step={25} fmt={(v) => `up to ${money(v)}`} anyLabel="Any price" onChange={set('ppMax')} />
        <div class="row row--between"><span class="lbl">Group size</span><Seg small value={s.settings.groupSize} options={[[4, '4 people'], [5, '5 people']]} onChange={(groupSize) => setSettings({ groupSize })} /></div>
        <div class="grid2">
          <Num label="Total rent min" prefix="$" step={50} value={f.rentMin} onChange={set('rentMin')} />
          <Num label="Total rent max" prefix="$" step={50} value={f.rentMax} onChange={set('rentMax')} />
        </div>
        <div class="row row--between"><span class="lbl">Deal score</span><Seg small value={f.deal} options={[['any', 'Any'], ['fair', 'Fair or better'], ['good', 'Good only']]} onChange={set('deal')} /></div>
        <div class="chips">
          <Chip on={f.utilIncl} onClick={flip('utilIncl')}>Utilities included</Chip>
          <Chip on={f.netIncl} onClick={flip('netIncl')}>Internet included</Chip>
          <Chip on={f.dropped} onClick={flip('dropped')}>Price dropped recently</Chip>
        </div>
      </Section>

      <Section title="Space">
        <div class="row row--between"><span class="lbl">Bedrooms, at least</span><Seg small value={f.bedsMin} options={[[null, 'Any'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]} onChange={set('bedsMin')} /></div>
        <div class="row row--between"><span class="lbl">Bedrooms, at most</span><Seg small value={f.bedsMax} options={[[null, 'Any'], [4, '4'], [5, '5'], [6, '6']]} onChange={set('bedsMax')} /></div>
        <div class="row row--between"><span class="lbl">Bathrooms, at least</span><Seg small value={f.bathsMin} options={[[null, 'Any'], [2, '2'], [3, '3'], [4, '4']]} onChange={set('bathsMin')} /></div>
        <div class="row row--between"><span class="lbl">Baths per bedroom</span><Seg small value={f.bathRatioMin} options={[[null, 'Any'], [0.5, '1 per 2'], [0.75, '3 per 4'], [1, '1 each']]} onChange={set('bathRatioMin')} /></div>
        <Range label="Square feet" value={f.sqftMin} min={0} max={3000} step={100} anyAt="min" fmt={(v) => `${v.toLocaleString()}+ sq ft`} anyLabel="Any size" onChange={set('sqftMin')} />
        <div class="grid2"><Num label="Price per sq ft max" prefix="$" step={0.1} value={f.ppsfMax} onChange={set('ppsfMax')} /></div>
        <div class="lbl">Property type</div>
        <div class="chips">{HOUSE_TYPES.map((t) => <Chip key={t} on={f.types.includes(t)} onClick={() => toggleType(t)}>{TYPE_LABEL[t]}</Chip>)}</div>
        <Switch on={f.hideComplexes} onChange={set('hideComplexes')} label="Hide big complexes" hint="Apartment and by-the-bed student communities" />
      </Section>

      <Section title="Location">
        {lms.map((lm) => <LandmarkRule key={lm.id} lm={lm} rule={f.lm[lm.id]} />)}
        <div class="row">
          <button type="button" class="btn" onClick={() => setUi({ panel: null, drawing: true, view: 'map', selectedId: null, sheet: 'closed' })}><Icon name="lasso" size={18} />{f.area ? 'Redraw area' : 'Draw an area'}</button>
          {f.area && <button type="button" class="btn btn--ghost" onClick={() => setFilters({ area: null })}>Clear area</button>}
        </div>
        <Switch on={f.hideFlood} onChange={set('hideFlood')} label="Hide high-risk flood zones" hint="FEMA zones A and V" />
        <Switch on={s.settings.rings} onChange={(rings) => setSettings({ rings })} label="Show distance rings" hint="0.5, 1 and 1.4 miles around Delta Chi" />
      </Section>

      <Section title="Must-haves">
        <div class="chips">
          <Chip on={f.furnished} onClick={flip('furnished')}>Furnished</Chip>
          <Chip on={f.pets} onClick={flip('pets')}>Pets allowed</Chip>
          <Chip on={f.dogs} onClick={flip('dogs')}>Dogs allowed</Chip>
          <Chip on={f.wd} onClick={flip('wd')}>In-unit washer/dryer</Chip>
          <Chip on={f.ac} onClick={flip('ac')}>Central A/C</Chip>
          <Chip on={f.dishwasher} onClick={flip('dishwasher')}>Dishwasher</Chip>
          <Chip on={f.outdoor} onClick={flip('outdoor')}>Yard or porch</Chip>
          <Chip on={f.pool} onClick={flip('pool')}>Pool</Chip>
        </div>
        <div class="row row--between"><span class="lbl">Parking spots, at least</span><Seg small value={f.parkingMin} options={[[null, 'Any'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]} onChange={set('parkingMin')} /></div>
        <div class="row row--between">
          <Chip on={!!f.availBy} onClick={() => setFilters({ availBy: f.availBy ? null : '2027-08-01' })}>Move-in by</Chip>
          <input class="date" type="date" value={f.availBy || '2027-08-01'} disabled={!f.availBy} onInput={(e) => setFilters({ availBy: e.currentTarget.value || null })} />
        </div>
        <div class="row row--between"><span class="lbl">Lease length</span><Seg small value={f.leaseMax} options={[[null, 'Any'], [12, 'Up to 12 mo'], [10, 'Up to 10'], [6, 'Up to 6']]} onChange={set('leaseMax')} /></div>
        <Switch on={f.verifiedOnly} onChange={set('verifiedOnly')} label="Verified only" hint="Off: a listing that doesn't say (furnished, pets, parking…) still shows, tagged Unverified" />
      </Section>

      <Section title="Freshness and status">
        <div class="row row--between"><span class="lbl">New in the last</span><Seg small value={f.fresh} options={[[null, 'Any'], [1, '24 hours'], [7, '7 days']]} onChange={set('fresh')} /></div>
        <div class="grid2"><Num label="Days on market max" value={f.domMax} onChange={set('domMax')} /></div>
        <div class="chips">
          <Chip on={f.hidePassed} onClick={flip('hidePassed')}>Hide Passed</Chip>
          <Chip on={f.favOnly} onClick={flip('favOnly')}>Favorites only</Chip>
          <Chip on={f.hasPhotos} onClick={flip('hasPhotos')}>Must have photos</Chip>
          <Chip on={f.showGone} onClick={flip('showGone')}>Show off-market (14 days)</Chip>
        </div>
        <label class="num"><span>Keyword</span>
          <span class="num__box"><input type="search" placeholder="fenced, pool, garage" value={f.q} onInput={(e) => setFilters({ q: e.currentTarget.value })} /></span>
        </label>
      </Section>

      <div class="row row--center">
        <button type="button" class="btn btn--ghost" onClick={() => (s.activePresetId ? applyPreset(s.activePresetId) : setFilters({ ...DEFAULT_FILTERS }))}>Reset{countActive(f) ? ` (${countActive(f)} changed)` : ''}</button>
      </div>
    </Modal>
  );
}
