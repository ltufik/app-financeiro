// Unit tests: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { catIndex, monthCalc, byCategory, schedule, project, needPmt, payoff } from '../public/js/lib/calc.js';
import { prepareRules, classify } from '../public/js/lib/categorize.js';
import { parseExtratoSantander, parseFaturaSantander, faturaMonth, detect, checkFatura } from '../public/js/lib/parse.js';
import { cycleMonth, norm, addM } from '../public/js/lib/format.js';

const cats = catIndex([
  { name: 'Salário', grp: 'renda' }, { name: 'Reembolsos', grp: 'entrada' }, { name: '13º', grp: 'pontual' },
  { name: 'Mercado', grp: 'dia' }, { name: 'Financiamento', grp: 'dia', financing: true }, { name: 'Obra', grp: 'fora' },
  { name: 'Fatura', grp: 'neutro' }, { name: 'Terceiros', grp: 'neutro' },
]);

test('monthCalc: sobra, taxa e taxa sem financiamento', () => {
  const r = monthCalc([
    { source: 'conta', amount: 10000, category: 'Salário' },
    { source: 'conta', amount: 500, category: 'Reembolsos' },
    { source: 'conta', amount: 3000, category: '13º' },
    { source: 'conta', amount: -1000, category: 'Mercado' },
    { source: 'conta', amount: -2000, category: 'Financiamento' },
    { source: 'conta', amount: -700, category: 'Obra' },
    { source: 'conta', amount: -4000, category: 'Fatura' },
    { source: 'cartao', amount: 3500, category: 'Mercado' },
    { source: 'cartao', amount: 300, category: 'Obra' },
    { source: 'cartao', amount: 200, category: 'Terceiros' },
  ], cats);
  assert.equal(r.renda, 10000); assert.equal(r.E, 10500); assert.equal(r.D, 3000); assert.equal(r.card, 3500);
  assert.equal(r.cardTotal, 4000); assert.equal(r.DX, 1000); assert.equal(r.EX, 3000);
  assert.equal(r.res, 4000); assert.equal(r.tx, 0.4); assert.equal(r.tx2, 0.6);
});

test('monthCalc: categoria desconhecida conta como dia a dia (saída) ou entrada', () => {
  const r = monthCalc([{ source: 'conta', amount: -100, category: 'X' }, { source: 'conta', amount: 50, category: 'Y' }], cats);
  assert.equal(r.D, 100); assert.equal(r.E, 50);
});

test('byCategory soma conta e cartão do dia a dia', () => {
  const g = byCategory([{ source: 'conta', amount: -100, category: 'Mercado' }, { source: 'cartao', amount: 50, category: 'Mercado' }, { source: 'cartao', amount: 50, category: 'Obra' }], cats);
  assert.deepEqual(g, { Mercado: 150 });
});

test('schedule: parcelas restantes e antecipação ignorada', () => {
  const s = schedule([
    { day: '01/01', description: 'LOJA', installment: '02/04', amount: 100 },
    { day: '05/02', description: 'SHOW', installment: '01/03', amount: 50 },
    { day: '05/02', description: 'SHOW', installment: '02/03', amount: 50 },
  ], 4);
  assert.deepEqual(s, [100, 100, 0, 0]);
});

test('project, needPmt e payoff', () => {
  const p = project({ start: 1000, pmt: 0, ext: 0, ret: 0, years: 2, receivables: [{ monthly: 10, left: 6 }], redemptions: [{ value: 100, at: 12 }] });
  assert.equal(p.length, 3); assert.equal(p[2], 1000 + 60 + 100);
  const need = needPmt({ start: 0, ret: 0, years: 1 }, 1200); assert.ok(Math.abs(need - 100) < 0.01);
  const a = payoff({ saldo: 12000, rate: 0, parcela: 1000 }); assert.equal(a.months, 12); assert.equal(Math.round(a.juros), 0);
  const b = payoff({ saldo: 100000, rate: 0.12, parcela: 500 }); assert.equal(b.months, null);
});

test('classify: parcela herdada, regra exata, regex com faixa de valor', () => {
  const pr = prepareRules([
    { source: 'cartao', kind: 'exact', pattern: 'PADARIA DO ZE', category: 'Mercado' },
    { source: 'conta', kind: 'regex', pattern: 'PIX.*JOAO', category: 'Obra', min_abs: 500, priority: 10 },
    { source: 'conta', kind: 'regex', pattern: 'PIX', category: 'Mercado', priority: 90 },
  ]);
  assert.equal(classify({ source: 'cartao', description: 'Padaria do Zé', amount: 10 }, pr).category, 'Mercado');
  assert.equal(classify({ source: 'conta', description: 'PIX JOAO', amount: -900 }, pr).category, 'Obra');
  assert.equal(classify({ source: 'conta', description: 'PIX JOAO', amount: -90 }, pr).category, 'Mercado');
  const prev = [{ day: '03/05', description: 'SOFA', installment: '01/10', category: 'Obra' }];
  assert.deepEqual(classify({ source: 'cartao', day: '03/05', description: 'SOFA', installment: '02/10', amount: 300 }, pr, prev), { category: 'Obra', how: 'parcela' });
  assert.equal(classify({ source: 'cartao', description: 'NADA', amount: 1 }, pr), null);
});

test('parseExtratoSantander confere a cadeia de saldos', () => {
  const lines = ['Saldo anterior 1.000,00',
    '01/10/2026 0000 PIX ENVIADO -100,00 D 900,00', 'FULANO DE TAL',
    '02/10/2026 0000 TED RECEBIDA 12345 2.000,50 C 2.900,50', 'EMPRESA X'];
  const r = parseExtratoSantander(lines);
  assert.equal(r.ok, true); assert.equal(r.rows.length, 2); assert.equal(r.month, '2026-10');
  assert.equal(r.rows[0].description, 'PIX ENVIADO FULANO DE TAL'); assert.equal(r.saldoFim, 2900.5);
  const bad = parseExtratoSantander(['Saldo anterior 1.000,00', '01/10/2026 0000 PIX -100,00 D 800,00']);
  assert.equal(bad.ok, false);
});

test('parseFaturaSantander confere total por cartão', () => {
  const lines = ['R$ 350,00 30/10/2026', 'LUIZ - 4388 XXXX XXXX 4388', 'Despesas', '05/10 MERCADO BOM 100,00', '06/10 LOJA 02/05 250,00', 'VALOR TOTAL 350,00', 'Saldo Desta Fatura 350,00'];
  const r = parseFaturaSantander(lines);
  assert.equal(r.ok, true); assert.equal(r.items.length, 2); assert.equal(r.items[1].installment, '02/05'); assert.equal(r.vencimento, '30/10/2026');
  assert.equal(faturaMonth('30/10/2026'), '2026-10'); assert.equal(faturaMonth('02/11/2026'), '2026-10'); assert.equal(faturaMonth('03/01/2027'), '2026-12');
});

test('detect e checkFatura', () => {
  assert.equal(detect('EXTRATO DE CONTA - CONTA CORRENTE'), 'extrato-santander');
  assert.equal(detect('Fatura do cartão Nubank vencimento 10/11'), 'fatura');
  const c = checkFatura([{ card: '1', amount: 10 }, { card: '1', amount: 5 }, { card: '1', amount: -3 }], [{ final: '1', valorTotal: 15 }]);
  assert.equal(c.ok, true);
});

test('format: ciclo do cartão, norm, addM', () => {
  assert.equal(cycleMonth('2026-10-23'), '2026-10'); assert.equal(cycleMonth('2026-10-24'), '2026-11'); assert.equal(cycleMonth('2026-12-30'), '2027-01');
  assert.equal(norm(' Pão  de Açúcar '), 'PAO DE ACUCAR'); assert.equal(addM('2026-01', -1), '2025-12');
});

test('outros bancos: banco detectado e conferência por total da fatura ou por totais do extrato', async () => {
  const { detectBank, checkFatura, checkExtrato } = await import('../public/js/lib/parse.js');
  assert.equal(detectBank('Nu Pagamentos S.A. - Fatura de outubro'), 'Nubank');
  assert.equal(detectBank('Banco Itaú Unibanco S.A.'), 'Itaú');
  assert.equal(detectBank('qualquer coisa'), null);
  const items = [{ card: '', amount: 100 }, { card: '', amount: 50.5 }, { card: '', amount: -20 }];
  assert.equal(checkFatura(items, [], 130.5).ok, true);
  assert.equal(checkFatura(items, [], 150.5).ok, false);
  assert.equal(checkFatura(items, [], null).how, 'sem total');
  assert.equal(checkFatura([{ card: '1', amount: 100 }, { card: '1', amount: -10 }], [{ final: '1', valorTotal: 90 }]).ok, true);
  const rows = [{ amount: 1000 }, { amount: -300 }, { amount: -200 }];
  assert.equal(checkExtrato(rows, null, null, 1000, 500), true);
  assert.equal(checkExtrato(rows, 100, 600), true);
  assert.equal(checkExtrato(rows, null, null, 1000, 400), false);
});

test('validações: e-mail, senha, nome, telefone, números, mês e data', async () => {
  const v = await import('../public/js/lib/validate.js');
  assert.equal(v.checkEmail('luiz@gmail.com'), ''); assert.notEqual(v.checkEmail('luiz@gmail'), ''); assert.notEqual(v.checkEmail('luiz gmail.com'), ''); assert.notEqual(v.checkEmail(''), '');
  assert.notEqual(v.checkPassword('1234567'), ''); assert.equal(v.checkPassword('12345678'), '');
  assert.notEqual(v.checkName(' a '), ''); assert.equal(v.checkName('Luana'), ''); assert.notEqual(v.checkName('<script>'), '');
  assert.deepEqual(v.parsePhoneBR('(11) 98765-4321'), { phone: '5511987654321', error: '' });
  assert.deepEqual(v.parsePhoneBR('+55 21 3333-4444'), { phone: '552133334444', error: '' });
  assert.equal(v.parsePhoneBR('').error, ''); assert.equal(v.parsePhoneBR('').phone, null);
  assert.notEqual(v.parsePhoneBR('98765-4321').error, ''); assert.notEqual(v.parsePhoneBR('(11) 88765-4321').error, ''); assert.notEqual(v.parsePhoneBR('(05) 98765-4321').error, '');
  assert.equal(v.formatPhoneBR('5511987654321'), '(11) 98765-4321');
  assert.equal(v.checkNumber('17000', { min: 0 }), ''); assert.notEqual(v.checkNumber('-5', { min: 0 }), ''); assert.notEqual(v.checkNumber('abc'), ''); assert.notEqual(v.checkNumber('2.5', { integer: true }), ''); assert.equal(v.checkNumber('', { allowEmpty: true }), '');
  assert.equal(v.checkMonth('2026-11'), ''); assert.notEqual(v.checkMonth('2026-13'), ''); assert.notEqual(v.checkMonth('11/2026'), '');
  assert.equal(v.checkDate('2026-10-06'), ''); assert.notEqual(v.checkDate('2099-01-01'), ''); assert.notEqual(v.checkDate('1990-01-01'), ''); assert.notEqual(v.checkDate('abc'), '');
});

test('nota fiscal: divisão por categoria entra na sobra e no gasto por categoria', async () => {
  const { expandSplits } = await import('../public/js/lib/calc.js');
  const c2 = catIndex([{ name: 'Saúde', grp: 'dia' }, { name: 'Suplementos', grp: 'dia' }, { name: 'Salário', grp: 'renda' }, { name: 'Obra', grp: 'fora' }]);
  const txs = [
    { source: 'conta', amount: 5000, category: 'Salário' },
    { source: 'cartao', amount: 182.4, category: 'Saúde', splits: [{ category: 'Saúde', amount: 62.4 }, { category: 'Suplementos', amount: 120 }] },
    { source: 'conta', amount: -100, category: 'Saúde', splits: [{ category: 'Suplementos', amount: 70 }, { category: 'Obra', amount: 30 }] },
  ];
  assert.equal(expandSplits(txs).length, 5);
  const by = byCategory(txs, c2);
  assert.equal(Math.round(by['Suplementos'] * 100) / 100, 190); assert.equal(Math.round(by['Saúde'] * 100) / 100, 62.4); assert.equal(by['Obra'], undefined);
  const r = monthCalc(txs, c2);
  assert.equal(Math.round(r.card * 100) / 100, 182.4); assert.equal(r.D, 70); assert.equal(r.DX, 30);
  assert.equal(Math.round(r.res * 100) / 100, 4747.6);
});

test('nota fiscal: limpeza da leitura, divisão exata e lançamento correspondente', async () => {
  const { normalizeReceipt, splitByCategory, findMatches } = await import('../public/js/lib/receipt.js');
  const r = normalizeReceipt({ loja: ' Drogasil  ', data: '2026-10-12', total: 180, pagamento: 'cartao', itens: [
    { descricao: 'Dipirona', valor: 12.4, categoria: 'Saúde' }, { descricao: 'Whey 900g', valor: 120, categoria: 'Suplementos' },
    { descricao: 'Creatina', valor: 50, categoria: 'Suplementos' }, { descricao: '', valor: 3 }, { descricao: 'Brinde', valor: 0 }] }, '2026-10-29');
  assert.ok(r.ok); assert.equal(r.store, 'Drogasil'); assert.equal(r.items.length, 3); assert.equal(r.diff, -2.4); assert.equal(r.payment, 'cartao');
  const sp = splitByCategory(r.items, r.total);
  assert.equal(sp[0].category, 'Suplementos');
  assert.equal(Math.round(sp.reduce((a, p) => a + p.amount, 0) * 100) / 100, 180);
  // future date and missing total fall back safely; empty receipt is refused
  const f = normalizeReceipt({ data: '2027-01-01', itens: [{ descricao: 'X', valor: 10, categoria: 'Mercado' }], desconto: 1 }, '2026-10-29');
  assert.equal(f.date, '2026-10-29'); assert.equal(f.total, 9); assert.equal(f.store, 'Nota fiscal');
  assert.equal(normalizeReceipt({ itens: [] }, '2026-10-29').ok, false);
  const txs = [
    { id: 'a', source: 'cartao', date: '2026-10-13', amount: 180, description: 'DROGASIL' },
    { id: 'b', source: 'cartao', date: '2026-10-25', amount: 180, description: 'LONGE' },
    { id: 'c', source: 'conta', date: '2026-10-12', amount: -180.03, description: 'PIX DROGASIL' },
    { id: 'd', source: 'cartao', date: '2026-10-12', amount: 180, description: 'JA TEM NOTA', receipt: {} },
    { id: 'e', source: 'conta', date: '2026-10-12', amount: 180, description: 'ENTRADA' },
  ];
  assert.deepEqual(findMatches(txs, { total: 180, date: '2026-10-12' }).map(t => t.id), ['c', 'a']);
});

test('gráficos: período, validação e dados de cada tipo', async () => {
  const { periodMonths, checkChart, buildChart, chartSVG, legendHTML } = await import('../public/js/lib/charts.js');
  const all = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
  assert.deepEqual(periodMonths({ kind: 'm3' }, all, '2026-03'), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(periodMonths({ kind: 'mes' }, all, 'ano:2026'), ['2026-04']);
  assert.deepEqual(periodMonths({ kind: 'ano', year: '2025' }, all), ['2025-11', '2025-12']);
  assert.deepEqual(periodMonths({ kind: 'faixa', from: '2026-03', to: '2025-12' }, all), ['2025-12', '2026-01', '2026-02', '2026-03']);
  const base = { title: 'Teste', type: 'barra', metric: 'sobra', period: { kind: 'm6' } };
  assert.equal(checkChart(base), '');
  assert.match(checkChart({ ...base, title: 'x' }), /nome/);
  assert.match(checkChart({ ...base, type: 'pizza' }), /Pizza/);
  assert.match(checkChart({ ...base, metric: 'escolhidas', cats: [] }), /categoria/);
  assert.match(checkChart({ ...base, period: { kind: 'faixa', from: '2026-05', to: '2026-01' } }), /antes/);
  const cats = { '2026-01': { Mercado: 1000, Farmácia: 200, Lazer: 0 }, '2026-02': { Mercado: 800, Suplementos: 150 } };
  const src = { months: ['2026-01', '2026-02'], calc: k => ({ res: k === '2026-01' ? 500 : -200, renda: 5000, E: 0, out: 4000, cardTotal: 3000, tx: 0.1 }), cats: k => cats[k] };
  const pie = buildChart({ ...base, type: 'pizza', metric: 'categorias' }, src);
  assert.equal(pie.kind, 'pie'); assert.deepEqual(pie.labels, ['Mercado', 'Farmácia', 'Suplementos']); assert.deepEqual(pie.series[0].values, [1800, 200, 150]);
  const lines = buildChart({ ...base, type: 'linha', metric: 'escolhidas', cats: ['Suplementos'] }, src);
  assert.equal(lines.kind, 'lines'); assert.deepEqual(lines.series[0].values, [0, 150]);
  const bars = buildChart({ ...base, metric: 'rendaGastos' }, src);
  assert.equal(bars.kind, 'bars'); assert.equal(bars.series.length, 2); assert.deepEqual(bars.series[0].values, [0, 0]);
  const tx = buildChart({ ...base, type: 'linha', metric: 'taxa' }, src);
  assert.equal(tx.unit, 'pct');
  assert.ok(buildChart({ ...base, metric: 'escolhidas', cats: ['Nada'], type: 'pizza' }, src).empty);
  assert.ok(buildChart(base, { ...src, months: [] }).empty);
  for (const d of [pie, lines, bars, tx, buildChart({ ...base, metric: 'categorias' }, { ...src, months: ['2026-01'] })]) {
    const svg = chartSVG(d, { title: 'x' });
    assert.match(svg, /^<svg/); assert.doesNotMatch(svg, /NaN|undefined/);
    assert.doesNotMatch(legendHTML(d), /NaN|undefined/);
  }
});

test('insights: faltam dados, vermelho, economia, gasto alto, cartão, fixas e pendências', async () => {
  const { insights } = await import('../public/js/lib/insights.js');
  const M = { '2026-07': { res: 1500, renda: 10000, E: 10000, out: 8000, tx: 0.15 }, '2026-08': { res: 1500, renda: 10000, E: 10000, out: 8000, tx: 0.15 },
    '2026-09': { res: 3000, renda: 10000, E: 10000, out: 7000, tx: 0.3 }, '2026-10': { res: -1200, renda: 10000, E: 10000, out: 11200, tx: -0.12 } };
  const cats = { '2026-07': { Mercado: 2000, Lazer: 500 }, '2026-08': { Mercado: 2000, Lazer: 500 }, '2026-09': { Mercado: 1800, Lazer: 300 }, '2026-10': { Mercado: 3500, Lazer: 2000 } };
  const base = { months: Object.keys(M), calc: k => M[k], cats: k => cats[k], fixed: () => 6000, manualCount: () => 0, pending: k => k === '2026-10' ? 3 : 0,
    goals: { savings: 0.2, cardMonthly: 5000, patrimonio: 1e6 }, nextFatura: { month: '2026-11', total: 6200 }, etaYears: () => 12 };
  const has = (upto) => (k, src) => k <= upto;
  const a = insights({ ...base, today: '2026-11-15', has: has('2026-10') });
  const ids = a.map(x => x.id);
  assert.equal(a[0].id, 'red'); assert.match(a[0].text, /Mercado e Lazer/);
  assert.ok(ids.includes('high')); assert.match(a.find(x => x.id === 'high').text, /Lazer \(\+R\$ 1\.567\)/);
  assert.ok(ids.includes('card') && ids.includes('fixed') && ids.includes('pending'));
  assert.ok(ids.includes('missing')); assert.match(a.find(x => x.id === 'missing').text, /fatura de novembro/);
  assert.ok(!ids.includes('saved'));
  // a good month: congratulations with the time to reach the goal; month ending without entries
  const b = insights({ ...base, months: ['2026-07', '2026-08', '2026-09'], today: '2026-10-28', has: (k, src) => k <= '2026-09' || (src === 'cartao' && k === '2026-10'), nextFatura: null, fixed: () => 0, pending: () => 0 });
  const bi = b.map(x => x.id);
  assert.ok(bi.includes('saved')); assert.match(b.find(x => x.id === 'saved').text, /30% da renda.*cerca de 12 anos/);
  assert.ok(bi.includes('low')); assert.ok(bi.includes('ending')); assert.match(b.find(x => x.id === 'ending').text, /Faltam 4 dias/);
  assert.ok(!bi.includes('missing'));
  // no data at all: nothing to say
  assert.deepEqual(insights({ ...base, months: [], today: '2026-10-10', has: () => false }), []);
});

test('grupos: receita e despesa, fixa, variável ou extra', async () => {
  const { KINDS, kindOf, kindByKey } = await import('../public/js/lib/calc.js');
  assert.equal(KINDS.length, 7);
  assert.equal(kindOf({ grp: 'dia', recurring: true }).label, 'Despesa fixa');
  assert.equal(kindOf({ grp: 'dia', recurring: null }).label, 'Despesa variável');
  assert.equal(kindOf({ grp: 'renda' }).label, 'Receita fixa');
  assert.equal(kindOf({ grp: 'fora' }).label, 'Despesa extra');
  assert.deepEqual([kindByKey('dfixa').grp, kindByKey('dfixa').recurring], ['dia', true]);
});

test('fechamento do mês: o que falta, despesas fixas sumidas e retrospectiva', async () => {
  const { checklist, retrospective, monthToClose } = await import('../public/js/lib/closing.js');
  const idx = catIndex([{ name: 'Salário', grp: 'renda' }, { name: 'Mercado', grp: 'dia' }, { name: 'Escola', grp: 'dia', recurring: true }, { name: 'Aluguel', grp: 'dia', recurring: true }]);
  const T = (month, source, amount, category, extra = {}) => ({ id: Math.random().toString(36).slice(2), month, source, amount, category, date: month + '-10', description: category, manual: false, ...extra });
  const txs = [
    ...['2026-06', '2026-07', '2026-08'].flatMap(k => [T(k, 'conta', 10000, 'Salário'), T(k, 'conta', -2000, 'Escola'), T(k, 'conta', -3000, 'Aluguel'), T(k, 'cartao', 1000, 'Mercado')]),
    T('2026-09', 'conta', 10000, 'Salário'), T('2026-09', 'conta', -3000, 'Aluguel'), T('2026-09', 'conta', -500, 'A classificar'),
    T('2026-09', 'cartao', 300, 'Mercado', { manual: true }),
  ];
  assert.equal(monthToClose(['2026-08', '2026-09', '2026-10'], { '2026-08': {} }, '2026-10-30'), '2026-09');
  assert.equal(monthToClose(['2026-10'], {}, '2026-10-30'), null);
  const c = checklist({ month: '2026-09', txs, idx });
  assert.deepEqual(c.data.map(d => [d.key, d.done]), [['conta', true], ['cartao', false]]);
  assert.equal(c.manual.length, 1); assert.equal(c.pending.length, 1);
  assert.deepEqual(c.missing, [{ category: 'Escola', avg: 2000 }]);
  assert.equal(c.ready, false);
  assert.equal(checklist({ month: '2026-09', txs, idx, skip: { cartao: true } }).data[1].done, true);
  const r = retrospective({ month: '2026-08', txs, idx, goals: { savings: 0.3 } });
  assert.equal(r.res, 4000); assert.equal(r.tx, 0.4); assert.equal(r.hitGoal, true); assert.equal(r.vsAvg, 0);
  assert.equal(r.top[0].name, 'Aluguel'); assert.equal(Math.round(r.top[0].share * 100), 50);
});

test('orçamento por categoria: uso, ritmo, sugestão e aviso', async () => {
  const { budgetStatus, suggestBudgets, budgetsOf } = await import('../public/js/lib/budget.js');
  assert.deepEqual(budgetsOf({ budgets: [['Mercado', 1500], ['Lazer', 0], ['x']] }), { Mercado: 1500 });
  assert.deepEqual(budgetsOf({ budgets: { Mercado: '1200', Zero: 0 } }), { Mercado: 1200 });
  assert.deepEqual(budgetsOf({}), {});
  const { insights } = await import('../public/js/lib/insights.js');
  const rows = budgetStatus({ budgets: { Mercado: 2000, Lazer: 500, Escola: 1000, Zero: 0 }, spent: { Mercado: 1000, Lazer: 600, Escola: 300 }, month: '2026-10', today: '2026-10-10' });
  assert.deepEqual(rows.map(r => [r.category, r.status]), [['Lazer', 'over'], ['Mercado', 'attention'], ['Escola', 'ok']]);
  assert.equal(rows[1].projected, 3100); assert.equal(rows[1].daysLeft, 21);
  const past = budgetStatus({ budgets: { Mercado: 2000 }, spent: { Mercado: 1700 }, month: '2026-09', today: '2026-10-10' });
  assert.equal(past[0].status, 'attention'); assert.equal(past[0].projected, 1700);
  assert.deepEqual(suggestBudgets([{ Mercado: 2010, Lazer: 400, 'A classificar': 900 }, { Mercado: 1890, Lazer: 520 }]), { Mercado: 1950, Lazer: 450 });
  const ins = insights({ today: '2026-10-10', months: ['2026-10'], calc: () => ({ res: 0, renda: 0, E: 0, out: 0, tx: 0 }), cats: () => ({ Mercado: 1700, Lazer: 600 }), has: () => true, manualCount: () => 1, pending: () => 0, goals: {}, nextFatura: null, budgets: { Mercado: 2000, Lazer: 500 } });
  const b = ins.find(x => x.id === 'budget');
  assert.equal(b.title, 'Orçamento estourado: Lazer'); assert.match(b.text, /Lazer já passou R\$ 100 do limite de R\$ 500\. Mercado já usou 85% de R\$ 2\.000 e faltam 21 dias\./);
});
