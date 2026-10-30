// Guided month closing: what is still missing for a month, and its retrospective.
// Pure functions, tested in tests/lib.test.mjs.
import { monthCalc, byCategory, expandSplits } from './calc.js';
import { addM } from './format.js';

const isPending = t => t.pending || !t.category || t.category === 'A classificar';

// Month the family should close now: the latest month before the current one that has data and isn't closed.
export function monthToClose(months, closed, today) {
  const cur = today.slice(0, 7);
  return [...months].filter(k => k < cur && !closed[k]).sort().pop() || null;
}

// Everything that's still open for month m.
// txs: all transactions; idx: category index; closed: settings.closed; skipped: {cartao|conta: true} sources the family doesn't use.
export function checklist({ month: m, txs, idx, skip = {} }) {
  const of = k => txs.filter(t => t.month === k);
  const mine = of(m);
  const has = src => mine.some(t => t.source === src && !t.manual);
  const data = [
    { key: 'conta', done: has('conta') || !!skip.conta, label: 'Extrato da conta' },
    { key: 'cartao', done: has('cartao') || !!skip.cartao, label: 'Fatura do cartão' },
  ];
  // Manual entries still waiting for the statement of the same source.
  const manual = mine.filter(t => t.manual && !has(t.source));
  const pending = mine.filter(isPending);
  // Fixed (recurring) expenses seen in at least 2 of the 3 previous months but not in m.
  const prev = [1, 2, 3].map(n => addM(m, -n));
  const fixedIn = k => { const s = {}; for (const t of expandSplits(of(k))) { const c = idx.get(t.category); if (c && c.grp === 'dia' && c.recurring) s[t.category] = (s[t.category] || 0) + (t.source === 'conta' ? -t.amount : +t.amount); } return s; };
  const now = fixedIn(m), seen = {};
  prev.forEach(k => { const f = fixedIn(k); for (const c in f) if (f[c] > 0) (seen[c] ||= []).push(f[c]); });
  const missing = Object.entries(seen).filter(([c, v]) => v.length >= 2 && !(now[c] > 0))
    .map(([category, v]) => ({ category, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 100) / 100 }))
    .sort((a, b) => b.avg - a.avg);
  return { data, manual, pending, missing, ready: data.every(d => d.done) && !pending.length };
}

// Retrospective of month m against the previous months.
export function retrospective({ month: m, txs, idx, goals = {} }) {
  const of = k => txs.filter(t => t.month === k);
  const c = monthCalc(of(m), idx);
  const before = [...new Set(txs.map(t => t.month))].filter(k => k < m).sort().slice(-3);
  const avgOut = before.length ? before.reduce((a, k) => a + monthCalc(of(k), idx).out, 0) / before.length : null;
  const cats = Object.entries(byCategory(of(m), idx)).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const total = cats.reduce((a, e) => a + e[1], 0) || 1;
  return {
    res: c.res, tx: c.tx, renda: c.renda, receitas: c.E, despesas: c.out, extras: c.EX - c.DX,
    meta: goals.savings || 0, hitGoal: !!goals.savings && c.tx >= goals.savings,
    vsAvg: avgOut == null ? null : c.out - avgOut,
    top: cats.slice(0, 5).map(([name, v]) => ({ name, value: Math.round(v * 100) / 100, share: v / total })),
  };
}
