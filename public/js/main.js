// Boot, sign-in, family selection and tab routing.
import * as db from './db.js';
import { S, setFamily, reindex, monthKeys, latestClosed } from './state.js';
import { mLong, thisMonth } from './lib/format.js';
import { $, $$, toast } from './ui.js';
import * as resumo from './views/resumo.js';
import * as lancar from './views/lancar.js';
import * as perguntar from './views/perguntar.js';
import * as extrato from './views/extrato.js';
import * as ajustes from './views/ajustes.js';
import { openTour } from './tour.js';

const VIEWS = { resumo, lancar, perguntar, extrato, ajustes };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

function show(id) { for (const s of ['boot', 'auth', 'reset', 'onboard', 'app']) $('#' + s).hidden = s !== id; }

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
  msg.className = 'small'; msg.textContent = '';
  if (!email || password.length < 8) { msg.className = 'err'; msg.textContent = 'Informe o e-mail e uma senha com pelo menos 8 caracteres.'; return; }
  $('#aGo').disabled = true;
  try {
    if (mode === 'signup') {
      if (!$('#aConsent').checked) throw { message: 'Para criar a conta, marque a concordância com o uso dos dados.' };
      const { data, error } = await db.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin, data: { name: $('#aName').value.trim() } } });
      if (error) throw error;
      if (!data.session) { setMode('login'); $('#aPass').value = ''; msg.className = 'banner ok'; msg.textContent = `Conta criada! Enviamos um link de confirmação para ${email}. Abra o e-mail (veja também o spam), clique no link e depois entre aqui com a sua senha.`; return; }
    } else {
      const { error } = await db.sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg.className = 'err';
    msg.textContent = /Invalid login/i.test(err.message || '') ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(err.message || '') ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : /already registered/i.test(err.message || '') ? 'Este e-mail já tem conta. Use Entrar.' : (err.message || 'Não foi possível entrar.');
  } finally { $('#aGo').disabled = false; }
};
$('#aForgot').onclick = async () => {
  const email = $('#aEmail').value.trim(); const msg = $('#aMsg');
  if (!email) { msg.className = 'err'; msg.textContent = 'Digite seu e-mail acima.'; return; }
  const { error } = await db.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  msg.className = error ? 'err' : 'small'; msg.textContent = error ? 'Não foi possível enviar agora.' : 'Enviamos um link para criar uma nova senha.';
};
$('#resetForm').onsubmit = async e => {
  e.preventDefault();
  const { error } = await db.sb.auth.updateUser({ password: $('#rPass').value });
  $('#rMsg').className = error ? 'err' : 'small'; $('#rMsg').textContent = error ? 'Não foi possível salvar. Use pelo menos 8 caracteres.' : 'Senha salva.';
  if (!error) setTimeout(() => start(), 800);
};

// ---------- family ----------
const displayName = () => S.user?.user_metadata?.name || (S.user?.email || '').split('@')[0];
async function pickFamily() {
  const list = await db.myHouseholds(S.user.id);
  if (!list.length) { show('onboard'); return false; }
  const want = lsGet('fin.hh'); const row = list.find(r => r.household_id === want) || list[0];
  S.hh = row.households; S.role = row.role; lsSet('fin.hh', S.hh.id);
  return true;
}
$('#oCreate').onclick = async () => {
  const n = $('#oName').value.trim(); if (!n) { $('#oMsg').textContent = 'Dê um nome para a família.'; return; }
  try { await db.createHousehold(n, displayName()); await start(); } catch (e) { $('#oMsg').textContent = 'Não foi possível criar.'; }
};
$('#oJoin').onclick = async () => {
  const c = $('#oCode').value.trim(); if (!c) return;
  try { const h = await db.acceptInvite(c, displayName()); lsSet('fin.hh', h); await start(); }
  catch (e) { $('#oMsg').textContent = /used/.test(e.message) ? 'Este convite já foi usado.' : /expired/.test(e.message) ? 'Este convite venceu. Peça um novo.' : 'Convite não encontrado.'; }
};
$('#oOut').onclick = async () => { await db.sb.auth.signOut(); location.reload(); };

// ---------- app ----------
S.reload = async (all = false) => {
  if (all) setFamily(await db.loadFamily(S.hh.id));
  else { const [txs, imports] = await Promise.all([db.reloadTransactions(S.hh.id), db.sb.from('imports').select('*').eq('household_id', S.hh.id)]); S.txs = txs.map(t => ({ ...t, amount: +t.amount })); S.imports = imports.data || S.imports; }
};
S.go = (tab, sel) => {
  setTab(tab);
  if (sel) setTimeout(() => { const e = $(sel); if (!e) return; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (e.matches('input,textarea,button')) e.focus({ preventScroll: true }); }, 60);
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });

// Welcome tour: once per person (remembered in the account, so it does not repeat on another phone).
const tourDone = () => S.user?.user_metadata?.tour_done || lsGet('fin.tour.' + S.user?.id) === '1';
function markTour() { lsSet('fin.tour.' + S.user.id, '1'); db.sb.auth.updateUser({ data: { tour_done: true } }).catch(() => {}); }
S.showTour = (where) => openTour(where === 'onboard'
  ? { finalTitle: 'Primeiro passo: criar a família', finalText: 'Dê um nome, como "Família Silva". Depois você convida quem divide as contas com você.', finalLabel: 'Criar minha família', onClose: () => { markTour(); $('#oName').focus(); } }
  : S.txs.length
    ? { finalTitle: 'Tudo pronto', finalText: 'Os primeiros passos ficam no Resumo. Você pode rever esta apresentação em Ajustes.', finalLabel: 'Ver meu resumo', onClose: () => markTour() }
    : { finalTitle: 'Primeiro passo: a fatura do cartão', finalText: 'Baixe o PDF da última fatura no app do banco e envie aqui. Em poucos segundos você vê para onde foi o dinheiro.', finalLabel: 'Enviar minha fatura', onClose: done => { markTour(); if (done) S.go('lancar', '#drop'); } });
S.render = () => {
  reindex(); renderMonthSel();
  const v = VIEWS[S.tab]; v.render($('#v-' + S.tab));
};
function setTab(t) {
  S.tab = t; lsSet('fin.tab', t);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $$('.view').forEach(v => v.hidden = v.dataset.view !== t);
  window.scrollTo(0, 0); S.render();
}
$$('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$('#monthSel').onchange = e => { S.m = e.target.value; S.render(); };
function renderMonthSel() {
  const ks = monthKeys(), years = [...new Set(ks.map(k => k.slice(0, 4)))].sort().reverse();
  if (!S.m || (!S.m.startsWith('ano:') && !ks.includes(S.m))) S.m = latestClosed() || ks[ks.length - 1] || thisMonth();
  const opts = [...ks].reverse().map(k => `<option value="${k}"${k === S.m ? ' selected' : ''}>${mLong(k)}</option>`);
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
  if (!S.user) { show('auth'); return; }
  if (!(await pickFamily())) { if (!tourDone()) S.showTour('onboard'); return; }
  setFamily(await db.loadFamily(S.hh.id));
  $('#brand').textContent = S.hh.name;
  show('app');
  const t = lsGet('fin.tab'); setTab(VIEWS[t] ? t : 'resumo');
  if (!tourDone()) S.showTour('app');
}

(async function boot() {
  try { await db.init(); }
  catch (e) { $('#boot').innerHTML = '<p class="err">O app ainda não foi configurado: faltam as variáveis do Supabase no servidor (veja o README).</p>'; return; }
  db.sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { show('reset'); return; }
    if (ev === 'SIGNED_IN' && !S.user) start();
    if (ev === 'SIGNED_OUT') { S.user = null; show('auth'); }
  });
  if (/type=recovery/.test(location.hash)) { show('reset'); return; }
  await start();
  let flash = null; try { flash = sessionStorage.getItem('fin.flash'); sessionStorage.removeItem('fin.flash'); } catch (e) { /* storage blocked */ }
  if (flash) {
    const target = !$('#auth').hidden ? $('#aMsg') : !$('#onboard').hidden ? $('#oMsg') : null;
    if (target) { target.className = 'banner ok'; target.textContent = flash; } else toast(flash);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
