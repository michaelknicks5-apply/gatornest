// Address lookup in the browser through Photon (OpenStreetMap data, no key needed).
// If it fails, the UI falls back to "tap the map to place it".
import cfg from '../config/settings.json';

export async function geocode(address) {
  const q = /gainesville/i.test(address) ? address : `${address}, Gainesville, FL`;
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${cfg.center.lat}&lon=${cfg.center.lng}&limit=1&lang=en`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const f = j.features && j.features[0];
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    if (Math.abs(lat - cfg.center.lat) > 0.6 || Math.abs(lng - cfg.center.lng) > 0.6) return null; // not near Gainesville
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
