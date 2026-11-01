// "Mês de exemplo": while the family has no data, Início shows what the app does with a fictional
// family, using the same calculations as the real summary. Read only, never saved.
// Pure module, tested in tests/lib.test.mjs.
import { catIndex, monthCalc, byCategory } from './calc.js';
import { brl0 } from './format.js';

export const DEMO_FAMILY = 'Família Exemplo';
export const DEMO_MONTH = 'setembro';
const C = (name, grp, recurring = false) => ({ name, grp, recurring });
export const DEMO_CATS = [
  C('Salário', 'renda', true), C('Outras entradas', 'entrada'), C('Moradia e contas', 'dia', true), C('Mercado', 'dia'), C('Restaurantes e delivery', 'dia'),
  C('Transporte', 'dia'), C('Saúde', 'dia'), C('Escola e cursos', 'dia', true), C('Assinaturas', 'dia', true), C('Lazer', 'dia'), C('Pagamento da fatura do cartão', 'neutro'),
];
const T = (source, description, amount, category) => ({ source, month: '2026-09', description, amount, category });
export const DEMO_TXS = [
  T('conta', 'Salário', 9800, 'Salário'), T('conta', 'Salário', 6200, 'Salário'), T('conta', 'Pix recebido: venda do carrinho de bebê', 450, 'Outras entradas'),
  T('conta', 'Aluguel', -3200, 'Moradia e contas'), T('conta', 'Condomínio', -780, 'Moradia e contas'), T('conta', 'Energia', -310, 'Moradia e contas'),
  T('conta', 'Escola', -1850, 'Escola e cursos'), T('conta', 'Pix: diarista', -640, 'Moradia e contas'), T('conta', 'Pagamento da fatura', -5120, 'Pagamento da fatura do cartão'),
  T('cartao', 'Supermercado', 1480, 'Mercado'), T('cartao', 'Hortifruti', 260, 'Mercado'), T('cartao', 'Delivery (12 pedidos)', 980, 'Restaurantes e delivery'),
  T('cartao', 'Restaurante', 310, 'Restaurantes e delivery'), T('cartao', 'Combustível', 690, 'Transporte'), T('cartao', 'Aplicativo de transporte', 240, 'Transporte'),
  T('cartao', 'Farmácia', 230, 'Saúde'), T('cartao', 'Streaming (4 serviços)', 165, 'Assinaturas'), T('cartao', 'Internet e celular', 320, 'Assinaturas'),
  T('cartao', 'Cinema e passeios', 420, 'Lazer'),
];

// The numbers the example card shows: leftover, savings rate, where the money went and two findings.
export function demoSummary() {
  const idx = catIndex(DEMO_CATS), a = monthCalc(DEMO_TXS, idx), cats = byCategory(DEMO_TXS, idx);
  const top = Object.entries(cats).filter(e => e[1] > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([cat, v]) => ({ cat, v }));
  const delivery = cats['Restaurantes e delivery'] || 0, subs = cats['Assinaturas'] || 0;
  return {
    res: a.res, tx: a.tx, income: a.E, out: a.out, top,
    findings: [
      `Delivery e restaurante somaram ${brl0(delivery)} no mês. Pela metade, sobram mais ${brl0(delivery / 2 * 12)} no ano.`,
      `Streaming, internet e celular: ${brl0(subs)} por mês. Vale revisar os planos.`,
    ],
  };
}
