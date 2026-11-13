import { useEffect } from 'preact/hooks';
import { useStore, loadData, readHash, selectListing, setState, setUi, markVisited, theme as getTheme, upsertPreset, applyPreset, toast, getListings, getState } from './store.js';
import { MapView } from './map/MapView.jsx';
import { TopBar, MapButtons } from './components/TopBar.jsx';
import { FilterPanel } from './components/FilterPanel.jsx';
import { DetailSheet } from './components/DetailSheet.jsx';
import { ListView, Compare } from './components/ListView.jsx';
import { PresetEditor, PresetInfo, AddListing, Settings } from './components/Panels.jsx';

export function App() {
  const s = useStore();
  const th = getTheme(s);

  useEffect(() => {
    (async () => {
      const deepLink = readHash();
      await loadData();
      if (deepLink && getListings(getState()).some((l) => l.id === deepLink)) selectListing(deepLink);
      else if (deepLink) toast('That listing is no longer on the map');
      setTimeout(markVisited, 8000); // "new since last visit" stays up for this session
    })();
    const tick = setInterval(() => setState({ now: Date.now() }), 60e3);
    const reload = setInterval(loadData, 10 * 60e3);
    const onVis = () => document.visibilityState === 'visible' && loadData();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => setState({ now: Date.now() });
    document.addEventListener('visibilitychange', onVis);
    mq.addEventListener('change', onScheme);
    return () => { clearInterval(tick); clearInterval(reload); document.removeEventListener('visibilitychange', onVis); mq.removeEventListener('change', onScheme); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = th;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = th === 'dark' ? '#0B1226' : '#F4F3F0';
  }, [th]);

  const shared = s.ui.sharedPreset;
  return (
    <div class={`app view-${s.ui.view}${s.ui.drawing || s.ui.placing ? ' is-drawing' : ''}`}>
      <MapView />
      <TopBar />
      {s.ui.view === 'list' && <ListView />}
      <MapButtons />
      <DetailSheet />
      {shared && (
        <div class="sharedbar card">
          <span><b>{shared.emoji} {shared.name}</b><small>Shared preset applied</small></span>
          <button type="button" class="btn btn--primary btn--sm" onClick={() => { upsertPreset(shared); applyPreset(shared.id); setUi({ sharedPreset: null }); toast('Saved to your presets'); }}>Save</button>
          <button type="button" class="btn btn--sm" onClick={() => setUi({ sharedPreset: null })}>Dismiss</button>
        </div>
      )}
      {s.ui.panel === 'filters' && <FilterPanel />}
      {s.ui.panel === 'preset' && <PresetEditor key={s.ui.editPresetId} />}
      {s.ui.panel === 'presetInfo' && <PresetInfo />}
      {s.ui.panel === 'add' && <AddListing />}
      {s.ui.panel === 'settings' && <Settings />}
      {s.ui.panel === 'compare' && <Compare />}
      {!s.ready && <div class="loading"><span class="spinner" />Loading listings…</div>}
      {s.ui.toast && <div class="toast" role="status">{s.ui.toast}</div>}
    </div>
  );
}
