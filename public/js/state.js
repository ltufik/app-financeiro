// App state and derived values shared by the views.
import { catIndex, monthCalc, sumCalcs, schedule, project, needPmt } from './lib/calc.js';
import { prepareRules } from './lib/categorize.js';
import { addM, diffM, thisMonth } from './lib/format.js';

export const S = {
  user: null, hh: null, role: null, members: [],
  categories: [], catIdx: new Map(), rules: [], prepared: null,
  txs: [], imports: [], studies: [],
  m: null, tab: 'resumo', render: () => {},
};

export function setFamily(f) {
  if (f.household) S.hh = f.household;
  S.members = f.members; S.categories = f.categories; S.rules = f.rules;
  S.txs = f.transactions.map(t => ({ ...t, amount: +t.amount })); S.imports = f.imports; S.studies = f.studies;
  reindex();
}
export function reindex() { S.catIdx = catIndex(S.categories); S.prepared = prepareRules(S.rules); }

export const settings = () => S.hh?.settings || {};
export const goals = () => ({ cardMonthly: 0, savings: 0.2, savingsNoFin: 0.3, patrimonio: 0, ret: 0.05, ...(settings().goals || {}) });
export const closeDay = () => +settings().cardCloseDay || 24;
export const hasFinancing = () => S.categories.some(c => c.financing);

export const txsOf = m => S.txs.filter(t => t.month === m);
export const monthKeys = () => [...new Set(S.txs.map(t => t.month))].sort();
// A month is "closed" for an account when its statement was imported (not only manual entries).
export const closedKeys = src => [...new Set(S.txs.filter(t => !t.manual && (!src || t.source === src)).map(t => t.month))].sort();
export const latestClosed = () => closedKeys('conta').pop() || closedKeys().pop() || null;
export const latestCard = () => closedKeys('cartao').pop() || null;
export const calcMonth = m => monthCalc(txsOf(m), S.catIdx);
export const calcMonths = ms => sumCalcs(ms.map(calcMonth));
export const manualOf = m => S.txs.filter(t => t.manual && t.month === m);
export const pendingManual = () => {
  const closed = { conta: new Set(closedKeys('conta')), cartao: new Set(closedKeys('cartao')) };
  return S.txs.filter(t => t.manual && !closed[t.source].has(t.month));
};
export const recurringSum = () => (settings().recurring || []).reduce((a, r) => a + (+r[1] || 0), 0);

export function nextFatura() {
  const L = latestCard(); if (!L) return null;
  const open = addM(L, 1), sch = schedule(txsOf(L).filter(t => t.source === 'cartao'), 12);
  const man = manualOf(open).filter(t => t.source === 'cartao').reduce((a, t) => a + t.amount, 0);
  return { month: open, parcelas: sch[0], recorrentes: recurringSum(), manuais: man, total: sch[0] + recurringSum() + man, schedule: sch, from: L };
}

// Projection inputs from the family's settings, counted from the latest closed month.
export function projOpts(pmt, ext, extra = {}) {
  const st = settings(), g = goals(), L = latestClosed() || thisMonth();
  const years = g.ageGoal && g.ageNow ? g.ageGoal - g.ageNow : (g.years || 10);
  const receivables = (st.receivables || []).map(r => ({ monthly: +r.monthly || 0, left: r.n == null ? null : Math.max(0, +r.n - (r.start ? diffM(r.start, L) + 1 : 0)) }));
  const redemptions = (st.redemptions || []).map(r => ({ value: +r.value || 0, at: diffM(L, r.month) })).filter(r => r.at > 0);
  return { start: +st.invest?.total || 0, pmt, ext, ret: g.ret ?? 0.05, years, receivables, redemptions, ...extra };
}
export const projectFor = (pmt, ext, extra) => project(projOpts(pmt, ext, extra));
export const needPmtFor = (ext, goal, extra) => needPmt(projOpts(0, ext, extra), goal);

export function patrimonio() {
  const st = settings(), o = projOpts(0, 0);
  const rows = [];
  if (st.invest?.total) rows.push({ name: 'Investimentos', value: +st.invest.total, note: st.invest.date ? 'em ' + st.invest.date.split('-').reverse().join('/') : '' });
  for (const a of st.assets || []) rows.push({ name: a.name, value: (+a.value || 0) - (+a.debt || 0), note: +a.debt ? `vale R$ ${Math.round(a.value).toLocaleString('pt-BR')}, faltam R$ ${Math.round(a.debt).toLocaleString('pt-BR')}` : 'quitado' });
  (st.receivables || []).forEach((r, i) => { const left = o.receivables[i].left; if (left) rows.push({ name: 'A receber: ' + r.name, value: left * r.monthly, note: left + ' parcelas' }); });
  return { total: rows.reduce((a, r) => a + r.value, 0), rows };
}

export function presets() {
  const st = settings();
  if (st.presets && st.presets.length) return st.presets;
  const ks = closedKeys('conta').slice(-3);
  const avg = ks.length ? Math.max(0, Math.round(calcMonths(ks).res / ks.length / 100) * 100) : 0;
  return [['Ritmo atual', avg, 0], ['+ R$ 1.000 por mês', avg + 1000, 0], ['+ R$ 2.000 por mês', avg + 2000, 0]];
}
