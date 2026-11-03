// Notifications off on this device: the app does not turn them on by itself (the phone asks the person),
// but it says so and takes the person to menu ☰ → Notificações. Pure module, tested in tests/lib.test.mjs.

export const ASK_MAX = 4;          // times the pop-up appears on this device
export const ASK_GAP_DAYS = 3;     // days between two of them

// status: from pushStatus() — 'on' | 'off' | 'denied' | 'need-install' | 'unsupported' | 'not-configured' | 'no-sw'.
// Only 'off' (never turned on, or turned off) and 'denied' (blocked in the phone settings) are worth a word:
// on an iPhone in Safari the install invitation comes first; elsewhere there is nothing the person can do.
export const pushIsOff = status => status === 'off' || status === 'denied';
export function shouldAskPush({ status, asks = {}, now }) {
  const n = +asks.n || 0, at = +asks.at || 0;
  return pushIsOff(status) && n < ASK_MAX && (!at || now - at >= ASK_GAP_DAYS * 864e5);
}

// Pop-up text, with the person's name.
export function pushAskText(status, name = '') {
  const first = String(name || '').trim().split(/\s+/)[0];
  const who = first ? first + ', as' : 'As';
  const items = [
    'Novidades do app e a resposta quando o que você pediu ficar pronto.',
    'Fatura fechando, mês acabando sem dados e gasto acima do normal.',
    'No máximo um aviso por dia, e você escolhe quais quer.',
  ];
  if (status === 'denied') return { title: `${who} notificações estão bloqueadas neste celular`, items: [...items, 'Na próxima tela, o passo a passo para liberar nos ajustes do celular.'], primary: 'Ver como liberar', secondary: 'Agora não' };
  return { title: `${who} notificações estão desligadas neste celular`, items: [...items, 'Na próxima tela é só tocar em Ativar e depois em Permitir. Dá para desligar quando quiser.'], primary: 'Ligar agora', secondary: 'Agora não' };
}

// The line under "Notificações" in menu ☰.
export const menuNote = status => status === 'denied' ? 'Bloqueadas neste celular' : status === 'off' ? 'Desligadas neste celular' : '';
