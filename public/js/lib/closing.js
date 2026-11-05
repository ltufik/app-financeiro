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

// Year retrospective: the months of the year with the account statement (complete), what came in, went out and
// stayed; the best and the hardest month; where most of the money went; the biggest expense; what the bank charged.
// fees: feesOf() of the year's rows (lib/bankfees.js). Only complete months count, so the numbers match the months.
export function yearRetro({ year, txs, idx, goals = {}, fees = null, closed = {} }) {
  const of = k => txs.filter(t => t.month === k);
  const months = [...new Set(txs.filter(t => t.month.startsWith(year + '-') && t.source === 'conta' && !t.manual).map(t => t.month))].sort();
  const per = months.map(k => ({ month: k, ...monthCalc(of(k), idx) }));
  const sum = f => Math.round(per.reduce((a, c) => a + (+f(c) || 0), 0) * 100) / 100;
  const renda = sum(c => c.renda), receitas = sum(c => c.E), despesas = sum(c => c.out), res = sum(c => c.res);
  const cats = {}; for (const k of months) for (const [n, v] of Object.entries(byCategory(of(k), idx))) cats[n] = (cats[n] || 0) + v;
  const top = Object.entries(cats).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]), tot = top.reduce((a, e) => a + e[1], 0) || 1;
  const byRes = [...per].sort((a, b) => b.res - a.res);
  // Biggest single day-to-day expense (not extras, not transfers): what the family will remember.
  let big = null;
  for (const k of months) for (const t of expandSplits(of(k))) { const c = idx.get(t.category); if (!c || c.grp !== 'dia' || c.recurring || c.financing) continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v > 0 && (!big || v > big.value)) big = { description: t.description, value: Math.round(v * 100) / 100, month: k, category: t.category }; }
  return {
    year, months, n: months.length, renda, receitas, despesas, res, tx: renda > 0 ? res / renda : 0, meta: goals.savings || 0,
    hitGoal: !!goals.savings && renda > 0 && res / renda >= goals.savings, good: per.filter(c => goals.savings ? c.tx >= goals.savings : c.res > 0).length,
    positive: per.filter(c => c.res > 0).length, per: per.map(c => ({ month: c.month, res: c.res, tx: c.tx })),
    best: byRes[0] ? { month: byRes[0].month, res: byRes[0].res } : null, worst: byRes.length > 1 ? { month: byRes[byRes.length - 1].month, res: byRes[byRes.length - 1].res } : null,
    top: top.slice(0, 5).map(([name, v]) => ({ name, value: Math.round(v * 100) / 100, share: v / tot })), big,
    fees: fees ? fees.total : 0, closedCount: months.filter(k => closed[k]).length, count: months.reduce((a, k) => a + of(k).length, 0),
  };
}

// The family's level in the year, by percentage (fair for any income): gold = their own goal and in the blue
// at least 3 of every 4 months; silver = 10% of income or more; bronze = the year in the blue.
export const LEVELS = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze', inicio: 'Ponto de partida' };
export function yearLevel(r) {
  const steady = r.n ? r.positive / r.n >= 0.75 : false, meta = r.meta || 0.2;
  const level = r.res > 0 && r.tx >= meta && steady ? 'ouro' : r.tx >= 0.10 ? 'prata' : r.res > 0 ? 'bronze' : 'inicio';
  // What is missing for the next level, in percentage points of income (and the steady months for gold).
  const next = level === 'ouro' ? null : level === 'prata' ? { level: 'ouro', points: Math.max(0, meta - r.tx), steady } : level === 'bronze' ? { level: 'prata', points: 0.10 - r.tx } : { level: 'bronze', points: null };
  return { level, label: LEVELS[level], next };
}

// Up to 3 milestones of the year, from what the data shows: an extra payment on a financing, starting or growing
// investments, getting out of the red, a big one-off purchase, the longest streak in the blue.
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mN = k => MES[+k.slice(5) - 1];
const R0 = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');
const INVEST = /invest|aplica|poupan|previd|tesouro|\bcdb\b|a[cç][oõ]es/i;
export function yearMilestones({ year, per, txs, idx, debts = [] }) {
  const out = [], inYear = t => String(t.date || t.month || '').startsWith(year + '-');
  // Extra payments on financings.
  for (const d of debts) { const v = (d.log || []).filter(e => e.kind === 'amortizacao' && String(e.date).startsWith(year + '-')).reduce((a, e) => a + (+e.value || 0), 0); if (v > 0) out.push({ id: 'amortizou', icon: '🏠', title: `Amortizaram ${R0(v)}`, text: `do ${d.name}. A dívida ficou menor e o patrimônio, maior.` }); }
  // Money put into investments (account outflows to an investment category).
  // Only categories that are investments alone (not "transfers between own accounts", which mix both).
  const inv = txs.filter(t => t.source === 'conta' && +t.amount < 0 && INVEST.test(t.category || '') && !/conta|transfer/i.test(t.category || '') && idx.get(t.category)?.grp === 'neutro');
  const invYear = inv.filter(inYear), hadBefore = txs.some(t => String(t.month) < year + '-01'), invBefore = inv.some(t => String(t.month) < year + '-01');
  if (invYear.length) { const v = -invYear.reduce((a, t) => a + +t.amount, 0), first = invYear.map(t => t.month).sort()[0]; out.push({ id: 'investiu', icon: '📈', title: hadBefore && !invBefore ? `Começaram a investir em ${mN(first)}` : `Investiram ${R0(v)}`, text: hadBefore && !invBefore ? `e puseram ${R0(v)} em aplicações até agora.` : 'em aplicações durante o ano.' }); }
  // Out of the red: a month in the blue right after one in the red.
  for (let i = 1; i < per.length; i++) if (per[i - 1].res < 0 && per[i].res > 0) { out.push({ id: 'saiu_vermelho', icon: '💪', title: `Em ${mN(per[i].month)}, saíram do vermelho`, text: `${mN(per[i - 1].month)[0].toUpperCase() + mN(per[i - 1].month).slice(1)} tinha fechado em −${R0(per[i - 1].res)}; ${mN(per[i].month)} fechou com ${R0(per[i].res)} de sobra.` }); break; }
  // A big one-off purchase (extra expense).
  let big = null; for (const t of txs.filter(inYear)) { const c = idx.get(t.category); if (c?.grp !== 'fora') continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v >= 3000 && (!big || v > big.v)) big = { v, t }; }
  if (big) out.push({ id: 'compra', icon: '🎯', title: `O grande gasto do ano: ${R0(big.v)}`, text: `${big.t.category} em ${mN(big.t.month)} (${big.t.description}), fora das contas do dia a dia.` });
  // Longest streak in the blue (3 months or more).
  let best = [0, 0], cur = 0; per.forEach((c, i) => { cur = c.res > 0 ? cur + 1 : 0; if (cur > best[0]) best = [cur, i]; });
  if (best[0] >= 3) out.push({ id: 'sequencia', icon: '🔥', title: `${best[0]} meses seguidos no azul`, text: `de ${mN(per[best[1] - best[0] + 1].month)} a ${mN(per[best[1]].month)}.` });
  return out.slice(0, 3);
}
