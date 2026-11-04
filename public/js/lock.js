// Automatic lock, like the bank apps: 30 s before the chosen time a warning counts down ("vamos desconectar"),
// then the "entrar" screen covers the app. The fingerprint/face (passkey on this device, WebAuthn) is asked only
// when the person taps Entrar and only if they turned it on; otherwise the password. Also the "Segurança" block
// in menu ☰ → Conta and the goodbye message after signing out. Used by the app and by the product console
// (which passes minutes: 60, since it has no family numbers).
// The fingerprint or face never leaves the phone: the app keeps only the id of the device key, on this device.
import { LOCK_OPTIONS, lockMinutes, isExpired, idleState, lockText, byeMessage, minutesLabel, toB64u, fromB64u, shouldOfferBio } from './lib/lock.js';
import { esc } from './lib/format.js';
import { $, toast, announce, confirmInline } from './ui.js';
import { track } from './usage.js';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
let L = null; // { sb, user, name, email, minutes }
const K = { min: () => 'fin.lock.min', last: () => 'fin.lock.last.' + L.user, bio: () => 'fin.bio.' + L.user, ask: () => 'fin.bio.ask.' + L.user };
export const lockMinutesNow = () => lockMinutes(L?.minutes || lsGet(K.min()));
const touch = () => { if (L && !isLocked()) lsSet(K.last(), String(Date.now())); };
export const isLocked = () => document.body.classList.contains('locked');

export async function bioSupported() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
}
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

// Starts watching. Locks right away when the app was left more than the chosen minutes ago.
// minutes: fixed time (the product console); otherwise the one chosen in Conta on this device.
export function initLock({ sb, user, name = '', email = '', minutes = 0 }) {
  const first = !L; L = { sb, user, name, email, minutes: +minutes || 0 };
  if (isExpired(lsGet(K.last()), Date.now(), lockMinutesNow())) lock('parado'); else touch();
  if (!first) return;
  // Any touch counts as use (and closes the warning); while the warning is up, every touch counts.
  let t = 0; const act = e => { if (e.target?.closest?.('#lkWarn')) return; const n = Date.now(); if (n - t > 10e3 || $('#lkWarn')) { t = n; touch(); hideWarn(); } };
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(ev, act, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!L) return;
    if (document.hidden) { if (!$('#lkWarn')) touch(); return; }
    check();
  });
  setInterval(() => { if (L && !document.hidden) check(); }, 1000);
}
function check() {
  if (isLocked()) return;
  const s = idleState(lsGet(K.last()), Date.now(), lockMinutesNow());
  if (s.phase === 'expired') { hideWarn(); lock('parado'); } else if (s.phase === 'warn') showWarn(s.left); else hideWarn();
}
// "Por segurança, vamos desconectar em 30 s": stay or leave now.
function showWarn(left) {
  let el = $('#lkWarn');
  if (!el) {
    el = document.createElement('div'); el.id = 'lkWarn'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'lkWT');
    const first = String(L.name || '').trim().split(/\s+/)[0];
    el.innerHTML = `<div class="lk-card"><div class="lk-ring" aria-hidden="true"><span id="lkWN"></span></div>
      <h2 id="lkWT">${first ? esc(first) + ', você' : 'Você'} ainda está aí?</h2>
      <p class="small muted" id="lkWS" aria-live="polite"></p>
      <button class="btn primary lk-big" type="button" id="lkStay">Continuar no app</button>
      <button class="linkbtn" type="button" id="lkLeave">Desconectar agora</button></div>`;
    document.body.append(el);
    $('#lkStay').onclick = () => { touch(); hideWarn(); track('seguranca.continuar'); };
    $('#lkLeave').onclick = () => { hideWarn(); track('seguranca.desconectar'); lock('manual'); };
    track('seguranca.aviso');
  }
  $('#lkWN').textContent = left; $('#lkWS').textContent = `Por segurança, vamos desconectar em ${left} segundo${left === 1 ? '' : 's'}. Depois é só entrar de novo.`;
}
const hideWarn = () => $('#lkWarn')?.remove();
// Called right after an explicit sign-in: the clock starts now.
export function freshSignIn(user) { lsSet('fin.lock.last.' + user, String(Date.now())); }

export async function lock(reason = 'parado') {
  if (!L || isLocked()) return;
  hideWarn(); document.querySelectorAll('.cfm-wrap').forEach(x => x.remove()); document.body.classList.remove('cfm-open');
  document.body.classList.add('locked');
  const bio = lsGet(K.bio()) && await bioSupported();
  const { hello, title, text } = lockText({ name: L.name, minutes: lockMinutesNow(), reason });
  const el = document.createElement('div'); el.id = 'lockScreen'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'lkT');
  const finger = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11v3a8 8 0 0 1-1.5 4.7"/><path d="M8.5 8.6A4 4 0 0 1 16 11v1.5"/><path d="M5.5 15.5A12 12 0 0 0 6 11a6 6 0 0 1 9.7-4.7"/><path d="M16 16.5a14 14 0 0 1-1 3.5"/><path d="M19.4 14a16 16 0 0 0 .6-3 8 8 0 0 0-1.1-4"/></svg>';
  el.innerHTML = `<div class="lk-card">
    <div class="lk-brand"><img src="/icons/icon.svg" alt="" width="44" height="44">Pra Onde Foi</div>
    <p class="lk-hello">${esc(hello)}</p>
    <h2 id="lkT">${esc(title)}</h2><p class="small muted">${esc(text)}</p>
    ${bio ? `<button class="btn primary lk-big" type="button" id="lkBio">${finger} Entrar</button>` : ''}
    <form id="lkForm" class="stack"${bio ? ' hidden' : ''}>
      <label class="f">Senha de ${esc(L.email || 'sua conta')}<input type="password" id="lkPass" autocomplete="current-password" required></label>
      <button class="btn primary lk-big" type="submit" id="lkGo">Entrar</button>
    </form>
    <p class="small" id="lkMsg" role="status">${bio ? 'Ao tocar em Entrar, o celular pede a digital ou o rosto.' : ''}</p>
    <div class="lk-links">${bio ? '<button class="linkbtn" type="button" id="lkUsePass">Entrar com a senha</button>' : ''}<span class="small muted">Não é você? <button class="linkbtn" type="button" id="lkOut">Sair da conta</button></span></div>
  </div>`;
  document.body.append(el);
  const msg = (t, bad) => { $('#lkMsg').textContent = t; $('#lkMsg').className = 'small' + (bad ? ' err' : ''); };
  const done = () => { el.remove(); document.body.classList.remove('locked'); touch(); setTimeout(() => afterUnlock(), 300); };
  if (bio) {
    // Only on the tap: nothing pops up by itself when the app opens.
    $('#lkBio').onclick = async () => {
      msg('Confirme no celular...'); $('#lkBio').disabled = true;
      try {
        await navigator.credentials.get({ publicKey: { challenge: challenge(), allowCredentials: [{ type: 'public-key', id: fromB64u(lsGet(K.bio())) }], userVerification: 'required', timeout: 60000 } });
        track('seguranca.desbloqueio_bio'); done();
      } catch (e) { $('#lkBio').disabled = false; msg('Não deu certo. Toque em Entrar de novo ou entre com a senha.', true); }
    };
    $('#lkUsePass').onclick = () => { $('#lkForm').hidden = false; $('#lkBio').hidden = true; $('#lkUsePass').hidden = true; msg(''); $('#lkPass').focus(); };
  }
  $('#lkForm').onsubmit = async e => {
    e.preventDefault();
    const pass = $('#lkPass').value;
    if (!pass) return msg('Digite a sua senha.', true);
    $('#lkGo').disabled = true; msg('Conferindo...');
    const { error } = await L.sb.auth.signInWithPassword({ email: L.email, password: pass }).catch(err => ({ error: err }));
    $('#lkGo').disabled = false;
    if (error) return msg(/invalid/i.test(error.message || '') ? 'Senha incorreta. Tente de novo.' : 'Não consegui conferir agora. Confira a internet e tente de novo.', true);
    track('seguranca.desbloqueio_senha'); done();
  };
  $('#lkOut').onclick = () => signOutSafely();
}

// Coming back after the lock counts as a new opening: one invitation (main.js sets which, in order).
let afterUnlock = () => offerBio();
export const setAfterUnlock = fn => { afterUnlock = fn; };

// Every "Sair da conta" goes through here: the goodbye message about security shows on the front door.
export async function signOutSafely(sb = L?.sb) {
  const name = L?.name || '';
  if (L) lsSet(K.last(), null);
  try { await sb?.auth.signOut(); } catch (e) { /* already out */ }
  // Set after signing out: the sign-out event already drew the front door, and the reload shows the message once.
  try { sessionStorage.setItem('fin.bye', name); } catch (e) { /* storage blocked */ }
  location.reload();
}
export function showBye() {
  let name = null; try { name = sessionStorage.getItem('fin.bye'); sessionStorage.removeItem('fin.bye'); } catch (e) { return; }
  if (name == null) return;
  const m = byeMessage(name);
  announce({ eyebrow: 'Segurança', title: m.title, html: `<ul>${m.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`, primary: 'Entendi' });
}

// Creates the device key (the phone asks for the fingerprint or face). Must run from a tap.
export async function registerBio() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: challenge(), rp: { name: 'Pra Onde Foi', id: location.hostname },
      user: { id: new TextEncoder().encode(String(L.user).slice(0, 64)), name: L.email || 'conta', displayName: L.name || L.email || 'Pra Onde Foi' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
    lsSet(K.bio(), toB64u(cred.rawId)); track('seguranca.biometria');
    toast('Da próxima vez, toque em Entrar e use a digital ou o rosto. Para desligar: menu ☰ → Dados e conta → Conta.');
    return true;
  } catch (err) { toast('Não foi possível ligar agora. Dá para tentar de novo em menu ☰ → Dados e conta → Conta.', 'info'); return false; }
}
// The app offers the fingerprint/face itself (the phone does not allow turning it on without the person).
// Returns true when the offer was shown.
export async function offerBio() {
  if (!L || window.__noMsgs || isLocked()) return false;
  let asks = {}; try { asks = JSON.parse(lsGet(K.ask()) || '{}'); } catch (e) { asks = {}; }
  if (!shouldOfferBio({ supported: await bioSupported(), on: !!lsGet(K.bio()), asks, now: Date.now() })) return false;
  const first = String(L.name || '').trim().split(/\s+/)[0];
  const r = await announce({ eyebrow: 'Segurança', title: `${first ? first + ', quer' : 'Quer'} entrar com a digital ou o rosto?`,
    html: `<ul><li>Quando o app desconectar por inatividade, é só tocar em Entrar e encostar o dedo ou olhar para o celular, sem digitar a senha.</li><li>A digital e o rosto ficam no seu celular: o app nunca recebe.</li><li>Dá para desligar quando quiser em menu ☰ → Dados e conta → Conta.</li></ul>`,
    primary: 'Sim, usar', secondary: 'Agora não' });
  if (r === 'primary') { if (await registerBio()) return true; }
  lsSet(K.ask(), JSON.stringify({ n: (+asks.n || 0) + 1, at: Date.now() }));
  return true;
}

// Right after creating the account (onboarding): is it worth asking, and remember a "not now".
export const bioOn = () => !!(L && lsGet(K.bio()));
export const setLockName = n => { if (L) L.name = n; };
export function noteBioDeclined() { if (!L) return; let a = {}; try { a = JSON.parse(lsGet(K.ask()) || '{}'); } catch (e) { a = {}; } lsSet(K.ask(), JSON.stringify({ n: (+a.n || 0) + 1, at: Date.now() })); }

// "Segurança" in menu ☰ → Conta.
export async function renderSecurity(box) {
  if (!L) { box.innerHTML = ''; return; }
  const can = await bioSupported(), on = !!lsGet(K.bio()), m = lockMinutesNow();
  box.innerHTML = `<h3>Segurança</h3>
    <label class="f">Desconectar depois de
      <select id="lkMin">${LOCK_OPTIONS.map(o => `<option value="${o}"${o === m ? ' selected' : ''}>${minutesLabel(o)} sem uso</option>`).join('')}</select></label>
    <p class="tiny muted">Vale para este aparelho. 30 segundos antes, o app avisa e dá para continuar. Depois, é só tocar em Entrar e usar ${on ? 'a digital ou o rosto (ou a senha)' : 'a senha'}.</p>
    ${can ? `<div class="rowbtn"><button class="btn${on ? '' : ' primary'}" type="button" id="lkBioTgl">${on ? 'Parar de usar a digital ou o rosto' : 'Entrar com a digital ou o rosto'}</button><button class="btn" type="button" id="lkNow">Desconectar agora</button></div>
      <p class="tiny muted">A digital e o rosto ficam no próprio celular: o app nunca recebe nem guarda.</p>`
      : `<div class="rowbtn"><button class="btn" type="button" id="lkNow">Desconectar agora</button></div><p class="tiny muted">Este aparelho não oferece digital ou rosto para apps do navegador. Para entrar de novo, use a senha.</p>`}`;
  $('#lkMin').onchange = e => { lsSet(K.min(), String(lockMinutes(e.target.value))); track('seguranca.tempo'); toast(`O app agora desconecta depois de ${minutesLabel(lockMinutes(e.target.value))} sem uso.`); renderSecurity(box); };
  $('#lkNow').onclick = () => { track('seguranca.bloquear'); lock('manual'); };
  const tgl = $('#lkBioTgl');
  if (tgl) tgl.onclick = async e => {
    if (on) {
      if (!await confirmInline(e.target, { text: 'Parar de usar a digital ou o rosto neste aparelho? Para entrar, passa a ser pela senha.', yes: 'Sim, parar' })) return;
      lsSet(K.bio(), null); toast('Para entrar, agora é pela senha.'); return renderSecurity(box);
    }
    if (!await confirmInline(e.target, { text: 'Usar a digital ou o rosto deste aparelho para entrar no app? O celular vai pedir para você confirmar.', yes: 'Sim, usar' })) return;
    await registerBio(); renderSecurity(box);
  };
}
