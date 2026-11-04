// Locking the app after a while without use, and the security messages. Pure module, tested in tests/lib.test.mjs.

export const LOCK_OPTIONS = [1, 3, 5, 15, 30];   // minutes; there is no "never": the app shows the family's numbers
export const LOCK_DEFAULT = 5;
// The product console has its own login and its own time (no family numbers there): 30 min to 4 hours, 1 hour by default.
export const CENTRAL_OPTIONS = [30, 60, 120, 240];
export const CENTRAL_DEFAULT = 60;
export const WARN_SECONDS = 30;                   // "vamos desconectar em 30 s" before the lock
export const lockMinutes = (v, scope = 'app') => scope === 'central' ? (CENTRAL_OPTIONS.includes(+v) ? +v : CENTRAL_DEFAULT) : (LOCK_OPTIONS.includes(+v) ? +v : LOCK_DEFAULT);
const minTxt = m => m === 1 ? '1 minuto' : m === 60 ? '1 hora' : m > 60 && m % 60 === 0 ? `${m / 60} horas` : `${m} minutos`;
export const minutesLabel = minTxt;

// lastActive: when the person last touched the app (ms). Nothing recorded yet = just signed in: not locked.
// minutes: already resolved with lockMinutes (each scope has its own options).
export function isExpired(lastActive, now, minutes) {
  const t = +lastActive, m = +minutes > 0 ? +minutes : LOCK_DEFAULT;
  return !!t && t <= now && now - t >= m * 60e3;
}

// Like the bank apps: a warning with a countdown just before, then the "entrar" screen.
// 'ok' | 'warn' (left = seconds until it disconnects) | 'expired'.
export function idleState(lastActive, now, minutes, warn = WARN_SECONDS) {
  const t = +lastActive; if (!t || t > now) return { phase: 'ok', left: null };
  const left = Math.ceil(((+minutes > 0 ? +minutes : LOCK_DEFAULT) * 60e3 - (now - t)) / 1000);
  return left <= 0 ? { phase: 'expired', left: 0 } : left <= warn ? { phase: 'warn', left } : { phase: 'ok', left };
}

// Text of the lock ("entrar") screen.
export function lockText({ name = '', minutes = LOCK_DEFAULT, reason = 'parado', scope = 'app' } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0], c = scope === 'central';
  return {
    hello: first ? `Olá, ${first}` : 'Olá',
    title: reason === 'manual' ? (c ? 'Você saiu da Central' : 'Você saiu do app') : 'Você foi desconectado por inatividade',
    text: reason === 'manual' ? (c ? 'A Central fica fechada até você entrar de novo.' : 'Os números da família ficam escondidos até você entrar de novo.')
      : `Ficou ${minTxt(lockMinutes(minutes, scope))} sem uso. ${c ? 'Para proteger a Central do produto, ela desconecta sozinha.' : 'Para proteger os números da família, o app desconecta sozinho.'}`,
  };
}

// Shown on the front door right after signing out.
export function byeMessage(name = '') {
  const first = String(name || '').trim().split(/\s+/)[0];
  return {
    title: first ? `Até logo, ${first}!` : 'Até logo!',
    items: [
      'Você saiu da conta. Neste celular, ninguém vê os números da família até alguém entrar de novo com e-mail e senha.',
      'O Pra Onde Foi nunca pede a senha do banco nem guarda o arquivo da fatura. Se alguém pedir em nome do app, não é o app.',
      'Dica: use o bloqueio de tela do celular (senha, digital ou rosto). E, dentro do app, o tempo para desconectar fica em menu ☰ → Dados e conta → Conta.',
    ],
  };
}

// Offer the fingerprint/face: only where the phone has it, while it is off, at most 3 times, a week apart.
export function shouldOfferBio({ supported, on, asks = {}, now }) {
  const n = +asks.n || 0, at = +asks.at || 0;
  return !!supported && !on && n < 3 && (!at || now - at >= 7 * 864e5);
}

// WebAuthn ids travel as base64url.
export const toB64u = bytes => { let s = ''; new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const fromB64u = t => Uint8Array.from(atob(String(t).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(t).length + 3) % 4)), c => c.charCodeAt(0));
