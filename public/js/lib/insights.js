// Insights for the home screen: short, actionable messages computed from the family's numbers.
// Pure function, tested in tests/lib.test.mjs.
import { addM } from './format.js';
import { budgetStatus } from './budget.js';

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => MES[+k.slice(5) - 1];
const R2 = v => (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
   fixedCats: ['Moradia e contas', ...] fixed (recurring) day-to-day categories (optional)
   closeDay: number                    day the card bill closes (optional)
 }
*/
export function insights(ctx) {
  const out = [], { today, months } = ctx;
  const cur = today.slice(0, 7), day = +today.slice(8, 10), prev = addM(cur, -1);
  const lastDay = new Date(+cur.slice(0, 4), +cur.slice(5, 7), 0).getDate();

  // 0. The card bill just closed (1 to 6 days ago) and is not in the app yet: the monthly habit.
  // Purchases from the closing day on go to the next bill, so the bill that closed is the closing date's month.
  const cd = +ctx.closeDay || 0, hadCard = months.some(k => ctx.has(k, 'cartao'));
  let billOpen = null;
  if (cd && hadCard) {
    const prevLast = new Date(+cur.slice(0, 4), +cur.slice(5, 7) - 1, 0).getDate();
    const closeK = day >= cd ? cur : prev, since = day >= cd ? day - cd : day + prevLast - Math.min(cd, prevLast);
    if (since >= 1 && since <= 6 && !ctx.has(closeK, 'cartao')) {
      billOpen = closeK;
      out.push({ id: 'fatura', tone: 'warn', title: 'A fatura do cartão fechou', text: `Fechou dia ${String(Math.min(cd, closeK === cur ? lastDay : prevLast)).padStart(2, '0')}/${closeK.slice(5)}. Mande o PDF (dá para mandar os de todos os cartões de uma vez) e veja para onde foi o dinheiro de ${mName(closeK)}.`, action: { label: 'Mandar a fatura', go: ['lancar', '#drop'] } });
    }
  }
  // What the bank charged in the latest month with data: interest first (the costly one), then fees.
  if (ctx.fees && months.length) {
    const L = [...months].reverse().find(k => k <= cur), f = L && ctx.fees(L), y = ctx.feesYear ? ctx.feesYear() : null;
    if (f && f.by.juros > 0) out.push({ id: 'juros', tone: 'bad', title: 'Juros e multa na fatura', text: `Em ${mName(L)} o banco cobrou ${R2(f.by.juros)} de juros, multa ou encargos. Pagar a fatura inteira, no dia, evita esse custo.`, action: { label: 'Ver o que o banco cobrou', go: ['resumo', '#feesBox'] } });
    else if (f && f.total >= 1 && y && y.total >= 1) out.push({ id: 'tarifas', tone: 'info', title: 'Quanto o banco cobrou', text: `${R2(f.total)} em ${mName(L)} de ${Object.entries(f.by).filter(e => e[1] > 0).map(e => ({ iof: 'IOF', anuidade: 'anuidade', tarifa: 'tarifas', juros: 'juros' })[e[0]]).join(', ')}; ${R(y.total)} nos últimos 12 meses. Dá para pedir isenção ou trocar o pacote.`, action: { label: 'Ver detalhes', go: ['resumo', '#feesBox'] } });
  }
  // 1. Missing data
  const miss = [];
  if (day >= 5 && !ctx.has(prev, 'conta')) miss.push(`o extrato de ${mName(prev)}`);
  if (day >= 12 && !ctx.has(cur, 'cartao') && hadCard && billOpen !== cur) miss.push(`a fatura de ${mName(cur)}`);
  if (miss.length && months.length) out.push({ id: 'missing', tone: 'warn', title: 'Faltam dados', text: `Ainda não chegou ${miss.join(' nem ')}. Sem isso, a sobra fica incompleta.`, action: { label: 'Enviar PDF', go: ['lancar', '#drop'] } });
  if (lastDay - day <= 5 && !ctx.manualCount(cur) && !ctx.has(cur, 'conta')) out.push({ id: 'ending', tone: 'info', title: `${mName(cur)[0].toUpperCase() + mName(cur).slice(1)} está acabando`, text: `Faltam ${lastDay - day + 1} dia${lastDay - day ? 's' : ''} e nenhum gasto de ${mName(cur)} foi lançado. Que tal lançar os do pix e do dinheiro agora, enquanto lembra?`, action: { label: 'Lançar gasto', go: ['lancar', '#qText'] } });

  // Budget per category, current month: warn early while there's still time to adjust.
  if (ctx.budgets && Object.keys(ctx.budgets).length) {
    const rows = budgetStatus({ budgets: ctx.budgets, spent: ctx.cats(cur), month: cur, today }).filter(r => r.status !== 'ok').slice(0, 2);
    if (rows.length) {
      const over = rows.filter(r => r.status === 'over');
      out.push({ id: 'budget', tone: 'warn', title: over.length ? `Orçamento estourado: ${over.map(r => r.category).join(' e ')}` : `${rows[0].category} perto do limite`,
        text: rows.map(r => r.status === 'over' ? `${r.category} já passou ${R(r.spent - r.limit)} do limite de ${R(r.limit)}.` : `${r.category} já usou ${P(r.pct)} de ${R(r.limit)}${r.daysLeft ? ` e faltam ${r.daysLeft} dias` : ''}.`).join(' ') + ' Bora segurar até o fim do mês?',
        action: { label: 'Ver orçamento', go: ['resumo', '#budgetBox'] } });
    }
  }

  // Subscriptions or fixed charges that got more expensive in the latest month.
  const ups = (ctx.recurring || []).filter(x => x.rise > 0 && x.current);
  if (ups.length) out.push({ id: 'subs_up', tone: 'warn', title: ups.length > 1 ? `${ups.length} cobranças ficaram mais caras` : `${ups[0].name} ficou mais cara`,
    text: ups.slice(0, 3).map(x => `${x.name}: de ${R2(x.prev)} para ${R2(x.last)}`).join('; ') + '. Vale conferir se o aumento estava combinado ou se dá para cancelar.', action: { label: 'Ver assinaturas', go: ['resumo', '#subsBox'] } });

  // A finished month waiting to be closed.
  if (ctx.toClose) { const n = mName(ctx.toClose); out.push({ id: 'close', tone: 'info', title: `Hora de fechar ${n}`, text: `Confira se falta algo e veja a retrospectiva de ${n}. Leva poucos minutos.`, action: { label: 'Fechar o mês', go: ['fechar'] } }); }

  // The month to talk about: the latest FINISHED one (before this month) with the account statement, else the latest
  // finished with data. The month going on is never "fechou": the forecast (Previsão do mês) speaks for it.
  const past = months.filter(k => k < cur), closed = past.filter(k => ctx.has(k, 'conta'));
  const m = closed[closed.length - 1] || past[past.length - 1] || months[months.length - 1], ongoing = !!m && m >= cur;
  if (!m) return out;
  const c = ctx.calc(m), before = months.filter(k => k < m).slice(-3), name = mName(m);

  // 2. In the red / saved well
  if (!ongoing && c.renda > 0 && c.res < 0) {
    const top = Object.entries(ctx.cats(m)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(' e ');
    out.push({ id: 'red', tone: 'bad', title: `${name[0].toUpperCase() + name.slice(1)} fechou no vermelho`, text: `Saiu ${R(c.res)} a mais do que entrou. Os maiores gastos foram ${top}. Vale olhar onde dá para cortar.`, action: { label: 'Perguntar onde cortar', go: ['perguntar', '#askText'] } });
  } else if (!ongoing && c.renda > 0 && ctx.goals.savings && c.tx >= ctx.goals.savings) {
    const eta = ctx.goals.patrimonio && ctx.etaYears ? ctx.etaYears(c.res) : null;
    out.push({ id: 'saved', tone: 'good', title: 'Parabéns, vocês economizaram bem!', text: `Em ${name} guardaram ${P(c.tx)} da renda (queriam ${P(ctx.goals.savings)}).` + (eta != null ? ` Guardando ${R(c.res)} por mês, o sonho de ${R(ctx.goals.patrimonio)} investidos chega em ${eta <= 1 ? 'cerca de 1 ano' : 'cerca de ' + Math.round(eta) + ' anos'}.` : ' Nesse ritmo, o sonho de vocês chega mais rápido.') });
  } else if (!ongoing && c.renda > 0 && ctx.goals.savings && c.tx < ctx.goals.savings) {
    const gap = ctx.goals.savings * c.renda - c.res;
    out.push({ id: 'below', tone: 'warn', title: 'Guardaram menos do que queriam', text: `Em ${name} guardaram ${P(c.tx)} da renda; o combinado era ${P(ctx.goals.savings)}. Faltaram ${R(gap)}.` });
  }

  // 3. Spending above the recent average, and which categories pushed it
  if (!ongoing && before.length >= 2) {
    const base = avg(before.map(k => ctx.calc(k).out));
    if (base > 0 && c.out > base * 1.1 && c.out - base > 200) {
      const cm = ctx.cats(m), cb = {}; before.forEach(k => { const x = ctx.cats(k); for (const n in x) cb[n] = (cb[n] || 0) + x[n] / before.length; });
      const ups = Object.keys(cm).map(n => [n, cm[n] - (cb[n] || 0)]).filter(e => e[1] > 100).sort((a, b) => b[1] - a[1]).slice(0, 2);
      out.push({ id: 'high', tone: 'warn', title: 'O gasto está alto, bora economizar?', text: `As despesas de ${name} ficaram ${P(c.out / base - 1)} acima da média dos meses anteriores (${R(c.out - base)} a mais).` + (ups.length ? ` Mais subiram: ${ups.map(e => `${e[0]} (+${R(e[1])})`).join(' e ')}.` : ''), action: { label: 'Ver gráficos', go: ['graficos'] } });
    } else if (base > 0 && c.out < base * 0.92 && base - c.out > 200) {
      out.push({ id: 'low', tone: 'good', title: 'Gastaram menos que o normal', text: `As despesas de ${name} ficaram ${R(base - c.out)} abaixo da média dos meses anteriores. Esse dinheiro pode ir direto para a meta.` });
    }
  }

  // 4. Next card bill already above the goal. The open bill the person typed (Previsão do mês) is the real number:
  // it wins over the estimate (installments + fixed bills) when it is newer and higher.
  let nf = ctx.nextFatura; const cap = ctx.goals.cardMonthly;
  const ck = nf && (ctx.checkins || []).filter(c => c && c.month === nf.month && +c.value >= 0).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (ck && +ck.value > nf.total) nf = { ...nf, total: +ck.value, informed: ck.date };
  const soma = nf && (nf.informed ? `está em ${R(nf.total)} (o valor que vocês informaram em ${nf.informed.slice(8, 10)}/${nf.informed.slice(5, 7)})` : `já soma ${R(nf.total)}`);
  if (nf && cap && nf.total > cap) out.push({ id: 'card', tone: 'warn', title: 'Cartão acima do limite', text: `A fatura de ${mName(nf.month)} ${nf.informed ? soma : `já soma ${R(nf.total)} entre parcelas e contas fixas`}, ${R(nf.total - cap)} acima do limite de ${R(cap)}. Segure as compras no cartão até o fechamento.` });

  // 4b. How much is left per day on the card until the bill closes (only while under the limit).
  if (nf && cap && nf.total < cap && ctx.closeDay) {
    const cd = Math.min(+ctx.closeDay, lastDay), left = cap - nf.total;
    const days = day < cd ? cd - day : (new Date(+cur.slice(0, 4), +cur.slice(5, 7), 0).getDate() - day) + Math.min(+ctx.closeDay, new Date(+addM(cur, 1).slice(0, 4), +addM(cur, 1).slice(5, 7), 0).getDate());
    if (days > 0 && left >= 50) out.push({ id: 'perday', tone: 'info', title: `Dá para gastar cerca de ${R(left / days)} por dia no cartão`, text: `A fatura de ${mName(nf.month)} ${soma} e o limite combinado é ${R(cap)}. Sobram ${R(left)} para os ${days} dias até o cartão fechar.`, action: { label: 'Ver metas', go: ['ajustes', null, 'metas'] } });
  }

  // 4d. Withdrawals not explained yet: cash disappears from the control unless the person says what it paid for.
  const fund = ctx.funding || [];
  if (fund.length) { const f = fund[0]; out.push({ id: 'entrada_amortizacao', tone: 'warn', title: `${R(f.income.amount)} entraram e foram para o financiamento?`, text: 'Se esse dinheiro entrou só para a amortização, ele não é sobra do mês. Confirme com um toque e a sobra fica certa.', action: { label: 'Confirmar', go: ['extrato', '#fundBox'] } }); }
  const dups = ctx.dups || 0;
  if (dups) out.push({ id: 'repetidos', tone: 'warn', title: dups > 1 ? `${dups} lançamentos apareceram duas vezes` : 'Um lançamento apareceu duas vezes', text: 'Você lançou à mão e o extrato ou a fatura trouxe de novo, então ele conta em dobro. Junte com um toque: fica um só, com a sua categoria.', action: { label: 'Ver e juntar', go: ['extrato', '#dupBox'] } });
  const cash = ctx.cashPending || [];
  if (cash.length) {
    const tot = cash.reduce((a, t) => a + Math.abs(+t.amount), 0);
    out.push({ id: 'saques', tone: 'warn', title: `${R(tot)} em ${cash.length > 1 ? 'saques' : 'saque'} sem detalhe`, text: 'Dinheiro vivo some do controle. Conte em poucas palavras no que foi (ex.: 200 feira, 100 uber) e a sobra do mês fica certa.', action: { label: 'Contar no que foi', go: ['lancar', '#cashBox'] } });
  }

  // 4c. A fixed bill (electricity, condo fee, school...) well above its own average.
  if (before.length >= 2 && (ctx.fixedCats || []).length) {
    const cm = ctx.cats(m), bills = [];
    for (const n of ctx.fixedCats) {
      const hist = before.map(k => ctx.cats(k)[n] || 0).filter(v => v > 0);
      if (hist.length < 2 || !(cm[n] > 0)) continue;
      const base = avg(hist);
      if (cm[n] > base * 1.25 && cm[n] - base >= 80) bills.push([n, cm[n], base]);
    }
    bills.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
    if (bills.length) out.push({ id: 'bill_up', tone: 'warn', title: bills.length > 1 ? `${bills.length} contas fixas vieram acima do normal` : `${bills[0][0]} veio acima do normal`,
      text: bills.slice(0, 2).map(([n, v, b]) => `${n}: ${R(v)} em ${name}, ${R(v - b)} (${P(v / b - 1)}) acima da média`).join('; ') + '. Vale conferir a conta: pode ser consumo, reajuste ou cobrança errada.', action: { label: 'Ver no extrato', go: ['extrato'] } });
  }

  // 5. Fixed costs eating the income
  const fx = ctx.fixed ? ctx.fixed(m) : 0;
  if (c.renda > 0 && fx / c.renda >= 0.5) out.push({ id: 'fixed', tone: 'info', title: 'Despesas fixas pesando', text: `As despesas fixas levam ${P(fx / c.renda)} da renda. O ideal é ficar abaixo de 50%: sobra mais espaço para imprevistos e para guardar.` });

  // 5b. Categories that look like the same thing: joining them makes charts and budgets clearer.
  if (ctx.catMerge > 0) out.push({ id: 'cat_merge', tone: 'info', title: ctx.catMerge > 1 ? `${ctx.catMerge} pares de categorias parecidas` : 'Duas categorias parecem a mesma', text: ctx.catMergeText || 'O app achou categorias que parecem a mesma coisa. Juntar deixa os gráficos e o orçamento mais claros.', action: { label: 'Ver e juntar', go: ['ajustes', '#catMerge', 'categorias'] } });

  // 6. Things to classify
  const pend = ctx.pending(m);
  if (pend) out.push({ id: 'pending', tone: 'info', title: `${pend} lançamento${pend > 1 ? 's' : ''} para conferir`, text: 'O app sugeriu a categoria, mas não tem certeza. Confira para a sobra e os gráficos ficarem certos; ele aprende e não pergunta de novo.', action: { label: 'Conferir agora', go: ['extrato', null, 'pend:' + m] } });

  return out.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
