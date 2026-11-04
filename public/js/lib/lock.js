// Locking the app after a while without use, and the security messages. Pure module, tested in tests/lib.test.mjs.

export const LOCK_OPTIONS = [1, 3, 5, 15, 30];   // minutes; there is no "never": the app shows the family's numbers
export const LOCK_DEFAULT = 5;
export const CENTRAL_MINUTES = 60;               // the product console has no family numbers: one hour
export const WARN_SECONDS = 30;                   // "vamos desconectar em 30 s" before the lock
export const lockMinutes = v => LOCK_OPTIONS.includes(+v) || +v === CENTRAL_MINUTES ? +v : LOCK_DEFAULT;
const minTxt = m => m === 1 ? '1 minuto' : m === 60 ? '1 hora' : `${m} minutos`;
export const minutesLabel = minTxt;

// lastActive: when the person last touched the app (ms). Nothing recorded yet = just signed in: not locked.
export function isExpired(lastActive, now, minutes) {
  const t = +lastActive;
  return !!t && t <= now && now - t >= lockMinutes(minutes) * 60e3;
}

// Like the bank apps: a warning with a countdown just before, then the "entrar" screen.
// 'ok' | 'warn' (left = seconds until it disconnects) | 'expired'.
export function idleState(lastActive, now, minutes, warn = WARN_SECONDS) {
  const t = +lastActive; if (!t || t > now) return { phase: 'ok', left: null };
  const left = Math.ceil((lockMinutes(minutes) * 60e3 - (now - t)) / 1000);
  return left <= 0 ? { phase: 'expired', left: 0 } : left <= warn ? { phase: 'warn', left } : { phase: 'ok', left };
}

// Text of the lock ("entrar") screen.
export function lockText({ name = '', minutes = LOCK_DEFAULT, reason = 'parado' } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return {
    hello: first ? `Olá, ${first}` : 'Olá',
    title: reason === 'manual' ? 'Você saiu do app' : 'Você foi desconectado por inatividade',
    text: reason === 'manual' ? 'Os números da família ficam escondidos até você entrar de novo.'
      : `Ficou ${minTxt(lockMinutes(minutes))} sem uso. Para proteger os números da família, o app desconecta sozinho.`,
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
