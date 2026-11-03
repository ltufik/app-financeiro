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

// "Permitir" on the browser's question is not always enough: the phone itself can still hold the
// notifications (app or Chrome notifications off, Do not disturb, battery saving). A web app cannot open
// those settings, so it shows the way. platform: 'ios' | 'samsung' | 'android' | 'other'.
export function platformOf(ua = '') {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/samsung|SM-[A-Z0-9]/i.test(ua)) return 'samsung';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}
export function phoneSteps(platform) {
  if (platform === 'ios') return [
    'Abra os Ajustes do iPhone → Notificações → Pra Onde Foi.',
    'Ligue Permitir Notificações e marque Tela Bloqueada, Central de Notificações e Faixas.',
    'Confira se não há um Foco ligado (Não Perturbe, Dormir, Trabalho): ele segura os avisos.',
  ];
  const base = [
    'Abra as Configurações do celular → Aplicativos (ou Apps).',
    'Toque em Pra Onde Foi (se não aparecer, toque em Chrome) → Notificações e ligue Permitir notificações.',
    'Se aparecer a lista de sites, deixe praondefoi.app.br ligado.',
    'Confira se o Não perturbe está desligado.',
  ];
  if (platform === 'samsung') return [...base, 'Samsung: Configurações → Cuidados com o aparelho (ou Bateria) → Limites de uso em segundo plano. Se o Chrome estiver em "Apps em suspensão", tire de lá.'];
  if (platform === 'android') return [...base, 'Se usa economia de bateria, deixe o Chrome sem restrição em Configurações → Bateria.'];
  return ['Nas configurações do sistema, permita notificações para o navegador e para praondefoi.app.br.', 'Confira se o modo Não perturbe está desligado.'];
}

// The test notice, from the app's point of view: 'arrived' (the phone got it; if it did not show, the phone's
// notification settings hold it), 'blocked' (the phone refused to show it) or 'missing' (did not reach the
// phone in time: battery saving or background limits on Chrome, or no internet).
export function testOutcome(kind) {
  if (kind === 'arrived') return { ask: 'O aviso chegou neste celular. Ele apareceu na tela?', no: 'O aviso chegou, mas o celular não mostrou: as notificações estão desligadas nos ajustes do celular. Siga os passos abaixo e mande o teste de novo.' };
  if (kind === 'blocked') return { ask: '', no: 'O celular recusou mostrar o aviso: as notificações deste app estão bloqueadas. Siga os passos abaixo e mande o teste de novo.' };
  return { ask: 'O aviso ainda não chegou neste celular. Ele apareceu na tela?', no: 'O aviso não chegou até o celular. Normalmente é a economia de bateria do celular segurando o app ou o navegador, ou a internet. Depois de ajustar, mande o teste de novo.' };
}
