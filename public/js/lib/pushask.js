// Notifications off on this device: the app does not turn them on by itself (the phone asks the person),
// but it says so and takes the person to menu ☰ → Notificações. Pure module, tested in tests/lib.test.mjs.

export const ASK_MAX = 7;          // times the pop-up appears on this device (a week of days with use)

// status: from pushStatus() — 'on' | 'off' | 'denied' | 'need-install' | 'unsupported' | 'not-configured' | 'no-sw'.
// Only 'off' (never turned on, or turned off) and 'denied' (blocked in the phone settings) are worth a word:
// on an iPhone in Safari the install invitation comes first; elsewhere there is nothing the person can do.
export const pushIsOff = status => status === 'off' || status === 'denied';
export function shouldAskPush({ status, asks = {}, now }) {
  const n = +asks.n || 0, at = +asks.at || 0;
  // At most once a day (calendar day on the phone), on the days the app is used.
  return pushIsOff(status) && n < ASK_MAX && (!at || new Date(at).toDateString() !== new Date(now).toDateString());
}

// Pop-up text, with the person's name: an invitation (what the person gains), not a status report.
// The state of the device goes in the small label on top.
export function pushAskText(status, name = '') {
  const first = String(name || '').trim().split(/\s+/)[0];
  const items = [
    'A resposta na hora quando o que você pediu ficar pronto.',
    'Fatura fechando, mês acabando sem dados ou gasto acima do normal, antes de virar surpresa.',
    'No máximo um aviso por dia, e você escolhe quais quer.',
  ];
  if (status === 'denied') return { eyebrow: 'Notificações bloqueadas', title: `${first ? first + ', quer' : 'Quer'} voltar a receber os avisos do app?`, items: [...items, 'Na próxima tela, o passo a passo para liberar nos ajustes do celular. Leva menos de um minuto.'], primary: 'Ver como liberar', secondary: 'Agora não' };
  return { eyebrow: 'Notificações desligadas', title: `${first ? first + ', que' : 'Que'} tal o app te avisar do que importa?`, items: [...items, 'É só tocar em Ativar e depois em Permitir. Dá para desligar quando quiser.'], primary: 'Quero receber', secondary: 'Agora não' };
}

// The line under "Notificações" in menu ☰.
export const menuNote = status => status === 'denied' ? 'Bloqueadas neste celular' : status === 'off' ? 'Desligadas neste celular' : '';
