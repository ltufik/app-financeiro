// Entries typed by hand (or from a receipt) that the bank statement or the card bill brought again: the app finds
// the pairs, so the same pix never counts twice, and keeps what the person added (category, note, the link to a
// financing payoff). Pure, tested in tests/lib.test.mjs.
const DAYS = 5;
const dayDiff = (a, b) => Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 864e5));
const same = (a, b) => Math.abs(Math.abs(+a) - Math.abs(+b)) < 0.01 && Math.sign(+a || 1) === Math.sign(+b || 1);
const near = (a, b, days = DAYS) => !a || !b || dayDiff(a, b) <= days;
// A row of a bill or statement has the date, or only the day ("05/11") with the month it was saved to.
export const rowDate = (r, month) => r.date || (/^\d{2}\/\d{2}$/.test(r.day || '') && month ? `${month.slice(0, 4)}-${r.day.slice(3)}-${r.day.slice(0, 2)}` : null);

// At import: which typed entries the document already has. manuals: the family's typed entries of that source;
// rows: the document's rows; month: where it is being saved. -> Map(manual id -> row index); one row per entry.
export function matchManuals(manuals = [], rows = [], month) {
  const used = new Set(), out = new Map();
  const dates = rows.map(r => rowDate(r, month)).filter(Boolean).sort(), lo = dates[0], hi = dates[dates.length - 1];
  const inSpan = m => m.month === month || (m.date && lo && hi && m.date >= shift(lo, -DAYS) && m.date <= shift(hi, DAYS));
  for (const m of [...manuals].filter(inSpan).sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    let best = -1, bestD = 1e9;
    rows.forEach((r, i) => { if (used.has(i) || !same(r.amount, m.amount)) return; const d = rowDate(r, month), dd = d && m.date ? dayDiff(d, m.date) : DAYS; if (dd <= DAYS && dd < bestD) { best = i; bestD = dd; } });
    if (best >= 0) { used.add(best); out.set(m.id, best); }
  }
  return out;
}
const shift = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/*
  Repeated entries already saved (a typed entry and the bank's, any month, same source, same amount, dates up to 5
  days apart), and financing payoffs whose typed entry was replaced by the statement's (the link points to an entry
  that no longer exists). skip: pairs the person said are not repeated ("manualId|bankId").
  Also the same statement saved under two accounts (pairs with copy: true, see below).
  -> { pairs: [{ manual, bank, copy? }], orphans: [{ debt, entry, bank }] }
*/
export function findDups(txs = [], debts = [], skip = []) {
  const no = new Set(skip || []), used = new Set(), pairs = [];
  const bank = txs.filter(t => !t.manual && !t.virtual), ids = new Set(txs.map(t => t.id));
  const linked = new Set(debts.flatMap(d => (d.log || []).map(e => e.txId).filter(Boolean)));
  for (const m of txs.filter(t => t.manual && !(t.splits || []).length).sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    const c = bank.filter(b => !used.has(b.id) && b.source === m.source && same(b.amount, m.amount) && !no.has(`${m.id}|${b.id}`) && !linked.has(b.id)
      && (m.date && b.date ? near(m.date, b.date) : b.month === m.month)).sort((x, y) => dayDiff(x.date || m.date, m.date) - dayDiff(y.date || m.date, m.date))[0];
    if (c) { used.add(c.id); pairs.push({ manual: m, bank: c }); }
  }
  // The same statement saved under two accounts (an updated statement read with the wrong bank): the same entry
  // (day, value, description) in two accounts of the month. The account with more entries that month is the right
  // one; the other's entry is the copy (pair.copy = true; "manual" is the copy, "bank" the one that stays).
  const rowsOf = new Map(), sig = t => [t.month, t.date || '', (+t.amount).toFixed(2), norm(t.description)].join('|');
  const imp = bank.filter(t => t.source === 'conta' && String(t.card || '').startsWith('@') && !used.has(t.id));
  for (const t of imp) rowsOf.set(t.month + t.card, (rowsOf.get(t.month + t.card) || 0) + 1);
  const groups = new Map(); for (const t of imp) { const k = sig(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  for (const g of groups.values()) {
    const cards = [...new Set(g.map(t => t.card))]; if (cards.length < 2) continue;
    const keepCard = cards.sort((a, b) => (rowsOf.get(g[0].month + b) || 0) - (rowsOf.get(g[0].month + a) || 0) || a.localeCompare(b))[0];
    const keepers = g.filter(t => t.card === keepCard), copies = g.filter(t => t.card !== keepCard);
    copies.forEach((c, i) => { const k = keepers[i % keepers.length]; if (!k || used.has(c.id) || no.has(`${c.id}|${k.id}`)) return; used.add(c.id); pairs.push({ manual: c, bank: k, copy: true }); });
  }
  const orphans = [];
  for (const d of debts) for (const e of d.log || []) {
    if (!e.txId || ids.has(e.txId) || e.kind !== 'amortizacao') continue;
    const b = bank.find(t => !used.has(t.id) && !linked.has(t.id) && t.source === 'conta' && +t.amount < 0 && Math.abs(Math.abs(+t.amount) - Math.abs(+e.value)) < 0.01 && near(t.date, e.date, 10));
    if (b) { used.add(b.id); orphans.push({ debt: d, entry: e, bank: b }); }
  }
  return { pairs, orphans };
}

// What the bank's entry keeps from the typed one: its category (when chosen) and what the person wrote.
export function mergeInto(manual, bank) {
  const set = {};
  if (manual.category && manual.category !== 'A classificar') { set.category = manual.category; set.pending = false; }
  const said = [bank.note, manual.note, norm(manual.description) !== norm(bank.description) ? manual.description : ''].map(s => String(s || '').trim()).filter(Boolean);
  const note = [...new Set(said)].join(' · ').slice(0, 200); if (note && note !== (bank.note || '')) set.note = note;
  return set;
}
const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
