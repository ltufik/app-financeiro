// "Ver a conta" everywhere a number decides something: each figure behind it, in order, adding up to the result.
// Rows: { label, value (number or text), kind: 'item'|'total'|'note' }. Pure, tested in tests/lib.test.mjs.
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const R = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const it = (label, value) => ({ label, value, kind: 'item' }), tot = (label, value) => ({ label, value, kind: 'total' }), note = (label, value) => ({ label, value, kind: 'note' });
const br = d => String(d || '').split('-').reverse().join('/');

// Nível do ano (lib/closing.js levelProgress): what the year has so far and what is missing for the next level.
// r: yearRetro ({ renda, res, tx, n, positive, months }); p: levelProgress(r); meta: the savings goal.
export function levelBreakdown(r, p, meta = 0.2) {
  if (!r || !r.n) return [];
  const last = r.months[r.months.length - 1], upTo = MES[+last.slice(5) - 1], avg = r.renda / r.n, out = [];
  out.push(it(`Entrou em ${r.n} ${r.n > 1 ? 'meses' : 'mês'} (até ${upTo})`, r.renda), it('Saiu no mesmo período', -(r.renda - r.res)), tot(`Sobrou (${Math.round(r.tx * 100)}% do que entrou)`, r.res));
  out.push(note('Meses no azul', `${r.positive} de ${r.n}`));
  const target = p.next === 'prata' ? 0.10 : p.next === 'ouro' ? meta : null;
  if (target != null && p.monthsLeft) {
    const yearIn = r.renda + p.monthsLeft * avg, need = target * yearIn, miss = Math.max(0, need - r.res);
    out.push(it(`Renda esperada no ano: o que entrou + ${p.monthsLeft} ${p.monthsLeft > 1 ? 'meses' : 'mês'} × ${R(avg)} (a média do ano)`, Math.round(yearIn)));
    out.push(it(`Para ${p.nextLabel}: ${Math.round(target * 100)}% disso`, Math.round(need)), it('Menos o que já sobrou', -r.res), tot('Falta guardar até dezembro', Math.round(miss)));
    out.push(note(`Por mês, nos ${p.monthsLeft} que faltam`, Math.round(miss / p.monthsLeft)));
  } else if (p.next === 'bronze') out.push(tot('Falta para sair do vermelho', Math.round(-r.res)));
  return out;
}

// O sonho de vocês (calc.js project): where the money gets in the years set in Metas.
// o: projOpts ({ start, pmt, ext, ret, years, receivables }); pts: project(o); goal: patrimônio wanted.
export function dreamBreakdown(o, pts, goal, { startYear } = {}) {
  if (!o || !pts?.length) return [];
  const end = pts[pts.length - 1], put = o.pmt * 12 * o.years + (o.ext || 0) * o.years + (o.receivables || []).reduce((a, x) => a + (+x.monthly || 0) * (x.left == null ? o.years * 12 : Math.min(x.left, o.years * 12)), 0);
  const out = [it('Investido hoje', Math.round(o.start)), it(`Guardando ${R(o.pmt)} por mês durante ${o.years} anos`, Math.round(o.pmt * 12 * o.years))];
  if (o.ext) out.push(it(`Mais ${R(o.ext)} por ano (13º, bônus) durante ${o.years} anos`, Math.round(o.ext * o.years)));
  const rec = put - o.pmt * 12 * o.years - (o.ext || 0) * o.years; if (rec >= 1) out.push(it('Recebimentos combinados (aluguéis, parcelas a receber)', Math.round(rec)));
  out.push(it(`Rendimento de ${Math.round((o.ret ?? 0.05) * 1000) / 10}% ao ano acima da inflação`, Math.round(end - o.start - put)), tot(`Em ${o.years} anos`, Math.round(end)));
  if (goal) {
    out.push(note('Meta de vocês', Math.round(goal)));
    const i = pts.findIndex(v => v >= goal);
    out.push(note(i >= 0 ? 'Chegam lá em' : 'Falta para a meta no fim do prazo', i >= 0 ? String((startYear || new Date().getFullYear()) + i) : Math.round(goal - end)));
  }
  return out;
}

// Saldo do financiamento (debt.js debtNow): the balance informed, the installments since then and the payoffs.
export function debtBreakdown(d, now) {
  if (!d || !now) return [];
  const out = [it(`Saldo informado${d.saldoEm ? ` em ${br(d.saldoEm)}` : ''}`, now.base)];
  if (now.months) out.push(it(`${now.months} ${now.months > 1 ? 'parcelas' : 'parcela'} desde então: a parte que abate o saldo (estimada; os juros, ${R(now.interest)}, não abatem)`, -now.estimated));
  if (now.amortized) out.push(it('Amortizações confirmadas', -now.amortized));
  out.push(tot('Saldo hoje', now.saldo));
  return out;
}

// Gastos do ano (annual.js setAside): the monthly amount that has every month's payments in hand when they come.
// cal: [{ month, total }] from now on.
export function asideBreakdown(cal = []) {
  let acc = 0, best = 0, at = null; const out = [];
  cal.forEach((m, i) => { acc += m.total; const per = acc / (i + 1); if (per > best) { best = per; at = m.month; } if (m.total) out.push(it(`${MES[+m.month.slice(5) - 1]}: ${R(m.total)} · acumulado ${R(acc)} ÷ ${i + 1} ${i ? 'meses' : 'mês'} = ${R(per)} por mês`, Math.round(per))); });
  if (at) out.push(tot(`O mês mais apertado é ${MES[+at.slice(5) - 1]}: separando ${R(Math.ceil(best / 10) * 10)} por mês (arredondado), o dinheiro de cada mês está na mão quando chega`, Math.ceil(best / 10) * 10));
  return out;
}
