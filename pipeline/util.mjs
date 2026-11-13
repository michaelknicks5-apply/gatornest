import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.GN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(ROOT, 'public/data');
export const p = (...parts) => path.join(ROOT, ...parts);

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function writeJson(file, value, pretty = true) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(value, null, pretty ? 1 : 0) + '\n';
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === text) return false;
  fs.writeFileSync(file, text);
  return true;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// fetch with a timeout and a clear error. Never logs headers (they may carry keys).
export async function http(url, { method = 'GET', headers = {}, body, timeout = 25000, as = 'json' } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method, headers, body, signal: ctl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`${res.status} ${res.statusText} from ${new URL(url).host}${text ? ': ' + text.slice(0, 160) : ''}`);
      err.status = res.status;
      throw err;
    }
    return { data: as === 'json' ? await res.json() : await res.text(), headers: res.headers };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`timed out after ${timeout / 1000}s: ${new URL(url).host}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
