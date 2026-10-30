// Usage per feature for the product console: only the feature name ("lancar.voz"), never values or text.
// Buffered and sent in small batches (at most every 10 s, and when the app goes to the background).
import * as db from './db.js';
import { S } from './state.js';

export const APP_VERSION = 'v28';
let buf = [], timer = null;
const OK = /^[a-z_]{2,20}(\.[a-z_]{2,20})?$/;

export function track(feature) {
  if (!OK.test(feature) || !S.user || !S.hh) return;
  buf.push(feature); if (buf.length >= 40) return flush();
  if (!timer) timer = setTimeout(flush, 10000);
}
export function flush() {
  clearTimeout(timer); timer = null;
  if (!buf.length || !db.sb || !S.hh) return;
  const list = buf.splice(0, 50);
  db.sb.rpc('track', { p_household: S.hh.id, p_features: list }).then(() => {}, () => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
