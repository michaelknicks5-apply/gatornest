import { useRef } from 'preact/hooks';
import { useStore, setUi, applyPreset, getVisible, newSinceLastVisit, setFilters, getState } from '../store.js';
import { countActive, sameFilters } from '../filters.js';
import { Icon } from '../icons.jsx';
import { ago, plural } from '../format.js';
import { mapApi } from '../map/MapView.jsx';

export const Logo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#7B4DFF" />
    <path d="M14 33 32 17l18 16" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M20 37c2.5 7.5 7 11 12 11s9.5-3.5 12-11" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" />
    <circle cx="32" cy="35" r="4.2" fill="#C9F26B" />
  </svg>
);

function PresetChip({ p, active, edited }) {
  const timer = useRef(null);
  const longFired = useRef(false);
  const start = () => { longFired.current = false; timer.current = setTimeout(() => { longFired.current = true; setUi({ panel: 'preset', editPresetId: p.id }); }, 480); };
  const stop = () => clearTimeout(timer.current);
  return (
    <button type="button" class={'pchip' + (active ? ' is-on' : '')} style={{ '--pc': p.color }}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={(e) => { e.preventDefault(); stop(); setUi({ panel: 'preset', editPresetId: p.id }); }}
      onClick={() => { if (!longFired.current) applyPreset(p.id); }}
      title="Tap to apply. Long-press to edit.">
      {p.emoji && <span class="pchip__emoji">{p.emoji}</span>}{p.name}{active && edited && <span class="pchip__dot" title="Changed since applied" />}{p.alerts && <Icon name="bell" size={13} />}
    </button>
  );
}

export function TopBar() {
  const s = useStore();
  const visible = getVisible(s);
  const activeCount = visible.filter((l) => l.status !== 'gone').length;
  const nFilters = countActive(s.filters);
  const active = s.presets.find((p) => p.id === s.activePresetId);
  const edited = active && !sameFilters(active.filters, s.filters);
  const meta = s.meta || {};
  const left = meta.rentcast ? Math.max(0, meta.rentcast.budget - meta.rentcast.used) : null;
  const fresh = newSinceLastVisit(s);
  const isFixture = s.dataSource === 'fixtures';
  const warn = s.usingCache ? `Can't reach the server. Showing data saved ${ago(new Date(s.usingCache).toISOString(), s.now)}` : s.loadError ? 'Could not load listings' : meta.warnings && meta.warnings.length ? meta.warnings[0] : null;

  return (
    <header class="top">
      <div class="top__bar card">
        <div class="brand"><Logo /><b>GatorNest</b></div>
        <div class="top__btns">
          <button type="button" class="iconbtn" aria-label={s.ui.view === 'map' ? 'List view' : 'Map view'} onClick={() => setUi({ view: s.ui.view === 'map' ? 'list' : 'map' })}><Icon name={s.ui.view === 'map' ? 'list' : 'map'} /></button>
          <button type="button" class={'iconbtn' + (nFilters ? ' has-badge' : '')} aria-label="Filters" onClick={() => setUi({ panel: 'filters' })}><Icon name="filter" />{nFilters > 0 && <span class="badge">{nFilters}</span>}</button>
          <button type="button" class="iconbtn" aria-label="Add a listing by link" onClick={() => setUi({ panel: 'add' })}><Icon name="plus" /></button>
          <button type="button" class="iconbtn" aria-label="Settings" onClick={() => setUi({ panel: 'settings' })}><Icon name="gear" /></button>
        </div>
      </div>

      <div class="presets" role="toolbar" aria-label="Saved filter presets">
        <button type="button" class="pinfo" aria-label="What the presets do" title="What the presets do" onClick={() => setUi({ panel: 'presetInfo' })}><Icon name="info" size={20} /></button>
        {s.presets.map((p) => <PresetChip key={p.id} p={p} active={p.id === s.activePresetId} edited={edited} />)}
        {(edited || !active) && <button type="button" class="pchip pchip--save" onClick={() => setUi({ panel: 'preset', editPresetId: 'new' })}><Icon name="plus" size={15} />Save</button>}
      </div>

      <div class="status">
        <span class="schip schip--count" onClick={() => setUi({ view: 'list' })}><b>{activeCount}</b> {activeCount === 1 ? 'house matches' : 'houses match'}</span>
        {meta.lastRun && <span class="schip">Updated {ago(meta.lastFetch || meta.lastRun, s.now)}{left != null && <> · {plural(left, 'call')} left</>}</span>}
        {isFixture && <span class="schip schip--test">Test data</span>}
        {fresh > 0 && <button type="button" class="schip schip--new" onClick={() => setFilters({ fresh: 1 })}>{fresh} new since last visit</button>}
        {s.filters.area && <button type="button" class="schip schip--area" onClick={() => setFilters({ area: null })}>Drawn area <Icon name="close" size={13} /></button>}
        {warn && <button type="button" class="schip schip--warn" title={warn} onClick={() => setUi({ panel: 'settings' })}><Icon name="warn" size={14} /><span>{warn}</span></button>}
      </div>
    </header>
  );
}

export function MapButtons() {
  const s = useStore();
  const hidden = s.ui.view === 'list' || (s.ui.selectedId && s.ui.sheet !== 'closed');
  return (
    <div class={'mapbtns' + (hidden ? ' is-hidden' : '')}>
      <button type="button" class="pillbtn" onClick={() => mapApi.recenter()}><Icon name="locate" size={18} />Re-center</button>
      <button type="button" class="pillbtn" onClick={() => mapApi.overview()}><Icon name="overview" size={18} />Overview</button>
    </div>
  );
}
