// Purchase sent by the iPhone shortcut (Apple Pay): amount as Shortcuts sends it ("R$ 45,90", "45.9", 45.9)
// and the transaction row. Pure functions, tested in tests/lib.test.mjs.
import { cycleMonth } from './format.js';

export function parseBRL(v) {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  let s = String(v || '').replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');           // 1.234,56 -> 1234.56
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); // 1.234 -> 1234
  const n = Math.abs(parseFloat(s));
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// today: 'AAAA-MM-DD' in Brazil. Returns the row or {error}.
export function quickRow({ valor, loja, cartao }, { household, user, today, closeDay = 24, category = null }) {
  const amount = parseBRL(valor);
  if (!(amount > 0) || amount >= 1e6) return { error: 'valor' };
  const store = String(loja || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Compra com Apple Pay';
  return {
    household_id: household, source: 'cartao', month: cycleMonth(today, closeDay), date: today, day: today.slice(8, 10) + '/' + today.slice(5, 7),
    description: store, amount, category: category || 'A classificar', card: cartao ? String(cartao).trim().slice(0, 40) : null, manual: true, created_by: user,
  };
}

// Phrase spoken to Siri ("45 na padaria no pix"): the prompt for the assistant and the rows from its answer.
export const phrasePrompt = ({ family, today, categories, text }) => `Você registra lançamentos financeiros de uma família brasileira (${family}). Hoje é ${today}.
Transforme a frase abaixo em lançamentos. Responda só com JSON no formato:
{"itens":[{"descricao":"texto curto","valor":123.45,"sentido":"saida"|"entrada","data":"AAAA-MM-DD","meio":"cartao"|"conta","categoria":"<nome exato de uma categoria da lista>"}]}
Regras: valor sempre positivo. "meio" = cartao quando falar em cartão ou crédito; conta para pix, boleto, débito, transferência ou dinheiro; sem meio dito, use conta. Datas relativas (hoje, ontem, sexta) a partir de hoje. Escolha a categoria pelo nome; se nenhuma servir, use "A classificar".
Categorias: ${categories.map(c => `${c.name} [${c.grp}]`).join(' | ')}
Frase: """${String(text).slice(0, 500)}"""`;

export function phraseRows(items, { household, user, today, closeDay = 24, categories = [] }) {
  const names = new Set(categories.map(c => c.name));
  return (items || []).filter(x => x && parseBRL(x.valor) > 0 && parseBRL(x.valor) < 1e6).slice(0, 10).map(x => {
    const source = x.meio === 'cartao' ? 'cartao' : 'conta', date = /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') && x.data <= today ? x.data : today;
    const sign = x.sentido === 'entrada' ? 1 : -1, v = parseBRL(x.valor);
    return { household_id: household, source, month: source === 'cartao' ? cycleMonth(date, closeDay) : date.slice(0, 7), date, day: date.slice(8, 10) + '/' + date.slice(5, 7),
      description: String(x.descricao || 'Lançamento por voz').replace(/\s+/g, ' ').trim().slice(0, 80), amount: Math.round((source === 'cartao' ? -sign * v : sign * v) * 100) / 100,
      category: names.has(x.categoria) ? x.categoria : (sign > 0 ? 'Outras entradas' : 'A classificar'), card: null, manual: true, created_by: user };
  });
}
