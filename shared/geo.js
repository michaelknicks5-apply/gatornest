// Geometry helpers shared by the app and the hourly pipeline.
const R_MI = 3958.8;
const rad = (d) => (d * Math.PI) / 180;

export function haversineMi(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(s));
}

// Rough travel estimate from straight-line miles, used only when no routed time exists.
export function estimateTravel(straightMi) {
  const road = straightMi * 1.3;
  return {
    mi: straightMi,
    est: true,
    walk: { min: Math.max(1, Math.round((road / 3.1) * 60)), mi: road },
    bike: { min: Math.max(1, Math.round((road / 9.5) * 60 + 1)), mi: road },
    drive: { min: Math.max(1, Math.round((road / 17) * 60 + 2)), mi: road },
  };
}

// poly: [[lng,lat], ...]
export function pointInPolygon(lng, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function circleRing(lng, lat, miles, steps = 96) {
  const out = [];
  const dLat = miles / 69.0;
  const dLng = miles / (69.0 * Math.cos(rad(lat)));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return out;
}

export function lineLengthMi(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversineMi({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] });
  }
  return d;
}

export function lineMidpoint(coords) {
  const total = lineLengthMi(coords);
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const seg = haversineMi({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
    if (d + seg >= total / 2 && seg > 0) {
      const t = (total / 2 - d) / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    d += seg;
  }
  return coords[Math.floor(coords.length / 2)];
}
