// What the product console sees: features used, screens visited (and for how long), where people tap,
// and errors. Only names of screens and buttons, never values or anything typed.
// Buffered and sent in small batches (at most every 10 s, and when the app goes to the background).
import * as db from './db.js';
import { S } from './state.js';
import { tapCell, tapLabel, cleanError } from './lib/navlog.js';

export const APP_VERSION = 'v37';
const OK = /^[a-z_]{2,20}(\.[a-z_]{2,20})?$/;
export const device = () => { const u = navigator.userAgent; return (/iphone|ipad/i.test(u) ? 'iPhone' : /android/i.test(u) ? 'Android' : /mac/i.test(u) ? 'Mac' : /windows/i.test(u) ? 'Windows' : 'Outro') + (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone ? ' · app instalado' : ' · navegador'); };
export const screenOf = () => S.tab === 'ajustes' ? 'menu.' + (S.sec || 'familia') : S.tab === 'resumo' ? 'inicio' : (S.tab || '');

let buf = [], timer = null;
let N = { screens: {}, flows: {}, taps: {}, targets: {} }, cur = null, since = 0;
const schedule = () => { if (!timer) timer = setTimeout(flush, 10000); };

export function track(feature) {
  if (!OK.test(feature) || !S.user || !S.hh) return;
  buf.push(feature); if (buf.length >= 40) return flush();
  schedule();
}

// Screen changes: one view, the time on the previous screen and the path from one to the other.
const stop = now => { if (cur && since) { const s = (N.screens[cur] ||= { v: 0, t: 0 }); s.t += Math.min(1800, Math.round((now - since) / 1000)); } since = 0; };
export function navTo(screen) {
  if (!OK.test(screen) || !S.user || screen === cur) return;
  const now = Date.now(); stop(now);
  if (cur) N.flows[cur + '>' + screen] = (N.flows[cur + '>' + screen] || 0) + 1;
  cur = screen; since = now; (N.screens[screen] ||= { v: 0, t: 0 }).v++;
  schedule();
}

// Taps: a cell on a 20-column grid and the name of the button, if it was one.
document.addEventListener('click', e => {
  if (!S.user || !cur || !e.isTrusted) return;
  const c = tapCell(e.clientX, e.clientY + window.scrollY, window.innerWidth); if (!c) return;
  const k = `${cur}|${c.x}|${c.y}`; N.taps[k] = (N.taps[k] || 0) + 1;
  const t = tapLabel(e.target); if (t) { const kt = cur + '|' + t; N.targets[kt] = (N.targets[kt] || 0) + 1; }
  schedule();
}, true);

export function flush() {
  clearTimeout(timer); timer = null;
  if (!db.sb || !S.user) return;
  if (buf.length && S.hh) db.sb.rpc('track', { p_household: S.hh.id, p_features: buf.splice(0, 50) }).then(() => {}, () => {});
  if (cur && since) { stop(Date.now()); since = Date.now(); }
  const data = {
    screens: Object.entries(N.screens).filter(([, x]) => x.v || x.t).map(([s, x]) => ({ s, v: x.v, t: x.t })),
    flows: Object.entries(N.flows).map(([k, n]) => { const [f, t] = k.split('>'); return { f, t, n }; }),
    taps: Object.entries(N.taps).map(([k, n]) => { const [s, x, y] = k.split('|'); return { s, x: +x, y: +y, n }; }),
    targets: Object.entries(N.targets).map(([k, n]) => { const i = k.indexOf('|'); return { s: k.slice(0, i), t: k.slice(i + 1), n }; }),
  };
  N = { screens: {}, flows: {}, taps: {}, targets: {} };
  if (data.screens.length || data.flows.length || data.taps.length || data.targets.length) db.sb.rpc('track_nav', { p_household: S.hh?.id || null, p_data: data }).then(() => {}, () => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { stop(Date.now()); flush(); }
  else if (cur) since = Date.now();
});

// Errors: those shown to the person (error pop-up) and those that happen behind the scenes.
const recent = new Map();
export function reportError(kind, message, source = '') {
  const msg = cleanError(message); if (!msg || !db.sb || !S.user) return;
  const key = kind + msg, now = Date.now(); if (now - (recent.get(key) || 0) < 60000) return; recent.set(key, now);
  db.sb.rpc('log_error', { p_household: S.hh?.id || null, p_kind: kind, p_message: msg, p_screen: cur || screenOf() || null, p_source: String(source).slice(0, 200) || null, p_device: device(), p_version: APP_VERSION }).then(() => {}, () => {});
}
window.addEventListener('error', e => { if (e.message) reportError('js', e.message, `${String(e.filename || '').split('/').pop()}:${e.lineno || ''}`); });
window.addEventListener('unhandledrejection', e => reportError('promessa', e.reason?.message || String(e.reason || '')));
window.__onToastErr = t => reportError('tela', t);
