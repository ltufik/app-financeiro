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
export function yearLevel(r, habit = null) {
  const steady = r.n ? r.positive / r.n >= 0.75 : false, meta = r.meta || 0.2, kept = !habit || !habit.counts || habit.ok;
  const level = r.res > 0 && r.tx >= meta && steady && kept ? 'ouro' : r.tx >= 0.10 ? 'prata' : r.res > 0 ? 'bronze' : 'inicio';
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

// Where the family can do better, from the year's own numbers (up to 3, the most useful first):
// months in the red, the gap to the goal, a category that grew from the first to the second half, the bank's charges.
export function yearOpportunities({ r, txs, idx }) {
  const out = [], of = k => txs.filter(t => t.month === k), meta = r.meta || 0.2;
  const red = (r.per || []).filter(c => c.res < 0);
  if (red.length) out.push({ id: 'vermelho', icon: '🧭', title: `${red.length} ${red.length > 1 ? 'meses' : 'mês'} no vermelho`, text: `${(s => s[0].toUpperCase() + s.slice(1))(red.map(c => MES[+c.month.slice(5) - 1]).join(', '))}. Combinar um limite por categoria (menu ☰ → Família e metas → Metas) avisa antes de passar.` });
  if (r.renda > 0 && r.tx < meta && r.n) { const gap = (meta * r.renda - r.res) / r.n; out.push({ id: 'meta', icon: '🎯', title: `Para a meta de ${Math.round(meta * 100)}%, faltaram ${R0(gap)} por mês`, text: 'É quanto precisaria sobrar a mais em cada mês. Cortar um pouco das duas categorias que mais pesam costuma bastar.' }); }
  // A day-to-day category (not fixed) that grew from the first to the second half of the year.
  if (r.n >= 4) {
    const h = Math.floor(r.n / 2), a = r.months.slice(0, h), b = r.months.slice(h), avg = (ks, n) => ks.reduce((s, k) => s + (byCategory(of(k), idx)[n] || 0), 0) / ks.length;
    const names = [...new Set(txs.filter(t => r.months.includes(t.month)).map(t => t.category))].filter(n => { const c = idx.get(n); return c && c.grp === 'dia' && !c.recurring && !c.financing && !/financ/i.test(n); });
    const up = names.map(n => ({ n, a: avg(a, n), b: avg(b, n) })).filter(x => x.a >= 200 && x.b - x.a >= 100 && x.b >= x.a * 1.15).sort((x, y) => (y.b - y.a) - (x.b - x.a))[0];
    if (up) out.push({ id: 'subiu', icon: '📊', title: `${up.n} subiu ${R0(up.b - up.a)} por mês`, text: `De ${R0(up.a)} para ${R0(up.b)} por mês, da primeira para a segunda metade do ano. Voltar ao que era deixa ${R0((up.b - up.a) * 12)} a mais por ano.` });
  }
  if (r.fees >= 100) out.push({ id: 'banco', icon: '🏦', title: `${R0(r.fees)} para o banco`, text: 'Em juros, IOF, anuidade e tarifas. Pedir isenção da anuidade e trocar o pacote de tarifas costuma zerar boa parte.' });
  return out.slice(0, 3);
}

// Evolution in the year: savings rate per month and the first half against the second.
export function yearEvolution(r) {
  if (!r.per || r.per.length < 4) return null;
  const h = Math.floor(r.per.length / 2), rate = ps => { const res = ps.reduce((a, c) => a + c.res, 0), renda = ps.reduce((a, c) => a + (c.tx ? c.res / c.tx : 0), 0); return renda > 0 ? res / renda : 0; };
  return { first: rate(r.per.slice(0, h)), second: rate(r.per.slice(h)), months: r.per.map(c => ({ month: c.month, tx: c.tx })) };
}

// Sundays with the open bill informed (the weekly habit). Counts from the first Sunday the forecast existed; it only
// starts to weigh on gold after 4 Sundays, so nobody loses a level for a habit that did not exist yet.
export const HABIT_START = '2026-11-08';
export function sundayHabit(checkins = [], today, year = today.slice(0, 4)) {
  let start = HABIT_START; if (HABIT_START < `${year}-01-01`) { let t = Date.parse(`${year}-01-01T12:00:00Z`); while (new Date(t).getUTCDay()) t += 864e5; start = new Date(t).toISOString().slice(0, 10); }
  const sundays = []; for (let t = Date.parse(start + 'T12:00:00Z'); t <= Date.parse(today + 'T12:00:00Z') && new Date(t).toISOString().startsWith(year); t += 7 * 864e5) sundays.push(new Date(t).toISOString().slice(0, 10));
  // A Sunday counts when the bill was informed from the Thursday before to the Wednesday after (one window per week).
  const done = sundays.filter(d => (checkins || []).some(c => c && c.date >= addDaysISO(d, -3) && c.date <= addDaysISO(d, 3))).length;
  const total = sundays.length, need = Math.ceil(total / 2);
  return { done, total, need, counts: total >= 4, ok: done >= need };
}
const addDaysISO = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// The level during the year: where the family is, the rules of every level (met or not) and what is missing for
// the next one, in money (what to keep more until December, and per month).
export function levelProgress(r, { habit = null, today } = {}) {
  // Months still to come in the year (after the last one with the account statement): their income also raises the
  // goal, so what is missing is "keep about X per month until December", with the usual income of the year.
  const lv = yearLevel(r, habit), meta = r.meta || 0.2, last = r.months?.length ? +r.months[r.months.length - 1].slice(5, 7) : +today.slice(5, 7) - 1;
  const monthsLeft = Math.max(0, 12 - last), avg = r.n ? r.renda / r.n : 0;
  const money = target => Math.max(0, Math.round(target * (r.renda + monthsLeft * avg) - r.res));
  const perM = v => monthsLeft ? Math.round(v / monthsLeft) : null;
  const keep = v => monthsLeft ? `Guardar uns ${R0(perM(v))} por mês até dezembro (${R0(v)} no total)` : `Faltaram ${R0(v)} no ano`;
  const posNeed = Math.ceil(0.75 * Math.max(r.n, 1));
  const rules = [
    { level: 'bronze', title: 'Bronze', text: 'Fechar o ano com sobra (ganhar mais do que gastar).', ok: r.res > 0 },
    { level: 'prata', title: 'Prata', text: 'Guardar pelo menos 10% do que ganharam no ano.', ok: r.tx >= 0.10 },
    { level: 'ouro', title: 'Ouro', text: `Guardar a meta de vocês (${Math.round(meta * 100)}% do que ganharam), com 3 de cada 4 meses no azul${habit?.counts ? ' e a fatura aberta informada em pelo menos metade dos domingos' : ''}.`, ok: lv.level === 'ouro' },
  ];
  const next = lv.next?.level || null, missing = [];
  if (next === 'bronze') { const v = Math.max(0, Math.round(-r.res)); missing.push({ text: monthsLeft ? `Sair do vermelho: ${R0(perM(v))} por mês de sobra até dezembro (${R0(v)} no total)` : `Faltaram ${R0(v)} de sobra no ano`, per: perM(v), frac: 0 }); }
  if (next === 'prata') { const v = money(0.10); missing.push({ text: keep(v), per: perM(v), frac: r.renda > 0 ? Math.min(1, Math.max(0, r.res / (0.10 * r.renda))) : 0 }); }
  if (next === 'ouro') {
    const v = money(meta);
    if (v > 0) missing.push({ text: keep(v), per: perM(v), frac: r.renda > 0 ? Math.min(1, Math.max(0, r.res / (meta * r.renda))) : 0 });
    if (r.positive < posNeed || !(r.n && r.positive / r.n >= 0.75)) missing.push({ text: `Meses no azul: ${r.positive} de ${r.n}; precisa de 3 em cada 4 (fechar os próximos no azul)`, frac: r.n ? r.positive / r.n / 0.75 : 0 });
    if (habit?.counts && !habit.ok) missing.push({ text: `Fatura aberta informada em ${habit.done} de ${habit.total} domingos; precisa de ${habit.need}`, frac: habit.need ? habit.done / habit.need : 0 });
  }
  const frac = missing.length ? Math.min(...missing.map(m => Math.min(1, m.frac || 0))) : 1;
  return { ...lv, next, nextLabel: next ? LEVELS[next] : null, rules, missing, frac, monthsLeft, habit };
}

