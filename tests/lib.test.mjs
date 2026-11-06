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
  // the card bill closed (day 24) and is not in the app yet: first, with a link to send it; once sent, gone
  const c = insights({ ...base, closeDay: 24, today: '2026-11-26', has: (k, src) => !(src === 'cartao' && k === '2026-11') });
  const cf = c.find(x => x.id === 'fatura'); assert.ok(cf); assert.match(cf.text, /Fechou dia 24\/11.*dinheiro de novembro/); assert.deepEqual(cf.action.go, ['lancar', '#drop']);
  assert.ok(!c.find(x => x.id === 'missing')?.text.includes('fatura de novembro'));
  assert.ok(!insights({ ...base, closeDay: 24, today: '2026-11-26', has: () => true }).some(x => x.id === 'fatura'));
  assert.ok(!insights({ ...base, closeDay: 24, today: '2026-11-24', has: (k, src) => !(src === 'cartao' && k === '2026-11') }).some(x => x.id === 'fatura'), 'not on the closing day itself');
  assert.ok(!insights({ ...base, closeDay: 24, today: '2026-12-02', has: (k, src) => !(src === 'cartao' && k === '2026-11') }).some(x => x.id === 'fatura'), 'only up to 6 days after');
  // closing late in the month: still counted in the first days of the next one
  const e = insights({ ...base, closeDay: 28, today: '2026-12-02', has: (k, src) => !(src === 'cartao' && k === '2026-11') });
  assert.match(e.find(x => x.id === 'fatura')?.text || '', /Fechou dia 28\/11/);
  assert.ok(!insights({ ...base, closeDay: 24, today: '2026-11-26', has: (k, src) => src !== 'cartao' }).some(x => x.id === 'fatura'), 'only for families that already sent a card bill');
  // what the bank charged: interest is bad news, fees are information
  const F = (j, t) => ({ total: j + t, by: { juros: j, iof: 0, anuidade: t, tarifa: 0 } });
  const j = insights({ ...base, today: '2026-11-15', has: () => true, fees: () => F(45.9, 0), feesYear: () => F(45.9, 0) }).find(x => x.id === 'juros');
  assert.equal(j.tone, 'bad'); assert.match(j.text, /outubro o banco cobrou R\$\s?45,90 de juros/);
  const tf = insights({ ...base, today: '2026-11-15', has: () => true, fees: () => F(0, 125), feesYear: () => F(0, 1500) }).find(x => x.id === 'tarifas');
  assert.match(tf.text, /anuidade; R\$ 1\.500 nos últimos 12 meses/);
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

test('assinaturas: acha cobranças que se repetem e o aumento de preço', async () => {
  const { findRecurring, merchant } = await import('../public/js/lib/recurring.js');
  assert.equal(merchant('NETFLIX.COM*123 SAO PAULO'), 'NETFLIX COM SAO');
  const ms = ['2026-06', '2026-07', '2026-08', '2026-09'];
  const idx = catIndex([{ name: 'Assinaturas', grp: 'dia' }, { name: 'Mercado', grp: 'dia' }, { name: 'Fatura', grp: 'neutro' }]);
  const T = (month, description, amount, extra = {}) => ({ month, source: 'cartao', description, amount, category: 'Assinaturas', ...extra });
  const txs = [
    ...ms.map((m, i) => T(m, 'NETFLIX.COM', i < 3 ? 39.9 : 44.9)),
    ...ms.slice(1).map(m => T(m, 'SPOTIFY', 21.9)),
    ...ms.map((m, i) => T(m, 'SUPERMERCADO X', [400, 900, 300, 1200][i], { category: 'Mercado' })),
    ...ms.map(m => T(m, 'LOJA MOVEIS', 400, { installment: '02/10' })),
    ...ms.map(m => T(m, 'PAGAMENTO FATURA', 5000, { category: 'Fatura' })),
    T('2026-08', 'ACADEMIA', 120), T('2026-09', 'ACADEMIA', 120),
  ];
  const r = findRecurring(txs, ms, { idx });
  assert.deepEqual(r.map(x => x.name), ['NETFLIX COM', 'SPOTIFY']);
  assert.equal(r[0].rise, 5); assert.equal(r[0].prev, 39.9); assert.equal(r[0].current, true);
  assert.equal(r[1].rise, 0);
});

test('divisão do casal: quem pagou o quê e o acerto', async () => {
  const { settle, payerOf } = await import('../public/js/lib/settle.js');
  const idx = catIndex([{ name: 'Mercado', grp: 'dia' }, { name: 'Salário', grp: 'renda' }, { name: 'Obra', grp: 'fora' }]);
  const members = [{ user_id: 'a' }, { user_id: 'b' }];
  const split = { cards: { '1111': 'a', '2222': 'b' }, conta: 'a' };
  const txs = [
    { source: 'cartao', card: '1111', amount: 1000, category: 'Mercado' },
    { source: 'cartao', card: '2222', amount: 200, category: 'Mercado' },
    { source: 'conta', amount: -600, category: 'Obra' },
    { source: 'conta', amount: 8000, category: 'Salário' },
    { source: 'cartao', manual: true, created_by: 'b', amount: 100, category: 'Mercado' },
    { source: 'cartao', card: '9999', amount: 50, category: 'Mercado' },
  ];
  assert.equal(payerOf(txs[4], split), 'b'); assert.equal(payerOf(txs[5], split), null);
  const s = settle({ txs, idx, members, split });
  assert.equal(s.total, 1950); assert.equal(s.unknown, 50);
  assert.deepEqual(s.balances.map(b => [b.id, b.paid, b.due]), [['a', 1600, 950], ['b', 300, 950]]);
  assert.deepEqual(s.transfers, [{ from: 'b', to: 'a', amount: 650 }]);
  const s2 = settle({ txs, idx, members, split: { ...split, share: { a: 0.7, b: 0.3 } } });
  assert.deepEqual(s2.transfers, [{ from: 'b', to: 'a', amount: 270 }]);
});

import { pricingCalc } from '../public/js/lib/pricing.js';
test('pricingCalc: receita, custos e ponto de equilíbrio', () => {
  const r = pricingCalc({ families: 1000, payingPct: 10, priceMonthly: 10, priceYearly: 120, yearlyShare: 50, activePct: 50, aiPerFamily: 1, feePct: 5, fx: 5, supabaseUsd: 25, vercelUsd: 20 });
  assert.equal(r.payers, 100); assert.equal(r.revenue, 1000); assert.equal(r.fees, 50); assert.equal(r.ai, 500); assert.equal(r.infra, 225);
  assert.equal(r.result, 225); assert.equal(r.breakEven, 500);
  assert.equal(pricingCalc({ families: 100, payingPct: 0, priceMonthly: 10, priceYearly: 100, yearlyShare: 0, activePct: 100, aiPerFamily: 2, feePct: 0, fx: 5, supabaseUsd: 0, vercelUsd: 0 }).breakEven, null);
});

import { FAQ, searchFaq, answerPrompt } from '../public/js/lib/faq.js';
test('searchFaq: acha pela palavra, sem acento e ignora palavras vazias', () => {
  assert.equal(searchFaq(FAQ, 'o que é a meta')[0].id, 'metas');
  assert.equal(searchFaq(FAQ, 'SENHA do pdf')[0].id, 'senha');
  assert.equal(searchFaq(FAQ, 'convidar minha esposa')[0].id, 'convite');
  assert.equal(searchFaq(FAQ, '').length, FAQ.length);
  assert.equal(searchFaq(FAQ, 'xyzzy plutao').length, 0);
  assert.ok(new Set(FAQ.map(x => x.id)).size === FAQ.length);
  assert.ok(answerPrompt(FAQ).includes('O que são as metas?'));
});

import { NEWS, unseenNews, replyTitle, replyTemplate, firstName } from '../public/js/lib/news.js';
test('mensagens: novidades não vistas, título e recado com o nome', () => {
  const items = [{ id: 'a', at: '2026-10-01T00:00:00Z', title: 'A' }, { id: 'b', at: '2026-10-20T00:00:00Z', title: 'B' }, { id: 'c', at: '2099-01-01T00:00:00Z', title: 'futuro' }];
  assert.deepEqual(unseenNews(items, {}).map(x => x.id), ['b', 'a']);
  assert.deepEqual(unseenNews(items, { seenAt: '2026-10-01T00:00:00Z' }).map(x => x.id), ['b']);
  assert.deepEqual(unseenNews(items, { createdAt: '2026-10-25T00:00:00Z' }).map(x => x.id), []);
  assert.equal(replyTitle('ideia', 'Luana Souza'), 'Luana, a sua ideia virou realidade!');
  assert.equal(replyTitle('erro', ''), 'O erro que você mandou foi corrigido!');
  assert.ok(replyTemplate('critica', 'Ana', 'A régua confunde').startsWith('Oi, Ana! Você comentou que "A régua confunde". Mudamos: '));
  assert.equal(firstName('  Luiz Tufik '), 'Luiz');
  assert.ok(NEWS.every(n => n.id && n.at && n.title && n.items.length));
});

import { tapCell, tapLabel, cleanError } from '../public/js/lib/navlog.js';
test('navegação: célula do toque, nome do botão e erro sem dados pessoais', () => {
  assert.deepEqual(tapCell(195, 100, 390), { x: 10, y: 5 });
  assert.deepEqual(tapCell(389, 10, 390), { x: 19, y: 0 });
  assert.equal(tapCell(10, 99999, 390), null);
  const fake = (attrs, text, inField = false) => ({ closest: s => s.includes('input') ? (inField ? {} : null) : fakeEl, getAttribute: k => attrs[k] || null, textContent: text, id: '' });
  let fakeEl = fake({}, '  Fechar   setembro  '); assert.equal(tapLabel({ closest: () => fakeEl }), 'Fechar setembro');
  fakeEl = fake({}, 'Pagar R$ 1.234,56 agora'); assert.equal(tapLabel({ closest: () => fakeEl }), 'Pagar # agora');
  fakeEl = fake({ 'aria-label': 'Abrir menu' }, ''); assert.equal(tapLabel({ closest: () => fakeEl }), 'Abrir menu');
  assert.equal(tapLabel({ closest: () => null }), '');
  fakeEl = { ...fake({}, 'Falar ou escrever"Gastei 45 na padaria"'), querySelector: s => s === 'strong' ? { textContent: 'Falar ou escrever' } : null };
  assert.equal(tapLabel({ closest: () => fakeEl }), 'Falar ou escrever', 'bloco com título e exemplo: só o título');
  assert.equal(cleanError('Falhou para ana@x.com no cartão 5502 0912 3456 7788'), 'Falhou para <e-mail> no cartão #');
  assert.equal(cleanError('Script error.'), '');
  assert.equal(cleanError('x'.repeat(500)).length, 400);
});

import { parseBRL, quickRow } from '../public/js/lib/quick.js';
test('atalho do iPhone: valor como o Atalhos manda e a linha do lançamento', () => {
  assert.equal(parseBRL('R$ 45,90'), 45.9); assert.equal(parseBRL('R$ 1.234,56'), 1234.56); assert.equal(parseBRL('45.9'), 45.9);
  assert.equal(parseBRL(12.5), 12.5); assert.equal(parseBRL('1.234'), 1234); assert.equal(parseBRL('-R$ 10,00'), 10); assert.ok(isNaN(parseBRL('abc')));
  const r = quickRow({ valor: 'R$ 45,90', loja: '  PADARIA   PAO QUENTE ', cartao: 'Nubank' }, { household: 'h', user: 'u', today: '2026-10-28', closeDay: 24 });
  assert.equal(r.month, '2026-11'); assert.equal(r.day, '28/10'); assert.equal(r.description, 'PADARIA PAO QUENTE'); assert.equal(r.amount, 45.9);
  assert.equal(r.source, 'cartao'); assert.equal(r.manual, true); assert.equal(r.created_by, 'u'); assert.equal(r.category, 'A classificar');
  assert.equal(quickRow({ valor: '0' }, { household: 'h', user: 'u', today: '2026-10-01' }).error, 'valor');
  assert.equal(quickRow({ valor: 10 }, { household: 'h', user: 'u', today: '2026-10-01' }).description, 'Compra com Apple Pay');
});

import { buildFeed, unread } from '../public/js/lib/feed.js';
test('sininho: novidades, recados e família dos últimos 30 dias, mais novo primeiro', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const f = buildFeed({ now, me: 'u1', myName: 'Luiz Elias',
    news: [{ id: 'a', at: '2026-10-30T10:00:00Z', title: 'Novo', items: ['x'] }, { id: 'velha', at: '2026-08-01T00:00:00Z', title: 'Velha' }],
    replies: [{ id: 7, kind: 'ideia', text: 'ver por semana', reply: 'Oi! Ficou pronto.', replied_at: '2026-10-31T09:00:00Z' }, { id: 8, text: 'x', reply: null }],
    imports: [{ id: 'i1', source: 'cartao', month: '2026-10', created_by: 'u2', created_at: '2026-10-29T10:00:00Z' }, { id: 'i2', source: 'conta', month: '2026-10', created_by: 'u1', created_at: '2026-10-29T11:00:00Z' }, { id: 'i3', source: 'backup', created_by: 'u2', created_at: '2026-10-29T11:00:00Z' }],
    closed: { '2026-09': { at: '2026-10-02T10:00:00Z', by: 'Luana' }, '2026-08': { at: '2026-10-01T10:00:00Z', by: 'Luiz' } },
    members: [{ user_id: 'u2', display_name: 'Luana Elias' }] });
  assert.deepEqual(f.map(x => x.id), ['r:7', 'n:a', 'i:i1', 'c:2026-09']);
  assert.equal(f[2].title, 'Luana importou a fatura de outubro'); assert.equal(f[3].title, 'Luana fechou setembro');
  assert.deepEqual(unread(f, { seenAt: '2026-10-30T00:00:00Z', shown: ['r:7'] }).map(x => x.id), ['n:a']);
});

// ---------- what kind of document (by content, not by extension) ----------
import { classifyText, aiKind } from '../public/js/lib/classify.js';
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join(' ');
test('classifyText: lê o conteúdo para saber o tipo do documento', () => {
  const k = (t, o) => classifyText(t, o).kind;
  assert.equal(k('Comprovante de transferência Pix enviado R$ 150,00 Data 12/10/2026 Quem recebeu Maria Instituição Banco X Quem pagou João ID da transação E123 Chave Pix: celular'), 'comprovante');
  // Paying the card bill is a receipt, even though it says "fatura".
  assert.equal(k('Comprovante de pagamento Pagamento realizado Fatura cartão de crédito Valor R$ 3.210,55 Data 10/10/2026 Autenticação ABC123 Vencimento 10/10/2026'), 'comprovante');
  assert.equal(k('Comprovante de pagamento de boleto Beneficiário Energia Valor pago R$ 245,10 Linha digitável 8360 Autenticação 9988'), 'comprovante');
  assert.equal(k('Fatura do cartão Vencimento 10/11/2026 Total desta fatura R$ 2.345,67 Pagamento mínimo R$ 234,56 Limite disponível 5.000,00 ' + many(15, i => `${String(i + 1).padStart(2, '0')}/10 LOJA ${i} ${i + 10},90`)), 'fatura');
  assert.equal(k('Extrato de conta corrente Agência 1234 Saldo anterior 1.000,00 ' + many(15, i => `${String(i + 1).padStart(2, '0')}/09 PIX ENVIADO FULANO -${i + 10},00`) + ' Saldo final 500,00'), 'extrato');
  assert.equal(k('MERCADO BOM PRECO CNPJ 12.345.678/0001-90 DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA Qtde Un Vl Unit ARROZ 1 UN 25,90 Valor a pagar R$ 30,88 Consulte pela chave de acesso'), 'nota');
  assert.equal(k('Extrato de investimentos Fundos de investimento saldo bruto 10.000,00 saldo líquido 9.900,00 CDB Tesouro Direto Rentabilidade', { pages: 4 }), 'investimentos');
  // Many dated amounts are a list of transactions, never a single receipt, even if "Pix" shows up a lot.
  assert.notEqual(k(many(20, i => `${String(i + 1).padStart(2, '0')}/09 PIX ENVIADO comprovante ${i},00`), { pages: 3 }), 'comprovante');
  // When the words do not say, nobody guesses: the reading assistant looks at the document.
  assert.equal(k('Obrigado pela preferência, volte sempre ao nosso estabelecimento.'), null);
  assert.equal(classifyText('').empty, true);
});
test('aiKind: a resposta da leitura vira um tipo que o app conhece', () => {
  assert.equal(aiKind('comprovante'), 'comprovante'); assert.equal(aiKind('Comprovante de pagamento da fatura'), 'comprovante');
  assert.equal(aiKind('fatura'), 'fatura'); assert.equal(aiKind('extrato'), 'extrato'); assert.equal(aiKind('nota'), 'nota');
  assert.equal(aiKind('investimentos'), 'investimentos'); assert.equal(aiKind('outro'), null); assert.equal(aiKind(undefined), null);
});

import { sniffBase64, docMessage, docPrompt } from '../public/js/lib/quick.js';
test('compartilhar no iPhone: o arquivo é reconhecido pelos primeiros bytes, não pelo nome', () => {
  const b64 = bytes => Buffer.from(bytes).toString('base64');
  assert.equal(sniffBase64(b64('%PDF-1.7 resto')).type, 'application/pdf');
  assert.equal(sniffBase64('data:application/octet-stream;base64,' + b64([0xFF, 0xD8, 0xFF, 0xE0, 1, 2])).type, 'image/jpeg');
  assert.equal(sniffBase64(b64([0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10])).type, 'image/png');
  // Shortcuts may break the base64 in lines.
  assert.equal(sniffBase64(b64('%PDF-1.4 ' + 'x'.repeat(100)).replace(/(.{20})/g, '$1\n')).type, 'application/pdf');
  assert.equal(sniffBase64(b64([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])).error, 'heic');
  assert.equal(sniffBase64(b64('olá, não sou arquivo')).error, 'formato');
  assert.equal(sniffBase64('').error, 'vazio');
  assert.equal(sniffBase64(b64('%PDF-1.4 ') + 'A'.repeat(4.5 * 1024 * 1024)).error, 'grande');
  assert.match(docMessage('fatura'), /fatura do cartão.*Fatura ou extrato/);
  assert.match(docMessage('nota'), /Foto da nota/);
  assert.match(docMessage('outro'), /Não achei um comprovante/);
  assert.match(docPrompt({ family: 'Família Souza', today: '2026-10-31', categories: [{ name: 'Mercado', grp: 'dia' }] }), /Mercado \[dia\]/);
});

import { lockMinutes, isExpired, lockText, byeMessage, toB64u, fromB64u, LOCK_OPTIONS, idleState } from '../public/js/lib/lock.js';
test('bloqueio: tempo sem uso, textos de segurança e chave da digital', () => {
  assert.equal(lockMinutes('15'), 15); assert.equal(lockMinutes('0'), 5); assert.equal(lockMinutes(undefined), 5); assert.ok(!LOCK_OPTIONS.includes(0));
  const now = Date.parse('2026-10-31T15:00:00Z');
  assert.equal(isExpired(now - 4 * 60e3, now, 5), false); assert.equal(isExpired(now - 5 * 60e3, now, 5), true);
  assert.equal(isExpired(null, now, 1), false, 'acabou de entrar: não bloqueia');
  assert.equal(isExpired(now + 60e3, now, 1), false, 'relógio adiantado não bloqueia em loop');
  assert.equal(lockText({ name: 'Ana Souza', minutes: 1 }).hello, 'Olá, Ana'); assert.match(lockText({ minutes: 1 }).title, /desconectado por inatividade/); assert.match(lockText({ minutes: 1 }).text, /Ficou 1 minuto sem uso/);
  assert.match(lockText({ reason: 'manual' }).title, /Você saiu/); assert.match(lockText({ minutes: 60, scope: 'central' }).text, /Ficou 1 hora sem uso\. Para proteger a Central/);
  assert.match(lockText({ minutes: 240, scope: 'central' }).text, /4 horas/); assert.match(lockText({ reason: 'manual', scope: 'central' }).title, /saiu da Central/);
  assert.equal(lockMinutes(60), 5); assert.equal(lockMinutes(45), 5);
  assert.equal(lockMinutes(undefined, 'central'), 60); assert.equal(lockMinutes('120', 'central'), 120); assert.equal(lockMinutes('5', 'central'), 60);
  const t0 = 1e12;
  assert.deepEqual(idleState(t0, t0 + 10e3, 1), { phase: 'ok', left: 50 });
  assert.deepEqual(idleState(t0, t0 + 35e3, 1), { phase: 'warn', left: 25 });
  assert.equal(idleState(t0, t0 + 60e3, 1).phase, 'expired');
  assert.equal(idleState(null, t0, 1).phase, 'ok');
  assert.equal(idleState(t0, t0 + 59 * 60e3 + 40e3, 60).phase, 'warn');
  const b = byeMessage('Beto Lima'); assert.equal(b.title, 'Até logo, Beto!'); assert.ok(b.items.some(i => /nunca pede a senha do banco/.test(i)));
  assert.equal(byeMessage('').title, 'Até logo!');
  const raw = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63]);
  assert.deepEqual([...fromB64u(toB64u(raw))], [...raw]); assert.ok(!/[+/=]/.test(toB64u(raw)));
});
import { shouldOfferBio } from '../public/js/lib/lock.js';
test('digital: o app oferece até 3 vezes, uma por semana, só onde o celular tem', () => {
  const now = Date.parse('2026-10-31T15:00:00Z');
  assert.equal(shouldOfferBio({ supported: true, on: false, now }), true);
  assert.equal(shouldOfferBio({ supported: false, on: false, now }), false);
  assert.equal(shouldOfferBio({ supported: true, on: true, now }), false);
  assert.equal(shouldOfferBio({ supported: true, on: false, asks: { n: 1, at: now - 2 * 864e5 }, now }), false);
  assert.equal(shouldOfferBio({ supported: true, on: false, asks: { n: 1, at: now - 8 * 864e5 }, now }), true);
  assert.equal(shouldOfferBio({ supported: true, on: false, asks: { n: 3, at: now - 30 * 864e5 }, now }), false);
});

import { demoSummary } from '../public/js/lib/demo.js';
test('mês de exemplo: números coerentes com o cálculo de verdade', () => {
  const d = demoSummary();
  assert.equal(d.income, 16450); assert.ok(d.res > 0 && d.res < d.income); assert.equal(Math.round(d.res + d.out), 16450);
  assert.equal(d.top.length, 5); assert.equal(d.top[0].cat, 'Moradia e contas');
  assert.ok(d.tx > 0.05 && d.tx < 0.4, 'taxa de quem guarda é plausível: ' + d.tx);
  assert.match(d.findings[0], /Delivery e restaurante somaram R\$ 1\.290/);
});

import { uniqueRules, prepareRules as prep2, classify as cls2 } from '../public/js/lib/categorize.js';
test('backup: regras repetidas não travam a importação e continuam valendo', () => {
  const rules = [
    { source: 'conta', kind: 'regex', pattern: 'PIX RECEBIDO.*LUANA', category: 'Salário Luana', min_abs: 5000, priority: 108 },
    { source: 'conta', kind: 'regex', pattern: 'PIX RECEBIDO.*LUANA', category: 'Outras entradas', priority: 109 },
    { source: 'cartao', kind: 'exact', pattern: 'NETFLIX', category: 'Lazer' }, { source: 'cartao', kind: 'exact', pattern: 'NETFLIX', category: 'Assinaturas' },
  ];
  const u = uniqueRules(rules);
  assert.equal(new Set(u.map(r => r.source + r.kind + r.pattern)).size, u.length);
  assert.equal(u.length, 3); assert.equal(u.find(r => r.pattern === 'NETFLIX').category, 'Assinaturas');
  const P = prep2(u);
  assert.equal(cls2({ source: 'conta', description: 'PIX RECEBIDO LUANA F', amount: 9000 }, P)?.category, 'Salário Luana');
  assert.equal(cls2({ source: 'conta', description: 'PIX RECEBIDO LUANA F', amount: 300 }, P)?.category, 'Outras entradas');
});

import { rankCategories, suggestCategories, groupCategories } from '../public/js/lib/catsearch.js';
test('categoria: busca por palavra do dia a dia e sugestões pela descrição', () => {
  const cats = [{ name: 'Transporte', grp: 'dia' }, { name: 'Combustível', grp: 'dia' }, { name: 'Mercado', grp: 'dia' }, { name: 'Restaurantes e delivery', grp: 'dia' },
    { name: 'Moradia e contas', grp: 'dia', recurring: true }, { name: 'Salário', grp: 'renda', recurring: true }, { name: 'Pagamento da fatura do cartão', grp: 'neutro' }, { name: 'Guaratuba: reforma', grp: 'fora' }];
  assert.deepEqual(rankCategories('estacionamento', cats), ['Transporte'], 'estacionamento acha Transporte');
  assert.deepEqual(rankCategories('estacion', cats), ['Transporte'], 'enquanto digita também acha');
  assert.equal(rankCategories('farma', cats).length, 0, 'sem categoria parecida, nada');
  assert.equal(rankCategories('merc', cats)[0], 'Mercado');
  assert.equal(rankCategories('reforma', cats)[0], 'Guaratuba: reforma', 'palavra no meio do nome');
  assert.equal(rankCategories('', cats).length, cats.length);
  assert.deepEqual(suggestCategories('ESTAPAR*ZAD SAO PAULO', cats).slice(0, 1), ['Transporte']);
  assert.equal(suggestCategories('AUTO POSTO ENGENHEIRO', cats)[0], 'Combustível');
  assert.equal(suggestCategories('IFD*RS DELIVERY', cats)[0], 'Restaurantes e delivery');
  assert.deepEqual(suggestCategories('XPTO 123', cats, { Mercado: 9, Transporte: 2 }), ['Mercado', 'Transporte'], 'sem pista, as mais usadas');
  const g = groupCategories(cats).map(x => x.title);
  assert.equal(g[0], 'Gastos do dia a dia'); assert.ok(g.includes('Gastos fora do comum')); assert.ok(g.some(t => t.startsWith('Não conta')));
});

import { docKeys, compareStatement } from '../public/js/lib/statements.js';
test('duas faturas no mesmo mês: o app vê se é a mesma reenviada ou outro cartão antes de perguntar', () => {
  const visa = [{ description: 'MERCADO', amount: 300, day: '01/09' }, { description: 'POSTO', amount: 200, day: '02/09' }, { description: 'FARMACIA', amount: 50, day: '03/09' }];
  const legacy = visa.map(r => ({ ...r, card: null }));
  // Mastercard with only the annual fee, against a Visa bill saved before without card numbers: goes alongside.
  const mc = [{ description: 'ANUIDADE DIFERENCIADA', amount: 0, day: '23/09', card: '8514' }];
  let c = compareStatement({ keys: docKeys('cartao', mc), rows: mc, existing: legacy });
  assert.equal(c.mode, 'alongside'); assert.deepEqual(c.cards, []); assert.equal(c.unknown, false);
  // The same Visa bill sent again (now with card numbers): replaces the old rows without card.
  const visa2 = visa.map(r => ({ ...r, card: '4388' }));
  c = compareStatement({ keys: docKeys('cartao', visa2), rows: visa2, existing: legacy });
  assert.equal(c.mode, 'replace'); assert.equal(c.unknown, true);
  // Visa again with Mastercard already there: replaces only the Visa.
  c = compareStatement({ keys: ['4388'], rows: visa2, existing: [...visa2, ...mc] });
  assert.equal(c.mode, 'replace'); assert.deepEqual(c.cards, ['4388']); assert.deepEqual(c.others, ['8514']);
  // A bill from another card, cards known on both sides: alongside.
  assert.equal(compareStatement({ keys: ['8514'], rows: mc, existing: visa2 }).mode, 'alongside');
  // Nothing in the month: new.
  assert.equal(compareStatement({ keys: ['4388'], rows: visa2, existing: [] }).mode, 'new');
  // Bank statements: the bank names the account.
  assert.deepEqual(docKeys('conta', [], { bank: 'Nubank' }), ['@nubank']);
  assert.deepEqual(docKeys('cartao', [{ card: '0947' }], { checks: [{ card: '4388' }, { card: 'total' }] }).sort(), ['0947', '4388']);
});

import { docsText } from '../public/js/lib/statements.js';
test('nome dos documentos do mês, em português', () => {
  assert.equal(docsText('cartao', ['4388', '0947', '0080']), 'a fatura dos cartões finais 4388, 0947 e 0080');
  assert.equal(docsText('cartao', ['8514']), 'a fatura do cartão final 8514');
  assert.equal(docsText('cartao', ['4388', '']), 'a fatura do cartão final 4388 e uma fatura enviada antes');
  assert.equal(docsText('conta', ['@nubank']), 'o extrato da conta Nubank');
});

import { applyMemos, withMemo, cleanNote, memoKey } from '../public/js/lib/memo.js';
test('anotação: o app lembra da anotação para o mesmo lançamento', () => {
  let memos = withMemo({}, 'cartao', 'JIM.COM* STTUP', '  cabeleireiro   Lily ');
  assert.equal(memos[memoKey('cartao', 'jim.com* sttup')], 'cabeleireiro Lily');
  const rows = [{ description: 'JIM.COM* STTUP' }, { description: 'PADARIA' }, { description: 'JIM.COM* STTUP', note: 'já tinha' }];
  assert.equal(applyMemos(rows, 'cartao', memos), 1);
  assert.equal(rows[0].note, 'cabeleireiro Lily'); assert.equal(rows[1].note, undefined); assert.equal(rows[2].note, 'já tinha');
  assert.equal(applyMemos([{ description: 'JIM.COM* STTUP' }], 'conta', memos), 0, 'conta e cartão são separados');
  memos = withMemo(memos, 'cartao', 'JIM.COM* STTUP', '');
  assert.deepEqual(memos, {});
  assert.equal(cleanNote('x'.repeat(300)).length, 120);
});

import { deviceKind, pushPeople, testText } from '../public/js/lib/pushinfo.js';
test('central: quem recebe avisos e resultado do teste', () => {
  assert.equal(deviceKind('https://web.push.apple.com/abc'), 'iPhone ou iPad');
  assert.equal(deviceKind('https://fcm.googleapis.com/fcm/send/x'), 'Android ou Chrome');
  assert.equal(deviceKind('nada'), 'Aparelho');
  const subs = [
    { user_id: 'a', endpoint: 'https://fcm.googleapis.com/1', prefs: {}, created_at: '2026-10-02' },
    { user_id: 'a', endpoint: 'https://web.push.apple.com/2', prefs: { novidades: false }, created_at: '2026-10-01' },
    { user_id: 'b', endpoint: 'https://fcm.googleapis.com/3', prefs: { novidades: false }, created_at: '2026-10-05' },
  ];
  const ppl = pushPeople(subs, [{ user_id: 'a', display_name: 'Ana', household_id: 'h' }, { user_id: 'b', display_name: 'Bruno', household_id: 'h' }], { h: 'Família Souza' });
  assert.equal(ppl[0].name, 'Ana'); assert.equal(ppl[0].devices, 2); assert.equal(ppl[0].since, '2026-10-01');
  assert.deepEqual(ppl[0].kinds, ['Android ou Chrome', 'iPhone ou iPad']); assert.equal(ppl[0].novidades, true);
  assert.equal(ppl[1].novidades, false); assert.equal(ppl[1].family, 'Família Souza');
  assert.equal(testText([]).kind, 'err');
  assert.match(testText([{ ok: true }, { ok: false, gone: true }]).text, /Enviado para 1 aparelho\..*1 aparelho antigo/);
  assert.equal(testText([{ ok: false, gone: true }]).kind, 'err');
});

import { shouldAskPush, pushAskText, menuNote, pushIsOff } from '../public/js/lib/pushask.js';
test('notificações desligadas: avisa sem forçar', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  assert.equal(shouldAskPush({ status: 'off', now }), true);
  assert.equal(shouldAskPush({ status: 'denied', now }), true);
  for (const s of ['on', 'need-install', 'unsupported', 'not-configured', 'no-sw']) assert.equal(shouldAskPush({ status: s, now }), false, s);
  assert.equal(shouldAskPush({ status: 'off', asks: { n: 1, at: now - 60e3 }, now }), false);
  assert.equal(shouldAskPush({ status: 'off', asks: { n: 1, at: now - 864e5 }, now }), true);
  assert.equal(shouldAskPush({ status: 'off', asks: { n: 7, at: now - 30 * 864e5 }, now }), false);
  assert.equal(pushAskText('off', 'Ana Souza').title, 'Ana, que tal o app te avisar do que importa?'); assert.equal(pushAskText('off', '').eyebrow, 'Notificações desligadas');
  assert.equal(pushAskText('denied', '').primary, 'Ver como liberar');
  assert.equal(menuNote('off'), 'Desligadas neste celular'); assert.equal(menuNote('on'), ''); assert.equal(pushIsOff('need-install'), false);
});

import { platformOf, phoneSteps } from '../public/js/lib/pushask.js';
test('notificações: passo a passo dos ajustes do celular', () => {
  assert.equal(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(platformOf('Mozilla/5.0 (Linux; Android 14; SM-P613) Chrome/120'), 'samsung');
  assert.equal(platformOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120'), 'android');
  assert.match(phoneSteps('ios').join(' '), /Ajustes do iPhone → Notificações → Pra Onde Foi/);
  assert.match(phoneSteps('samsung').join(' '), /Apps em suspensão/);
  assert.ok(phoneSteps('other').length >= 2);
});

import { testOutcome } from '../public/js/lib/pushask.js';
test('notificações: o teste diz se o aviso chegou ao celular ou não', () => {
  assert.match(testOutcome('arrived').no, /chegou, mas o celular não mostrou/);
  assert.match(testOutcome('missing').no, /não chegou até o celular/);
  assert.equal(testOutcome('blocked').ask, '');
});

import { linkFor, parseLink } from '../public/js/lib/links.js';
test('tocar no aviso leva para o lugar certo', () => {
  assert.equal(linkFor('novidade', { id: 'n20261103e' }), '/?abrir=novidade&id=n20261103e');
  assert.equal(linkFor('recado', { id: 42 }), '/?abrir=recado&id=42');
  assert.equal(linkFor('avisos'), '/?abrir=avisos');
  assert.equal(linkFor('tela', { tab: 'ajustes', sec: 'metas' }), '/?tab=ajustes&sec=metas');
  assert.equal(linkFor('tela', { tab: 'nada' }), '/');
  assert.deepEqual(parseLink('/?abrir=recado&id=42'), { abrir: 'recado', id: '42' });
  assert.deepEqual(parseLink('/?abrir=novidade&id=n1'), { abrir: 'novidade', id: 'n1' });
  assert.deepEqual(parseLink('/?tab=ajustes&sec=metas'), { tab: 'ajustes', sec: 'metas' });
  assert.equal(parseLink('/?abrir=recado&id=<script>'), null);
  assert.equal(parseLink('/'), null);
});

import { makeQueue, advance, isDone, position, queueSummary, QUEUE_MAX } from '../public/js/lib/queue.js';
test('vários arquivos de uma vez: fila e resumo', () => {
  const q = makeQueue([{ name: 'visa.pdf' }, { name: 'master.pdf' }, { name: 'extrato.pdf' }]);
  q.items[0].status = 'lendo';
  assert.equal(position(q), '1 de 3');
  advance(q, 'salvo', 'Fatura de outubro'); assert.equal(q.items[1].status, 'lendo'); assert.equal(position(q), '2 de 3');
  advance(q, 'pulado'); advance(q, 'salvo', 'Extrato de outubro');
  assert.ok(isDone(q));
  const s = queueSummary(q);
  assert.equal(s.head, 'Pronto: 2 salvos e 1 pulado.');
  assert.equal(s.lines[0].label, 'Fatura de outubro');
  const big = makeQueue(Array.from({ length: QUEUE_MAX + 2 }, (_, i) => ({ name: i + '.pdf' })));
  assert.equal(big.items.length, QUEUE_MAX); assert.match(queueSummary(big).head, /2 arquivos ficaram de fora/);
});

import { toCSV } from '../public/js/lib/csv.js';
test('planilha CSV abre no Excel brasileiro', () => {
  const csv = toCSV([
    { source: 'cartao', month: '2026-10', date: '2026-10-05', description: 'Mercado; "Pão"', category: 'Mercado', amount: 123.4, installment: '02/10', card: '4388', note: 'compra do mês' },
    { source: 'conta', month: '2026-09', day: '01/09', description: 'Nota', category: 'Mercado', amount: -100, splits: [{ category: 'Mercado', amount: 60 }, { category: 'Farmácia', amount: 40 }] },
  ], [{ name: 'Mercado', grp: 'dia', recurring: false }]);
  assert.ok(csv.startsWith('﻿Data;Mês;Onde'));
  const ls = csv.trim().split('\r\n');
  assert.equal(ls.length, 4);
  assert.equal(ls[1], '01/09;2026-09;Conta;Nota;Mercado;Despesa variável;-60,00;;;');
  assert.equal(ls[2].split(';').slice(4, 7).join(';'), 'Farmácia;;-40,00');
  assert.equal(ls[3], '05/10/2026;2026-10;Cartão;"Mercado; ""Pão""";Mercado;Despesa variável;123,40;02/10;4388;compra do mês');
});

test('insights: quanto dá para gastar por dia no cartão e conta fixa acima do normal', async () => {
  const { insights } = await import('../public/js/lib/insights.js');
  const M = { res: 2000, renda: 10000, E: 10000, out: 8000, tx: 0.2 };
  const cats = { '2026-07': { Moradia: 700, Escola: 1500 }, '2026-08': { Moradia: 720, Escola: 1500 }, '2026-09': { Moradia: 680, Escola: 1500 }, '2026-10': { Moradia: 1050, Escola: 1520 } };
  const base = { months: Object.keys(cats), calc: () => M, cats: k => cats[k] || {}, fixed: () => 0, manualCount: () => 1, pending: () => 0, has: () => true,
    goals: { savings: 0.2, cardMonthly: 5000 }, nextFatura: { month: '2026-11', total: 3000 }, fixedCats: ['Moradia', 'Escola'], closeDay: 24 };
  const a = insights({ ...base, today: '2026-11-14' });
  const pd = a.find(x => x.id === 'perday');
  assert.ok(pd); assert.equal(pd.title, 'Dá para gastar cerca de R$ 200 por dia no cartão'); assert.match(pd.text, /Sobram R\$ 2\.000 para os 10 dias/);
  const bu = a.find(x => x.id === 'bill_up');
  assert.ok(bu); assert.equal(bu.title, 'Moradia veio acima do normal'); assert.match(bu.text, /Moradia: R\$ 1\.050 em outubro, R\$ 350 \(50%\) acima da média/);
  // After the closing day, the days run to next month's closing; above the limit, no per-day message.
  assert.match(insights({ ...base, today: '2026-11-26' }).find(x => x.id === 'perday').text, /28 dias/);
  assert.ok(!insights({ ...base, today: '2026-11-14', nextFatura: { month: '2026-11', total: 5200 } }).some(x => x.id === 'perday'));
});

import { progressOf } from '../public/js/lib/queue.js';
test('pop-up de progresso: percentual pelo passo da leitura', () => {
  assert.equal(progressOf('Lendo fatura.pdf...'), 5);
  assert.equal(progressOf('Lendo a parte 1 de 4...'), 15);
  assert.equal(progressOf('Lendo a parte 3 de 4...'), 45);
  assert.equal(progressOf('Lendo a página 2 de 2...'), 45);
  assert.equal(progressOf('Fatura do Nubank lida: 7 lançamentos.'), 78);
  assert.equal(progressOf('Pedindo sugestão de categoria para 3 lançamentos novos...'), 82);
  assert.equal(progressOf('Tentando de novo...'), null);
});

import { nowHint, failedIndexes } from '../public/js/lib/queue.js';
test('vários arquivos: o que fazer agora e o que tentar de novo', () => {
  assert.match(nowHint('revisao'), /toque em Salvar/);
  assert.match(nowHint('senha'), /senha/);
  assert.equal(nowHint('nada'), '');
  const q = makeQueue([{ name: 'a.pdf' }, { name: 'b.pdf' }, { name: 'c.pdf' }]);
  advance(q, 'erro', 'Não deu para responder agora.'); advance(q, 'salvo'); advance(q, 'erro');
  assert.deepEqual(failedIndexes(q), [0, 2]);
  assert.equal(queueSummary(q).lines[0].label, 'Não deu para responder agora.');
});

import { shortTag } from '../public/js/lib/statements.js';
test('extrato: conta aparece como conta, não como cartão', () => {
  assert.equal(shortTag('@santander'), 'conta Santander');
  assert.equal(shortTag('4388'), 'cartão 4388');
  assert.equal(shortTag(''), '');
  assert.match(toCSV([{ source: 'conta', month: '2026-10', day: '01/10', description: 'Pix', category: 'X', amount: -1, card: '@santander' }], []), /;Santander;/);
});

import { sameReason, mergeSuggestions, mergeSettings, pairKey } from '../public/js/lib/catmerge.js';
test('categorias parecidas: sugere juntar e mantém a mais usada', () => {
  assert.equal(sameReason('Mercado', 'Mercados'), 'mesmo nome');
  assert.equal(sameReason('Saúde', 'Saúde e terapia'), 'um nome está dentro do outro');
  assert.equal(sameReason('Farmácia', 'Remédios'), 'querem dizer a mesma coisa');
  assert.equal(sameReason('Restaurantes', 'Restaurante e bar'), 'um nome está dentro do outro');
  assert.equal(sameReason('Casa', 'Casa de praia alugada'), null, 'nome mais longo com duas palavras a mais é outra coisa');
  assert.equal(sameReason('Outros', 'Outros pequenos gastos'), 'um nome está dentro do outro');
  assert.equal(sameReason('Salário Luana', 'Salário Luana: consignado da Claudia'), null);
  assert.equal(sameReason('Presentes', 'Guaratuba: móveis e equipamentos (presente dos pais)'), null);
  assert.equal(sameReason('Assinaturas', 'Assinatura'), 'mesmo nome');
  assert.equal(sameReason('Mercado', 'Moradia'), null);
  assert.equal(sameReason('Restaurantes e delivery', 'Mercado'), null);
  assert.equal(sameReason('Lazer', 'Lazer'), 'mesmo nome');
  assert.equal(mergeSuggestions([{ name: 'Acordo Itaú', grp: 'dia' }, { name: 'Quitação do acordo Itaú', grp: 'fora' }]).length, 0, 'tipos diferentes não se juntam por nome parecido');
  const cats = [{ name: 'Saúde', grp: 'dia' }, { name: 'Saúde e terapia', grp: 'dia' }, { name: 'Salário', grp: 'renda', recurring: true }, { name: 'Salários', grp: 'dia' },
    { name: 'Mercado', grp: 'dia' }, { name: 'A classificar', grp: 'dia' }];
  const s = mergeSuggestions(cats, { 'Saúde': 3, 'Saúde e terapia': 25, 'Mercado': 40 });
  assert.equal(s.length, 1, 'receita e despesa nunca se juntam');
  assert.deepEqual([s[0].keep, s[0].drop, s[0].dropCount], ['Saúde e terapia', 'Saúde', 3]);
  assert.equal(mergeSuggestions(cats, {}, [pairKey('Saúde e terapia', 'Saúde')]).length, 0, 'quem disse para manter separadas não é perguntado de novo');
  assert.deepEqual(mergeSettings({ budgets: { 'Saúde': 100, 'Saúde e terapia': 400 }, x: 1 }, 'Saúde', 'Saúde e terapia'), { budgets: { 'Saúde e terapia': 500 }, x: 1 });
});

test('insights: aviso de categorias parecidas leva para Categorias', async () => {
  const { insights } = await import('../public/js/lib/insights.js');
  const a = insights({ months: ['2026-10'], today: '2026-10-10', calc: () => ({ res: 0, renda: 0, out: 0, tx: 0 }), cats: () => ({}), fixed: () => 0, has: () => true, manualCount: () => 1, pending: () => 0, goals: {}, nextFatura: null, catMerge: 2 });
  const x = a.find(i => i.id === 'cat_merge');
  assert.ok(x); assert.equal(x.title, '2 pares de categorias parecidas'); assert.deepEqual(x.action.go, ['ajustes', '#catMerge', 'categorias']);
});

import { parseCSV, parseAmount, parseDate, detectColumns, buildEntries, markDuplicates, matchCategory } from '../public/js/lib/sheet.js';
test('planilha: números, datas e colunas', () => {
  assert.equal(parseAmount('R$ -1.234,56'), -1234.56); assert.equal(parseAmount('(45,00)'), -45); assert.equal(parseAmount('1,234.50'), 1234.5);
  assert.equal(parseAmount('230'), 230); assert.equal(parseAmount(12.5), 12.5); assert.equal(parseAmount('mercado'), null);
  assert.equal(parseDate('05/10/2026'), '2026-10-05'); assert.equal(parseDate('5/1/26'), '2026-01-05'); assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate(46300), '2026-10-05'); assert.equal(parseDate('31/02/x'), null);
  const csv = parseCSV('﻿Data;Descrição;Categoria;Valor;Forma de pagamento\n05/10/2026;"Padaria; pão";Mercado;-23,50;Pix\n06/10/2026;Salário;Salário;9.800,00;Conta\n07/10/2026;Posto Shell;Combustível;150,00;Cartão de crédito\n;Total;;;\n');
  assert.equal(csv.length, 5); assert.equal(csv[1][1], 'Padaria; pão');
  const d = detectColumns(csv);
  assert.deepEqual([d.header, d.map.date, d.map.description, d.map.category, d.map.amount, d.map.source], [0, 0, 1, 2, 3, 4]);
});

test('planilha: lançamentos com sinal certo, categorias da família e sem duplicar', () => {
  const rows = parseCSV('Data;Descrição;Categoria;Valor;Forma de pagamento\n05/10/2026;Padaria;Mercado;23,50;Pix\n06/10/2026;Salário;Salário;9.800,00;Conta\n27/10/2026;Posto Shell;Gasolina;150,00;Cartão de crédito\n08/10/2026;Coisa nova;Hobbies;40;Pix\n;Total;;;');
  const cats = [{ name: 'Mercado', grp: 'dia' }, { name: 'Salário', grp: 'renda', recurring: true }, { name: 'Combustível', grp: 'dia' }];
  const { map, header } = detectColumns(rows);
  const r = buildEntries(rows, { map, header, categories: cats, closeDay: 24 });
  assert.equal(r.entries.length, 4); assert.equal(r.skipped, 1);
  const [pad, sal, posto, nova] = r.entries;
  assert.deepEqual([pad.source, pad.amount, pad.category, pad.month], ['conta', -23.5, 'Mercado', '2026-10']);
  assert.deepEqual([sal.amount, sal.category], [9800, 'Salário']);
  assert.deepEqual([posto.source, posto.amount, posto.category, posto.month], ['cartao', 150, 'Combustível', '2026-11']);
  assert.deepEqual([nova.category, nova.sheetCategory], ['A classificar', 'Hobbies']);
  assert.equal(matchCategory('mercado', cats), 'Mercado');
  // A chosen mapping wins ("Hobbies" -> new category "Hobbies").
  assert.equal(buildEntries(rows, { map, header, categories: [...cats, { name: 'Hobbies', grp: 'dia' }], catMap: { Hobbies: 'Hobbies' } }).entries[3].category, 'Hobbies');
  const marked = markDuplicates(r.entries, [{ source: 'conta', amount: -23.5, date: '2026-10-06' }]);
  assert.deepEqual(marked.map(e => e.dup), [true, false, false, false]);
});

test('extrato dividido em dois arquivos: a segunda parte entra junto, sem apagar a primeira', () => {
  const mk = (d, desc, v) => ({ day: d, description: desc, amount: v, card: '@santander' });
  const part1 = [mk('01/10', 'PIX JOAO', -100), mk('03/10', 'TED SALARIO', 5000), mk('05/10', 'BOLETO LUZ', -190), mk('10/10', 'PIX PADARIA', -20)];
  const part2 = [mk('16/10', 'PIX MERCADO', -300), mk('20/10', 'BOLETO ESCOLA', -1500), mk('28/10', 'PIX JOAO', -100), mk('30/10', 'TARIFA', -30)];
  let c = compareStatement({ keys: ['@santander'], rows: part2, existing: part1 });
  assert.equal(c.mode, 'complement'); assert.deepEqual(c.cards, []); assert.deepEqual(c.fresh, [0, 1, 2, 3]); assert.equal(c.dup, 0);
  // Parts that share a few days: only what is new goes in.
  const part2b = [part1[3], ...part2];
  c = compareStatement({ keys: ['@santander'], rows: part2b, existing: part1 });
  assert.equal(c.mode, 'complement'); assert.equal(c.dup, 1); assert.deepEqual(c.fresh, [1, 2, 3, 4]);
  // The same file again: replace.
  assert.equal(compareStatement({ keys: ['@santander'], rows: part1, existing: part1 }).mode, 'replace');
  // The full month after the first half: the half is inside it, the rest comes in (nothing is erased).
  c = compareStatement({ keys: ['@santander'], rows: [...part1, ...part2], existing: part1 });
  assert.equal(c.mode, 'complement'); assert.equal(c.dup, 4); assert.deepEqual(c.fresh, [4, 5, 6, 7]);
  // A half that is already all there (the full month was saved before): nothing new, nothing erased.
  c = compareStatement({ keys: ['@santander'], rows: part1, existing: [...part1, ...part2] });
  assert.equal(c.mode, 'complement'); assert.deepEqual(c.fresh, []);
  // Two identical Pix on the same day count twice.
  const twin = [mk('05/10', 'PIX PADARIA', -20), mk('05/10', 'PIX PADARIA', -20)];
  assert.deepEqual(compareStatement({ keys: ['@santander'], rows: twin, existing: [twin[0]] }).fresh, [1]);
});

import { averagePace, paceScenarios } from '../public/js/lib/goalplan.js';
test('sonho: ritmo atual é a média real dos últimos meses, não um número fixo', () => {
  const rows = [{ month: '2026-06', res: 9000 }, { month: '2026-08', res: 4210 }, { month: '2026-09', res: 2990 }, { month: '2026-10', res: 5100 }];
  const a = averagePace(rows);
  assert.equal(a.value, 4100); assert.deepEqual(a.months, ['2026-08', '2026-09', '2026-10']); assert.equal(a.text, 'ago a out');
  assert.equal(averagePace([{ month: '2026-10', res: -800 }]).value, 0);
  const sc = paceScenarios({ rows, goals: { planMonthly: 6000, planYearly: 40000 }, saved: [['Ritmo atual', 1000, 0], ['Cartão em R$ 17 mil', 7000, 0]] });
  assert.deepEqual(sc.map(s => [s.name, s.monthly, s.yearly]), [['Média dos últimos 3 meses', 4100, 0], ['O plano de vocês', 6000, 40000], ['+ R$ 1.000 por mês', 5100, 0], ['Cartão em R$ 17 mil', 7000, 0]]);
  assert.match(sc[0].note, /o que sobrou de verdade em ago a out/);
  assert.equal(paceScenarios({ rows: [] })[0].note, 'aparece quando houver meses com o extrato da conta');
});

test('gráfico: sobra acumulada soma mês a mês', async () => {
  const { buildChart, chartSVG } = await import('../public/js/lib/charts.js');
  const src = { months: ['2026-08', '2026-09', '2026-10'], calc: k => ({ res: { '2026-08': 1000, '2026-09': -200, '2026-10': 3000 }[k] }), cats: () => ({}) };
  const d = buildChart({ title: 'Acumulado', type: 'linha', metric: 'acumulada', period: { kind: 'faixa', from: '2026-08', to: '2026-10' } }, src);
  assert.deepEqual(d.series[0].values, [1000, 800, 3800]); assert.equal(d.unit, 'brl');
  assert.doesNotMatch(chartSVG(d, { title: 'x' }), /NaN|undefined/);
});

import { debtNow, installmentSplit, monthlyRate, debtOfAsset, debtForTx, pendingAmortizations, investNow } from '../public/js/lib/debt.js';
test('financiamento: parcelas abatem pela estimativa e amortização abate na hora', async () => {
  assert.ok(Math.abs(monthlyRate(0.12) - 0.009489) < 1e-5);
  const p = installmentSplit(350000, { taxa: 0.12, parcela: 5600 }); assert.equal(p.juros, 3321.08); assert.equal(p.amort, 2278.92);
  const s = installmentSplit(120000, { taxa: 0.12, sistema: 'sac', meses: 120 }); assert.equal(s.amort, 1000);
  const d = { id: 'g', name: 'Financiamento de Guaratuba', saldo: 480000, saldoEm: '2026-09-30', saldoAt: '2026-09-30T12:00:00Z', taxa: 0.12, parcela: 5600, log: [{ date: '2026-11-04', at: '2026-11-04T21:00:00Z', kind: 'amortizacao', value: 130000, txId: 't1' }] };
  const n = debtNow(d, '2026-11-04');
  assert.equal(n.months, 1); assert.equal(n.amortized, 130000);
  const after1 = 480000 - installmentSplit(480000, d).amort; assert.equal(n.saldo, Math.round((after1 - 130000) * 100) / 100);
  assert.deepEqual(n.history.map(h => h.kind), ['inicio', 'amortizacao', 'parcelas']);
  assert.equal(debtNow(d, '2026-10-15').months, 0);
  assert.equal(debtNow({ saldo: 1000, saldoEm: '2026-01-01', taxa: 0, parcela: 600 }, '2026-12-01').saldo, 0);
  assert.equal(debtNow({ saldo: 5000 }, '2026-11-04').saldo, 5000);
  const { linkFor, parseLink } = await import('../public/js/lib/links.js');
  assert.equal(linkFor('tela', { tab: 'lancar', sec: 'pdf' }), '/?tab=lancar&sec=pdf'); assert.deepEqual(parseLink('/?tab=lancar&sec=pdf'), { tab: 'lancar', sec: 'pdf' });
  assert.equal(linkFor('tela', { tab: 'lancar', sec: 'xyz' }), '/?tab=lancar');
  // Typed before the date existed (old data): the payment still counts, nothing is estimated yet.
  assert.equal(debtNow({ saldo: 480000, taxa: 0.12, parcela: 5600, log: [{ date: '2026-11-04', at: '2026-11-04T21:00:00Z', kind: 'amortizacao', value: 130000 }] }, '2026-11-04').saldo, 350000);
  // A balance typed after the payment already includes it.
  assert.equal(debtNow({ ...d, saldo: 345000, saldoEm: '2026-11-05', saldoAt: '2026-11-05T10:00:00Z' }, '2026-11-05').saldo, 345000);
});
test('financiamento: liga o bem e reconhece o comprovante', () => {
  const debts = [{ id: 'g', name: 'Financiamento de Guaratuba', saldo: 480000, parcela: 5600 }, { id: 'sp', name: 'Financiamento do apartamento de SP', saldo: 150000, parcela: 2700 }];
  assert.equal(debtOfAsset({ name: 'Casa de Guaratuba', debt: 480000 }, debts).id, 'g');
  assert.equal(debtOfAsset({ name: 'Apartamento de São Paulo', debt: 150000 }, debts).id, 'sp');
  assert.equal(debtOfAsset({ name: 'Honda Civic', debt: 0 }, debts), null);
  assert.equal(debtOfAsset({ name: 'Casa', debtId: 'sp' }, debts).id, 'sp');
  assert.equal(debtForTx({ description: 'Pix Caixa', note: 'amortização do financiamento da casa de Guaratuba' }, debts).id, 'g');
  assert.equal(debtForTx({ description: 'Mercado' }, debts), null);
  const txs = [{ id: 't1', source: 'conta', amount: -130000, description: 'Amortização Guaratuba' }, { id: 't2', source: 'conta', amount: -5600, description: 'Parcela financiamento Guaratuba' }, { id: 't3', source: 'conta', amount: -90000, description: 'Amortização SP' }];
  assert.deepEqual(pendingAmortizations(txs, debts, ['t3']).map(x => [x.tx.id, x.debt.id]), [['t1', 'g']]);
  assert.deepEqual(pendingAmortizations(txs, [{ ...debts[0], log: [{ kind: 'amortizacao', value: 130000, txId: 't1' }] }, debts[1]], ['t3']), []);
  // Real case: the text says Bertioga, the category says Guaratuba; the regular installment is not asked.
  const real = [{ id: 'r1', source: 'conta', amount: -99000, description: 'PIX financiamento Bertioga (Caixa)', category: 'Guaratuba: financiamento (Caixa)' }, { id: 'r2', source: 'conta', amount: -5600, description: 'PIX financiamento Bertioga (Caixa)', category: 'Guaratuba: financiamento (Caixa)' }];
  assert.deepEqual(pendingAmortizations(real, debts).map(x => [x.tx.id, x.debt.id]), [['r1', 'g']]);
  // Names neither: still asked, without a financing (the person picks).
  assert.deepEqual(pendingAmortizations([{ id: 'r3', source: 'conta', amount: -99000, description: 'Amortização Caixa' }], debts).map(x => [x.tx.id, x.debt]), [['r3', null]]);
  const iv = investNow({ total: 100000, date: '2025-11-04' }, 0.1, '2026-11-04'); assert.equal(iv.value, 110000); assert.ok(iv.estimated);
  assert.equal(investNow({ total: 100000, date: '2026-11-04' }, 0.1, '2026-11-04').estimated, false);
});


test('parcelas já comprometidas: por mês, as que mais pesam e quando acabam', async () => {
  const { installmentPlan } = await import('../public/js/lib/parcelas.js');
  const txs = [{ description: 'Geladeira', amount: 400, installment: '02/10', day: '05/09' }, { description: 'Curso', amount: 300, installment: '11/12', day: '01/09' },
    { description: 'Tênis', amount: 100, installment: '03/03' }, { description: 'Mercado', amount: 500 },
    { description: 'Dup', amount: 50, installment: '01/02', day: '01/10' }, { description: 'Dup', amount: 50, installment: '01/02', day: '01/10' }];
  const p = installmentPlan(txs, '2026-10', 12);
  assert.deepEqual(p.months.slice(0, 3), [{ month: '2026-11', total: 700 }, { month: '2026-12', total: 400 }, { month: '2027-01', total: 400 }]);
  assert.equal(p.months.length, 8); assert.equal(p.items[0].description, 'Geladeira'); assert.equal(p.items[0].ends, '2027-06');
  assert.equal(p.total, 400 * 8 + 300); assert.equal(p.last, '2027-06');
  assert.deepEqual(installmentPlan([], '2026-10').items, []);
});

test('quanto o banco cobrou: juros, IOF, anuidade e tarifas', async () => {
  const { feeKind, feesOf } = await import('../public/js/lib/bankfees.js');
  assert.equal(feeKind('JUROS ROTATIVO'), 'juros'); assert.equal(feeKind('Multa por atraso'), 'juros'); assert.equal(feeKind('ENCARGOS PARCELAMENTO DE FATURA'), 'juros');
  assert.equal(feeKind('IOF EXTERIOR'), 'iof'); assert.equal(feeKind('Mastercard 1/12 anuidade'), 'anuidade'); assert.equal(feeKind('Tarifa pacote servicos'), 'tarifa');
  assert.equal(feeKind('Mercado Juros Bairro'), 'juros', 'a word "juros" is enough: the store names do not use it'); assert.equal(feeKind('Padaria'), null);
  const f = feesOf([{ source: 'conta', amount: -125, description: 'Mastercard anuidade', month: '2026-09' }, { source: 'cartao', amount: 67.72, description: 'IOF EXTERIOR', month: '2026-09' },
    { source: 'cartao', amount: -10, description: 'ESTORNO ANUIDADE', month: '2026-09' }, { source: 'conta', amount: -37.49, description: 'Tarifa pacote servicos', month: '2026-09' }, { source: 'cartao', amount: 80, description: 'Mercado', month: '2026-09' }]);
  assert.deepEqual(f.by, { juros: 0, iof: 67.72, anuidade: 115, tarifa: 37.49 }); assert.equal(f.total, 220.21); assert.equal(f.items[0].description, 'Mastercard anuidade'); assert.equal(f.items.length, 3);
});

test('Início dinâmico: o aviso novo ou que mudou sobe para o topo', async () => {
  const { rankFeed, sig } = await import('../public/js/lib/homefeed.js');
  const a = { id: 'red', tone: 'bad', text: 'a' }, b = { id: 'saved', tone: 'good', text: 'b' }, c = { id: 'card', tone: 'warn', text: 'c' };
  assert.deepEqual(rankFeed([a, b, c], null).fresh, [], 'first visit: nothing is new');
  const r = rankFeed([a, b, c], { red: sig(a), card: 'card|old' });
  assert.deepEqual(r.fresh, ['saved', 'card']); assert.deepEqual(r.list.map(x => x.id), ['card', 'saved', 'red']);
  assert.deepEqual(rankFeed([a, b, c], r.seen).fresh, []);
});

test('retrospectiva: nível por porcentagem e marcos do ano', async () => {
  const { yearLevel, yearMilestones } = await import('../public/js/lib/closing.js');
  const { catIndex } = await import('../public/js/lib/calc.js');
  assert.equal(yearLevel({ n: 9, positive: 8, res: 53494, tx: 0.128, meta: 0.2 }).level, 'prata');
  assert.ok(Math.abs(yearLevel({ n: 9, positive: 8, res: 53494, tx: 0.128, meta: 0.2 }).next.points - 0.072) < 1e-9);
  assert.equal(yearLevel({ n: 12, positive: 10, res: 90000, tx: 0.22, meta: 0.2 }).level, 'ouro');
  assert.equal(yearLevel({ n: 12, positive: 7, res: 90000, tx: 0.22, meta: 0.2 }).level, 'prata', 'gold also needs steady months');
  assert.equal(yearLevel({ n: 12, positive: 6, res: 3000, tx: 0.03, meta: 0.2 }).level, 'bronze');
  assert.equal(yearLevel({ n: 12, positive: 3, res: -3000, tx: -0.03, meta: 0.2 }).level, 'inicio');
  const idx = catIndex([{ name: 'Investimentos', grp: 'neutro' }, { name: 'Carro', grp: 'fora' }, { name: 'Mercado', grp: 'dia' }]);
  const per = [{ month: '2026-05', res: 100 }, { month: '2026-06', res: -5078 }, { month: '2026-07', res: 1253 }, { month: '2026-08', res: 6942 }, { month: '2026-09', res: 2658 }];
  const txs = [{ source: 'conta', amount: -10, category: 'Mercado', month: '2025-12', date: '2025-12-10' }, { source: 'conta', amount: -2000, category: 'Investimentos', month: '2026-03', date: '2026-03-10' }, { source: 'conta', amount: -45000, category: 'Carro', description: 'Carro novo', month: '2026-04', date: '2026-04-02' }];
  const m = yearMilestones({ year: '2026', per, txs, idx, debts: [{ name: 'Financiamento de Guaratuba', log: [{ kind: 'amortizacao', date: '2026-11-04', value: 130000 }] }] });
  assert.deepEqual(m.map(x => x.id), ['amortizou', 'investiu', 'saiu_vermelho']);
  assert.match(m[0].title, /130\.000/); assert.match(m[1].title, /Começaram a investir em março/); assert.match(m[2].text, /−R\$ 5\.078/);
  assert.deepEqual(yearMilestones({ year: '2026', per, txs: txs.slice(2), idx }).map(x => x.id), ['saiu_vermelho', 'compra', 'sequencia']);
  assert.match(yearMilestones({ year: '2026', per, txs: txs.slice(1), idx })[0].title, /^Investiram R\$ 2\.000/, 'no earlier data: cannot say they started');
});

test('retrospectiva: onde dá para melhorar e evolução no ano', async () => {
  const { yearRetro, yearOpportunities, yearEvolution } = await import('../public/js/lib/closing.js');
  const { catIndex } = await import('../public/js/lib/calc.js');
  const idx = catIndex([{ name: 'Salário', grp: 'renda', recurring: true }, { name: 'Lazer', grp: 'dia' }, { name: 'Tarifas', grp: 'dia', recurring: true }]);
  const txs = [];
  ['01', '02', '03', '04', '05', '06'].forEach((m, i) => { const k = '2026-' + m; txs.push({ source: 'conta', month: k, date: k + '-05', amount: 10000, category: 'Salário', description: 'Salário' }, { source: 'conta', month: k, date: k + '-10', amount: -(i < 3 ? 8000 : 10500), category: 'Lazer', description: 'Lazer' }, { source: 'conta', month: k, date: k + '-11', amount: -30, category: 'Tarifas', description: 'Tarifa pacote servicos' }); });
  const r = yearRetro({ year: '2026', txs, idx, goals: { savings: 0.2 }, fees: { total: 180 } });
  const o = yearOpportunities({ r, txs, idx });
  assert.deepEqual(o.map(x => x.id), ['vermelho', 'meta', 'subiu']);
  assert.match(o[0].title, /3 meses no vermelho/); assert.match(o[2].title, /Lazer subiu R\$ 2\.500 por mês/);
  const e = yearEvolution(r); assert.ok(e.first > 0.19 && e.second < 0);
});

test('gastos do ano: acha, põe no calendário, quanto separar e à vista ou parcelado', async () => {
  const { detectAnnual, calendar, setAside, payAdvice, fipeFromIpva, nextValue, kindOfTx } = await import('../public/js/lib/annual.js');
  const txs = [{ source: 'conta', month: '2026-04', date: '2026-04-01', amount: -2285.34, description: 'Detran' }, { source: 'conta', month: '2026-04', date: '2026-04-01', amount: -237.04, description: 'Detran' },
    { source: 'conta', month: '2026-07', date: '2026-07-03', amount: -367, description: 'Detran' }, { source: 'conta', month: '2026-03', date: '2026-03-20', amount: -871.18, description: 'PIX Ministerio da Fazenda' },
    ...['02', '03', '04'].map(m => ({ source: 'conta', month: '2026-' + m, date: `2026-${m}-10`, amount: -114.37, description: 'IPTU PMSP' })), { source: 'conta', month: '2026-05', date: '2026-05-14', amount: -18000, description: 'Tributos Prefeitura de Bertioga' }];
  const d = detectAnnual(txs, '2026-11-05');
  assert.deepEqual(d.map(x => [x.kind, x.total, x.mode]), [['iptu', 18000, 'avista'], ['ipva', 2285.34, 'avista'], ['iptu', 343.11, 'parcelado']]);
  assert.equal(d[0].once, true); assert.equal(kindOfTx({ description: 'PIX Ministerio da Fazenda' }), null);
  assert.equal(detectAnnual(txs, '2026-11-05', [d[0].key]).length, 2, 'dismissed ones do not come back');
  assert.equal(fipeFromIpva(2285.34, 'SP'), 57133.5);
  assert.deepEqual(nextValue({ lastPaid: 1000 }), { value: 1000, low: 950, high: 1050 });
  const cal = calendar([{ name: 'IPVA', value: 2400, mode: 'avista', start: 1, desc: 0.03 }, { name: 'IPTU', value: 1400, mode: 'parcelado', parcelas: 10, start: 2 }], [{ category: 'Escola', month: 2, extra: 1800 }], '2026-11-05', 6);
  assert.deepEqual(cal.map(m => [m.month, m.total]), [['2026-12', 0], ['2027-01', 2328], ['2027-02', 1940], ['2027-03', 140], ['2027-04', 140], ['2027-05', 140]]);
  assert.equal(setAside(cal), 1430, 'enough by February: (2328 + 1940) / 3 months');
  const it = { value: 2400, desc: 0.03, parcelas: 5, monthsTo: 2 };
  assert.equal(payAdvice(it, { invest: 100000, reserve: 30000, avgLeft: 3000, redMonths: 0, interest: 0, ret: 0.1 }).pick, 'avista');
  assert.match(payAdvice(it, { invest: 0, reserve: 30000, avgLeft: 3000, redMonths: 2, interest: 0 }).why, /2 meses no vermelho/);
  assert.match(payAdvice(it, { invest: 0, reserve: 30000, avgLeft: 2000, redMonths: 0, interest: 0 }).why, /Separem R\$ 1\.170 por mês/);
  assert.equal(payAdvice(it, { invest: 0, reserve: 30000, avgLeft: 300, redMonths: 0, interest: 0 }).pick, 'parcelado');
  assert.equal(payAdvice(it, { invest: 31000, reserve: 30000, avgLeft: 300, redMonths: 0, interest: 0 }).pick, 'parcelado', 'would drop the emergency reserve');
});

test('gastos do ano: pago no ano', async () => {
  const { paidThisYear } = await import('../public/js/lib/annual.js');
  const txs = [{ source: 'conta', month: '2026-04', amount: -2285.34, description: 'Detran' }, { source: 'conta', month: '2026-04', amount: -237.04, description: 'Detran' }, { source: 'conta', month: '2025-04', amount: -2100, description: 'Detran' }];
  assert.deepEqual(paidThisYear({ kind: 'ipva', from: 'Detran' }, txs, '2026-11-05'), { total: 2285.34, months: ['2026-04'] });
  // Real case: the Civic's IPVA (Detran) and a Secretaria da Fazenda payment were shown as paid for the scooter.
  const civic = { kind: 'ipva', from: 'Detran' }, scooter = { kind: 'ipva', assetName: 'Scooter de São Paulo', fromAsset: { atOnce: 330 } };
  const all = [...txs, { source: 'conta', month: '2026-08', amount: -469.91, description: 'PIX Secretaria da Fazenda' }];
  assert.deepEqual(paidThisYear(scooter, all, '2026-11-06', [civic, scooter]), { total: 0, months: [] });
  // A payment noted as a fine ("multa") is not IPVA, even to the Secretaria da Fazenda.
  const { kindOfTx } = await import('../public/js/lib/annual.js');
  assert.equal(kindOfTx({ description: 'PIX Secretaria da Fazenda', note: 'multas' }), null);
  assert.equal(kindOfTx({ description: 'DETRAN multa de trânsito' }), null);
  // Alone in the list, a cheap motorcycle IPVA (R$ 330) still counts.
  assert.deepEqual(paidThisYear(scooter, [{ source: 'conta', month: '2026-01', amount: -330, description: 'IPVA moto' }], '2026-11-06', [scooter]), { total: 330, months: ['2026-01'] });
});

test('gastos do ano: IPVA pelo veículo do patrimônio e o estado dele', async () => {
  const { guessAssetType, ipvaOf, effectiveItems, vehicleSuggestions } = await import('../public/js/lib/annual.js');
  assert.equal(guessAssetType('Honda Civic Touring 2020'), 'carro'); assert.equal(guessAssetType('Scooter de São Paulo'), 'moto');
  assert.equal(guessAssetType('Casa de Guaratuba'), 'imovel'); assert.equal(guessAssetType('Apartamento de São Paulo'), 'imovel');
  const civic = { name: 'Honda Civic Touring 2020', value: 139000, tipo: 'carro', uf: 'ES' };
  assert.deepEqual(ipvaOf(civic), { base: 2780, rate: 0.02, desc: 0.15, atOnce: 2363, parc: 6, start: 4 });
  assert.equal(ipvaOf({ ...civic, uf: 'SP' }).base, 5560);
  const [e] = effectiveItems([{ kind: 'ipva', name: 'IPVA', assetName: civic.name, mode: 'avista', value: 2285 }], [civic]);
  assert.equal(e.value, 2780); assert.equal(e.uf, 'ES'); assert.equal(e.start, 4); assert.equal(e.desc, 0.15);
  assert.equal(effectiveItems([{ kind: 'ipva', assetName: 'Carro vendido' }], [civic])[0].gone, true);
  assert.deepEqual(vehicleSuggestions([], [civic, { name: 'Scooter', value: 17000, tipo: 'moto' }]).map(x => x.asset.name), [civic.name], 'without a state there is no estimate yet');
});

import { forecast, forecastText, checkinTarget, sundayAsk, closeDateOf } from '../public/js/lib/monthend.js';
test('month-end forecast: history, open bill check-in and the Sunday ask', () => {
  const categories = [{ name: 'Salário', grp: 'renda' }, { name: 'Aluguel', grp: 'dia' }, { name: 'Mercado', grp: 'dia' }, { name: 'Obra', grp: 'fora' }];
  const txs = [];
  for (const k of ['2026-07', '2026-08', '2026-09']) txs.push(
    { month: k, source: 'conta', amount: 10000, category: 'Salário' }, { month: k, source: 'conta', amount: -3000, category: 'Aluguel' },
    { month: k, source: 'cartao', amount: 4000, category: 'Mercado' }, { month: k, source: 'cartao', amount: 1000, category: 'Obra' });
  const settings = { goals: { savings: 0.2 }, cardCloseDay: 24 };
  assert.equal(forecast({ txs: txs.filter(t => t.month === '2026-09'), categories, settings, today: '2026-10-10' }), null, 'needs two complete months');
  const f = forecast({ txs, categories, settings, today: '2026-10-10' });
  // income 10.000, account 3.000, bill 5.000 of which 80% counts -> 4.000; leftover 3.000; goal 2.000
  assert.equal(f.res, 3000); assert.equal(f.meta, 2000); assert.equal(f.status, 'ok'); assert.equal(f.basis, 'historico');
  assert.equal(f.usual, Math.round(5000 / 30 * 0.8)); assert.equal(f.daysLeft, 22);
  assert.equal(f.perDay, Math.round(5000 / 30 * 0.8 + 1000 / 22));
  // A high open bill on day 20 (4 days to close) moves the forecast: (7.000 + 4 days of usual pace) * 0.8
  const g = forecast({ txs, categories, settings: { ...settings, checkins: [{ date: '2026-10-20', month: '2026-10', value: 7000 }] }, today: '2026-10-20' });
  assert.equal(g.basis, 'checkin'); assert.equal(g.card, Math.round((7000 + 4 * 5000 / 30) * 0.8)); assert.equal(g.status, 'risco');
  assert.match(forecastText(g).line, /Outubro pode fechar abaixo da meta: a previsão é sobrar R\$/); assert.match(forecastText(g).head, /^A previsão é sobrar R\$/);
  const red = forecast({ txs, categories, settings: { ...settings, checkins: [{ date: '2026-10-20', month: '2026-10', value: 12000 }] }, today: '2026-10-20' });
  assert.equal(red.status, 'vermelho'); assert.match(forecastText(red).title, /vermelho/);
  // With the bill already in the app, it counts as it is.
  const withBill = forecast({ txs: [...txs, { month: '2026-10', source: 'cartao', amount: 2000, category: 'Mercado' }], categories, settings, today: '2026-10-26' });
  assert.equal(withBill.basis, 'fatura'); assert.equal(withBill.card, 2000);
  // Bill already in (closed early): the open one is next month's; a check-in forecasts it.
  const early = forecast({ txs: [...txs, { month: '2026-10', source: 'cartao', amount: 2000, category: 'Mercado', day: '03/10' }], categories, settings: { ...settings, checkins: [{ date: '2026-10-05', month: '2026-11', value: 3000 }] }, today: '2026-10-05' });
  assert.equal(early.nextBill.month, '2026-11'); assert.equal(early.nextBill.closeDate, '2026-11-04'); assert.equal(early.nextBill.value, Math.round(3000 + 30 * 5000 / 30));
  assert.match(forecastText(early).next, /^Fatura de novembro: com R\$ 3\.000 até 05\/10, deve fechar em uns R\$ /);
  assert.equal(checkinTarget('2026-10-05', 24, true).month, '2026-11');
  // An unconfirmed payoff of a financing (R$ 99 mil) does not count as the month's spending.
  const payoff = forecast({ txs: [...txs, { id: 'x', month: '2026-10', source: 'conta', amount: -99000, description: 'PIX financiamento Bertioga (Caixa)', category: 'Guaratuba: financiamento (Caixa)' }], categories, settings: { ...settings, debts: [{ id: 'g', name: 'Financiamento de Guaratuba', parcela: 5600 }] }, today: '2026-10-10' });
  assert.equal(payoff.res, 3000); assert.equal(payoff.ignored, 1);
  // Which bill to ask about
  assert.deepEqual(checkinTarget('2026-10-10', 24, false), { month: '2026-10', closed: false, closeDate: '2026-10-24' });
  assert.deepEqual(checkinTarget('2026-10-26', 24, false), { month: '2026-10', closed: true, closeDate: '2026-10-24' });
  assert.equal(checkinTarget('2026-10-26', 24, true).month, '2026-11');
  assert.equal(closeDateOf('2026-02', 30), '2026-02-28');
  // Sunday: asks with the name; not again within the week; after two unanswered asks, every other week.
  const a = sundayAsk(f, { name: 'Luiz Tufik', sent: {}, checkins: [], today: '2026-10-11' });
  assert.equal(a.msg.title, 'Luiz, quanto está a fatura aberta?'); assert.ok(a.msg.body.length <= 220); assert.equal(a.miss, 0);
  assert.equal(sundayAsk(f, { sent: {}, checkins: [{ date: '2026-10-10', value: 1 }], today: '2026-10-11' }), null, 'just answered');
  assert.equal(sundayAsk(f, { sent: { previsao: '2026-10-11', previsao_miss: 1 }, checkins: [], today: '2026-10-18' }), null, 'two in a row unanswered: skip a week');
  assert.equal(sundayAsk(f, { sent: { previsao: '2026-10-11', previsao_miss: 1 }, checkins: [], today: '2026-10-25' }).miss, 2);
  assert.equal(sundayAsk(f, { sent: { previsao: '2026-10-11', previsao_miss: 1 }, checkins: [{ date: '2026-10-12', value: 1 }], today: '2026-10-18' }).miss, 0, 'answered: back to weekly');
});

import { levelProgress, sundayHabit, yearLevel } from '../public/js/lib/closing.js';
import { homeEngagement } from '../public/js/lib/homefeed.js';
test('level during the year: what is missing, rules, Sunday habit; Início engagement', () => {
  // 9 months in, R$ 417 mil of income, R$ 53 mil kept (12,8%), 8 of 9 in the blue: Prata; Ouro needs 20% of the
  // whole year (3 more months of the usual income): about R$ 19 mil per month.
  const r = { n: 9, months: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'], renda: 417306.31, res: 53494.61, tx: 53494.61 / 417306.31, positive: 8, meta: 0.2 };
  const p = levelProgress(r, { habit: sundayHabit([], '2026-11-05'), today: '2026-11-05' });
  assert.equal(p.level, 'prata'); assert.equal(p.next, 'ouro'); assert.equal(p.monthsLeft, 3);
  assert.equal(p.missing[0].text, 'Guardar uns R$ 19.262 por mês até dezembro (R$ 57.787 no total)');
  assert.deepEqual(p.rules.map(x => x.ok), [true, true, false]);
  // Bronze to Prata and the way out of the red
  assert.match(levelProgress({ ...r, res: 10000, tx: 10000 / 417306.31 }, { today: '2026-11-05' }).missing[0].text, /^Guardar uns R\$ [\d.]+ por mês até dezembro/);
  assert.match(levelProgress({ ...r, res: -6000, tx: -0.01, positive: 3 }, { today: '2026-11-05' }).missing[0].text, /^Sair do vermelho: R\$ 2\.000 por mês/);
  // The Sunday habit: one window per week; only weighs on gold from the 4th Sunday on.
  assert.deepEqual(sundayHabit([], '2026-11-05'), { done: 0, total: 0, need: 0, counts: false, ok: true });
  const h = sundayHabit([{ date: '2026-11-08' }, { date: '2026-11-20' }], '2026-12-06');
  assert.deepEqual([h.done, h.total, h.need, h.counts, h.ok], [2, 5, 3, true, false]);
  const gold = { ...r, res: 90000, tx: 90000 / 417306.31 };
  assert.equal(yearLevel(gold).level, 'ouro'); assert.equal(yearLevel(gold, h).level, 'prata');
  assert.match(levelProgress(gold, { habit: h, today: '2026-12-06' }).missing.at(-1).text, /Fatura aberta informada em 2 de 5 domingos; precisa de 3/);
  assert.equal(sundayHabit([], '2027-01-10', '2027').total, 2, 'first Sundays of 2027: 3 and 10 of January');
  // Engagement: who acted among who came; median of days back.
  assert.deepEqual(homeEngagement([{ days: 10, features: { 'inicio.acao': 2 } }, { days: 3, features: { 'aba.resumo': 4 } }, { days: 0, features: {} }]), { active: 2, acted: 1, actedPct: 50, daysMedian: 6.5 });
});

test('financing history keeps what identifies each payoff (for undo)', async () => {
  const { debtNow } = await import('../public/js/lib/debt.js');
  // Luiz: R$ 480 mil from June at 12% a.a., R$ 5.600 a month, R$ 140 mil paid off: about R$ 330 mil today.
  const d = { saldo: 480000, saldoEm: '2026-06-01', taxa: 0.12, parcela: 5600, sistema: 'price', log: [{ kind: 'amortizacao', value: 140000, date: '2026-08-15', at: 'a1', txId: 't1' }] };
  const n = debtNow(d, '2026-11-06');
  assert.equal(Math.round(n.saldo), 330650); assert.equal(n.months, 5);
  assert.deepEqual(n.history.filter(h => h.kind === 'amortizacao').map(h => [h.at, h.txId]), [['a1', 't1']]);
});

import { pushHealth, healthAlertMessage } from '../public/js/lib/pushhealth.js';
test('push health: deliveries by robot, late robots and the alert', () => {
  const now = '2026-11-09T13:00:00Z';
  const runs = [
    { at: '2026-11-09T12:00:00Z', job: 'diario', ok: true }, { at: '2026-11-09T12:00:05Z', job: 'versao', ok: true },
    { at: '2026-11-06T00:00:00Z', job: 'lembrete', ok: true }, // 3 days ago: late
    { at: '2026-11-08T22:00:00Z', job: 'previsao', ok: false },
  ];
  const logs = [
    ...Array(8).fill({ job: 'diario', ok: true, status: 201 }), { job: 'diario', ok: false, status: 410 },
    ...Array(3).fill({ job: 'previsao', ok: true, status: 201 }), ...Array(3).fill({ job: 'previsao', ok: false, status: 500 }),
  ].map(l => ({ ...l, at: '2026-11-08T22:00:00Z' }));
  const h = pushHealth(logs, runs, now);
  const j = Object.fromEntries(h.jobs.map(x => [x.job, x]));
  assert.equal(j.diario.late, false); assert.equal(j.lembrete.late, true); assert.equal(j.lembrete.hoursAgo, 85); assert.equal(j.previsao.lastOk, false);
  const d = h.byJob.find(b => b.job === 'diario'); assert.deepEqual([d.sent, d.ok, d.gone, d.failed], [9, 8, 1, 0]);
  assert.deepEqual(h.alerts.map(a => a.job), ['lembrete', 'previsao', 'previsao']);
  assert.match(h.alerts[0].text, /^Lembrete da noite \(21h\) não roda há 4 dias\.$/);
  assert.match(h.alerts[2].text, /só 50% chegaram/);
  assert.deepEqual(h.errors, [{ text: 'resposta 500', n: 3 }, { text: 'resposta 410', n: 1 }]);
  assert.equal(healthAlertMessage(h.alerts).title, '3 problemas nos avisos do app');
  assert.equal(healthAlertMessage([]), null);
  // No record yet: not an alert.
  assert.deepEqual(pushHealth([], [], now).alerts, []); assert.equal(pushHealth([], [], now).jobs[0].never, true);
});

test('link to a Central page (alerts to the owner only)', async () => {
  const { linkFor } = await import('../public/js/lib/links.js');
  assert.equal(linkFor('central', { sec: 'avisos' }), '/admin.html#avisos');
  assert.equal(linkFor('central', { sec: 'x"><script' }), '/');
});

import { healthColor, healthHistory } from '../public/js/lib/health.js';
test('server health: color by what failed and the history', async () => {
  const ok = id => ({ id, ok: true, ms: 300 });
  assert.equal(healthColor(['banco', 'login', 'bibliotecas', 'avisos', 'assistente'].map(ok)).color, 'verde');
  assert.deepEqual(healthColor([ok('banco'), { id: 'login', ok: false }, ok('bibliotecas')]), { color: 'vermelho', ok: false, text: 'Fora do ar: Login.' });
  assert.equal(healthColor([ok('banco'), { id: 'assistente', ok: false }]).color, 'amarelo');
  assert.equal(healthColor([{ id: 'banco', ok: true, ms: 4000 }]).text, 'Lento: Banco de dados.');
  const h = healthHistory([{ job: 'servidor', at: '2026-11-08T12:00:00Z', ok: true, summary: { color: 'verde' } }, { job: 'servidor', at: '2026-11-07T12:00:00Z', ok: false, summary: { color: 'vermelho', text: 'Fora do ar: Login.' } }, { job: 'servidor', at: '2026-10-01T12:00:00Z', ok: true }], 7, '2026-11-09T13:00:00Z');
  assert.deepEqual([h.runs, h.bad, h.list[1].text], [2, 1, 'Fora do ar: Login.']);
  // The endpoint: database down -> red; public answer has no details.
  const { runHealth } = await import('../api/health.js');
  const fake = async (u, o) => ({ ok: !/rest\/v1/.test(u) });
  const r = await runHealth({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'k', anonKey: 'a', env: { VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q' }, fetchImpl: fake });
  assert.equal(r.color, 'vermelho'); assert.equal(r.checks.find(c => c.id === 'assistente').ok, false); assert.match(r.text, /Banco de dados/);
});
