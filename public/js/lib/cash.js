// Withdrawals and cash ("Saques e dinheiro vivo"): money taken out of the account disappears from the control unless
// the person says what it paid for. Finds the withdrawals, reads "200 feira, 100 uber" and splits the withdrawal by
// category (the transaction's splits, like a receipt). Pure, tested in tests/lib.test.mjs.
const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// "SAQUE 24H", "SAQUE BANCO24HORAS", "SAQ ATM", "RETIRADA CAIXA", "PIX SAQUE"... never the fee for the withdrawal.
const CASH = /\b(saques?|saq|retirada|caixa eletronico|banco ?24 ?h?(oras)?|24 ?horas|atm|tecban|pix saque|saque pix)\b/;
export const isCashWithdrawal = t => t && t.source === 'conta' && +t.amount < 0 && CASH.test(plain(`${t.description} ${t.note || ''}`)) && !/tarifa|taxa|iof/.test(plain(t.description));

// The withdrawals still to explain: the last 70 days, at least R$ 20, not split yet and not "não lembro".
export function pendingCash(txs = [], { today, skip = [] } = {}) {
  const from = new Date(Date.parse(today + 'T12:00:00Z') - 70 * 864e5).toISOString().slice(0, 10), no = new Set(skip);
  return txs.filter(t => isCashWithdrawal(t) && Math.abs(+t.amount) >= 20 && !(t.splits || []).length && !no.has(t.id) && (t.date || `${t.month}-28`) >= from)
    .sort((a, b) => ((a.date || a.month) < (b.date || b.month) ? 1 : -1));
}

// Everyday words -> what to look for in the family's categories (the first one that exists wins).
const HINTS = [
  [/feira|mercad|hortifrut|padaria|acougue|sacolao|quitanda/, ['mercado', 'supermercado', 'alimentacao', 'feira']],
  [/uber|taxi|onibus|metro|99|corrida|passagem|gasolina|combust|estacionamento|pedagio/, ['transporte', 'combustivel', 'carro', 'mobilidade']],
  [/almoc|jantar|lanche|restaurant|bar\b|pizza|cafe|sorvete|delivery|ifood/, ['restaurante', 'alimentacao fora', 'lazer', 'delivery']],
  [/farmac|remedio|medic|consulta|dentista/, ['saude', 'farmacia']],
  [/presente|aniversar/, ['presente']],
  [/diarista|faxina|empregada|babá|baba|jardineiro/, ['casa', 'servicos', 'moradia', 'diarista']],
  [/cabelo|cabeleir|manicure|salao|barbe|estetica/, ['beleza', 'cuidados pessoais']],
  [/escola|material|livro|curso/, ['educacao', 'escola']],
  [/igreja|dizimo|oferta|doacao|esmola/, ['doacao', 'igreja']],
  [/cinema|show|passeio|parque|festa|viagem/, ['lazer', 'viagem']],
  [/roupa|sapato|tenis|loja/, ['roupa', 'vestuario', 'compras']],
];
export function categoryFor(label, categories = []) {
  const p = plain(label), names = categories.filter(c => c.name !== 'A classificar').map(c => ({ c, n: plain(c.name) }));
  if (!p) return null;
  const exact = names.find(x => x.n === p) || names.find(x => p.length >= 4 && (x.n.includes(p) || p.includes(x.n)));
  if (exact) return exact.c.name;
  for (const [re, keys] of HINTS) if (re.test(p)) { for (const k of keys) { const f = names.find(x => x.n.includes(k)); if (f) return f.c.name; } }
  return null;
}

// "200 feira, 100 uber e 50 presente" / "feira 200 + uber 100" / "R$ 80,50 na farmácia" -> [{ amount, label, category }].
export function parseCashText(text, categories = []) {
  const parts = String(text || '').split(/,(?!\d)|;|\+|\be\b|\n/i).map(s => s.trim()).filter(Boolean), out = [];
  for (const s of parts) {
    const m = s.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i); if (!m) continue;
    const n = m[1].includes(',') ? +m[1].replace(/\./g, '').replace(',', '.') : +m[1]; if (!(n > 0)) continue;
    const label = s.replace(m[0], '').replace(/\b(reais?|no|na|nos|nas|de|do|da|com|em|pra|para|o|a|r\$)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    out.push({ amount: Math.round(n * 100) / 100, label: label || 'outros', category: categoryFor(label, categories) || 'A classificar' });
  }
  return out;
}

// The splits saved on the withdrawal: what was said, and the rest stays as the withdrawal (its category).
// Returns null when what was said is more than the withdrawal.
export function cashSplits(total, parts = [], restCategory = 'A classificar') {
  const t = Math.abs(+total), said = Math.round(parts.reduce((a, p) => a + p.amount, 0) * 100) / 100;
  if (said - t > 0.009 || !parts.length) return null;
  const by = {}; for (const p of parts) by[p.category] = Math.round(((by[p.category] || 0) + p.amount) * 100) / 100;
  const rest = Math.round((t - said) * 100) / 100;
  if (rest > 0) by[restCategory] = Math.round(((by[restCategory] || 0) + rest) * 100) / 100;
  return Object.entries(by).map(([category, amount]) => ({ category, amount }));
}
