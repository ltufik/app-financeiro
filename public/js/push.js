// Push notifications on this device: permission, subscription and the kinds of notice the person wants.
import * as db from './db.js';
import { S } from './state.js';
import { announce } from './ui.js';
import { track } from './usage.js';
import { shouldAskPush, pushAskText } from './lib/pushask.js';

export const PUSH_TYPES = [
  { key: 'dados', label: 'Falta de dados', hint: 'Quando faltar o extrato ou a fatura, ou o mês estiver acabando sem lançamentos.' },
  { key: 'gastos', label: 'Gastos', hint: 'Mês no vermelho, gasto acima da média, cartão acima da meta.' },
  { key: 'conquistas', label: 'Conquistas', hint: 'Quando vocês economizarem bem ou gastarem menos que o normal.' },
  { key: 'familia', label: 'Família', hint: 'Na hora em que alguém entra na família, importa uma fatura ou fecha o mês.' },
  { key: 'semanal', label: 'Resumo da semana', hint: 'Aos domingos, quanto saiu nos últimos 7 dias.' },
  { key: 'novidades', label: 'Novidades do app', hint: 'Quando o app ganhar algo novo; se foi pedido seu, o aviso vem com o seu nome.' },
  { key: 'lembrete', label: 'Lembrete do fim do dia', hint: 'Às 21h, só se você não lançou nada no dia: um toque abre o microfone.' },
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
  return { dados: true, gastos: true, conquistas: true, familia: true, semanal: true, ...(row?.prefs || {}) };
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

// Tells the other members (push), without waiting: someone joined, imported a statement or closed a month.
export async function notifyFamily(type, extra = {}) {
  try {
    const { data } = await db.sb.auth.getSession();
    await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (data?.session?.access_token || '') }, body: JSON.stringify({ household: S.hh.id, type, ...extra }) });
  } catch (e) { /* best effort */ }
}

// What the menu and the steps on Início show: the real state of this device, checked at each opening.
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };
export async function refreshPushState() {
  S.pushStatus = await pushStatus().catch(() => 'unsupported');
  if (S.pushStatus === 'on') ls('fin.push.on', '1'); else if (S.pushStatus === 'off' || S.pushStatus === 'denied') ls('fin.push.on', '0');
  return S.pushStatus;
}

// Notifications off: say so and take the person to the page that turns them on (the phone only asks
// after a tap there). Once a day, up to 7 times per device. Returns true when the pop-up was shown.
const ASK = () => 'fin.pushask.' + (S.user?.id || '');
export async function offerPush() {
  if (window.__noMsgs || document.body.classList.contains('locked') || !S.user) return false;
  const status = await refreshPushState();
  let asks = {}; try { asks = JSON.parse(ls(ASK()) || '{}'); } catch (e) { asks = {}; }
  if (!shouldAskPush({ status, asks, now: Date.now() })) return false;
  ls(ASK(), JSON.stringify({ n: (+asks.n || 0) + 1, at: Date.now() }));
  const t = pushAskText(status, S.user.user_metadata?.display_name || '');
  const r = await announce({ eyebrow: t.eyebrow, title: t.title, html: `<ul>${t.items.map(i => `<li>${i}</li>`).join('')}</ul>`, primary: t.primary, secondary: t.secondary });
  track(r === 'primary' ? 'avisos.convite_sim' : 'avisos.convite_nao');
  if (r === 'primary') { S.pushFocus = true; S.go('ajustes', '#pushBox', 'avisos'); }
  return true;
}
