// Receipts (nota fiscal / cupom): prompt, cleanup of what was read, split by category and matching
// with a transaction already in the statement. Pure functions, tested in tests/lib.test.mjs.

const r2 = v => Math.round((+v || 0) * 100) / 100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const RECEIPT_JSON = `{"loja":"nome da loja","cnpj":"só números ou null","data":"AAAA-MM-DD","total":0.00,"pagamento":"cartao"|"conta"|null,"itens":[{"descricao":"nome do produto","valor":0.00,"categoria":"nome de categoria"}],"desconto":0.00}`;

// Prompt for Claude. `cats` = names of the day-to-day categories the family already has.
export function receiptPrompt(cats, today) {
  return `A imagem (ou o texto) é uma nota fiscal ou cupom de compra brasileiro. Hoje é ${today}.
Leia e responda só com JSON no formato ${RECEIPT_JSON}.
Regras: "valor" de cada item é o valor final pago pelo item (quantidade × preço, já com o desconto do item, se houver). "total" é o valor total pago na nota. "desconto" é o desconto geral da nota (positivo) ou 0.
"pagamento": cartao se a nota disser cartão de crédito; conta para débito, pix ou dinheiro; null se não disser.
Para cada item, escolha a categoria mais específica. Use uma destas quando servir (são as despesas da família): ${cats.join(' | ')}.
Se nenhuma servir bem, sugira um nome novo curto e comum (ex.: "Suplementos", "Higiene", "Pet", "Bebidas"). Remédio é saúde; suplemento (whey, creatina, vitaminas, colágeno) é "Suplementos" quando não houver categoria parecida.
Escreva a descrição do item por extenso quando a nota abreviar (ex.: "CREAT 300G" → "Creatina 300 g"). Nunca invente itens ou valores; se não der para ler, deixe a lista vazia.`;
}

// Clean what Claude returned. Returns { ok, store, date, total, payment, items:[{description, amount, category}], msg }.
export function normalizeReceipt(raw, today) {
  const items = (Array.isArray(raw?.itens) ? raw.itens : [])
    .map(x => ({ description: String(x?.descricao || '').replace(/\s+/g, ' ').trim().slice(0, 80), amount: r2(x?.valor), category: String(x?.categoria || '').trim().slice(0, 60) }))
    .filter(x => x.description && x.amount > 0);
  const sum = r2(items.reduce((a, x) => a + x.amount, 0));
  let total = r2(raw?.total);
  if (!(total > 0)) total = r2(sum - (+raw?.desconto || 0));
  const date = ISO.test(raw?.data || '') && raw.data <= today ? raw.data : today;
  const out = { store: String(raw?.loja || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Nota fiscal', date, dateRead: ISO.test(raw?.data || ''), total, payment: raw?.pagamento === 'cartao' || raw?.pagamento === 'conta' ? raw.pagamento : null, items };
  if (!items.length) return { ...out, ok: false, msg: 'Não consegui ler os itens da nota. Tente uma foto mais de perto, reta e com boa luz.' };
  if (!(total > 0)) return { ...out, ok: false, msg: 'Não achei o total da nota.' };
  return { ...out, ok: true, sum, diff: r2(total - sum) };
}

// Group items by category and make the parts add up exactly to `total` (discounts and rounding are spread
// in proportion to each part; the last cent goes to the biggest part).
export function splitByCategory(items, total) {
  const g = new Map();
  for (const it of items) g.set(it.category || 'A classificar', r2((g.get(it.category || 'A classificar') || 0) + it.amount));
  const parts = [...g.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const sum = parts.reduce((a, p) => a + p.amount, 0);
  if (!parts.length || !(total > 0) || !(sum > 0)) return parts;
  const f = total / sum;
  for (const p of parts) p.amount = r2(p.amount * f);
  const off = r2(total - parts.reduce((a, p) => a + p.amount, 0));
  parts[0].amount = r2(parts[0].amount + off);
  return parts.filter(p => p.amount > 0);
}

const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
// Transactions that are probably this purchase: same value (±R$ 0,05), date within ±maxDays.
// Card purchases are positive; account payments negative. Rows already detailed by a receipt are skipped.
export function findMatches(txs, { total, date }, maxDays = 4) {
  return (txs || [])
    .filter(t => !t.receipt && t.date && Math.abs(Math.abs(+t.amount) - total) <= 0.05 && (t.source === 'cartao' ? +t.amount > 0 : +t.amount < 0) && Math.abs(days(t.date, date)) <= maxDays)
    .map(t => ({ t, dd: Math.abs(days(t.date, date)) }))
    .sort((a, b) => a.dd - b.dd || (a.t.manual ? 1 : 0) - (b.t.manual ? 1 : 0))
    .map(x => x.t)
    .slice(0, 5);
}
