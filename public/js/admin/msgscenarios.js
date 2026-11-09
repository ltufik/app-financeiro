// Central → Mensagens: every notice and push of the app, written for the fictitious Souza family (Ana and Bruno)
// in different moments of the month, so the texts can be reviewed in one place. Uses the same functions the app and
// the robots use (lib/insights.js, lib/monthend.js, lib/pushtexts.js), so what shows here is what people get.
import { insights } from '../lib/insights.js';
import { forecastText, sundayAsk } from '../lib/monthend.js';
import { weekly, reminderMessage, message as familyNotice } from '../lib/pushtexts.js';
import { catIndex } from '../lib/calc.js';
import { linkFor } from '../lib/links.js';

export const PERSON = 'Ana Souza', PARTNER = 'Bruno Souza';
const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const calcOf = (res, renda = 14000, out = renda - res) => ({ res, renda, E: renda, out, tx: res / renda, card: out * 0.45 });
const base = (over = {}) => {
  const M = { '2026-06': calcOf(2900), '2026-07': calcOf(3100), '2026-08': calcOf(2700), '2026-09': calcOf(3000), '2026-10': calcOf(-1200), ...(over.M || {}) };
  const C = { '2026-06': { Mercado: 2100, Escola: 2400, 'Moradia e contas': 2600, Delivery: 600 }, '2026-07': { Mercado: 2000, Escola: 2400, 'Moradia e contas': 2550, Delivery: 650 },
    '2026-08': { Mercado: 2200, Escola: 2400, 'Moradia e contas': 2620, Delivery: 700 }, '2026-09': { Mercado: 2050, Escola: 2400, 'Moradia e contas': 2580, Delivery: 620 },
    '2026-10': { Mercado: 2300, Escola: 3100, 'Moradia e contas': 3300, Delivery: 1400 }, '2026-11': { Mercado: 900, Escola: 3100, Delivery: 380 }, ...(over.C || {}) };
  const months = over.months || [...MONTHS, '2026-11'];
  return { months, calc: k => M[k] || calcOf(0, 0, 0), cats: k => C[k] || {}, fixed: k => (C[k]?.Escola || 0) + (C[k]?.['Moradia e contas'] || 0),
    has: over.has || ((k, s) => k <= '2026-10' || (k === '2026-11' && s === 'conta')), manualCount: () => 1, pending: k => (k === '2026-10' ? 4 : 0),
    goals: { savings: 0.2, cardMonthly: 6000, patrimonio: 800000 }, nextFatura: { month: '2026-11', total: 4300 }, etaYears: () => 14, closeDay: 28,
    fixedCats: ['Escola', 'Moradia e contas'], budgets: { Delivery: 500 }, recurring: [{ name: 'Netflix', rise: 6, current: true, prev: 39.9, last: 45.9 }],
    fees: k => (k === '2026-10' ? { total: 92.4, by: { juros: 0, tarifa: 92.4 } } : null), feesYear: () => ({ total: 640 }), cashPending: [{ amount: -400 }, { amount: -600 }],
    dups: 1, funding: [], catMerge: 1, catMergeText: 'Mercado e Supermercado', toClose: null, checkins: [], ...over };
};

export const SCENARIOS = [
  { id: 'meio', title: 'Meio do mês (09/11): outubro no vermelho', desc: 'Outubro fechou com gastos acima do normal; novembro tem o extrato parcial; há saques e um repetido.', today: '2026-11-09', ctx: base() },
  { id: 'comeco', title: 'Começo do mês (03/12): a fatura fechou e falta fechar novembro', desc: 'A fatura do cartão fechou dia 28 e ainda não chegou; novembro terminou e não foi fechado.', today: '2026-12-03',
    ctx: base({ months: [...MONTHS, '2026-11'], has: (k, s) => k <= '2026-10' || (k === '2026-11' && s === 'conta'), toClose: '2026-11', M: { '2026-11': calcOf(3600) } }) },
  { id: 'fim', title: 'Fim do mês (26/11): outubro bateu a meta', desc: 'Outubro guardou acima da meta e gastou menos que o normal; o cartão está dentro do limite.', today: '2026-11-26',
    ctx: base({ M: { '2026-10': calcOf(4200, 14000, 9800) }, C: { '2026-10': { Mercado: 1900, Escola: 2400, 'Moradia e contas': 2500, Delivery: 400 } }, cashPending: [], dups: 0, catMerge: 0, recurring: [], budgets: { Delivery: 500 } }) },
  { id: 'nova', title: 'Família nova (15/11): só o cartão de outubro', desc: 'Mandou a fatura de outubro, mas não o extrato da conta.', today: '2026-11-15',
    ctx: base({ months: ['2026-10'], has: (k, s) => s === 'cartao' && k === '2026-10', M: { '2026-10': calcOf(0, 0, 5200) }, cashPending: [], dups: 0, catMerge: 0, recurring: [], fees: null, budgets: {}, nextFatura: null }) },
];

const FC = { month: '2026-11', status: 'risco', res: 1800, meta: 2800, perDay: 120, perDayZero: 260, usual: 180, basis: 'checkin', nextBill: null };
// The same link the 9h robot builds from the notice's button (api/_daily.js).
const pushUrl = x => x.action ? linkFor('tela', { tab: x.action.go[0], sec: x.action.go[0] === 'lancar' && x.action.go[1] === '#drop' ? 'pdf' : x.action.go[2] }) : linkFor('tela', { tab: 'resumo' });

// Every message of a scenario: the notices on Início (also the 9h push, the most urgent one) and the other pushes.
export function scenarioMessages(sc) {
  const ins = insights({ ...sc.ctx, today: sc.today });
  const out = ins.map(x => ({ channel: 'inicio', id: x.id, tone: x.tone, title: x.title, text: x.text, action: x.action || null }));
  const top = ins.find(x => x.id === 'fatura') || ins.find(x => x.tone === 'bad' || x.tone === 'warn') || ins[0];
  if (top) out.push({ channel: 'push', where: 'Push das 9h (o aviso mais urgente)', id: top.id, title: top.id === 'fatura' ? `${PERSON.split(' ')[0]}, a fatura do cartão fechou` : top.title, text: top.text, url: pushUrl(top) });
  return out;
}
export function otherPushes() {
  const idx = catIndex([{ name: 'Mercado', grp: 'dia' }, { name: 'Delivery', grp: 'dia' }]);
  const w = weekly([{ source: 'cartao', date: '2026-11-14', amount: 420, category: 'Mercado' }, { source: 'cartao', date: '2026-11-13', amount: 160, category: 'Delivery' }], idx, '2026-11-15');
  const ft = forecastText(FC), sa = sundayAsk(FC, { name: PERSON, sent: {}, checkins: [], today: '2026-11-15' });
  const r1 = reminderMessage(PERSON), r2 = reminderMessage(PERSON, { empty: true });
  const fam = ['joined', 'imported', 'closed'].map(type => ({ type, m: familyNotice({ type, name: PARTNER.split(' ')[0], family: 'Família Souza', source: 'cartao', month: '2026-10' }) }));
  return [
    { channel: 'push', where: 'Domingo, resumo da semana', id: 'semanal', title: w.title, text: w.text, url: w.url },
    { channel: 'push', where: 'Domingo 19h, previsão do mês', id: 'previsao', title: sa?.msg.title, text: sa?.msg.body, url: linkFor('tela', { tab: 'resumo', sec: 'previsao' }) },
    { channel: 'inicio', where: 'Início, Previsão do mês', id: 'previsao', title: ft.title, text: `${ft.head} ${ft.day}`, action: { label: 'Atualizar a previsão' } },
    { channel: 'push', where: '21h, quem não lançou nada hoje', id: 'lembrete', title: r1.title, text: r1.body, url: r1.url },
    { channel: 'push', where: '21h, família ainda sem dados', id: 'lembrete_vazio', title: r2.title, text: r2.body, url: r2.url },
    ...fam.map(({ type, m }) => ({ channel: 'push', where: `Para o resto da família quando ${PARTNER.split(' ')[0]} ${type === 'joined' ? 'entra' : type === 'imported' ? 'manda a fatura' : 'fecha o mês'}`, id: 'familia_' + type, title: m.title, text: m.body, url: m.url })),
  ];
}
