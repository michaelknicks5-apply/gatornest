// MapLibre v6 ships its worker as a separate module; hand it the bundled URL so it works in dev and in the build.
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl(workerUrl);
export default maplibregl;
