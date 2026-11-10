// End-of-month forecast: how the current month is likely to close and how much still fits per day to hit the
// savings goal. Works with no new input (the last months' pattern); gets sharper with the open card bill the
// person types (a "check-in": the number shown in the bank app). Pure, tested in tests/lib.test.mjs.
import { catIndex, monthCalc, expandSplits, schedule } from './calc.js';
import { addM, cycleMonth } from './format.js';
import { pendingAmortizations } from './debt.js';

const r0 = v => Math.round(v);
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return !n ? 0 : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const lastDayOf = k => new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate();
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));

// The day the bill of month k closes (bill months follow cycleMonth: purchases from the closing day go to the next one).
export const closeDateOf = (k, closeDay = 24) => `${k}-${String(Math.min(+closeDay || 24, lastDayOf(k))).padStart(2, '0')}`;

// Which bill the check-in asks about today: the open one; but when this month's bill already closed and is not in
// the app yet, that one ("quanto veio a fatura"), because it decides this month.
export function checkinTarget(today, closeDay = 24, billImported = false) {
  const cur = today.slice(0, 7); let open = cycleMonth(today, closeDay);
  if (open !== cur && !billImported) return { month: cur, closed: true, closeDate: closeDateOf(cur, closeDay) };
  if (open === cur && billImported) open = addM(cur, 1); // the bill closed earlier than the day set in Metas
  return { month: open, closed: false, closeDate: closeDateOf(open, closeDay) };
}

/*
  forecast({ txs, categories, settings, today }) -> null (fewer than 2 complete past months) or
  { month, res, meta, renda, status: 'ok'|'risco'|'vermelho', perDay, allowance, daysLeft, basis: 'fatura'|'checkin'|'historico',
    checkin, card, conta, entradas, hist: [months used] }
  settings: households.settings ({ goals: {savings}, cardCloseDay, checkins: [{date, month, value}] }).
*/
export function forecast({ txs: all, categories, settings = {}, today }) {
  // A big payment that looks like paying off a financing and is not confirmed yet does not count: once confirmed it
  // goes to "Amortização de financiamento" (only the equity changes), so it never is the month's spending.
  const pend = new Set(pendingAmortizations(all, settings.debts || [], settings.debtSkip).map(x => x.tx.id));
  const txs = pend.size ? all.filter(t => t.id == null || !pend.has(t.id)) : all;
  const idx = catIndex(categories), cur = today.slice(0, 7), day = +today.slice(8, 10), cd = +settings.cardCloseDay || 24;
  const of = k => txs.filter(t => t.month === k), has = (k, src) => txs.some(t => t.month === k && t.source === src && !t.manual);
  const hist = [...new Set(txs.map(t => t.month))].filter(k => k < cur && has(k, 'conta') && has(k, 'cartao')).sort().slice(-3);
  if (hist.length < 2) return null;
  const C = Object.fromEntries(hist.map(k => [k, monthCalc(of(k), idx)])), now = monthCalc(of(cur), idx);
  const renda = median(hist.map(k => C[k].renda)) || median(hist.map(k => C[k].E));
  const goal = +(settings.goals?.savings ?? 0.2) || 0, meta = Math.max(0, renda * goal);

  // Account side: what already happened this month (the statement so far, or what was typed) plus what still is
  // expected until the end of the month, from the family's own last months: the income that usually comes (salary,
  // by category), the fixed bills and financing payments that usually leave (by category) and the day-to-day pace
  // for the days the statement does not cover yet. A statement of the whole month needs nothing on top.
  const contaRows = k => expandSplits(of(k).filter(t => t.source === 'conta'));
  const byCat = k => { const m = {}; for (const t of contaRows(k)) { const n = t.category || 'A classificar'; m[n] = (m[n] || 0) + (+t.amount || 0); } return m; };
  const H = hist.map(byCat), N = byCat(cur), names = [...new Set([...H.flatMap(o => Object.keys(o)), ...Object.keys(N)])];
  const grpOf = n => idx.get(n) || { grp: 'dia' }, isFixed = c => c.grp === 'dia' && (c.recurring || c.financing);
  const lastSeen = has(cur, 'conta') ? of(cur).filter(t => t.source === 'conta' && !t.manual && t.date).map(t => t.date).sort().pop() || null : null;
  const seenDay = lastSeen ? +lastSeen.slice(8, 10) : 0, full = !!lastSeen && seenDay >= lastDayOf(cur) - 1;
  const comingIn = [], comingOut = []; let varHist = 0, varNow = 0;
  for (const n of names) {
    const c = grpOf(n), med = median(H.map(o => o[n] || 0)), got = N[n] || 0;
    if (c.grp === 'renda' && med > 0 && !full) { const v = Math.max(0, med - Math.max(0, got)); if (v >= 1) comingIn.push({ name: n, value: r0(v) }); }
    else if (isFixed(c) && med < 0 && !full) { const v = Math.max(0, -med - Math.max(0, -got)); if (v >= 1) comingOut.push({ name: n, value: r0(v), financing: !!c.financing }); }
    else if (c.grp === 'dia' && !isFixed(c)) { varHist += -med; varNow += -got; }
  }
  const contaPace = Math.max(0, varHist) / 30;
  const varLeft = full ? 0 : lastSeen ? contaPace * Math.max(0, lastDayOf(cur) - seenDay) : Math.max(0, varHist - Math.max(0, varNow));
  const sum = a => a.reduce((x, y) => x + y.value, 0);
  const E = now.E + sum(comingIn), D = now.D + sum(comingOut) + varLeft;

  // Card side (the bill of this month counts this month). Share of the bill that counts in the leftover.
  const tot = hist.reduce((a, k) => a + C[k].cardTotal, 0), share = tot > 0 ? Math.min(1, Math.max(0, hist.reduce((a, k) => a + C[k].card, 0) / tot)) : 1;
  const medTotal = median(hist.map(k => C[k].cardTotal));
  const bills = [...new Set(txs.filter(t => t.source === 'cartao' && !t.manual).map(t => t.month))].filter(k => k < cur).sort(), L = bills[bills.length - 1];
  const gap = L ? monthsBetween(L, cur) : 0;
  const committed = L && gap >= 1 && gap <= 12 ? (schedule(of(L).filter(t => t.source === 'cartao'), 12)[gap - 1] || 0) + (settings.recurring || []).reduce((a, r) => a + (+r[1] || 0), 0) : 0;
  const pace = Math.max(0, medTotal - committed) / 30; // new purchases per day, on top of installments and subscriptions
  const ck = (settings.checkins || []).filter(c => c && c.month === cur && +c.value >= 0 && c.date <= today).sort((a, b) => a.date < b.date ? -1 : 1).pop() || null;
  const closeDate = closeDateOf(cur, cd);
  let card, basis;
  if (has(cur, 'cartao')) { card = now.card; basis = 'fatura'; }
  else if (ck) { card = Math.max((+ck.value + pace * Math.max(0, dayDiff(ck.date, closeDate))) * share, now.card); basis = 'checkin'; }
  else { card = Math.max(Math.max(medTotal, committed) * share, now.card); basis = 'historico'; }

  // Per day: the family's usual pace of new purchases, plus (or minus) the room left above the goal, spread over
  // the days left. Fixed bills are already in the forecast, so this is what fits for the day-to-day.
  const res = E - D - card, daysLeft = lastDayOf(cur) - day + 1, usual = pace * share + contaPace;
  const perDay = Math.max(0, usual + (daysLeft > 0 ? (res - meta) / daysLeft : 0)), perDayZero = Math.max(0, usual + (daysLeft > 0 ? res / daysLeft : 0));
  // This month's bill is already in (it closed): the open one is next month's. The check-in then forecasts that bill.
  let nextBill = null;
  if (basis === 'fatura') {
    // The real closing day shows in the bill itself: the day after its last purchase in that month (installments aside).
    const lastBuy = Math.max(0, ...of(cur).filter(t => t.source === 'cartao' && !t.manual && !t.installment && /^\d{2}\/\d{2}$/.test(t.day || '') && t.day.slice(3) === cur.slice(5)).map(t => +t.day.slice(0, 2)));
    const nm = cycleMonth(today, cd) > cur ? cycleMonth(today, cd) : addM(cur, 1), nc = closeDateOf(nm, lastBuy ? Math.min(28, lastBuy + 1) : cd);
    const ckn = (settings.checkins || []).filter(c => c && c.month === nm && +c.value >= 0 && c.date <= today).sort((a, b) => a.date < b.date ? -1 : 1).pop() || null;
    nextBill = { month: nm, closeDate: nc, usual: r0(medTotal), checkin: ckn, value: ckn ? r0(+ckn.value + pace * Math.max(0, dayDiff(ckn.date, nc))) : null };
  }
  const status = res >= meta ? 'ok' : res >= 0 ? 'risco' : 'vermelho';
  return { month: cur, res: r0(res), meta: r0(meta), renda: r0(renda), goal, status, perDay: r0(perDay), perDayZero: r0(perDayZero), usual: r0(usual), daysLeft, basis, checkin: ck, closeDate,
    card: r0(card), conta: r0(D), entradas: r0(E), hist, nextBill, ignored: pend.size,
    coming: { income: comingIn.sort((a, b) => b.value - a.value), fixed: comingOut.sort((a, b) => b.value - a.value), variable: r0(varLeft), through: lastSeen },
    // Every number behind the forecast, for "Ver a conta" (forecastBreakdown).
    parts: { nowE: r0(now.E), nowD: r0(now.D), varLeft: r0(varLeft), contaPace: r0(contaPace), varDays: full ? 0 : lastSeen ? Math.max(0, lastDayOf(cur) - seenDay) : null,
      cardNow: r0(now.card), cardPace: r0(pace), share: Math.round(share * 100) / 100, medTotal: r0(medTotal), committed: r0(committed),
      ck: ck ? { value: r0(+ck.value), date: ck.date, days: Math.max(0, dayDiff(ck.date, closeDate)) } : null } };
}

// "Ver a conta" on the forecast: each number considered, in order, so the family can check it (and trust it).
// -> [{ label, value, kind: 'item'|'total'|'note' }]; the items add up to the totals.
export function forecastBreakdown(f) {
  if (!f || !f.parts) return [];
  const p = f.parts, c = f.coming || {}, br = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`, mes = MES[+f.month.slice(5) - 1], out = [];
  const it = (label, value) => out.push({ label, value: Math.round(value), kind: 'item' }), tot = (label, value) => out.push({ label, value: Math.round(value), kind: 'total' });
  it(c.through ? `Já entrou na conta (extrato até ${br(c.through)})` : 'Já entrou na conta', p.nowE);
  for (const x of c.income || []) it(`Ainda deve entrar: ${x.name} (pela média dos últimos meses)`, x.value);
  tot('Entradas do mês', f.entradas);
  it(c.through ? `Já saiu da conta (extrato até ${br(c.through)})` : 'Já saiu da conta', -p.nowD);
  for (const x of c.fixed || []) it(`Ainda deve sair: ${x.name} (${x.financing ? 'financiamento' : 'conta fixa'}, pela média)`, -x.value);
  if (p.varLeft) it(p.varDays != null ? `Dia a dia da conta nos ${p.varDays} dias que o extrato ainda não cobre (${R(p.contaPace)} por dia)` : 'Dia a dia da conta que ainda falta (pela média dos últimos meses)', -p.varLeft);
  const sh = p.share < 1 ? `, só a parte que conta na sobra (${Math.round(p.share * 100)}%)` : '';
  it(f.basis === 'fatura' ? `Fatura do cartão de ${mes} (já no app)`
    : f.basis === 'checkin' ? `Fatura do cartão: ${R(p.ck.value)} informados em ${br(p.ck.date)} + ${R(p.cardPace)} por dia nos ${p.ck.days} dias até fechar${sh}`
    : `Fatura do cartão: o normal de vocês (${R(Math.max(p.medTotal, p.committed))})${sh}`, -f.card);
  tot('Sobra prevista', f.res);
  out.push({ label: 'Meta do mês', value: f.meta, kind: 'note' });
  out.push({ label: `Cabem por dia: o ritmo normal de compras novas (${R(f.usual)}) ${f.res >= f.meta ? '+' : '−'} ${R(Math.abs(f.res - f.meta))} ÷ ${f.daysLeft} dias que faltam`, value: f.perDay, kind: 'note' });
  return out;
}

// The text of the forecast, the same on Início, in the toast after a check-in and in the Sunday push.
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const R = v => (v < 0 ? '−' : '') + 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');
export function forecastText(f, name = '') {
  const N = String(name || '').trim().split(/\s+/)[0];
  const m = MES[+f.month.slice(5) - 1], M = m[0].toUpperCase() + m.slice(1);
  const head = f.status === 'ok' ? `No ritmo de agora, ${m} fecha com sobra de ${R(f.res)}${f.meta ? `, acima da meta de ${R(f.meta)}` : ''}.`
    : f.status === 'risco' ? `${M} pode fechar abaixo da meta: a previsão é sobrar ${R(f.res)}, e a meta é ${R(f.meta)}.`
    : `${M} pode fechar no vermelho: a previsão é faltar ${R(-f.res)}.`;
  const day = f.perDay > 0 ? `Para bater a meta, as compras novas (cartão e pix) cabem em até ${R(f.perDay)} por dia até o fim do mês. O normal de vocês é ${R(f.usual)} por dia.`
    : f.perDayZero > 0 ? `Para bater a meta faltariam ${R(f.meta - f.res)}. Para pelo menos não fechar no vermelho, as compras novas (cartão e pix) cabem em até ${R(f.perDayZero)} por dia. O normal de vocês é ${R(f.usual)} por dia.`
    : `Para não fechar no vermelho, segure as compras novas até o fim do mês: faltam ${R(-f.res)}.`;
  // On screen the title already says it: the line under it only carries the numbers.
  const short = f.status === 'ok' ? head : f.status === 'risco' ? `A previsão é sobrar ${R(f.res)}, e a meta é ${R(f.meta)}.` : `A previsão é faltar ${R(-f.res)}.`;
  const nb = f.nextBill, nm = nb && MES[+nb.month.slice(5) - 1];
  const next = nb?.value != null ? `Fatura de ${nm}: com ${R(nb.checkin.value)} até ${nb.checkin.date.slice(8, 10)}/${nb.checkin.date.slice(5, 7)}, deve fechar em uns ${R(nb.value)} (o normal de vocês é ${R(nb.usual)}).` : '';
  // What the forecast already counts that did not happen yet (so the person trusts the number).
  const cm = f.coming || {}, inc = (cm.income || []).reduce((a, x) => a + x.value, 0), fix = (cm.fixed || []).reduce((a, x) => a + x.value, 0);
  const names = l => l.slice(0, 2).map(x => x.name).join(' e ') + (l.length > 2 ? ' e outras' : '');
  const plan = [inc ? `${R(inc)} que ainda devem entrar (${names(cm.income)})` : '', fix ? `${R(fix)} de contas fixas e financiamentos que ainda vão sair (${names(cm.fixed)})` : '']
    .filter(Boolean).join(' e ');
  const counted = plan ? `Já conta com ${plan}${cm.through ? `, pelo extrato até ${cm.through.slice(8, 10)}/${cm.through.slice(5, 7)}` : ''}.` : '';
  return { next, counted, line: head, head: short, title: (N ? `${N}, ${m}` : M) + (f.status === 'ok' ? ' está no caminho da meta' : f.status === 'risco' ? ' pode fechar abaixo da meta' : ' pode fechar no vermelho'), day };
}

// Sunday 19h push: whether to ask this device, and the message. Asks at most once a week; after two asks in a row
// with no answer, only every other week. sent = push_subscriptions.last_sent.
export function sundayAsk(f, { name = '', sent = {}, checkins = [], today }) {
  if (!f) return null;
  const answered = since => (checkins || []).some(c => c && c.date >= since);
  if (answered(addDays(today, -2))) return null; // just updated
  const last = sent.previsao || null, miss = last && !answered(last) ? (+sent.previsao_miss || 0) + 1 : 0;
  if (last && dayDiff(last, today) < 6) return null;
  if (miss >= 2 && dayDiff(last, today) < 13) return null;
  const t = forecastText(f, name), n = String(name || '').trim().split(/\s+/)[0];
  return { miss, msg: { title: `${n ? n + ', q' : 'Q'}uanto está a fatura aberta?`, body: `${t.line} Digite o valor da fatura de vocês no app do banco e veja quanto dá para gastar por dia.`.slice(0, 220), tag: 'previsao' } };
}
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
