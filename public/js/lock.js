// Automatic lock: after some minutes without use the app is covered and asks for the fingerprint/face
// (passkey on this device, WebAuthn) or the password. Also the "Segurança" block in menu ☰ → Conta,
// and the goodbye message after signing out. Used by the app and by the product console.
// The fingerprint or face never leaves the phone: the app keeps only the id of the device key, on this device.
import { LOCK_OPTIONS, lockMinutes, isExpired, lockText, byeMessage, minutesLabel, toB64u, fromB64u, shouldOfferBio } from './lib/lock.js';
import { esc } from './lib/format.js';
import { $, toast, announce, confirmInline } from './ui.js';
import { track } from './usage.js';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
let L = null; // { sb, user, name, email }
const K = { min: () => 'fin.lock.min', last: () => 'fin.lock.last.' + L.user, bio: () => 'fin.bio.' + L.user, ask: () => 'fin.bio.ask.' + L.user };
export const lockMinutesNow = () => lockMinutes(lsGet(K.min()));
const touch = () => { if (L && !isLocked()) lsSet(K.last(), String(Date.now())); };
export const isLocked = () => document.body.classList.contains('locked');

export async function bioSupported() {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
}
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

// Starts watching. Locks right away when the app was left more than the chosen minutes ago.
export function initLock({ sb, user, name = '', email = '' }) {
  const first = !L; L = { sb, user, name, email };
  if (isExpired(lsGet(K.last()), Date.now(), lockMinutesNow())) lock('parado'); else touch();
  if (!first) return;
  let t = 0; const act = () => { const n = Date.now(); if (n - t > 10e3) { t = n; touch(); } };
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(ev, act, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!L) return;
    if (document.hidden) { touch(); return; }
    if (!isLocked() && isExpired(lsGet(K.last()), Date.now(), lockMinutesNow())) lock('parado');
  });
  setInterval(() => { if (L && !document.hidden && !isLocked() && isExpired(lsGet(K.last()), Date.now(), lockMinutesNow())) lock('parado'); }, 15e3);
}
// Called right after an explicit sign-in: the clock starts now.
export function freshSignIn(user) { lsSet('fin.lock.last.' + user, String(Date.now())); }

export async function lock(reason = 'parado') {
  if (!L || isLocked()) return;
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove()); document.body.classList.remove('cfm-open');
  document.body.classList.add('locked');
  const bio = lsGet(K.bio()) && await bioSupported();
  const { title, text } = lockText({ name: L.name, minutes: lockMinutesNow(), reason });
  const el = document.createElement('div'); el.id = 'lockScreen'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'lkT');
  el.innerHTML = `<div class="lk-card">
    <div class="lk-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
    <h2 id="lkT">${esc(title)}</h2><p class="small muted">${esc(text)}</p>
    ${bio ? '<button class="btn primary lk-big" type="button" id="lkBio">Desbloquear com digital ou rosto</button>' : ''}
    <form id="lkForm" class="stack"${bio ? ' hidden' : ''}>
      <label class="f">Senha de ${esc(L.email || 'sua conta')}<input type="password" id="lkPass" autocomplete="current-password" required></label>
      <button class="btn primary lk-big" type="submit" id="lkGo">Desbloquear</button>
    </form>
    <p class="small" id="lkMsg" role="status"></p>
    <div class="rowbtn lk-links">${bio ? '<button class="linkbtn" type="button" id="lkUsePass">Usar a senha</button>' : ''}<button class="linkbtn" type="button" id="lkOut">Sair da conta</button></div>
  </div>`;
  document.body.append(el);
  const msg = (t, bad) => { $('#lkMsg').textContent = t; $('#lkMsg').className = 'small' + (bad ? ' err' : ''); };
  const done = () => { el.remove(); document.body.classList.remove('locked'); touch(); };
  if (bio) {
    const go = async () => {
      msg('Confirme no celular...');
      try {
        await navigator.credentials.get({ publicKey: { challenge: challenge(), allowCredentials: [{ type: 'public-key', id: fromB64u(lsGet(K.bio())) }], userVerification: 'required', timeout: 60000 } });
        track('seguranca.desbloqueio_bio'); done();
      } catch (e) { msg('Não deu certo. Tente de novo ou use a senha.', true); }
    };
    $('#lkBio').onclick = go;
    $('#lkUsePass').onclick = () => { $('#lkForm').hidden = false; $('#lkBio').hidden = true; $('#lkUsePass').hidden = true; msg(''); $('#lkPass').focus(); };
    setTimeout(go, 300);
  } else setTimeout(() => $('#lkPass')?.focus(), 100);
  $('#lkForm').onsubmit = async e => {
    e.preventDefault();
    const pass = $('#lkPass').value;
    if (!pass) return msg('Digite a sua senha.', true);
    $('#lkGo').disabled = true; msg('Conferindo...');
    const { error } = await L.sb.auth.signInWithPassword({ email: L.email, password: pass }).catch(err => ({ error: err }));
    $('#lkGo').disabled = false;
    if (error) return msg(/invalid/i.test(error.message || '') ? 'Senha incorreta. Tente de novo.' : 'Não consegui conferir agora. Confira a internet e tente de novo.', true);
    track('seguranca.desbloqueio_senha'); done();
    offerBio();
  };
  $('#lkOut').onclick = () => signOutSafely();
}

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
    toast('Da próxima vez, desbloqueie com a digital ou o rosto. Para desligar: menu ☰ → Conta → Segurança.');
    return true;
  } catch (err) { toast('Não foi possível ligar agora. Dá para tentar de novo em menu ☰ → Conta → Segurança.', 'info'); return false; }
}
// The app offers the fingerprint/face itself (the phone does not allow turning it on without the person).
// Returns true when the offer was shown.
export async function offerBio() {
  if (!L || window.__noMsgs || isLocked()) return false;
  let asks = {}; try { asks = JSON.parse(lsGet(K.ask()) || '{}'); } catch (e) { asks = {}; }
  if (!shouldOfferBio({ supported: await bioSupported(), on: !!lsGet(K.bio()), asks, now: Date.now() })) return false;
  const first = String(L.name || '').trim().split(/\s+/)[0];
  const r = await announce({ eyebrow: 'Segurança', title: `${first ? first + ', quer' : 'Quer'} desbloquear com a digital ou o rosto?`,
    html: `<ul><li>Quando o app se bloquear, é só encostar o dedo ou olhar para o celular, sem digitar a senha.</li><li>A digital e o rosto ficam no seu celular: o app nunca recebe.</li><li>Dá para desligar quando quiser em menu ☰ → Conta → Segurança.</li></ul>`,
    primary: 'Sim, usar', secondary: 'Agora não' });
  if (r === 'primary') { if (await registerBio()) return true; }
  lsSet(K.ask(), JSON.stringify({ n: (+asks.n || 0) + 1, at: Date.now() }));
  return true;
}

// "Segurança" in menu ☰ → Conta.
export async function renderSecurity(box) {
  if (!L) { box.innerHTML = ''; return; }
  const can = await bioSupported(), on = !!lsGet(K.bio()), m = lockMinutesNow();
  box.innerHTML = `<h3>Segurança</h3>
    <label class="f">Bloquear o app depois de
      <select id="lkMin">${LOCK_OPTIONS.map(o => `<option value="${o}"${o === m ? ' selected' : ''}>${minutesLabel(o)} sem uso</option>`).join('')}</select></label>
    <p class="tiny muted">Vale para este aparelho. Bloqueado, o app pede ${on ? 'a digital ou o rosto (ou a senha)' : 'a senha'} para mostrar os números de novo.</p>
    ${can ? `<div class="rowbtn"><button class="btn${on ? '' : ' primary'}" type="button" id="lkBioTgl">${on ? 'Parar de usar a digital ou o rosto' : 'Usar a digital ou o rosto para desbloquear'}</button><button class="btn" type="button" id="lkNow">Bloquear agora</button></div>
      <p class="tiny muted">A digital e o rosto ficam no próprio celular: o app nunca recebe nem guarda.</p>`
      : `<div class="rowbtn"><button class="btn" type="button" id="lkNow">Bloquear agora</button></div><p class="tiny muted">Este aparelho não oferece digital ou rosto para apps do navegador. O desbloqueio é pela senha.</p>`}`;
  $('#lkMin').onchange = e => { lsSet(K.min(), String(lockMinutes(e.target.value))); track('seguranca.tempo'); toast(`O app agora se bloqueia depois de ${minutesLabel(lockMinutes(e.target.value))} sem uso.`); renderSecurity(box); };
  $('#lkNow').onclick = () => { track('seguranca.bloquear'); lock('manual'); };
  const tgl = $('#lkBioTgl');
  if (tgl) tgl.onclick = async e => {
    if (on) {
      if (!await confirmInline(e.target, { text: 'Parar de usar a digital ou o rosto neste aparelho? O desbloqueio passa a ser pela senha.', yes: 'Sim, parar' })) return;
      lsSet(K.bio(), null); toast('O desbloqueio agora é pela senha.'); return renderSecurity(box);
    }
    if (!await confirmInline(e.target, { text: 'Usar a digital ou o rosto deste aparelho para desbloquear o app? O celular vai pedir para você confirmar.', yes: 'Sim, usar' })) return;
    await registerBio(); renderSecurity(box);
  };
}
