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

// ---------- iPhone "Compartilhar" shortcut: a receipt (PDF, photo or print) sent as base64 ----------
import { KIND_RULES, KIND_LABEL, aiKind } from './classify.js';

// What the file is, by its first bytes (never by its name). heic: iPhone photo format the reader does not take.
export function sniffBase64(b64) {
  const s = String(b64 || '').replace(/^data:[^,]*,/, '').replace(/[\s\r\n]+/g, '');
  if (!s) return { error: 'vazio' };
  let head = '';
  try { head = atob(s.slice(0, 24)); } catch (e) { return { error: 'formato' }; }
  const type = head.startsWith('%PDF') ? 'application/pdf' : head.charCodeAt(0) === 0xFF && head.charCodeAt(1) === 0xD8 ? 'image/jpeg'
    : head.slice(1, 4) === 'PNG' ? 'image/png' : head.slice(8, 12) === 'WEBP' ? 'image/webp' : head.startsWith('GIF8') ? 'image/gif'
    : head.slice(4, 8) === 'ftyp' ? 'heic' : null;
  if (!type) return { error: 'formato' };
  if (type === 'heic') return { error: 'heic' };
  const bytes = Math.floor(s.length * 3 / 4);
  if (bytes > 3.2 * 1024 * 1024) return { error: 'grande' }; // the server takes up to 4.5 MB of request
  return { type, data: s, bytes };
}

export const docPrompt = ({ family, today, categories }) => `Você recebeu um documento enviado pelo botão Compartilhar do iPhone por uma família brasileira (${family}). Hoje é ${today}.
Diga o que é e, se for um comprovante, extraia o lançamento. Responda só com JSON:
{"tipo":"comprovante"|"nota"|"fatura"|"extrato"|"investimentos"|"outro","itens":[{"descricao":"texto curto: para quem ou de quem e o motivo, se houver","valor":123.45,"sentido":"saida"|"entrada","data":"AAAA-MM-DD","meio":"cartao"|"conta","categoria":"<nome exato de uma categoria da lista>"}]}
${KIND_RULES}
Só preencha "itens" para "comprovante". Regras: valor sempre positivo; Pix e transferência enviados, boleto pago e débito são "conta" e "saida"; recebidos são "entrada"; compra no crédito é "cartao". Pagamento da fatura do cartão é "conta" e "saida". Não invente: sem valor claro, deixe itens vazio.
Categorias: ${categories.map(c => `${c.name} [${c.grp}]`).join(' | ')}`;

// The answer the shortcut shows on the iPhone for each kind that is not a single receipt.
export function docMessage(tipo) {
  const k = aiKind(tipo);
  if (k === 'nota') return 'Isto é uma nota fiscal. Para separar cada item na sua categoria, abra o app e envie em Lançar → Foto da nota.';
  if (k === 'fatura' || k === 'extrato' || k === 'investimentos') return `Isto é ${k === 'fatura' ? 'uma' : 'um'} ${KIND_LABEL[k]}. Abra o app e envie em Lançar → Fatura ou extrato, para conferir tudo antes de salvar.`;
  return 'Não achei um comprovante com valor nesse arquivo. Confira se é o comprovante certo ou lance pelo app.';
}
