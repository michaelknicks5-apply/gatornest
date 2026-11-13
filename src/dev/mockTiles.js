// DEV ONLY (?mock=1): a hand-drawn stand-in for the base map so the style can be checked
// in places where the real tile server is unreachable. Not used in production.
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

const line = (name, klass, coords) => ({ type: 'Feature', properties: { name, class: klass }, geometry: { type: 'LineString', coordinates: coords } });
const poly = (props, ring) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
const box = (props, x, y, dx, dy) => poly(props, [[x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy]]);

const UNIV = 29.652, W13 = -82.3392, W34 = -82.3723;
const roads = [
  line('W University Ave', 'primary', [[-82.395, UNIV], [-82.32, UNIV]]),
  line('NW 13th St', 'primary', [[W13, 29.675], [W13, 29.615]]),
  line('SW 34th St', 'primary', [[W34, 29.675], [W34, 29.615]]),
  line('Archer Rd', 'primary', [[W13, 29.6405], [-82.356, 29.633], [W34, 29.6255], [-82.39, 29.619]]),
  line('SW 2nd Ave', 'secondary', [[W34, 29.6502], [-82.36, 29.6502], [-82.353, 29.6512], [-82.325, 29.6512]]),
  line('NW 8th Ave', 'secondary', [[-82.39, 29.659], [-82.32, 29.659]]),
  line('NW 16th Ave', 'secondary', [[-82.39, 29.667], [-82.32, 29.667]]),
  line('Museum Rd', 'tertiary', [[W13, 29.6444], [-82.3565, 29.6444], [-82.363, 29.641]]),
  line('NW 5th Ave', 'tertiary', [[-82.358, 29.6562], [-82.325, 29.6562]]),
  line('NW 22nd St', 'tertiary', [[-82.353, UNIV], [-82.353, 29.667]]),
  line('Gale Lemerand Dr', 'tertiary', [[-82.3502, UNIV], [-82.3502, 29.6405]]),
  line('Newell Dr', 'minor', [[-82.3445, UNIV], [-82.3445, 29.641]]),
  line('Fraternity Dr', 'minor', [[-82.3545, 29.6444], [-82.355, 29.6462], [-82.3585, 29.6468], [-82.36, 29.645], [-82.3585, 29.6438]]),
  line('Village Dr', 'minor', [[-82.36, 29.645], [-82.362, 29.6475], [-82.362, 29.6502]]),
  line('SW 23rd Ter', 'minor', [[-82.3574, 29.6502], [-82.3574, UNIV]]),
];
for (let i = 1; i <= 7; i++) if (i !== 5) roads.push(line(`NW ${i}${['st', 'nd', 'rd'][i - 1] || 'th'} Ave`, 'minor', [[-82.359, UNIV + i * 0.00105], [W13, UNIV + i * 0.00105]]));
for (let i = 14; i <= 28; i++) if (i !== 22) roads.push(line(`NW ${i}th St`, 'minor', [[W13 - (i - 13) * 0.00098, UNIV], [W13 - (i - 13) * 0.00098, 29.659]]));
for (let i = 1; i <= 6; i++) roads.push(line(`SW ${i}th Ave`, 'minor', [[W13 + 0.012, UNIV - i * 0.00105], [W13, UNIV - i * 0.00105]]));
for (let i = 25; i <= 33; i++) roads.push(line(`NW ${i}th St`, 'minor', [[W13 - (i - 13) * 0.00098 - 0.006, UNIV], [W13 - (i - 13) * 0.00098 - 0.006, 29.659]]));

const layers = {
  transportation: roads,
  transportation_name: roads,
  water: [poly({}, [[-82.364, 29.6425], [-82.3615, 29.6445], [-82.358, 29.6437], [-82.3575, 29.6418], [-82.361, 29.6408]])],
  water_name: [{ type: 'Feature', properties: { name: 'Lake Alice' }, geometry: { type: 'Point', coordinates: [-82.3608, 29.6428] } }],
  landcover: [poly({ class: 'grass' }, [[-82.371, 29.6475], [-82.3625, 29.6475], [-82.3625, 29.6518], [-82.371, 29.6518]]), box({ class: 'wood' }, -82.37, 29.636, 0.007, 0.005), box({ class: 'grass' }, -82.349, 29.6462, 0.003, 0.002)],
  landuse: [poly({ class: 'university' }, [[W13, UNIV], [-82.3625, UNIV], [-82.3625, 29.6475], [-82.371, 29.6475], [-82.371, 29.636], [W13, 29.6395]])],
  park: [],
  building: [box({}, -82.3445, 29.6476, 0.0009, 0.0007), box({}, -82.3575, 29.6457, 0.0006, 0.0005), box({}, -82.3462, 29.653, 0.001, 0.0008), box({}, -82.3495, 29.6492, 0.0022, 0.0017), box({}, -82.346, 29.6523, 0.0005, 0.0004)],
  place: [{ type: 'Feature', properties: { name: 'College Park', class: 'neighbourhood' }, geometry: { type: 'Point', coordinates: [-82.3465, 29.6558] } }, { type: 'Feature', properties: { name: 'Golfview', class: 'neighbourhood' }, geometry: { type: 'Point', coordinates: [-82.3605, 29.6488] } }, { type: 'Feature', properties: { name: 'Gainesville', class: 'city' }, geometry: { type: 'Point', coordinates: [-82.325, 29.6516] } }],
};

export function installMockTiles(maplibregl) {
  const index = {};
  for (const [name, features] of Object.entries(layers)) index[name] = new geojsonvt({ type: 'FeatureCollection', features }, { maxZoom: 14, buffer: 128, tolerance: 1 });
  maplibregl.addProtocol('mock', async (params) => {
    const [z, x, y] = params.url.replace('mock://', '').split('/').map(Number);
    const tile = {};
    for (const [name, idx] of Object.entries(index)) {
      const t = idx.getTile(z, x, y);
      if (t) tile[name] = t;
    }
    const buf = vtpbf.fromGeojsonVt(tile, { version: 2 });
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  });
}
