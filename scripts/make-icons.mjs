// Renders the app icons from the SVG mark. Run: npm run icons
import sharp from 'sharp';
import fs from 'node:fs';
const mark = (pad, rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="#7B4DFF"/><g transform="translate(32 32) scale(${pad}) translate(-32 -32)"><path d="M14 33 32 17l18 16" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 37c2.5 7.5 7 11 12 11s9.5-3.5 12-11" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/><circle cx="32" cy="35" r="4.2" fill="#C9F26B"/></g></svg>`;
const out = (name, size, pad, rx) => sharp(Buffer.from(mark(pad, rx)), { density: 600 }).resize(size, size).png().toFile(`public/icons/${name}`);
fs.mkdirSync('public/icons', { recursive: true });
await out('icon-192.png', 192, 1, 14);
await out('icon-512.png', 512, 1, 14);
await out('icon-maskable-512.png', 512, 0.72, 0); // full-bleed with a safe zone
await out('apple-touch-icon.png', 180, 0.82, 0); // iOS rounds the corners itself
console.log('icons written');
