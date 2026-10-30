// Messages to the people testing the app: "O que mudou" after each update and personal replies
// when something they asked for is done. Pure module, tested in tests/lib.test.mjs.

// Starting notes; the list published in the product console replaces it. `at` decides who sees it:
// only people whose account existed before (new people get the welcome instead).
export const NEWS = [
  { id: 'n20261030', at: '2026-10-30T15:00:00Z', title: 'Sua opinião agora tem lugar no app', items: [
    'Toque no balão no topo para mandar um erro, uma ideia ou uma crítica, falando ou escrevendo.',
    'Menu ☰ → Dúvidas: as perguntas mais comuns e um assistente que responde as outras.',
    'Metas mais claras: limite do cartão, quanto guardar e o sonho de vocês.',
    'Quem paga o quê, assinaturas e modo privacidade (o olho no topo).',
  ] },
];

export const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
const hi = n => firstName(n) ? firstName(n) + ', ' : '';

export function replyTitle(kind, name) {
  const t = { erro: 'o erro que você mandou foi corrigido', ideia: 'a sua ideia virou realidade', critica: 'melhoramos o que você apontou' }[kind] || 'temos uma resposta para você';
  const s = hi(name) + t + '!';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Suggested text for the console, the owner edits before sending.
export function replyTemplate(kind, name, text) {
  const what = String(text || '').trim(), short = what.length > 90 ? what.slice(0, 90) + '…' : what;
  const lead = { erro: `Você avisou que "${short}". Corrigimos`, ideia: `Você sugeriu "${short}". Já está no app`, critica: `Você comentou que "${short}". Mudamos`, duvida: `Você perguntou "${short}". Melhoramos a explicação` }[kind] || `Você escreveu "${short}". Cuidamos disso`;
  return `Oi, ${firstName(name) || 'tudo bem'}! ${lead}: `;
}

// Notes this person has not seen: newer than what they saw and than their account.
export function unseenNews(items, { seenAt, createdAt } = {}) {
  const after = Math.max(Date.parse(seenAt || 0) || 0, Date.parse(createdAt || 0) || 0);
  return (items || []).filter(x => x && x.at && Date.parse(x.at) > after && Date.parse(x.at) <= Date.now() + 864e5)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3);
}
