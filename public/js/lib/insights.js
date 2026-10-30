// Insights for the home screen: short, actionable messages computed from the family's numbers.
// Pure function, tested in tests/lib.test.mjs.
import { addM } from './format.js';

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => MES[+k.slice(5) - 1];
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');
const P = v => Math.round(v * 100) + '%';
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const RANK = { bad: 0, warn: 1, good: 2, info: 3 };

/*
 ctx = {
   today: 'AAAA-MM-DD',
   months: ['AAAA-MM', ...]            months with data, sorted
   calc(k) -> monthCalc result         { res, renda, E, out, tx, ... }
   cats(k) -> { category: spent }      day-to-day expenses by category
   fixed(k) -> number                  fixed (recurring) expenses of the month
   has(k, source) -> boolean           statement/bill imported for that month (not only manual)
   manualCount(k) -> number
   pending(k) -> number                transactions still "A classificar"
   goals: { savings, cardMonthly, patrimonio }
   nextFatura: { month, total } | null
   etaYears(pmt) -> number | null      years to reach the wealth goal saving pmt per month
 }
*/
export function insights(ctx) {
  const out = [], { today, months } = ctx;
  const cur = today.slice(0, 7), day = +today.slice(8, 10), prev = addM(cur, -1);
  const lastDay = new Date(+cur.slice(0, 4), +cur.slice(5, 7), 0).getDate();

  // 1. Missing data
  const miss = [];
  if (day >= 5 && !ctx.has(prev, 'conta')) miss.push(`o extrato de ${mName(prev)}`);
  if (day >= 12 && !ctx.has(cur, 'cartao') && months.some(k => ctx.has(k, 'cartao'))) miss.push(`a fatura de ${mName(cur)}`);
  if (miss.length && months.length) out.push({ id: 'missing', tone: 'warn', title: 'Faltam dados', text: `Ainda não chegou ${miss.join(' nem ')}. Sem isso, a sobra fica incompleta.`, action: { label: 'Enviar PDF', go: ['lancar', '#drop'] } });
  if (lastDay - day <= 5 && !ctx.manualCount(cur) && !ctx.has(cur, 'conta')) out.push({ id: 'ending', tone: 'info', title: `${mName(cur)[0].toUpperCase() + mName(cur).slice(1)} está acabando`, text: `Faltam ${lastDay - day + 1} dia${lastDay - day ? 's' : ''} e nenhum gasto de ${mName(cur)} foi lançado. Que tal lançar os do pix e do dinheiro agora, enquanto lembra?`, action: { label: 'Lançar gasto', go: ['lancar', '#qText'] } });

  // A finished month waiting to be closed.
  if (ctx.toClose) { const n = mName(ctx.toClose); out.push({ id: 'close', tone: 'info', title: `Hora de fechar ${n}`, text: `Confira se falta algo e veja a retrospectiva de ${n}. Leva poucos minutos.`, action: { label: 'Fechar o mês', go: ['fechar'] } }); }

  // The month to talk about: the latest one with the account statement, else the latest with data.
  const closed = months.filter(k => ctx.has(k, 'conta'));
  const m = closed[closed.length - 1] || months[months.length - 1];
  if (!m) return out;
  const c = ctx.calc(m), before = months.filter(k => k < m).slice(-3), name = mName(m);

  // 2. In the red / saved well
  if (c.renda > 0 && c.res < 0) {
    const top = Object.entries(ctx.cats(m)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(' e ');
    out.push({ id: 'red', tone: 'bad', title: `${name[0].toUpperCase() + name.slice(1)} fechou no vermelho`, text: `Saiu ${R(c.res)} a mais do que entrou. Os maiores gastos foram ${top}. Vale olhar onde dá para cortar.`, action: { label: 'Perguntar onde cortar', go: ['perguntar', '#askText'] } });
  } else if (c.renda > 0 && ctx.goals.savings && c.tx >= ctx.goals.savings) {
    const eta = ctx.goals.patrimonio && ctx.etaYears ? ctx.etaYears(c.res) : null;
    out.push({ id: 'saved', tone: 'good', title: 'Parabéns, vocês economizaram bem!', text: `Em ${name} guardaram ${P(c.tx)} da renda (meta: ${P(ctx.goals.savings)}).` + (eta != null ? ` Guardando ${R(c.res)} por mês, a meta de ${R(ctx.goals.patrimonio)} chega em ${eta <= 1 ? 'cerca de 1 ano' : 'cerca de ' + Math.round(eta) + ' anos'}.` : ' Nesse ritmo, as metas chegam mais rápido.') });
  } else if (c.renda > 0 && ctx.goals.savings && c.tx < ctx.goals.savings) {
    const gap = ctx.goals.savings * c.renda - c.res;
    out.push({ id: 'below', tone: 'warn', title: 'A sobra ficou abaixo da meta', text: `Em ${name} guardaram ${P(c.tx)} da renda; a meta é ${P(ctx.goals.savings)}. Faltaram ${R(gap)}.` });
  }

  // 3. Spending above the recent average, and which categories pushed it
  if (before.length >= 2) {
    const base = avg(before.map(k => ctx.calc(k).out));
    if (base > 0 && c.out > base * 1.1 && c.out - base > 200) {
      const cm = ctx.cats(m), cb = {}; before.forEach(k => { const x = ctx.cats(k); for (const n in x) cb[n] = (cb[n] || 0) + x[n] / before.length; });
      const ups = Object.keys(cm).map(n => [n, cm[n] - (cb[n] || 0)]).filter(e => e[1] > 100).sort((a, b) => b[1] - a[1]).slice(0, 2);
      out.push({ id: 'high', tone: 'warn', title: 'O gasto está alto, bora economizar?', text: `As despesas de ${name} ficaram ${P(c.out / base - 1)} acima da média dos meses anteriores (${R(c.out - base)} a mais).` + (ups.length ? ` Mais subiram: ${ups.map(e => `${e[0]} (+${R(e[1])})`).join(' e ')}.` : ''), action: { label: 'Ver gráficos', go: ['graficos'] } });
    } else if (base > 0 && c.out < base * 0.92 && base - c.out > 200) {
      out.push({ id: 'low', tone: 'good', title: 'Gastaram menos que o normal', text: `As despesas de ${name} ficaram ${R(base - c.out)} abaixo da média dos meses anteriores. Esse dinheiro pode ir direto para a meta.` });
    }
  }

  // 4. Next card bill already above the goal
  const nf = ctx.nextFatura, cap = ctx.goals.cardMonthly;
  if (nf && cap && nf.total > cap) out.push({ id: 'card', tone: 'warn', title: 'Cartão acima da meta', text: `A fatura de ${mName(nf.month)} já soma ${R(nf.total)} entre parcelas e contas fixas, ${R(nf.total - cap)} acima da meta de ${R(cap)}. Segure as compras no cartão até o fechamento.` });

  // 5. Fixed costs eating the income
  const fx = ctx.fixed ? ctx.fixed(m) : 0;
  if (c.renda > 0 && fx / c.renda >= 0.5) out.push({ id: 'fixed', tone: 'info', title: 'Despesas fixas pesando', text: `As despesas fixas levam ${P(fx / c.renda)} da renda. O ideal é ficar abaixo de 50%: sobra mais espaço para imprevistos e para guardar.` });

  // 6. Things to classify
  const pend = ctx.pending(m);
  if (pend) out.push({ id: 'pending', tone: 'info', title: `${pend} lançamento${pend > 1 ? 's' : ''} para conferir`, text: 'O app sugeriu a categoria, mas não tem certeza. Confira para a sobra e os gráficos ficarem certos; ele aprende e não pergunta de novo.', action: { label: 'Conferir', go: ['extrato', '#lPend'] } });

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
