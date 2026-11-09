// App state and derived values shared by the views.
import { catIndex, monthCalc, sumCalcs, schedule, project, needPmt } from './lib/calc.js';
import { prepareRules } from './lib/categorize.js';
import { paceScenarios } from './lib/goalplan.js';
import { addM, diffM, thisMonth, todayISO } from './lib/format.js';
import { virtualRows } from './lib/privacy.js';
import { debtNow, debtOfAsset, investNow, pendingAmortizations } from './lib/debt.js';

export const S = {
  user: null, hh: null, role: null, members: [],
  categories: [], catIdx: new Map(), rules: [], prepared: null,
  txs: [], imports: [], studies: [],
  m: null, tab: 'resumo', render: () => {},
};

export function setFamily(f) {
  if (f.household) S.hh = f.household;
  S.members = f.members; S.categories = f.categories; S.rules = f.rules;
  S.txs = withPrivate(f.transactions, f.privateTotals); S.imports = f.imports; S.studies = f.studies;
  reindex();
}
// The family's entries plus, in place of what is private to someone else, one read-only total per month and group.
export const withPrivate = (txs, totals) => [...txs.map(t => ({ ...t, amount: +t.amount })), ...virtualRows(totals || [], S.members)];
export const isMine = t => !!t.private_to && t.private_to === S.user?.id;
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
  return { start: investNow(st.invest, g.ret ?? 0.05, todayISO()).value, pmt, ext, ret: g.ret ?? 0.05, years, receivables, redemptions, ...extra };
}
export const projectFor = (pmt, ext, extra) => project(projOpts(pmt, ext, extra));
export const needPmtFor = (ext, goal, extra) => needPmt(projOpts(0, ext, extra), goal);

// Financings with today's balance: installments taken off by estimate, extra payments the family confirmed.
export const debtsNow = () => (settings().debts || []).map(d => ({ ...d, now: debtNow(d, todayISO()) }));
// Big payments that look like paying a financing and still wait for "isso abate o financiamento?".
export const pendingDebtPayments = () => pendingAmortizations(S.txs, settings().debts || [], settings().debtSkip);

const R0 = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR'), D = d => d.split('-').reverse().join('/');
export function patrimonio() {
  const st = settings(), o = projOpts(0, 0), ds = debtsNow(), used = new Set();
  const rows = [];
  if (st.invest?.total) { const iv = investNow(st.invest, goals().ret ?? 0.05, todayISO()); rows.push({ name: 'Investimentos', value: iv.value, note: iv.estimated ? `${R0(st.invest.total)} no extrato de ${D(st.invest.date)}; hoje, estimado. Mande o extrato novo para o valor real` : st.invest.date ? 'em ' + D(st.invest.date) : '' }); }
  for (const a of st.assets || []) {
    const d = debtOfAsset(a, ds); if (d) used.add(d.id);
    const owe = d ? d.now.saldo : +a.debt || 0;
    rows.push({ name: a.name, value: (+a.value || 0) - owe, note: owe ? `vale ${R0(+a.value || 0)}, faltam ${R0(owe)}${d?.now.months ? ' (estimado)' : ''}` : 'quitado', debtId: d?.id });
  }
  for (const d of ds) if (!used.has(d.id) && d.now.saldo > 0) rows.push({ name: d.name, value: -d.now.saldo, note: `faltam ${R0(d.now.saldo)}${d.now.months ? ' (estimado)' : ''}`, debtId: d.id });
  (st.receivables || []).forEach((r, i) => { const left = o.receivables[i].left; if (left) rows.push({ name: 'A receber de ' + r.name, value: left * r.monthly, note: left + ' parcelas' }); });
  return { total: rows.reduce((a, r) => a + r.value, 0), rows };
}

// Scenarios for the dream: the real average of the last complete months (with the bank statement, before this
// month), the family's own plan (Metas) and the scenarios saved before. [name, monthly, yearly, note, saved].
export function presets() {
  const rows = closedKeys('conta').filter(k => k < thisMonth()).map(k => ({ month: k, res: calcMonth(k).res }));
  return paceScenarios({ rows, goals: goals(), saved: settings().presets }).map(x => [x.name, x.monthly, x.yearly, x.note, !!x.saved]);
}
