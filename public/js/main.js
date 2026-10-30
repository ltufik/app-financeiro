// Boot, sign-in, family selection and tab routing.
import * as db from './db.js';
import { S, setFamily, reindex, monthKeys, latestClosed } from './state.js';
import { mLong, thisMonth } from './lib/format.js';
import { $, $$, toast, validate, clearInvalid } from './ui.js';
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
import { photo } from './photos.js';
import { askInstall, shouldAskInstall, isIOS, markNotInstalled, checkStillInstalled } from './install.js';
import { captureInviteFromUrl, pendingInvite, inviteInfo, startOnboarding, displayName } from './onboarding.js';

const VIEWS = { resumo, lancar, graficos, perguntar, extrato, ajustes, fechar };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

function show(id) { for (const s of ['boot', 'welcome', 'auth', 'reset', 'onboard', 'app']) $('#' + s).hidden = s !== id; window.scrollTo(0, 0); }
// Front door: the landing page explains the app; invite links skip straight to sign-up.
function showSignedOut() {
  if (pendingInvite()) { show('auth'); showInviteBanner(); return; }
  show('welcome');
  if (shouldAskInstall()) setTimeout(() => { if (!$('#welcome').hidden) askInstall(); }, 1200);
}
// After entering the app in the browser: one more invitation to install (iPhone keeps a separate login).
const maybeAskInstall = () => { if (shouldAskInstall()) askInstall({ note: isIOS() ? 'Depois de instalar, abra pelo ícone e entre com o mesmo e-mail e senha.' : '' }); };
$('#wHero').innerHTML = photo('lost', { w: 1100, ratio: '3 / 2', fallback: 'hero', cls: 'land-photo' });
$('#wSignup').onclick = () => { show('auth'); setMode('signup'); $('#aName').focus(); };
$('#wLogin').onclick = $('#wLogin2').onclick = () => { show('auth'); setMode('login'); $('#aEmail').focus(); };
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
  return true;
}
$('#oOut').onclick = async () => { await db.sb.auth.signOut(); location.reload(); };

// ---------- app ----------
S.reload = async (all = false) => {
  if (all) setFamily(await db.loadFamily(S.hh.id));
  else { const [txs, imports] = await Promise.all([db.reloadTransactions(S.hh.id), db.sb.from('imports').select('*').eq('household_id', S.hh.id)]); S.txs = txs.map(t => ({ ...t, amount: +t.amount })); S.imports = imports.data || S.imports; }
};
S.go = (tab, sel, sec) => {
  if (sec) S.sec = sec;
  setTab(tab);
  if (sel) setTimeout(() => { const e = $(sel); if (!e) return; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (e.matches('input,textarea,button')) e.focus({ preventScroll: true }); }, 60);
};
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); S.installEvt = e;
  // Only fires when the app is NOT installed: if we thought it was (uninstalled since), ask again.
  if (markNotInstalled()) setTimeout(() => { if (!$('.tour') && !$('.coach') && shouldAskInstall()) askInstall(); }, 1200);
});
checkStillInstalled();

// Welcome tour: once per person (remembered in the account, so it does not repeat on another phone).
const tourDone = () => S.user?.user_metadata?.tour_done || lsGet('fin.tour.' + S.user?.id) === '1';
// Saved in the account too, so it holds on another phone and in the installed app (separate storage on iPhone).
const saveFlag = data => db.sb.auth.updateUser({ data }).then(r => { if (r?.data?.user) S.user = r.data.user; }).catch(() => {});
function markTour() { lsSet('fin.tour.' + S.user.id, '1'); saveFlag({ tour_done: true }); }
// Guided walkthrough over the real screen; then (once) the invitation to install.
S.startCoach = (force = false, after) => startCoach({
  user: S.user, force, go: t => { if (S.tab !== t) setTab(t); },
  onNever: () => saveFlag({ coach_done: true }),
  onEnd: () => { if (after) after(); else setTimeout(maybeAskInstall, 600); },
});
S.showTour = () => openTour(S.txs.length
    ? { finalTitle: 'Tudo pronto', finalText: 'Os primeiros passos ficam no Resumo. Você pode rever esta apresentação no menu ☰, em Ajuda.', finalLabel: 'Ver meu resumo', onClose: () => { markTour(); S.startCoach(); } }
    : { finalTitle: 'Primeiro passo: a fatura do cartão', finalText: 'Baixe o PDF da última fatura no app do banco e envie aqui. Em poucos segundos você vê para onde foi o dinheiro.', finalLabel: 'Enviar minha fatura', onClose: done => { markTour(); S.startCoach(false, () => { if (done) S.go('lancar', '#drop'); else setTimeout(maybeAskInstall, 600); }); } });
S.render = () => {
  reindex(); renderMonthSel();
  const v = VIEWS[S.tab]; v.render($('#v-' + S.tab));
};
function setTab(t) {
  closeMenu(false);
  S.tab = t; lsSet('fin.tab', t);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.view').forEach(v => v.hidden = v.dataset.view !== t);
  window.scrollTo(0, 0); S.render();
}
$$('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
initMenu();
$('#monthSel').onchange = e => { S.m = e.target.value; if (S.tab === 'fechar' && !S.m.startsWith('ano:')) S.closeMonth = S.m; S.render(); };
function renderMonthSel() {
  const ks = monthKeys(), years = [...new Set(ks.map(k => k.slice(0, 4)))].sort().reverse();
  if (!S.m || (!S.m.startsWith('ano:') && !ks.includes(S.m))) S.m = latestClosed() || ks[ks.length - 1] || thisMonth();
  const closed = S.hh?.settings?.closed || {};
  const opts = [...ks].reverse().map(k => `<option value="${k}"${k === S.m ? ' selected' : ''}>${mLong(k)}${closed[k] ? ' ✓' : ''}</option>`);
  if (!ks.includes(S.m) && !S.m.startsWith('ano:')) opts.unshift(`<option value="${S.m}" selected>${mLong(S.m)}</option>`);
  years.forEach(y => opts.push(`<option value="ano:${y}"${S.m === 'ano:' + y ? ' selected' : ''}>Ano de ${y}</option>`));
  $('#monthSel').innerHTML = opts.join('');
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
  const hasFamily = await pickFamily();
  // Onboarding: how to be called, a pending invite (from a WhatsApp link), or creating the family.
  if (!hasFamily || !displayName() || pendingInvite()) {
    show('onboard');
    startOnboarding(hasFamily ? 'existing' : 'full', () => { starting = null; start(); });
    return;
  }
  setFamily(await db.loadFamily(S.hh.id));
  $('#brand').textContent = S.hh.name;
  show('app');
  // A notification opens the app on a given tab (?tab=...).
  const want = new URLSearchParams(location.search).get('tab'), t = lsGet('fin.tab');
  if (VIEWS[want]) history.replaceState(null, '', location.pathname);
  setTab(VIEWS[want] ? want : VIEWS[t] ? t : 'resumo');
  if (!tourDone()) S.showTour();
  else if (shouldCoach(S.user)) setTimeout(() => S.startCoach(), 700);
  else { setTimeout(maybeAskInstall, 1500); }
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

(async function boot() {
  // Registered first thing: Android only offers a real install (our icon and name) once the service worker is active.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'open' && S.hh) { const t = new URL(e.data.url).searchParams.get('tab'); if (VIEWS[t]) S.go(t); } });
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
