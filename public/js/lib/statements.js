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

// The same entry: same value and, when both have a day, the same day (a Pix to the same person on another day is
// another entry); without a day, the same description.
const same = (a, b) => Math.abs((+a.amount || 0) - (+b.amount || 0)) < 0.01 && (a.day && b.day ? a.day === b.day : norm(a.description) === norm(b.description));
// One-to-one matching (two identical Pix on the same day count twice): which new rows are already there.
function matchRows(rows, pool) {
  const used = new Set(), fresh = [];
  rows.forEach((r, i) => { const j = pool.findIndex((t, k) => !used.has(k) && same(r, t)); if (j < 0) fresh.push(i); else used.add(j); });
  return { hit: rows.length - fresh.length, fresh };
}
// The same document sent again only when the rows match in both directions (almost everything of the new one is
// there AND almost everything there is in the new one). A statement split in two files, or a bill sent in parts,
// shares the account but not the rows: it goes in together, only with what is new.
const SAME_SHARE = 0.8;

// existing: the month's imported rows of that source (not the ones typed by hand).
// Returns { mode: 'new' | 'replace' | 'alongside' | 'complement', cards: keys to replace, unknown: replace rows with no key,
//           others: keys of other documents kept, overlap: share of the new rows already there,
//           fresh: indexes of the new rows to save (complement), dup: how many were already there }.
export function compareStatement({ keys = [], rows = [], existing = [] }) {
  const all = rows.map((_, i) => i);
  if (!existing.length) return { mode: 'new', cards: [], unknown: false, others: [], overlap: 0, fresh: all, dup: 0 };
  const known = new Set(existing.filter(t => t.card).map(t => String(t.card))), noKey = existing.filter(t => !t.card);
  const sameKeys = keys.filter(k => known.has(k)), others = [...known].filter(k => !keys.includes(k));
  const judge = pool => { const m = matchRows(rows, pool), ovNew = rows.length ? m.hit / rows.length : 0, ovOld = pool.length ? m.hit / pool.length : 0; return { ...m, ovNew, same: ovNew >= SAME_SHARE && ovOld >= SAME_SHARE }; };
  // The document names its card or account and that one is already in the month.
  if (sameKeys.length) {
    const j = judge(existing.filter(t => t.card && sameKeys.includes(String(t.card))));
    if (j.same) { const u = noKey.length ? judge(noKey) : null; return { mode: 'replace', cards: sameKeys, unknown: !!u?.same, others, overlap: j.ovNew, fresh: all, dup: 0 }; }
    return { mode: 'complement', cards: [], unknown: false, others, overlap: j.ovNew, fresh: j.fresh, dup: j.hit, keys: sameKeys };
  }
  // Rows saved without a card or account (older imports or a backup): decided only by the rows.
  const pool = noKey.length ? noKey : (keys.length ? [] : existing);
  if (pool.length) {
    const j = judge(pool);
    if (j.same) return { mode: 'replace', cards: keys.length ? [] : [...known], unknown: true, others: keys.length ? others : [], overlap: j.ovNew, fresh: all, dup: 0 };
    if (j.hit) return { mode: 'complement', cards: [], unknown: false, others: keys.length ? others : [...known], overlap: j.ovNew, fresh: j.fresh, dup: j.hit, keys: [''] };
  }
  return { mode: 'alongside', cards: [], unknown: false, others: noKey.length ? [...others, ''] : others, overlap: 0, fresh: all, dup: 0 };
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
