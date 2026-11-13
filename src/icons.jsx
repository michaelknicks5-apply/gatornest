// Small hand-drawn icon set. All original shapes; no third-party brand assets.
const P = {
  filter: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
  map: '<path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4zM9 4v13M15 7v13"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4"/>',
  share: '<path d="M12 15V4M8 7.5 12 4l4 3.5M6 12v7h12v-7"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 6 7.5-6"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8" fill="currentColor"/><path d="m9 21 2.5-6.5L9.5 12l1.5-4.5 3 .5 1.5 3 3 1M11.5 14.5 14 17l.5 4M10.5 8 8 9.5 7 13"/>',
  bike: '<circle cx="6" cy="16.5" r="3.5"/><circle cx="18" cy="16.5" r="3.5"/><path d="M6 16.5 10 9h6l2 7.5M10 9 9 6.5H7M12 16.5 16 9"/>',
  car: '<path d="M4 16v-3.5l2-5.5h12l2 5.5V16M4 16h16M4 16v2.5h3V16M17 16v2.5h3V16"/><circle cx="7.5" cy="13" r=".9" fill="currentColor"/><circle cx="16.5" cy="13" r=".9" fill="currentColor"/>',
  locate: '<path d="M12 3.5 19 20l-7-3.5L5 20z"/>',
  overview: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16zM13.5 6.5l4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lasso: '<path d="M12 4c-4.7 0-8.5 2.7-8.5 6s3.8 6 8.5 6 8.5-2.7 8.5-6-3.8-6-8.5-6zM7 15.5c-1 1.5-.5 3.5 1.5 3.5 2.5 0 1.5-3-0.5-2.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  warn: '<path d="M12 4 21 19.5H3zM12 10v4.5M12 17.2v.3"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m5 17.5 5-4.5 3.5 3 2.5-2 3.5 3.5"/>',
  compare: '<rect x="3.5" y="4" width="7" height="16" rx="2"/><rect x="13.5" y="4" width="7" height="16" rx="2"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  route: '<circle cx="6" cy="18" r="2.3"/><circle cx="18" cy="6" r="2.3"/><path d="M8.3 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h5.7"/>',
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  download: '<path d="M12 4v11M8 11.5l4 3.5 4-3.5M5 19.5h14"/>',
};

export function Icon({ name, size = 20, fill = false, class: cls = '' }) {
  return (
    <svg class={'ico ' + cls} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name] || '' }} />
  );
}

// Landmark badge glyphs (white on a colored badge). Returned as SVG strings so map markers can use them too.
const L = {
  dx: '<text x="14" y="19.5" text-anchor="middle" font-family="Nunito, system-ui, sans-serif" font-weight="900" font-size="14.5" fill="#fff" stroke="none">ΔΧ</text>',
  house: '<path d="M6 13.5 14 7l8 6.5V21a1 1 0 0 1-1 1h-4.5v-5h-5v5H7a1 1 0 0 1-1-1z" fill="#fff" stroke="none"/>',
  wave: '<path d="M4 12c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0 3.5-2.5 5-1.5M4 18c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0 3.5-2.5 5-1.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
  golf: '<path d="M9.5 5v18" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M9.5 5.5h11v8h-11z" fill="#fff" stroke="none"/><path d="M9.5 5.5h3.7v2.7H9.5zM16.8 5.5h3.7v2.7h-3.7zM13.2 8.2h3.6v2.6h-3.6zM9.5 10.8h3.7v2.7H9.5zM16.8 10.8h3.7v2.7h-3.7z" fill="#1c1b29" stroke="none"/><ellipse cx="11" cy="23" rx="5" ry="1.3" fill="#fff" opacity=".7" stroke="none"/>',
  book: '<path d="M5 8c3-1.5 6-1.5 9 .5v13c-3-2-6-2-9-.5zM23 8c-3-1.5-6-1.5-9 .5v13c3-2 6-2 9-.5z" fill="#fff" stroke="none"/>',
  pint: '<path d="M8.5 6h11l-1.3 16.5H9.8z" fill="#fff" stroke="none"/><path d="M9 10.5h10" stroke="#F5B301" stroke-width="2.2"/><path d="M9.3 13h9.4l-.7 8H10z" fill="#F5B301" stroke="none"/>',
  pin: '<circle cx="14" cy="14" r="5" fill="#fff" stroke="none"/>',
};
export const LANDMARK_COLORS = { dx: '#C8102E', house: '#7B4DFF', wave: '#0EA5C6', golf: '#16A866', book: '#2563EB', pint: '#B45309', pin: '#52525B' };
export const landmarkSvg = (icon) => `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${L[icon] || L.pin}</svg>`;

export function LandmarkBadge({ icon, size = 34 }) {
  return <span class="lmbadge" style={{ background: LANDMARK_COLORS[icon] || LANDMARK_COLORS.pin, width: size + 'px', height: size + 'px' }} dangerouslySetInnerHTML={{ __html: landmarkSvg(icon) }} />;
}
