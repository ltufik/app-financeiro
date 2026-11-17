// The message manual (Central → Mensagens): the rules every notice on Início and every push must follow, as checks.
// Each message: { channel: 'inicio'|'push', id, title, text, action?, url? }; ctx: { today, name }.
// Returns the problems found, in plain words. Pure, tested in tests/lib.test.mjs.
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// Personal messages talk to "você"; everything about the family's money talks about "vocês".
export const PERSONAL = new Set(['lembrete', 'lembrete_vazio', 'recado', 'teste']);
// Messages about money that must carry the family's own numbers, and the ones that must compare with the family's normal.
const NEEDS_NUMBER = new Set(['red', 'saved', 'below', 'high', 'low', 'card', 'perday', 'fixed', 'bill_up', 'subs_up', 'budget', 'juros', 'tarifas', 'semanal', 'previsao', 'saques', 'entrada_amortizacao']);
const NEEDS_COMPARE = new Set(['red', 'high', 'low', 'bill_up', 'semanal']);
const VAGUE = /vale (olhar|conferir|a pena)|lembre de|faltam dados|bora |dá uma olhada|fique de olho|confira se/i;

export const RULES = [
  ['momento', 'Momento certo', 'Mês em andamento nunca "fechou"; número parcial diz até quando.'],
  ['nome', 'Pessoal sem o nome', 'O nome de quem lê não abre o aviso (só o cumprimento do Início). Pessoal é o número, a categoria, a casa, a meta ou quem da família fez.'],
  ['pessoa', '"Vocês" uma vez', 'No máximo um "vocês" por aviso; push pessoal fala com "você".'],
  ['numero', 'Números da família', 'Aviso de dinheiro traz o valor da própria família.'],
  ['comparacao', 'Comparado com o normal', 'Alta ou queda comparada com a média da própria família.'],
  ['acao', 'Próximo passo', 'Um botão (ou link no push) que leva direto ao lugar.'],
  ['vago', 'Sem frase genérica', 'Nada de "vale olhar", "faltam dados", "lembre de".'],
  ['tamanho', 'Curto', 'Título até 8 palavras (52 letras); texto com até 2 frases e 160 letras (push 140).'],
];

export function checkMessage(m, { today, name } = {}) {
  const out = [], all = `${m.title || ''} ${m.text || ''}`, first = String(name || '').trim().split(/\s+/)[0];
  const cur = today ? MES[+today.slice(5, 7) - 1] : null;
  if (cur && new RegExp(`${cur}[^.]*\\bfechou|fechou[^.]*\\b${cur}`, 'i').test(all)) out.push(['momento', `Diz que ${cur} fechou, mas o mês ainda está acontecendo.`]);
  if (first && new RegExp(`^${first}\\b`).test(String(m.title || '').trim())) out.push(['nome', `Abre com o nome de quem lê (${first}).`]);
  const personal = PERSONAL.has(m.id), vs = (all.match(/vocês/gi) || []).length;
  if (vs > 1) out.push(['pessoa', `"Vocês" ${vs} vezes.`]);
  if (personal && m.channel === 'push' && /vocês/i.test(all) && !/de vocês|da família/i.test(all)) out.push(['pessoa', 'Push pessoal falando com "vocês".']);
  if (NEEDS_NUMBER.has(m.id) && !/R\$|\d+ ?%/.test(all)) out.push(['numero', 'Fala de dinheiro sem o número da família.']);
  if (NEEDS_COMPARE.has(m.id) && !/média|normal|costuma|que o de sempre|do que em/i.test(all)) out.push(['comparacao', 'Não compara com o normal da própria família.']);
  if (m.channel === 'inicio' && !m.action) out.push(['acao', 'Sem botão de próximo passo.']);
  if (m.channel === 'push' && !m.url) out.push(['acao', 'Sem link para o lugar certo.']);
  const v = all.match(VAGUE); if (v) out.push(['vago', `Frase genérica: "${v[0].trim()}".`]);
  const tw = String(m.title || '').trim().split(/\s+/).filter(w => !/^(R\$|[\d.,%]+|·|:|-)$/.test(w)).length;
  if ((m.title || '').length > 52 || tw > 8) out.push(['tamanho', `Título com ${tw} palavras e ${(m.title || '').length} letras.`]);
  const lim = m.channel === 'push' ? 140 : 160, sentences = String(m.text || '').split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"])/).filter(x => x.trim()).length;
  if ((m.text || '').length > lim) out.push(['tamanho', `Texto com ${(m.text || '').length} letras.`]);
  if (sentences > 2) out.push(['tamanho', `Texto com ${sentences} frases.`]);
  return out.map(([rule, text]) => ({ rule, text }));
}
