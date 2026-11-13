import { useEffect, useRef, useState } from 'preact/hooks';
import Supercluster from 'supercluster';
import maplibregl from './gl.js';
import { buildStyle, makePillImage } from './style.js';
import { getState, useStore, getVisible, getListings, getLandmarks, quality, selectListing, setUi, setFilters, theme as getTheme, toast } from '../store.js';
import { circleRing, lineMidpoint, haversineMi } from '../../shared/geo.js';
import cfg from '../../config/settings.json';
import { landmarkSvg, LANDMARK_COLORS, Icon } from '../icons.jsx';
import { money } from '../format.js';

// Small imperative handle other components use (fly to a listing, overview, re-center, pick a point).
export const mapApi = { map: null, overview() {}, recenter() {}, pickPoint: () => Promise.resolve(null) };

const fc = (features) => ({ type: 'FeatureCollection', features });
const isDesktop = () => window.innerWidth >= 900;
const routeCache = new Map();

async function loadRoutes(l, dir) {
  if (l.source === 'manual' || !dir) return null;
  const key = dir + '/' + l.id;
  if (!routeCache.has(key)) {
    routeCache.set(key, fetch(`${dir}/routes/${encodeURIComponent(l.id)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return routeCache.get(key);
}

export function MapView() {
  const s = useStore();
  const box = useRef(null);
  const st = useRef({ markers: new Map(), lmMarkers: new Map(), prev: {}, index: null, styleReady: false, theme: null });
  const [lasso, setLasso] = useState(null); // screen points while drawing

  // ---- create the map once ----
  useEffect(() => {
    let dead = false;
    (async () => {
      const mock = import.meta.env.DEV && new URLSearchParams(location.search).has('mock');
      if (mock) (await import('../dev/mockTiles.js')).installMockTiles(maplibregl);
      if (dead) return;
      const th = getTheme();
      st.current.theme = th;
      st.current.mock = mock;
      const map = new maplibregl.Map({
        container: box.current, style: buildStyle(th, { mock }),
        center: [cfg.center.lng, cfg.center.lat], zoom: 13.7, minZoom: 10, maxZoom: 19,
        attributionControl: false, dragRotate: false, pitchWithRotate: false, maxPitch: 0, fadeDuration: 150,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: mock ? 'Test basemap (dev only)' : undefined }), 'bottom-right');
      const ensurePill = () => { if (!map.hasImage('pill')) { const p = makePillImage(st.current.theme); map.addImage('pill', p.image, p.options); } };
      map.on('styleimagemissing', (e) => { if (e.id === 'pill') ensurePill(); });
      map.on('style.load', () => { ensurePill(); st.current.styleReady = true; st.current.prev.overlayKey = null; sync(); });
      map.on('moveend', () => renderPins());
      map.on('zoom', () => box.current && box.current.classList.toggle('zoom-lo', map.getZoom() < 13.2));
      map.on('error', (e) => console.warn('map:', e?.error?.message || e));
      mapApi.map = map;
      st.current.map = map;
      window.__gnMap = map;
    })();
    return () => { dead = true; st.current.map && st.current.map.remove(); };
  }, []);

  // ---- helpers bound to the latest state ----
  function padding() {
    const ui = getState().ui;
    if (isDesktop()) return { top: 60, bottom: 40, left: ui.view === 'list' ? 470 : 40, right: ui.selectedId ? 460 : 40 };
    return { top: 150, bottom: ui.selectedId && ui.sheet !== 'closed' ? Math.round(window.innerHeight * 0.5) : 90, left: 30, right: 30 };
  }

  function renderPins() {
    const { map, markers, index } = st.current;
    if (!map || !index) return;
    const state = getState();
    const b = map.getBounds();
    const items = index.getClusters([b.getWest() - 0.01, b.getSouth() - 0.01, b.getEast() + 0.01, b.getNorth() + 0.01], Math.round(map.getZoom()));
    const seen = new Set();
    for (const it of items) {
      const [lng, lat] = it.geometry.coordinates;
      const isCluster = !!it.properties.cluster;
      const id = isCluster ? 'c' + it.properties.cluster_id : it.properties.id;
      seen.add(id);
      let sig;
      let l;
      if (isCluster) sig = 'c' + it.properties.point_count + '|' + it.properties.minPP;
      else {
        l = it.properties.l;
        sig = [quality(l, state), Math.round(l.pp), l.isNew, !!l.track.fav, state.ui.selectedId === l.id, l.track.status || ''].join('|');
      }
      const cur = markers.get(id);
      if (cur && cur.sig === sig) { cur.marker.setLngLat([lng, lat]); continue; }
      if (cur) cur.marker.remove();
      const el = document.createElement('button');
      el.type = 'button';
      if (isCluster) {
        const n = it.properties.point_count;
        el.className = 'cluster' + (n >= 10 ? ' cluster--lg' : '');
        el.innerHTML = `<span class="cluster__in"><b>${n}</b><small>from ${money(it.properties.minPP)}</small></span>`;
        el.setAttribute('aria-label', `${n} listings, zoom in`);
        el.onclick = (e) => {
          e.stopPropagation();
          map.easeTo({ center: [lng, lat], zoom: Math.min(index.getClusterExpansionZoom(it.properties.cluster_id) + 0.3, 18), duration: 600 });
        };
      } else {
        const q = quality(l, state);
        const sel = state.ui.selectedId === l.id;
        el.className = `pin pin--${q}${l.isNew ? ' is-new' : ''}${sel ? ' is-selected' : ''}${l.track.status === 'Passed' ? ' is-passed' : ''}`;
        el.innerHTML = `<span class="pin__in">${l.isNew ? '<span class="pin__ring"></span>' : ''}<span class="pin__body">${l.track.fav ? '<i>★</i>' : ''}${l.status === 'gone' ? 'Taken' : `${money(l.pp)}<small>/pp</small>`}</span></span>`;
        el.setAttribute('aria-label', `${l.address}, ${money(l.pp)} per person`);
        el.onclick = (e) => { e.stopPropagation(); selectListing(l.id); };
      }
      const marker = new maplibregl.Marker({ element: el, anchor: isCluster ? 'center' : 'bottom' }).setLngLat([lng, lat]).addTo(map);
      if (!isCluster && getState().ui.selectedId === l.id) el.style.zIndex = 5;
      markers.set(id, { marker, sig });
    }
    for (const [id, m] of markers) if (!seen.has(id)) { m.marker.remove(); markers.delete(id); }
  }

  function renderLandmarks(lms) {
    const { map, lmMarkers } = st.current;
    const keep = new Set();
    for (const lm of lms) {
      const sig = [lm.lat, lm.lng, lm.name, lm.icon, lm.offset].join('|');
      keep.add(lm.id);
      const cur = lmMarkers.get(lm.id);
      if (cur && cur.sig === sig) continue;
      if (cur) cur.marker.remove();
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'lm' + (lm.primary ? ' lm--primary' : '');
      el.innerHTML = `<span class="lm__badge" style="background:${LANDMARK_COLORS[lm.icon] || LANDMARK_COLORS.pin}">${landmarkSvg(lm.icon)}</span><span class="lm__label">${lm.short || lm.name}</span>`;
      el.onclick = (e) => { e.stopPropagation(); toast(`${lm.name} · ${lm.address || ''}`); map.easeTo({ center: [lm.lng, lm.lat], duration: 500 }); };
      // offset (pixels, from config) keeps landmarks that sit almost on top of each other apart
      const marker = new maplibregl.Marker({ element: el, anchor: 'center', offset: lm.offset || [0, 0] }).setLngLat([lm.lng, lm.lat]).addTo(map);
      lmMarkers.set(lm.id, { marker, sig });
    }
    for (const [id, m] of lmMarkers) if (!keep.has(id)) { m.marker.remove(); lmMarkers.delete(id); }
  }

  async function renderRoute(state, lms) {
    const { map } = st.current;
    const r = state.ui.route;
    const l = r && getListings(state).find((x) => x.id === state.ui.selectedId);
    const lm = r && lms.find((x) => x.id === r.landmarkId);
    if (st.current.routeLabel) { st.current.routeLabel.remove(); st.current.routeLabel = null; }
    if (!r || !l || !lm) { map.getSource('route')?.setData(fc([])); return; }
    const token = (st.current.routeToken = {});
    const routes = await loadRoutes(l, state.dataSource);
    if (st.current.routeToken !== token) return;
    let coords = routes?.[lm.id]?.[r.mode]?.coords;
    const est = !coords;
    if (!coords) coords = [[l.lng, l.lat], [lm.lng, lm.lat]];
    map.getSource('route')?.setData(fc([{ type: 'Feature', properties: { est }, geometry: { type: 'LineString', coordinates: coords } }]));
    const t = l.travel[lm.id];
    const leg = t[r.mode];
    const el = document.createElement('div');
    el.className = 'routepill';
    el.textContent = `${t.est || est ? '~' : ''}${leg.min} min · ${(leg.mi ?? t.mi).toFixed(1)} mi`;
    st.current.routeLabel = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lineMidpoint(coords)).addTo(map);
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    // fitBounds padding is added on top of the map's own padding, which already clears the top bar and the sheet.
    map.setPadding(padding());
    map.fitBounds(bounds, { padding: 44, maxZoom: 16.5, duration: 900 });
  }

  // ---- push store state onto the map ----
  function sync() {
    const { map } = st.current;
    const state = getState();
    if (!map || !st.current.styleReady) return;
    const prev = st.current.prev;
    const th = getTheme(state);
    if (th !== st.current.theme) {
      st.current.theme = th;
      st.current.styleReady = false;
      map.setStyle(buildStyle(th, { mock: st.current.mock }));
      return; // style.load calls sync again
    }
    const lms = getLandmarks(state);
    const visible = getVisible(state);

    if (prev.lms !== lms) { renderLandmarks(lms); prev.lms = lms; }

    const pinKey = [visible, state.settings.budgetPP, state.ui.selectedId];
    if (!prev.pinKey || pinKey.some((k, i) => k !== prev.pinKey[i])) {
      if (!prev.pinKey || prev.pinKey[0] !== visible) {
        const index = new Supercluster({ radius: 38, maxZoom: 15, map: (p) => ({ minPP: p.l.pp }), reduce: (acc, p) => { acc.minPP = Math.min(acc.minPP, p.minPP); } });
        index.load(visible.map((l) => ({ type: 'Feature', properties: { id: l.id, l }, geometry: { type: 'Point', coordinates: [l.lng, l.lat] } })));
        st.current.index = index;
      }
      prev.pinKey = pinKey;
      renderPins();
    }

    const overlayKey = [state.settings.rings, state.filters.area, lms].map((x) => (typeof x === 'object' ? x : String(x)));
    if (!prev.overlayKey || overlayKey.some((k, i) => k !== prev.overlayKey[i])) {
      prev.overlayKey = overlayKey;
      const anchor = lms.find((x) => x.id === cfg.ringLandmark) || lms.find((x) => x.primary) || lms[0];
      map.getSource('rings')?.setData(fc(state.settings.rings && anchor ? [0.5, 1, cfg.ringMiles].map((mi) => ({ type: 'Feature', properties: { mi }, geometry: { type: 'LineString', coordinates: circleRing(anchor.lng, anchor.lat, mi) } })) : []));
      const a = state.filters.area;
      map.getSource('area')?.setData(fc(a && a.length > 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...a, a[0]]] } }] : []));
      prev.routeKey = null;
    }

    const routeKey = JSON.stringify([state.ui.route, state.ui.selectedId]);
    if (prev.routeKey !== routeKey) { prev.routeKey = routeKey; renderRoute(state, lms); }

    if (prev.selectedId !== state.ui.selectedId) {
      prev.selectedId = state.ui.selectedId;
      const l = state.ui.selectedId && getListings(state).find((x) => x.id === state.ui.selectedId);
      if (l) map.flyTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 15.2), padding: padding(), duration: 1100, essential: true });
      else map.easeTo({ padding: padding(), duration: 400 });
    }
  }
  useEffect(sync);

  // ---- public handle ----
  useEffect(() => {
    mapApi.overview = () => {
      const { map } = st.current;
      if (!map) return;
      const state = getState();
      const pts = [...getVisible(state).map((l) => [l.lng, l.lat]), ...getLandmarks(state).map((l) => [l.lng, l.lat])];
      if (!pts.length) return;
      const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
      map.setPadding(padding());
      map.fitBounds(b, { padding: 28, maxZoom: 15.5, duration: 900 });
    };
    mapApi.recenter = () => {
      const { map } = st.current;
      if (!map) return;
      const lms = getLandmarks();
      const home = lms.find((x) => x.primary) || lms[0];
      const fallback = (why) => { map.flyTo({ center: [home.lng, home.lat], zoom: 15, padding: padding(), duration: 900 }); toast(why); };
      if (!navigator.geolocation) return fallback(`Centered on ${home.name}`);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (haversineMi(me, cfg.center) > 25) return fallback(`You're outside Gainesville, so centered on ${home.name}`);
          if (!st.current.me) {
            const el = document.createElement('div');
            el.className = 'medot';
            st.current.me = new maplibregl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map);
          } else st.current.me.setLngLat([me.lng, me.lat]);
          map.flyTo({ center: [me.lng, me.lat], zoom: 15.5, padding: padding(), duration: 900 });
        },
        () => fallback(`Location is off, so centered on ${home.name}`),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
      );
    };
    mapApi.pickPoint = () => new Promise((resolve) => {
      const { map } = st.current;
      if (!map) return resolve(null);
      map.once('click', (e) => resolve({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    });
  }, []);

  // ---- lasso drawing ----
  const pt = (e) => { const r = box.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const finishLasso = () => {
    const pts = lasso || [];
    setLasso(null);
    if (pts.length < 8) { toast('Draw a bigger shape'); return; }
    const step = Math.max(1, Math.floor(pts.length / 60));
    const area = pts.filter((_, i) => i % step === 0).map((p) => { const ll = st.current.map.unproject(p); return [+ll.lng.toFixed(5), +ll.lat.toFixed(5)]; });
    setFilters({ area });
    setUi({ drawing: false });
  };

  return (
    <div class="mapwrap">
      <div ref={box} class="map" />
      {s.ui.drawing && (
        <div class="lasso" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setLasso([pt(e)]); }} onPointerMove={(e) => lasso && setLasso([...lasso, pt(e)])} onPointerUp={finishLasso} onPointerCancel={() => setLasso(null)}>
          <svg>{lasso && lasso.length > 1 && <path d={'M' + lasso.map((p) => p.join(',')).join('L') + 'Z'} />}</svg>
          <div class="lasso__hint"><Icon name="lasso" /> Draw around the area you want
            <button class="btn btn--sm" onPointerDown={(e) => e.stopPropagation()} onClick={() => setUi({ drawing: false })}>Cancel</button>
          </div>
        </div>
      )}
      {s.ui.placing && <div class="placehint"><Icon name="locate" size={18} /> Tap the map where it should go</div>}
    </div>
  );
}
