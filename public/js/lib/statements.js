// Several card bills (or bank statements) in the same month: before asking anything, find out whether the
// new document is the SAME one sent again (replace it) or ANOTHER card/account (add it alongside).
// Pure module, tested in tests/lib.test.mjs.
import { norm } from './format.js';

// Which card or account a document belongs to: card finals for a bill, "@bank" for a bank statement.
export function docKeys(source, rows, { bank = '', checks = [] } = {}) {
  if (source === 'cartao') {
    const ks = new Set();
    for (const r of rows || []) if (r.card) ks.add(String(r.card).trim());
    for (const c of checks || []) if (c.card && c.card !== 'total') ks.add(String(c.card).trim());
    return [...ks].filter(Boolean);
  }
  const b = norm(bank || '').toLowerCase().replace(/\s+/g, '');
  return b ? ['@' + b] : [];
}

const same = (a, b) => Math.abs((+a.amount || 0) - (+b.amount || 0)) < 0.01 && (norm(a.description) === norm(b.description) || (a.day && a.day === b.day));

// existing: the month's imported rows of that source (not the ones typed by hand).
// Returns { mode: 'new' | 'replace' | 'alongside', cards: keys to replace, unknown: replace rows with no key,
//           others: keys of other documents kept, overlap: share of the new rows already there }.
export function compareStatement({ keys = [], rows = [], existing = [] }) {
  if (!existing.length) return { mode: 'new', cards: [], unknown: false, others: [], overlap: 0 };
  const known = new Set(existing.filter(t => t.card).map(t => String(t.card))), noKey = existing.filter(t => !t.card);
  const sameKeys = keys.filter(k => known.has(k));
  // Rows saved without a key (older imports or a backup): the same document if most of the new rows are there.
  const pool = keys.length ? noKey : existing;
  const hit = rows.filter(r => pool.some(t => same(r, t))).length, overlap = rows.length ? hit / rows.length : 0;
  const unknownIsSame = pool.length > 0 && overlap >= 0.5;
  if (!keys.length) {
    // The document does not say which card or account: decide only by the rows.
    return unknownIsSame ? { mode: 'replace', cards: [...known], unknown: true, others: [], overlap } : { mode: 'alongside', cards: [], unknown: false, others: [...known], overlap };
  }
  const others = [...known].filter(k => !keys.includes(k));
  if (sameKeys.length || (unknownIsSame && noKey.length)) return { mode: 'replace', cards: sameKeys, unknown: unknownIsSame, others, overlap };
  return { mode: 'alongside', cards: [], unknown: false, others: noKey.length ? [...others, ''] : others, overlap };
}

// How a card or account is called on screen.
export function keyLabel(source, k) {
  if (!k) return source === 'cartao' ? 'a fatura enviada antes' : 'o extrato enviado antes';
  return k.startsWith('@') ? 'a conta ' + k.charAt(1).toUpperCase() + k.slice(2) : 'o cartão final ' + k;
}

// "a fatura dos cartões finais 4388, 0947 e 0080", "o extrato da conta Nubank", "uma fatura enviada antes".
const andList = xs => xs.length > 1 ? xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1] : xs[0] || '';
export function docsText(source, keys) {
  const cards = keys.filter(k => k && !k.startsWith('@')), accts = keys.filter(k => k && k.startsWith('@')).map(k => k.charAt(1).toUpperCase() + k.slice(2)), parts = [];
  if (cards.length) parts.push(`a fatura ${cards.length > 1 ? 'dos cartões finais' : 'do cartão final'} ${andList(cards)}`);
  if (accts.length) parts.push(`o extrato ${accts.length > 1 ? 'das contas' : 'da conta'} ${andList(accts)}`);
  if (keys.includes('')) parts.push(source === 'cartao' ? 'uma fatura enviada antes' : 'um extrato enviado antes');
  return andList(parts);
}

// The short tag on each entry: "cartão 4388" for a card, "conta Santander" for a bank account (@santander).
export const shortTag = k => !k ? '' : String(k).startsWith('@') ? 'conta ' + String(k).charAt(1).toUpperCase() + String(k).slice(2) : 'cartão ' + k;
