// Starting content for the product console. Once saved, the database copy is the one that counts.
// Fixed ids (from the title), so a release can mark an item as done and tell who asked for it.
export const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const it = (title, status, origin, effort, problem = '', extra = {}) => ({ id: slug(title), title, status, origin, effort, problem, cost: false, notes: '', from: [], where: '', ...extra });

export const BACKLOG = [
  // done
  ...[
    ['Leitura de fatura e extrato de qualquer banco, conferindo totais', 'Equipe'], ['Lançar gasto por voz ou texto', 'Equipe'], ['Nota fiscal por foto ou PDF, item por categoria', 'Equipe'],
    ['Gráficos do seu jeito (pizza, linha, barras, período)', 'Equipe'], ['Menu ☰ com ajustes organizados', 'Equipe'], ['Apresentação e tour guiado', 'Equipe'],
    ['Paleta Mar aberto e fotos reais', 'Equipe'], ['Grupos receita e despesa (fixa, variável, extra)', 'Equipe'], ['Início com avisos e régua de preenchimento', 'Equipe'],
    ['Notificações push diárias', 'Equipe'], ['Convite da família pelo WhatsApp', 'Equipe'], ['Fechamento do mês guiado com retrospectiva', 'Claude'],
    ['Métricas do produto (funil e retenção)', 'Claude'], ['Início enxuto', 'Claude'], ['Lançar com 4 opções', 'Claude'], ['Orçamento por categoria com aviso', 'Claude'],
    ['Assinaturas e aumentos de preço', 'Claude'], ['Extrato em cartões', 'Claude'], ['Avisos na hora para a família', 'Claude'], ['Modo privacidade', 'Claude'],
    ['Quem paga o quê e acerto do casal', 'Claude'], ['Página Sobre (o que guardamos, créditos)', 'Claude'], ['Pop-ups de confirmação e de resultado', 'Equipe'],
    ['Central do produto (painel, backlog, preço, desenho)', 'Equipe'], ['Textos mais claros: metas e patrimônio', 'Equipe'], ['Dar opinião (erro, ideia, crítica) por voz ou texto', 'Equipe'], ['Dúvidas com busca e resposta do assistente', 'Equipe'], ['Uso por funcionalidade e mapa de calor', 'Equipe'], ['Documentação e matriz de serviços', 'Equipe'], ['Aviso de teste alpha, novidades e recado personalizado', 'Equipe'], ['Compras com Apple Pay entram sozinhas (atalho do iPhone)', 'Equipe'],
  ].map(([t, o]) => it(t, 'feito', o, 'M')),
  // later (decided)
  it('E-mail próprio (Resend) e religar confirmação de e-mail', 'depois', 'Claude', 'P', 'Limite de e-mails do Supabase; obrigatório antes de abrir ao público'),
  it('Domínio próprio', 'depois', 'Equipe', 'P', 'Cara de produto; cerca de R$ 40 por ano', { cost: true }),
  it('Encaminhar a fatura por e-mail', 'depois', 'Claude', 'M', 'Conflita com não guardar o PDF e com faturas com senha'),
  it('App nas lojas (Play Store, App Store)', 'depois', 'Equipe', 'M', '', { cost: true }),
  it('Lançamento automático pelas notificações do banco (Android)', 'proximo', 'Equipe', 'G', 'Todo mundo esquece de lançar; o banco já avisa cada compra, Pix e TED no celular', { cost: true, notes: 'Exige o app na Play Store (US$ 25 uma vez) e a permissão Acesso a notificações.' }),
  it('Open Finance (dados automáticos do banco)', 'depois', 'Mercado', 'G', 'R$ 540 a 6.000 por mês nos agregadores', { cost: true }),
  it('Plano pago / modelo de negócio', 'depois', 'Produto', 'M', 'Definir depois de medir o uso'),
  // benchmarking ideas
  it('Revisão de domingo (5 minutos)', 'proximo', 'Benchmarking: Tiller, Copilot', 'P', 'Lançamentos se acumulam até a pessoa desistir'),
  it('Caixa "a revisar" que chega a zero', 'proximo', 'Benchmarking: Copilot', 'M', 'Não se sabe o que falta conferir'),
  it('Regras que aprendem (confirmar antes de aplicar)', 'ideia', 'Benchmarking: Copilot, Monarch', 'M', 'Já aprende regra exata; falta perguntar e generalizar'),
  it('Meu, seu, nosso (lançamentos e contas privadas)', 'proximo', 'Benchmarking: Monarch, Honeydue', 'M', 'Casal quer ver o comum sem expor tudo'),
  it('Comentário e reação no lançamento', 'ideia', 'Benchmarking: Monarch, Honeydue', 'P', '"O que foi esse gasto?" vira briga no WhatsApp'),
  it('Conta fora do normal (luz, condomínio acima da média)', 'ideia', 'Benchmarking: Nubank', 'P', ''),
  it('Gastos anuais previstos (IPVA, IPTU, matrícula)', 'proximo', 'Benchmarking: YNAB', 'M', 'Janeiro e fevereiro estouram'),
  it('Parcelas já comprometidas nos próximos meses', 'ideia', 'Brasil', 'M', 'Parcelas de 10x tiram a sobra dos próximos meses'),
  it('Quanto ainda dá para gastar por dia', 'ideia', 'Benchmarking: Goodbudget, Monefy', 'P', ''),
  it('Mês pelo dia do salário', 'ideia', 'Benchmarking: Emma', 'M', ''),
  it('Sobra do orçamento que passa para o mês seguinte', 'ideia', 'Benchmarking: Monarch, YNAB', 'M', ''),
  it('Previsão do fim do mês ("vai sobrar?")', 'ideia', 'Benchmarking: Monarch', 'M', ''),
  it('Dividir a nota por pessoa', 'ideia', 'Benchmarking: Splitwise Pro', 'M', '', { cost: true }),
  it('Contas a pagar com responsável e lembrete', 'ideia', 'Benchmarking: Honeydue, Organizze', 'M', ''),
  it('Projeto ou viagem com orçamento próprio', 'ideia', 'Benchmarking: Money Lover, Noh', 'M', ''),
  it('Retrospectiva do ano', 'ideia', 'Benchmarking: Copilot', 'M', 'Motivo para voltar e compartilhar em dezembro'),
  it('Perguntas sugeridas no assistente', 'ideia', 'Benchmarking: Monarch AI, Porquim', 'P', '', { cost: true }),
  it('Mês de exemplo antes do primeiro PDF', 'ideia', 'Benchmarking: Copilot, YNAB', 'P', 'Tela vazia afasta quem chega por convite'),
  it('Exportar tudo em CSV', 'ideia', 'Benchmarking: Copilot', 'P', 'Medo de perder o histórico'),
  it('Desafio de meta (52 semanas, mês sem delivery)', 'ideia', 'Benchmarking: Mobills', 'P', ''),
  it('Cobrança honesta (teste sem cartão, aviso de renovação, cancelar em 1 clique)', 'ideia', 'Benchmarking', 'P', 'Cobrança abusiva é uma das maiores reclamações do mercado'),
];

export const BENCH = [
  ['Mobills', 'BR', 'Controle de gastos e cartões', 'Dashboard, metas, orçamento, web', 'Grátis limitado; Premium R$ 99,90/ano', 'Recursos tirados do grátis; divergência de saldo'],
  ['Organizze', 'BR', 'Controle simples, só assinatura', 'Limite por categoria, notificações do banco, ocultar valores, sem anúncios', 'R$ 32,90/mês ou R$ 159/ano', 'Fatura não sincroniza; cancelamento por e-mail'],
  ['Minhas Economias', 'BR', 'Grátis com Open Finance', 'Conexão automática, orçamento', 'Grátis; clube R$ 24,90/mês', 'Sincronização duplica/apaga; cancelamento difícil'],
  ['Kinvo', 'BR', 'Investimentos', 'Carteira, benchmarks, IR', 'Premium R$ 179,90/ano', 'Posições desatualizadas, perda de histórico'],
  ['Noh', 'BR', 'Conta e cartão de casal', 'Fatura compartilhada, caixinhas, WhatsApp', 'App grátis', 'Não confirmado'],
  ['Porquim IA', 'BR', 'Assistente no WhatsApp', 'Lança por texto, áudio e foto; responde perguntas', 'Não confirmado', 'Não confirmado'],
  ['YNAB', 'EUA', 'Orçamento base zero', 'Método, YNAB Together (6 pessoas)', 'US$ 109/ano', 'Curva de aprendizado; abandono no 1º mês'],
  ['Monarch', 'EUA', 'Visão completa da família', 'Casal grátis, comentários, contas privadas, IA, previsão', 'US$ 99,99/ano', 'Conexões instáveis; suporte só por e-mail'],
  ['Copilot', 'EUA', 'Premium iPhone', 'IA que aprende, recorrências, revisão mensal/anual', 'US$ 95/ano', 'Só Apple; cobra cada pessoa do casal'],
  ['Rocket Money', 'EUA', 'Assinaturas', 'Detecta e cancela assinaturas, negocia contas', 'Grátis; US$ 7 a 14/mês', 'Cancelamento difícil; taxa confusa'],
  ['Honeydue', 'EUA', 'Casais grátis', 'Painel compartilhado, chat, lembretes', 'Grátis com anúncios', 'Sincronização errada; suporte'],
  ['Splitwise', 'Global', 'Dividir despesas', 'Simplifica dívidas; Pro lê recibo', 'Grátis limitado; Pro US$ 39,99/ano', 'Limite diário e anúncios'],
  ['Goodbudget', 'EUA', 'Envelopes manuais', 'Envelopes compartilhados', 'Grátis limitado; US$ 80/ano', 'Tudo manual; histórico curto no grátis'],
  ['Emma', 'Reino Unido', 'Agregador', 'Assinaturas, orçamento pelo salário', '£ 3 a 7/mês', 'Cobrança após cancelar teste'],
];

export const PRICING = { families: 100, payingPct: 10, priceMonthly: 12.9, priceYearly: 109.9, yearlyShare: 60, activePct: 60, aiPerFamily: 1.5, feePct: 5, fx: 5.6, supabaseUsd: 0, vercelUsd: 0 };

export const CANVAS = {
  problema: 'A família não sabe para onde vai o dinheiro: pix, cartão e renda espalhados em bancos diferentes, e planilha dá trabalho demais.',
  publico: 'Casais e famílias brasileiras que querem organizar as contas juntos, sem conectar o banco.',
  proposta: 'Manda o PDF da fatura e do extrato (de qualquer banco), fala os gastos e o app mostra quanto sobrou e o que fazer, para toda a família.',
  diferenciais: 'Família inclusa sem cobrar por pessoa; confere os totais (confiança); voz e foto de nota; fechamento do mês guiado; não pede senha de banco.',
  metricas: 'Famílias com 2 meses fechados; voltaram depois de 30 dias; % de lançamentos conferidos; famílias com 2 pessoas.',
  canais: 'Convite pelo WhatsApp entre famílias; indicação; conteúdo sobre organização financeira.',
  receita: 'Plano família (mensal/anual). Grátis: PDF e fechamento. Pago: o que tem custo de IA (assistente, voz, nota, retrospectiva).',
  custos: 'IA por uso; Supabase e Vercel (grátis no começo); e-mail transacional; domínio.',
  riscos: 'Esforço de mandar PDF todo mês; bancos mudarem o layout do PDF; concorrência de bancos com organização embutida.',
  personas: [
    { nome: 'Casal organizado', quem: '30 a 45 anos, dois salários, filhos pequenos', quer: 'Saber quanto sobra e chegar numa meta (casa, viagem)', dor: 'Planilha abandonada; brigas sobre quem gastou' },
    { nome: 'Família no aperto', quem: 'Renda apertada, muitas parcelas no cartão', quer: 'Parar de fechar o mês no vermelho', dor: 'Não sabe para onde foi; tem vergonha de olhar' },
  ],
  jornada: [
    { etapa: 'Descobre', objetivo: 'Recebe o convite no WhatsApp', metrica: 'Convites aceitos' },
    { etapa: 'Começa', objetivo: 'Cria a conta e manda o 1º PDF', metrica: '% com 1 mês importado' },
    { etapa: 'Rotina', objetivo: 'Lança por voz e confere na semana', metrica: 'Ativos por semana' },
    { etapa: 'Fecha o mês', objetivo: 'Fecha e vê a retrospectiva', metrica: '% que fecharam um mês' },
    { etapa: 'Fica', objetivo: 'Volta no mês seguinte e convida alguém', metrica: 'Voltaram depois de 30 dias' },
  ],
};
