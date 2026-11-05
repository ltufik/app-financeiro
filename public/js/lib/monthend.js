// End-of-month forecast: how the current month is likely to close and how much still fits per day to hit the
// savings goal. Works with no new input (the last months' pattern); gets sharper with the open card bill the
// person types (a "check-in": the number shown in the bank app). Pure, tested in tests/lib.test.mjs.
import { catIndex, monthCalc, expandSplits, schedule } from './calc.js';
import { addM, cycleMonth } from './format.js';

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
  const cur = today.slice(0, 7), open = cycleMonth(today, closeDay);
  if (open !== cur && !billImported) return { month: cur, closed: true, closeDate: closeDateOf(cur, closeDay) };
  return { month: open, closed: false, closeDate: closeDateOf(open, closeDay) };
}

/*
  forecast({ txs, categories, settings, today }) -> null (fewer than 2 complete past months) or
  { month, res, meta, renda, status: 'ok'|'risco'|'vermelho', perDay, allowance, daysLeft, basis: 'fatura'|'checkin'|'historico',
    checkin, card, conta, entradas, hist: [months used] }
  settings: households.settings ({ goals: {savings}, cardCloseDay, checkins: [{date, month, value}] }).
*/
export function forecast({ txs, categories, settings = {}, today }) {
  const idx = catIndex(categories), cur = today.slice(0, 7), day = +today.slice(8, 10), cd = +settings.cardCloseDay || 24;
  const of = k => txs.filter(t => t.month === k), has = (k, src) => txs.some(t => t.month === k && t.source === src && !t.manual);
  const hist = [...new Set(txs.map(t => t.month))].filter(k => k < cur && has(k, 'conta') && has(k, 'cartao')).sort().slice(-3);
  if (hist.length < 2) return null;
  const C = Object.fromEntries(hist.map(k => [k, monthCalc(of(k), idx)])), now = monthCalc(of(cur), idx);
  const renda = median(hist.map(k => C[k].renda)) || median(hist.map(k => C[k].E));
  const goal = +(settings.goals?.savings ?? 0.2) || 0, meta = Math.max(0, renda * goal);

  // Account side: the statement when it is in; otherwise the usual month (or what was already launched, if more).
  const contaIn = has(cur, 'conta');
  const E = contaIn ? now.E : Math.max(median(hist.map(k => C[k].E)), now.E);
  const D = contaIn ? now.D : Math.max(median(hist.map(k => C[k].D)), now.D);

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
  const res = E - D - card, daysLeft = lastDayOf(cur) - day + 1, usual = pace * share;
  const perDay = Math.max(0, usual + (daysLeft > 0 ? (res - meta) / daysLeft : 0)), perDayZero = Math.max(0, usual + (daysLeft > 0 ? res / daysLeft : 0));
  const status = res >= meta ? 'ok' : res >= 0 ? 'risco' : 'vermelho';
  return { month: cur, res: r0(res), meta: r0(meta), renda: r0(renda), goal, status, perDay: r0(perDay), perDayZero: r0(perDayZero), usual: r0(usual), daysLeft, basis, checkin: ck, closeDate,
    card: r0(card), conta: r0(D), entradas: r0(E), hist };
}

// The text of the forecast, the same on Início, in the toast after a check-in and in the Sunday push.
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const R = v => (v < 0 ? '−' : '') + 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');
export function forecastText(f) {
  const m = MES[+f.month.slice(5) - 1], M = m[0].toUpperCase() + m.slice(1);
  const head = f.status === 'ok' ? `No ritmo de agora, ${m} fecha com sobra de ${R(f.res)}${f.meta ? `, acima da meta de ${R(f.meta)}` : ''}.`
    : f.status === 'risco' ? `${M} pode fechar abaixo da meta: a previsão é sobrar ${R(f.res)}, e a meta é ${R(f.meta)}.`
    : `${M} pode fechar no vermelho: a previsão é faltar ${R(-f.res)}.`;
  const day = f.perDay > 0 ? `Para bater a meta, as compras novas (cartão e pix) cabem em até ${R(f.perDay)} por dia até o fim do mês. O normal de vocês é ${R(f.usual)} por dia.`
    : f.perDayZero > 0 ? `Para bater a meta faltariam ${R(f.meta - f.res)}. Para pelo menos não fechar no vermelho, as compras novas (cartão e pix) cabem em até ${R(f.perDayZero)} por dia. O normal de vocês é ${R(f.usual)} por dia.`
    : `Para não fechar no vermelho, segure as compras novas até o fim do mês: faltam ${R(-f.res)}.`;
  // On screen the title already says it: the line under it only carries the numbers.
  const short = f.status === 'ok' ? head : f.status === 'risco' ? `A previsão é sobrar ${R(f.res)}, e a meta é ${R(f.meta)}.` : `A previsão é faltar ${R(-f.res)}.`;
  return { line: head, head: short, title: f.status === 'ok' ? `${M} no caminho da meta` : f.status === 'risco' ? `${M} pode fechar abaixo da meta` : `${M} pode fechar no vermelho`, day };
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
  const t = forecastText(f), n = String(name || '').trim().split(/\s+/)[0];
  return { miss, msg: { title: `${n ? n + ', q' : 'Q'}uanto está a fatura aberta?`, body: `${t.line} Digite o valor que aparece no app do banco e veja quanto dá para gastar por dia.`.slice(0, 220), tag: 'previsao' } };
}
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
