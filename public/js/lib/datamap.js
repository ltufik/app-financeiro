// Mapa dos dados: every piece of data the app keeps (where it is filled, what it changes) and every number it
// calculates (which function, from which data, on which screens). Shown in the Central (Planejar → Mapa dos dados).
// Rule: changed a field or a calculation? Update its line here and check EVERY screen listed in "aparece".
// tests/lib.test.mjs fails when a settings key the app writes is missing here, when a number names a function that
// does not exist, or when a number reads data that is not in this map.

// Stored data. `key` is the name in households.settings (or the table and column); `fill` is where the person
// fills it; `affects` lists what changes when it changes (ids of NUMBERS below or plain words).
export const DATA = [
  // households.settings: family plans and choices
  { key: 'goals', store: 'settings', what: 'Metas: limite da fatura por mês, % a guardar (com e sem o financiamento), valor do sonho, idades, rendimento ao ano', fill: 'Menu → Metas', affects: ['sobra_mes', 'previsao_mes', 'nivel_ano', 'sonho', 'limite_cartao', 'investimentos_hoje'] },
  { key: 'cardCloseDay', store: 'settings', what: 'Dia em que a fatura do cartão fecha', fill: 'Menu → Metas', affects: ['previsao_mes', 'limite_cartao'] },
  { key: 'budgets', store: 'settings', what: 'Limite por categoria no mês', fill: 'Menu → Metas → Orçamento por categoria', affects: ['orcamento'] },
  { key: 'presets', store: 'settings', what: 'Cenários do sonho salvos pela família', fill: 'Início → Sonho → salvar cenário', affects: ['sonho'] },
  { key: 'invest', store: 'settings', what: 'Total investido e a data do extrato', fill: 'Menu → Patrimônio e dívidas → Investimentos; Lançar (extrato de investimentos)', affects: ['investimentos_hoje', 'patrimonio_liquido', 'sonho'] },
  { key: 'assets', store: 'settings', what: 'Bens: nome, valor hoje, tipo, estado e o financiamento ligado (debtId); "debt" só para bem sem financiamento ligado', fill: 'Menu → Patrimônio e dívidas → Bens', affects: ['patrimonio_liquido', 'gastos_ano'] },
  { key: 'debts', store: 'settings', what: 'Financiamentos: saldo informado e a data (saldoEm/saldoAt), juros, parcela, tipo de parcela, meses; log das amortizações', fill: 'Menu → Patrimônio e dívidas → Financiamentos; "Registrar uma amortização"; Lançar (comprovante); pergunta "Isso abate um financiamento?"', affects: ['saldo_financiamento', 'patrimonio_liquido'] },
  { key: 'debtSkip', store: 'settings', what: 'Pagamentos que a família disse que não abatem financiamento (o app não pergunta de novo)', fill: '"Não abate" na pergunta; Desfazer amortização', affects: ['pergunta de amortização'] },
  { key: 'receivables', store: 'settings', what: 'Dinheiro que alguém devolve por mês', fill: 'Menu → Patrimônio e dívidas', affects: ['patrimonio_liquido', 'sonho'] },
  { key: 'redemptions', store: 'settings', what: 'Dinheiro que entra numa data (resgate, venda)', fill: 'Menu → Patrimônio e dívidas', affects: ['sonho'] },
  { key: 'recurring', store: 'settings', what: 'Contas fixas no cartão (nome, valor, observação)', fill: 'Menu → Patrimônio e dívidas → Contas fixas no cartão', affects: ['previsao_mes', 'limite_cartao'] },
  { key: 'annual', store: 'settings', what: 'Gastos do ano (IPVA, IPTU, escola, seguros): valor e meses', fill: 'Menu → Gastos do ano', affects: ['gastos_ano'] },
  { key: 'annualSkip', store: 'settings', what: 'Gastos do ano que a família disse que não voltam', fill: 'Gastos do ano → "Não volta"', affects: ['gastos_ano'] },
  { key: 'closed', store: 'settings', what: 'Meses fechados (data e números do fechamento)', fill: 'Fechar o mês', affects: ['nivel_ano', 'retrospectiva', 'missões'] },
  { key: 'closeSkip', store: 'settings', what: 'Fontes que a família não usa no fechamento (ex.: não tem cartão)', fill: 'Fechar o mês → "Não uso"', affects: ['lista do fechamento'] },
  { key: 'closeIgnore', store: 'settings', what: 'Categorias ignoradas no fechamento de um mês', fill: 'Fechar o mês → "Ignorar este mês"', affects: ['lista do fechamento'] },
  { key: 'checkins', store: 'settings', what: 'Conferências de domingo (data e valor da fatura aberta)', fill: 'Início → Previsão → "Quanto está a fatura aberta"', affects: ['previsao_mes', 'nivel_ano', 'sequência'] },
  { key: 'split', store: 'settings', what: 'Quem paga o quê na família', fill: 'Menu → Quem paga o quê', affects: ['acerto entre a família'] },
  { key: 'catKeepApart', store: 'settings', what: 'Pares de categorias que a família quer separadas (sem sugestão de juntar)', fill: 'Menu → Categorias → "Manter separadas"', affects: ['sugestões de categorias'] },
  { key: 'memos', store: 'settings', what: 'Anotações pessoais lembradas para o mesmo nome de lançamento', fill: 'Extrato → Anotar → "Lembrar"', affects: ['Extrato', 'Lançar'] },
  { key: 'ruleLog', store: 'settings', what: 'Regras que o app aprendeu (para mostrar e desfazer)', fill: 'Ao mudar a categoria e responder "sempre"', affects: ['Menu → Categorias → Regras'] },
  { key: 'facts', store: 'settings', what: 'Fatos da família que o assistente sabe', fill: 'Menu → O que o assistente sabe', affects: ['Perguntar'] },
  { key: 'charts', store: 'settings', what: 'Gráficos personalizados', fill: 'Gráficos → Novo gráfico', affects: ['Gráficos'] },
  { key: 'privateCards', store: 'settings', what: 'Cartões marcados como "meu" (privados)', fill: 'Lançar / Extrato → Meu, seu, nosso', affects: ['sobra_mes (visão de cada um)', 'Extrato'] },
  { key: 'skips', store: 'settings', what: 'Passos e missões que a família disse que não usa ("Não tenho")', fill: 'Menu → Missões e conquistas → "Não tenho"', affects: ['missões'] },
  { key: 'goalsSet', store: 'settings', what: 'Marca que as metas foram salvas pelo menos uma vez', fill: 'Menu → Metas → Salvar metas', affects: ['missões'] },
  { key: 'missionsDone', store: 'settings', what: 'Missões e selos já comemorados', fill: 'Automático ao cumprir', affects: ['missões', 'avisos à família'] },
  { key: 'challenge', store: 'settings', what: 'Desafio do mês aceito', fill: 'Início → Desafios → Aceitar', affects: ['desafio do mês'] },
  { key: 'challenges', store: 'settings', what: 'Histórico dos desafios', fill: 'Automático ao fim do mês', affects: ['desafio do mês', 'selos'] },
  { key: 'dupSkip', store: 'settings', what: 'Pares que a família disse que não são repetidos', fill: 'Extrato → Repetidos → "Não é repetido"', affects: ['repetidos'] },
  { key: 'fundSkip', store: 'settings', what: 'Entradas que a família disse que não pagaram amortização', fill: 'Pergunta "Esse dinheiro pagou a amortização?"', affects: ['sobra_mes'] },
  { key: 'cashSkip', store: 'settings', what: 'Saques que a família não lembra onde gastou', fill: 'Lançar → Saques → "Não lembro"', affects: ['saques'] },
  // Tables
  { key: 'transactions', store: 'tabela', what: 'Lançamentos: data, mês, valor, categoria, origem (conta/cartão), mês da fatura, partes (splits), nota, de quem (privado)', fill: 'Lançar (PDF, foto, planilha, à mão, falando); Extrato (editar)', affects: ['sobra_mes', 'previsao_mes', 'nivel_ano', 'sonho', 'gastos_ano', 'orcamento', 'limite_cartao'] },
  { key: 'categories', store: 'tabela', what: 'Categorias e o grupo de cada uma (renda, entrada, pontual, dia, fora, neutro) e se é fixa', fill: 'Menu → Categorias', affects: ['sobra_mes', 'previsao_mes', 'nivel_ano', 'orcamento'] },
  { key: 'rules', store: 'tabela', what: 'Regras de categoria (palavra → categoria)', fill: 'Menu → Categorias → Regras; aprendidas ao corrigir', affects: ['categoria dos próximos lançamentos'] },
  { key: 'imports', store: 'tabela', what: 'Arquivos importados (sem o arquivo, só o resumo)', fill: 'Lançar', affects: ['missões', 'sequência'] },
];

// Numbers the app calculates. One function each: every screen calls it (never redo the math on a screen).
export const NUMBERS = [
  { id: 'saldo_financiamento', what: 'Quanto falta de cada financiamento hoje', fn: 'debtNow', file: 'lib/debt.js', via: 'debtsNow (state.js)', inputs: ['debts'],
    shows: ['Menu → Patrimônio: "Como está cada financiamento hoje" e Ver a conta', 'Menu → Patrimônio: campo "Quanto falta hoje" dos financiamentos', 'Menu → Patrimônio: "Quanto falta pagar" dos bens ligados', 'Início: Patrimônio (cada bem)', 'Perguntar (assistente)'],
    rule: 'Saldo informado − parte das parcelas desde a data do saldo (estimada) − amortizações registradas depois do saldo. Campo editável mostra o valor de hoje; o bem ligado mostra o mesmo valor.' },
  { id: 'patrimonio_liquido', what: 'Patrimônio líquido', fn: 'patrimonio', file: 'state.js', inputs: ['invest', 'assets', 'debts', 'receivables'],
    shows: ['Início: Patrimônio', 'Retrospectiva', 'Perguntar'], rule: 'Investimentos hoje + bens − o que falta de cada financiamento + o que falta receber.' },
  { id: 'investimentos_hoje', what: 'Investimentos trazidos para hoje', fn: 'investNow', file: 'lib/debt.js', inputs: ['invest', 'goals'], shows: ['Início: Patrimônio', 'Sonho'], rule: 'Total do extrato com o rendimento ao ano das Metas até hoje.' },
  { id: 'sobra_mes', what: 'Sobra do mês', fn: 'monthCalc', file: 'lib/calc.js', inputs: ['transactions', 'categories', 'privateCards', 'fundSkip'],
    shows: ['Início: Sobra', 'Fechar o mês', 'Gráficos', 'Avisos no celular', 'Perguntar'], rule: 'Entrou − saiu pelo grupo de cada categoria; cartão pelo mês da fatura; lançamento com partes conta uma linha por parte.' },
  { id: 'previsao_mes', what: 'Previsão do mês e quanto cabe por dia', fn: 'forecast', file: 'lib/monthend.js', inputs: ['transactions', 'categories', 'goals', 'cardCloseDay', 'recurring', 'checkins'],
    shows: ['Início: Previsão do mês e Ver a conta', 'Avisos de domingo', 'Desafios'], rule: 'Extrato até o dia + renda e contas fixas que faltam + dia a dia pela média + cartão.' },
  { id: 'nivel_ano', what: 'Nível do ano (bronze, prata, ouro)', fn: 'levelProgress', file: 'lib/closing.js', via: 'yearRetro (lib/closing.js)', inputs: ['transactions', 'categories', 'goals', 'checkins', 'closed'],
    shows: ['Início: Nível do ano e Ver a conta', 'Retrospectiva'], rule: 'Sobra dos meses com extrato ÷ o que entrou; o que falta para o próximo nível até dezembro.' },
  { id: 'sonho', what: 'Sonho: quanto terão no prazo', fn: 'project', file: 'lib/calc.js', via: 'projOpts (state.js)', inputs: ['goals', 'invest', 'presets', 'receivables', 'redemptions', 'transactions'],
    shows: ['Início: Sonho e Ver a conta', 'Menu → Metas'], rule: 'Investido hoje + o que guardam por mês e por ano + recebimentos + rendimento acima da inflação.' },
  { id: 'gastos_ano', what: 'Gastos do ano e quanto separar por mês', fn: 'setAside', file: 'lib/annual.js', via: 'calendar (lib/annual.js)', inputs: ['annual', 'annualSkip', 'assets', 'transactions'],
    shows: ['Menu → Gastos do ano e Ver a conta', 'Início: aviso de gasto do ano'], rule: 'Por mês, o acumulado ÷ os meses até ele; o mês mais apertado decide, arredondado de 10 em 10.' },
  { id: 'orcamento', what: 'Orçamento por categoria no mês', fn: 'budgetStatus', file: 'lib/budget.js', inputs: ['budgets', 'transactions', 'categories'], shows: ['Início: avisos de orçamento', 'Avisos no celular'], rule: 'Gasto da categoria no mês contra o limite e o ritmo do mês.' },
  { id: 'limite_cartao', what: 'Fatura contra o limite combinado', fn: 'forecast', file: 'lib/monthend.js', inputs: ['transactions', 'goals', 'cardCloseDay', 'recurring'], shows: ['Início: Previsão (cartão)', 'Avisos no celular'], rule: 'Fatura do mês e a aberta contra o limite da fatura das Metas.' },
];

export const dataKeys = () => DATA.map(d => d.key);
