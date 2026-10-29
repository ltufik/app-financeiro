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
