// Custom Waze-inspired MapLibre style on OpenFreeMap vector tiles (OpenMapTiles schema).
// No Waze assets are used; colors and shapes are our own.
export const VIOLET = '#7B4DFF';
export const VIOLET_DARK = '#5B2FD9';

const THEMES = {
  light: {
    land: '#F4F3F0', campus: '#EFEDE6', park: '#D5EBCB', wood: '#CBE5C0', water: '#BCDDF5', waterLine: '#A9D2F0',
    building: '#E4E2DC', buildingLine: '#D8D6CF',
    road: '#FFFFFF', roadMajor: '#FFFFFF', casing: '#D0CFC8', casingMajor: '#BFBEB6', path: '#D9D6CC', rail: '#CFCDC6',
    label: '#7C7C87', labelHalo: '#FFFFFF', place: '#5E5E6B', waterLabel: '#5C93BF',
    route: VIOLET, routeCasing: VIOLET_DARK, ring: VIOLET, area: VIOLET, pillText: '#FFFFFF',
  },
  dark: {
    land: '#111A33', campus: '#141F3B', park: '#143031', wood: '#12302C', water: '#0A2550', waterLine: '#0D2E63',
    building: '#18233F', buildingLine: '#1E2A4B',
    road: '#26355C', roadMajor: '#34477A', casing: '#0B1226', casingMajor: '#0B1226', path: '#1F2B4C', rail: '#1C2746',
    label: '#8FA0C8', labelHalo: '#0B1226', place: '#B6C3E6', waterLabel: '#5E8FD6',
    route: '#9B7BFF', routeCasing: '#5B2FD9', ring: '#9B7BFF', area: '#9B7BFF', pillText: '#FFFFFF',
  },
};

export const themeColors = (theme) => THEMES[theme] || THEMES.light;

const w = (stops, base = 1.5) => ['interpolate', ['exponential', base], ['zoom'], ...stops.flat()];
const cls = (...c) => ['match', ['get', 'class'], c, true, false];
const empty = { type: 'FeatureCollection', features: [] };

export function buildStyle(theme = 'light', { mock = false } = {}) {
  const c = themeColors(theme);
  const src = 'omt';
  const road = (id, filter, color, widths, extra = {}) => ({
    id, type: 'line', source: src, 'source-layer': 'transportation', filter,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': w(widths) }, ...extra,
  });
  const MINOR = cls('minor', 'service', 'track');
  const MID = cls('tertiary', 'secondary');
  const MAJOR = cls('primary', 'trunk', 'motorway');

  const style = {
    version: 8,
    name: 'GatorNest ' + theme,
    sources: {
      [src]: mock ? { type: 'vector', tiles: ['mock://{z}/{x}/{y}'], minzoom: 0, maxzoom: 14 } : { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      rings: { type: 'geojson', data: empty },
      area: { type: 'geojson', data: empty },
      route: { type: 'geojson', data: empty },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': c.land } },
      { id: 'campus', type: 'fill', source: src, 'source-layer': 'landuse', filter: cls('university', 'college', 'school', 'stadium', 'hospital'), paint: { 'fill-color': c.campus } },
      { id: 'landcover-grass', type: 'fill', source: src, 'source-layer': 'landcover', filter: cls('grass'), paint: { 'fill-color': c.park, 'fill-opacity': 0.9 } },
      { id: 'landcover-wood', type: 'fill', source: src, 'source-layer': 'landcover', filter: cls('wood', 'wetland'), paint: { 'fill-color': c.wood, 'fill-opacity': 0.7 } },
      { id: 'park', type: 'fill', source: src, 'source-layer': 'park', paint: { 'fill-color': c.park, 'fill-opacity': 0.8 } },
      { id: 'pitch', type: 'fill', source: src, 'source-layer': 'landuse', filter: cls('pitch', 'playground', 'cemetery'), paint: { 'fill-color': c.park, 'fill-opacity': 0.7 } },
      { id: 'water', type: 'fill', source: src, 'source-layer': 'water', paint: { 'fill-color': c.water } },
      { id: 'waterway', type: 'line', source: src, 'source-layer': 'waterway', paint: { 'line-color': c.waterLine, 'line-width': w([[12, 0.6], [16, 2.5]]) } },
      { id: 'building', type: 'fill', source: src, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': c.building, 'fill-outline-color': c.buildingLine, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] } },
      { id: 'path', type: 'line', source: src, 'source-layer': 'transportation', minzoom: 15, filter: cls('path'), paint: { 'line-color': c.path, 'line-width': 1.2, 'line-dasharray': [2, 2] } },
      { id: 'rail', type: 'line', source: src, 'source-layer': 'transportation', filter: cls('rail'), paint: { 'line-color': c.rail, 'line-width': 1.2 } },
      road('road-minor-case', MINOR, c.casing, [[12, 0.4], [14, 2.6], [16, 9], [18, 24]], { minzoom: 12 }),
      road('road-mid-case', MID, c.casing, [[9, 0.6], [12, 2.6], [14, 6], [16, 14], [18, 32]]),
      road('road-major-case', MAJOR, c.casingMajor, [[7, 0.8], [10, 2.4], [12, 4.4], [14, 8.5], [16, 18], [18, 40]]),
      road('road-minor', MINOR, c.road, [[12, 0.1], [14, 1.5], [16, 7], [18, 21]], { minzoom: 12 }),
      road('road-mid', MID, c.road, [[9, 0.3], [12, 1.6], [14, 4.4], [16, 11.5], [18, 28]]),
      road('road-major', MAJOR, c.roadMajor, [[7, 0.5], [10, 1.5], [12, 3], [14, 6.5], [16, 15], [18, 36]]),
      // Our overlays sit above roads and below labels.
      { id: 'rings', type: 'line', source: 'rings', paint: { 'line-color': c.ring, 'line-width': 2, 'line-opacity': 0.45, 'line-dasharray': [2, 3] } },
      { id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': c.area, 'fill-opacity': 0.1 } },
      { id: 'area-line', type: 'line', source: 'area', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': c.area, 'line-width': 3, 'line-dasharray': [1, 1.6] } },
      { id: 'route-case', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.routeCasing, 'line-width': 11, 'line-opacity': ['case', ['boolean', ['get', 'est'], false], 0.35, 1] } },
      { id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.route, 'line-width': 7.5 } },
      {
        id: 'road-label', type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: 15, filter: MINOR,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': w([[15, 10.5], [18, 13]], 1), 'symbol-spacing': 320 },
        paint: { 'text-color': c.label, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.4 },
      },
      {
        // Street-name "pills": rounded violet rectangles with bold white text.
        id: 'road-pill', type: 'symbol', source: src, 'source-layer': 'transportation_name', minzoom: 12.5,
        filter: ['all', ['has', 'name'], cls('primary', 'trunk', 'secondary', 'tertiary')],
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': w([[12, 260], [16, 520]], 1),
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': w([[12, 10.5], [16, 13]], 1), 'text-letter-spacing': 0.02,
          'text-rotation-alignment': 'viewport', 'text-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport',
          'icon-image': 'pill', 'icon-text-fit': 'both', 'icon-text-fit-padding': [2, 8, 2, 8], 'text-padding': 6,
          'symbol-sort-key': ['match', ['get', 'class'], ['primary', 'trunk'], 0, 'secondary', 1, 2],
        },
        paint: { 'text-color': c.pillText },
      },
      {
        id: 'water-label', type: 'symbol', source: src, 'source-layer': 'water_name', minzoom: 12,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 11.5, 'text-max-width': 6 },
        paint: { 'text-color': c.waterLabel, 'text-halo-color': c.labelHalo, 'text-halo-width': 1 },
      },
      {
        id: 'place-hood', type: 'symbol', source: src, 'source-layer': 'place', minzoom: 12, maxzoom: 16, filter: cls('suburb', 'neighbourhood', 'quarter'),
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 7 },
        paint: { 'text-color': c.place, 'text-opacity': 0.6, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.2 },
      },
      {
        id: 'place-city', type: 'symbol', source: src, 'source-layer': 'place', maxzoom: 12, filter: cls('city', 'town'),
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': w([[6, 11], [11, 16]], 1) },
        paint: { 'text-color': c.place, 'text-halo-color': c.labelHalo, 'text-halo-width': 1.5 },
      },
    ],
  };
  if (!mock) style.glyphs = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
  return style;
}

// Stretchable rounded rectangle used behind street names.
export function makePillImage(theme) {
  // 44px square at 2x. Corners (radius 16) stay fixed; the 8px middle band stretches to fit the text.
  const s = 44;
  const r = 16;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = theme === 'dark' ? '#8E6BFF' : VIOLET;
  g.beginPath();
  g.roundRect(1, 1, s - 2, s - 2, r);
  g.fill();
  const img = g.getImageData(0, 0, s, s);
  return {
    image: { width: s, height: s, data: new Uint8Array(img.data.buffer) },
    options: { pixelRatio: 2, stretchX: [[18, 26]], stretchY: [[18, 26]], content: [12, 6, 32, 38] },
  };
}
