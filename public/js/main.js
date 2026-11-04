// Boot, sign-in, family selection and tab routing.
import * as db from './db.js';
import { S, setFamily, reindex, monthKeys, latestClosed } from './state.js';
import { mLong, mShort, thisMonth } from './lib/format.js';
import { $, $$, toast, validate, clearInvalid, configureCatPicker } from './ui.js';
import { checkEmail, checkPassword, checkName } from './lib/validate.js';
import * as resumo from './views/resumo.js';
import * as lancar from './views/lancar.js';
import * as perguntar from './views/perguntar.js';
import * as extrato from './views/extrato.js';
import * as ajustes from './views/ajustes.js';
import * as graficos from './views/graficos.js';
import * as fechar from './views/fechar.js';
import { openTour } from './tour.js';
import { initMenu, closeMenu } from './menu.js';
import { startCoach, shouldCoach } from './coach.js';
import { checkAdmin, touchActivity } from './metrics.js';
import { initPrivacy } from './privacy.js';
import { track, navTo, screenOf } from './usage.js';
import { TEST_PHASE } from './feedback.js';
import { showMessages, openBell, refreshBell, openNewsById, openReplyById, prefetchMessages } from './messages.js';
import { photo } from './photos.js';
import { askInstall, shouldAskInstall, isIOS, isAndroid, isMobile, isStandalone, markNotInstalled, checkStillInstalled } from './install.js';
import { captureInviteFromUrl, pendingInvite, inviteInfo, startOnboarding, displayName } from './onboarding.js';
import { offerPush, refreshPushState } from './push.js';
import { parseLink } from './lib/links.js';
import { initLock, freshSignIn, signOutSafely, showBye, offerBio, setAfterUnlock } from './lock.js';

const VIEWS = { resumo, lancar, graficos, perguntar, extrato, ajustes, fechar };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

function show(id) { for (const s of ['boot', 'welcome', 'auth', 'reset', 'onboard', 'app']) $('#' + s).hidden = s !== id; window.scrollTo(0, 0); }
// Front door: the landing page explains the app; invite links skip straight to sign-up.
function showSignedOut() {
  if (pendingInvite()) { show('auth'); showInviteBanner(); return; }
  show('welcome');
  showBye();
  if (shouldAskInstall()) setTimeout(() => { if (!$('#welcome').hidden) askInstall(); }, 1200);
}
// After entering the app in the browser: one more invitation to install (iPhone keeps a separate login).
// Messages for testers (welcome, replies, what's new) come first; then the invitation to install.
// Nothing else to say this time: notifications off? Otherwise offer the fingerprint/face (once a week, up to 3 times); then the install invitation.
// Then, if notifications are off on this phone, say so (every few days); else the fingerprint/face.
// The app may open locked (left unused): then the invitation waits for the unlock, which counts as the same
// opening if a message was just shown (one pop-up per opening).
let popupAt = 0;
const afterIntro = () => { refreshPushState(); return showMessages().then(shown => { if (shown) { popupAt = Date.now(); return null; } return offerPush().then(p => p ? null : offerBio()); }).then(() => setTimeout(maybeAskInstall, 600)); };
// A tapped notification says where to go (lib/links.js): the note or the reply in full, Notificações, or a
// screen. It counts as the pop-up of this opening. Locked: it waits for the unlock.
let pendingLink = null;
async function openLink(l) {
  if (!l || !S.hh) return;
  if (document.body.classList.contains('locked')) { pendingLink = l; return; }
  pendingLink = null; popupAt = Date.now(); track('aviso.tocou');
  if (l.abrir === 'novidade') { S.go('resumo'); await openNewsById(l.id); return; }
  if (l.abrir === 'recado') { S.go('resumo'); await openReplyById(l.id); return; }
  if (l.abrir === 'avisos') { S.go('ajustes', '#pushBox', 'avisos'); return; }
  if (l.tab === 'lancar' && l.sec === 'pdf') { S.go('lancar'); lancar.openMode('pdf', true); return; }
  if (l.tab) S.go(l.tab, null, l.sec);
}
let inviting = false;
setAfterUnlock(() => {
  if (pendingLink) { openLink(pendingLink); return; }
  if (inviting || Date.now() - popupAt < 10 * 60e3) return;
  inviting = true;
  offerPush().then(p => p ? null : offerBio()).finally(() => { inviting = false; });
});
const maybeAskInstall = () => { if (shouldAskInstall()) askInstall({ note: isIOS() ? 'Depois de instalar, abra pelo ícone e entre com o mesmo e-mail e senha.' : '' }); };
$('#wHero').innerHTML = photo('lost', { w: 1100, ratio: '3 / 2', fallback: 'hero', cls: 'land-photo' });
// Always available on the phone: the automatic invitation only comes back after a few days.
$('#wInstall').hidden = !isMobile() || isStandalone(); $('#wInstall').onclick = () => { try { localStorage.removeItem('fin.install.never'); } catch (e) { /* storage blocked */ } askInstall(); };
$('#wSignup').onclick = () => { show('auth'); setMode('signup'); $('#aName').focus(); };
$('#wLogin').onclick = () => { show('auth'); setMode('login'); $('#aEmail').focus(); };
$('#aBack').onclick = () => show('welcome');

// ---------- auth ----------
let mode = 'login';
function setMode(m) {
  mode = m;
  $$('#authForm [data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  $('#nameRow').hidden = $('#consentRow').hidden = m !== 'signup';
  $('#aGo').textContent = m === 'signup' ? 'Criar conta' : 'Entrar';
  $('#aPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  $('#aMsg').textContent = '';
}
$$('#authForm [data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('#aEmail').value.trim(), password = $('#aPass').value, msg = $('#aMsg');
  msg.className = 'small'; msg.textContent = ''; clearInvalid($('#authForm'));
  if (!validate([
    ...(mode === 'signup' ? [[$('#aName'), checkName($('#aName').value, 'o seu nome', 2, 80)]] : []),
    [$('#aEmail'), checkEmail(email)],
    [$('#aPass'), mode === 'signup' ? checkPassword(password) : (password ? '' : 'Digite a sua senha.')],
  ])) return;
  $('#aGo').disabled = true;
  try {
    if (mode === 'signup') {
      if (!$('#aConsent').checked) throw { message: 'Para criar a conta, marque a concordância com o uso dos dados.' };
      const { data, error } = await db.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/' + (pendingInvite() ? '?convite=' + pendingInvite() : ''), data: { name: $('#aName').value.trim() } } });
      if (error) throw error;
      if (!data.session) { setMode('login'); $('#aPass').value = ''; msg.className = 'banner ok'; msg.textContent = `Conta criada! Enviamos um link de confirmação para ${email}. Abra o e-mail (veja também o spam), clique no link e depois entre aqui com a sua senha.`; return; }
    } else {
      const { error } = await db.sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg.className = 'err';
    msg.textContent = /rate limit|too many|security purposes/i.test(err.message || '') ? 'Muitos cadastros ou e-mails seguidos agora. Espere alguns minutos e tente de novo.' : /Invalid login/i.test(err.message || '') ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(err.message || '') ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : /already registered/i.test(err.message || '') ? 'Este e-mail já tem conta. Use Entrar.' : (err.message || 'Não foi possível entrar.');
  } finally { $('#aGo').disabled = false; }
};
$('#aForgot').onclick = async () => {
  const email = $('#aEmail').value.trim(); const msg = $('#aMsg'); clearInvalid($('#authForm'));
  if (!validate([[$('#aEmail'), checkEmail(email) && 'Para recuperar a senha, digite seu e-mail acima. ' + checkEmail(email)]])) return;
  const { error } = await db.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
  msg.className = error ? 'err' : 'banner ok'; msg.textContent = error ? 'Não foi possível enviar agora: ' + db.errorText(error) : `Se existir uma conta com ${email}, enviamos um link para criar uma nova senha. Veja também o spam.`;
};
$('#resetForm').onsubmit = async e => {
  e.preventDefault();
  clearInvalid($('#resetForm'));
  const p1 = $('#rPass').value, p2 = $('#rPass2').value;
  if (!validate([[$('#rPass'), checkPassword(p1)], [$('#rPass2'), p1 === p2 ? '' : 'As duas senhas não são iguais.']])) return;
  const { error } = await db.sb.auth.updateUser({ password: p1 });
  $('#rMsg').className = error ? 'err' : 'banner ok';
  $('#rMsg').textContent = error ? (/same|different/i.test(error.message || '') ? 'A nova senha precisa ser diferente da anterior.' : 'Não foi possível salvar: ' + db.errorText(error)) : 'Senha nova salva! Entrando no app...';
  if (!error) { history.replaceState(null, '', location.pathname); setTimeout(() => start(), 1200); }
};

// ---------- family ----------
async function pickFamily() {
  const list = await db.myHouseholds(S.user.id);
  if (!list.length) return false;
  const want = lsGet('fin.hh'); const row = list.find(r => r.household_id === want) || list[0];
  S.hh = row.households; S.role = row.role; lsSet('fin.hh', S.hh.id);
  // Already a member with a name (e.g. account from before the name step, or another phone): keep it, do not ask again.
  const known = row.display_name || list.find(r => r.display_name)?.display_name;
  if (!S.user.user_metadata?.display_name && known) {
    S.user.user_metadata = { ...S.user.user_metadata, display_name: known };
    db.sb.auth.updateUser({ data: { display_name: known } }).catch(() => {});
  }
  return true;
}
$('#oOut').onclick = () => signOutSafely(db.sb);

// ---------- app ----------
S.reload = async (all = false) => {
  if (all) setFamily(await db.loadFamily(S.hh.id));
  else { const [txs, imports] = await Promise.all([db.reloadTransactions(S.hh.id), db.sb.from('imports').select('*').eq('household_id', S.hh.id)]); S.txs = txs.map(t => ({ ...t, amount: +t.amount })); S.imports = imports.data || S.imports; }
};
S.go = (tab, sel, sec) => {
  if (sec) S.sec = sec;
  setTab(tab);
  if (sel) VIEWS[tab]?.reveal?.(sel);
  if (sel) setTimeout(() => { const e = $(sel); if (!e) return; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (e.matches('input,textarea,button')) e.focus({ preventScroll: true }); }, 60);
};
const onInstallable = e => {
  e.preventDefault && e.preventDefault(); S.installEvt = e;
  // Only fires when the app is NOT installed: if we thought it was (uninstalled since), ask again.
  if (markNotInstalled()) askAgainSoon();
  // The steps were on screen and Chrome is ready now: switch to the one-tap button.
  const sheet = $('.isheet'); if (sheet && !sheet.querySelector('[data-install]') && isAndroid()) { sheet.remove(); askInstall(); }
};
// The app was uninstalled since the last visit: invite to install again (once the screen is free).
const askAgainSoon = () => setTimeout(() => { if (!$('.tour') && !$('.coach') && !$('.cfm-wrap') && shouldAskInstall()) askInstall(); }, 1200);
window.addEventListener('beforeinstallprompt', onInstallable);
if (window.__bip) onInstallable(window.__bip);
checkStillInstalled().then(changed => { if (changed) askAgainSoon(); });

// Welcome tour: once per person (remembered in the account, so it does not repeat on another phone).
const tourDone = () => S.user?.user_metadata?.tour_done || lsGet('fin.tour.' + S.user?.id) === '1';
// Saved in the account too, so it holds on another phone and in the installed app (separate storage on iPhone).
const saveFlag = data => db.sb.auth.updateUser({ data }).then(r => { if (r?.data?.user) S.user = r.data.user; }).catch(() => {});
function markTour() { lsSet('fin.tour.' + S.user.id, '1'); saveFlag({ tour_done: true }); }
// Guided walkthrough over the real screen; then (once) the invitation to install.
S.startCoach = (force = false, after) => startCoach({
  user: S.user, force, go: t => { if (S.tab !== t) setTab(t); },
  onNever: () => saveFlag({ coach_done: true }),
  onEnd: () => { if (after) after(); else afterIntro(); },
});
S.showTour = () => openTour(S.txs.length
    ? { finalTitle: 'Tudo pronto', finalText: 'Os primeiros passos ficam no Resumo. Você pode rever esta apresentação no menu ☰, em Ajuda.', finalLabel: 'Ver meu resumo', onClose: () => { markTour(); S.startCoach(); } }
    : { finalTitle: 'Primeiro passo: a fatura do cartão', finalText: 'Baixe o PDF da última fatura no app do banco e envie aqui. Em poucos segundos você vê para onde foi o dinheiro.', finalLabel: 'Enviar minha fatura', onClose: done => { markTour(); S.startCoach(false, () => { if (done) showMessages().then(() => S.go('lancar', '#drop')); else afterIntro(); }); } });
S.render = () => {
  reindex(); renderMonthSel();
  const v = VIEWS[S.tab]; v.render($('#v-' + S.tab));
};
function setTab(t) {
  closeMenu(false);
  track('aba.' + (t === 'resumo' ? 'inicio' : t === 'ajustes' ? 'menu' : t));
  if (t === 'ajustes' && S.sec) track('menu.' + S.sec);
  S.tab = t; lsSet('fin.tab', t);
  navTo(screenOf()); // after S.tab changes: the screen being opened, not the one being left
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.view').forEach(v => v.hidden = v.dataset.view !== t);
  window.scrollTo(0, 0); S.render();
}
$$('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
initMenu();
$('#bellBtn').onclick = () => { track('sininho'); openBell(); };
$('#fbBtn').hidden = !TEST_PHASE; $('#fbBtn').onclick = () => S.go('ajustes', null, 'opiniao');
$('#privBtn').addEventListener('click', () => track('privacidade'));
initPrivacy($('#privBtn'), () => { $$('.view[data-built]').forEach(v => { delete v.dataset.built; }); S.render(); });
$('#monthSel').onchange = e => { S.m = e.target.value; if (S.tab === 'fechar' && !S.m.startsWith('ano:')) S.closeMonth = S.m; S.render(); };
const narrow = window.matchMedia('(max-width: 440px)');
narrow.addEventListener?.('change', () => { if (S.hh) renderMonthSel(); });
function renderMonthSel() {
  const ks = monthKeys(), years = [...new Set(ks.map(k => k.slice(0, 4)))].sort().reverse();
  if (!S.m || (!S.m.startsWith('ano:') && !ks.includes(S.m))) S.m = latestClosed() || ks[ks.length - 1] || thisMonth();
  const closed = S.hh?.settings?.closed || {};
  // Phones: short label ("out. 2026") so the year is not cut off.
  const label = narrow.matches ? k => mShort(k) + '. ' + k.slice(0, 4) : mLong;
  const opts = [...ks].reverse().map(k => `<option value="${k}"${k === S.m ? ' selected' : ''}>${label(k)}${closed[k] ? ' ✓' : ''}</option>`);
  if (!ks.includes(S.m) && !S.m.startsWith('ano:')) opts.unshift(`<option value="${S.m}" selected>${label(S.m)}</option>`);
  years.forEach(y => opts.push(`<option value="ano:${y}"${S.m === 'ano:' + y ? ' selected' : ''}>${narrow.matches ? '' : 'Ano de '}${y}${narrow.matches ? ' inteiro' : ''}</option>`));
  $('#monthSel').innerHTML = opts.join('');
}

// ?abrir=novidade|recado|avisos or ?tab=…&sec=… (a tapped notification): kept until the app opens.
{ const l = parseLink(location.href); if (l) { try { sessionStorage.setItem('fin.link', JSON.stringify(l)); } catch (e) { /* storage blocked */ } history.replaceState(null, '', location.pathname); } }
// ?acao=voz|nota|pdf|compartilhar (icon shortcuts, the evening reminder, Android share): kept until the app opens.
{ const a = new URLSearchParams(location.search).get('acao'); if (/^(voz|nota|pdf|compartilhar)$/.test(a || '')) { try { sessionStorage.setItem('fin.acao', a); } catch (e) { /* storage blocked */ } history.replaceState(null, '', location.pathname); } }
function runAcao(a) {
  track('atalho.' + a);
  S.go('lancar');
  if (a === 'compartilhar') return lancar.handleShared();
  lancar.openMode({ voz: 'falar', nota: 'nota', pdf: 'pdf' }[a], true);
  if (a === 'voz') setTimeout(() => { $('#qText')?.focus(); $('#qMic')?.click(); }, 250);
}

let starting = null;
function start() { return starting ||= doStart().finally(() => { starting = null; }); }
async function doStart() {
  show('boot');
  const { data } = await db.sb.auth.getSession();
  S.user = data?.session?.user || null;
  if (!S.user) { showSignedOut(); return; }
  // The session copy kept on the device can be old: fetch the account so choices like "Não mostrar mais" hold.
  try { const { data: fresh } = await db.sb.auth.getUser(); if (fresh?.user) S.user = fresh.user; } catch (e) { /* offline: keep the session copy */ }
  // Locks before the numbers show when the app was left alone for longer than the chosen minutes.
  if (S.justSignedIn) freshSignIn(S.user.id);
  initLock({ sb: db.sb, user: S.user.id, name: displayName(), email: S.user.email });
  const hasFamily = await pickFamily();
  // Onboarding: how to be called, a pending invite (from a WhatsApp link), or creating the family.
  if (!hasFamily || !displayName() || pendingInvite()) {
    show('onboard');
    startOnboarding(hasFamily ? 'existing' : 'full', () => { starting = null; start(); });
    return;
  }
  initLock({ sb: db.sb, user: S.user.id, name: displayName(), email: S.user.email }); // now with the name chosen
  prefetchMessages(); // what's new and personal replies load together with the family's data
  setFamily(await db.loadFamily(S.hh.id));
  $('#brand').textContent = S.hh.name;
  touchActivity(); checkAdmin();
  show('app');
  setTab('resumo');
  const link = (() => { try { const l = JSON.parse(sessionStorage.getItem('fin.link') || 'null'); sessionStorage.removeItem('fin.link'); return l; } catch (e) { return null; } })();
  // A tapped notification: straight there; it is this opening's pop-up.
  if (link && tourDone()) { setTimeout(() => openLink(link).finally(() => refreshBell()), 300); S.justSignedIn = false; return; }
  // Shortcut on the icon, the evening reminder or something shared with the app: go straight there.
  const acao = (() => { try { const a = sessionStorage.getItem('fin.acao'); sessionStorage.removeItem('fin.acao'); return a; } catch (e) { return null; } })();
  if (acao && tourDone()) { runAcao(acao); S.justSignedIn = false; refreshBell(); return; }
  if (!tourDone()) S.showTour();
  else if (shouldCoach(S.user)) setTimeout(() => S.startCoach(), 700);
  else { setTimeout(afterIntro, 250); }
  if (tourDone() && S.justSignedIn) toast(`Que bom ter você de volta, ${displayName().split(" ")[0]}!`);
  S.justSignedIn = false;
}

// Someone opened an invite link without being signed in: say who invited them and suggest creating an account.
async function showInviteBanner() {
  const code = pendingInvite(), el = $('#aInvite'); if (!code) { el.hidden = true; return; }
  const info = await inviteInfo(code);
  if (!info || info.status !== 'ok') { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = `${info.inviter || 'Alguém'} convidou você para participar da ${info.family}. Crie sua conta (ou entre, se já tiver uma) e você entra direto na família.`;
  setMode('signup');
  if (info.invitee && !$('#aName').value) $('#aName').value = info.invitee;
}

// Category picker: the family's most used categories come first, and a new one can be created right there.
configureCatPicker({
  usage: () => { const u = {}; for (const t of S.txs || []) if (t.category) u[t.category] = (u[t.category] || 0) + 1; return u; },
  create: async name => { const c = await db.addCategory(S.hh.id, { name, grp: 'dia', recurring: false }); S.categories.push(c); reindex(); return c.name; },
});

(async function boot() {
  // Registered first thing: Android only offers a real install (our icon and name) once the service worker is active.
  if ('serviceWorker' in navigator) {
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js').then(r => { document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); }); }).catch(() => {});
    // A new version took over (the app was open while it was published): the menu offers it, and coming back to
    // the app after a while with nothing in progress loads it by itself.
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW) S.updateReady = true; });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const busy = document.querySelector('.busyov, .cfm-wrap, .ann, #review:not([hidden]), #shReview:not([hidden]), #rcReview:not([hidden]), #pwBox:not([hidden])') || S.tab === 'lancar';
      if (S.updateReady && hiddenAt && Date.now() - hiddenAt > 60e3 && !busy) location.reload();
    });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'open' && S.hh) openLink(parseLink(e.data.url)); });
  }
  captureInviteFromUrl();
  // Read before the Supabase client consumes the link: a password-recovery link carries type=recovery.
  const recovering = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);
  try { await db.init(); }
  catch (e) { $('#boot').innerHTML = '<p class="err">O app ainda não foi configurado: faltam as variáveis do Supabase no servidor (veja o README).</p>'; return; }
  db.sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { show('reset'); return; }
    if (ev === 'SIGNED_IN' && !S.user) { S.justSignedIn = true; start(); }
    if (ev === 'SIGNED_OUT') { S.user = null; showSignedOut(); }
  });
  if (recovering) { show('reset'); return; }
  await start();
  let flash = null; try { flash = sessionStorage.getItem('fin.flash'); sessionStorage.removeItem('fin.flash'); } catch (e) { /* storage blocked */ }
  if (flash) {
    if (!$('#welcome').hidden) { show('auth'); setMode('login'); }
    const target = !$('#auth').hidden ? $('#aMsg') : !$('#onboard').hidden ? $('#oMsg') : null;
    if (target) { target.className = 'banner ok'; target.textContent = flash; } else toast(flash);
  }
})();
