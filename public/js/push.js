// Push notifications on this device: permission, subscription and the kinds of notice the person wants.
import * as db from './db.js';
import { S } from './state.js';

export const PUSH_TYPES = [
  { key: 'dados', label: 'Falta de dados', hint: 'Quando faltar o extrato ou a fatura, ou o mês estiver acabando sem lançamentos.' },
  { key: 'gastos', label: 'Gastos', hint: 'Mês no vermelho, gasto acima da média, cartão acima da meta.' },
  { key: 'conquistas', label: 'Conquistas', hint: 'Quando vocês economizarem bem ou gastarem menos que o normal.' },
  { key: 'semanal', label: 'Resumo da semana', hint: 'Aos domingos, quanto saiu nos últimos 7 dias.' },
];
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const configured = () => !!db.config.vapidPublicKey;

const keyBytes = b64 => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
// The service worker must be active; don't wait forever if it failed to register.
const reg = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('no_sw')), 6000))]);

// 'unsupported' | 'need-install' (iPhone in Safari) | 'not-configured' | 'denied' | 'off' | 'on'
export async function pushStatus() {
  if (isIOS() && !isStandalone()) return 'need-install';
  if (!pushSupported()) return 'unsupported';
  if (!configured()) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  let r; try { r = await reg(); } catch (e) { return 'no-sw'; }
  const sub = await r.pushManager.getSubscription();
  if (!sub) return 'off';
  const row = await db.myPush(sub.endpoint).catch(() => null);
  return row ? 'on' : 'off';
}
export async function currentPrefs() {
  const sub = pushSupported() && await (await reg()).pushManager.getSubscription();
  const row = sub ? await db.myPush(sub.endpoint).catch(() => null) : null;
  return { dados: true, gastos: true, conquistas: true, semanal: true, ...(row?.prefs || {}) };
}

// Must run from a tap (iPhone and Chrome only ask permission after a user gesture).
export async function enablePush(prefs) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'dismissed';
  const r = await reg();
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(db.config.vapidPublicKey) });
  await db.savePush(S.hh.id, sub.toJSON(), prefs);
  return 'on';
}
export async function savePrefs(prefs) {
  const sub = await (await reg()).pushManager.getSubscription(); if (!sub) return;
  await db.savePush(S.hh.id, sub.toJSON(), prefs);
}
export async function disablePush() {
  const sub = await (await reg()).pushManager.getSubscription(); if (!sub) return;
  await db.deletePush(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
export async function sendTest() {
  const sub = await (await reg()).pushManager.getSubscription(); if (!sub) throw new Error('off');
  const { data } = await db.sb.auth.getSession();
  const r = await fetch('/api/push-test', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data?.session?.access_token || '') }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (!r.ok) throw new Error('send');
}
