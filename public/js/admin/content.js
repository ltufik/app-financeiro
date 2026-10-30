// Starting content for the console's service matrix, documentation and usage labels.
// Once saved in the console, the database copy is the one that counts.

// Friendly names for the usage keys recorded by the app (public/js/usage.js).
export const FEATURE_LABELS = {
  'aba.inicio': 'Abriu o Início', 'aba.lancar': 'Abriu Lançar', 'aba.graficos': 'Abriu Gráficos', 'aba.perguntar': 'Abriu Perguntar', 'aba.extrato': 'Abriu Extrato', 'aba.menu': 'Abriu o menu', 'aba.fechar': 'Abriu Fechar o mês',
  'lancar.falar': 'Lançar: falar ou escrever', 'lancar.nota': 'Lançar: foto da nota', 'lancar.pdf': 'Lançar: fatura ou extrato', 'lancar.mao': 'Lançar: à mão',
  'lancar.salvar': 'Salvou lançamento falado ou escrito', 'lancar.pdf_ok': 'Importou fatura ou extrato', 'lancar.nota_ok': 'Salvou nota fiscal',
  'perguntar.enviar': 'Pergunta ao assistente', 'fechar.mes': 'Fechou um mês', 'graficos.salvar': 'Salvou gráfico', privacidade: 'Modo privacidade',
  'opiniao.erro': 'Mandou erro', 'opiniao.ideia': 'Mandou ideia', 'opiniao.critica': 'Mandou crítica', 'duvida.ler': 'Leu uma dúvida', 'duvida.perguntar': 'Perguntou nas Dúvidas',
  'menu.familia': 'Menu: Família', 'menu.divisao': 'Menu: Quem paga o quê', 'menu.metas': 'Menu: Metas', 'menu.patrimonio': 'Menu: Patrimônio', 'menu.categorias': 'Menu: Categorias',
  'menu.avisos': 'Menu: Notificações', 'menu.contexto': 'Menu: O que o assistente sabe', 'menu.ajuda': 'Menu: Ajuda', 'menu.duvidas': 'Menu: Dúvidas', 'menu.opiniao': 'Menu: Dar opinião',
  'menu.backup': 'Menu: Backup', 'menu.sobre': 'Menu: Sobre', 'menu.metricas': 'Menu: Métricas', 'menu.conta': 'Menu: Conta',
};
export const AREA_LABELS = { aba: 'Abas', lancar: 'Lançar', perguntar: 'Perguntar', fechar: 'Fechar o mês', graficos: 'Gráficos', privacidade: 'Privacidade', opiniao: 'Opinião', duvida: 'Dúvidas', menu: 'Menu' };

const sv = (id, name, what, where, status, plan, ai, deps, keys) => ({ id, name, what, where, status, plan, ai, deps, keys });
export const SERVICES = [
  sv('pdf', 'Leitura de fatura e extrato', 'Lê o PDF de qualquer banco, confere com o total e separa em lançamentos', 'Lançar → Fatura ou extrato', 'no_ar', 'gratis', 'as_vezes', 'pdf.js; IA quando o layout é novo', ['lancar.pdf_ok']),
  sv('cat', 'Categorias que aprendem', 'Sugere a categoria e aprende com cada correção', 'Revisão do PDF e Extrato', 'no_ar', 'gratis', 'sim', 'IA (rápida); regras salvas', ['lancar.pdf_ok']),
  sv('voz', 'Lançar falando ou escrevendo', '"Gastei 45 na padaria no pix" vira um lançamento', 'Lançar → Falar ou escrever', 'no_ar', 'a_definir', 'sim', 'Reconhecimento de voz do celular; IA', ['lancar.salvar', 'lancar.falar']),
  sv('nota', 'Nota fiscal por foto', 'Lê a nota e separa cada item na sua categoria', 'Lançar → Foto da nota', 'no_ar', 'pago', 'sim', 'IA com imagem', ['lancar.nota_ok', 'lancar.nota']),
  sv('mao', 'Lançar à mão', 'Data, valor, descrição e categoria', 'Lançar → Preencher à mão', 'no_ar', 'gratis', 'nao', '—', ['lancar.mao']),
  sv('inicio', 'Início com sobra e avisos', 'Sobra do mês, avisos, régua de preenchimento, para onde foi', 'Início', 'no_ar', 'gratis', 'nao', '—', ['aba.inicio']),
  sv('orc', 'Metas e orçamento', 'Limite do cartão, quanto guardar, sonho e limite por categoria', 'Menu → Metas', 'no_ar', 'gratis', 'nao', '—', ['menu.metas']),
  sv('fechar', 'Fechar o mês', 'Conferência, retrospectiva e acerto do casal', 'Cartão no Início', 'no_ar', 'gratis', 'nao', '—', ['fechar.mes', 'aba.fechar']),
  sv('graf', 'Gráficos personalizados', 'Pizza, linha e barras do jeito da família', 'Gráficos', 'no_ar', 'gratis', 'nao', '—', ['aba.graficos', 'graficos.salvar']),
  sv('ask', 'Perguntar (assistente)', 'Responde sobre os números da família e simula cenários', 'Perguntar', 'no_ar', 'pago', 'sim', 'IA com ferramentas', ['perguntar.enviar', 'aba.perguntar']),
  sv('extrato', 'Extrato e categorias', 'Lista, filtros, troca de categoria', 'Extrato', 'no_ar', 'gratis', 'nao', '—', ['aba.extrato']),
  sv('subs', 'Assinaturas e aumentos', 'Acha cobranças repetidas e avisa quando o preço sobe', 'Início → Mais detalhes', 'no_ar', 'gratis', 'nao', '—', []),
  sv('split', 'Quem paga o quê', 'Quanto cada um pagou e o acerto do mês', 'Menu → Quem paga o quê', 'no_ar', 'gratis', 'nao', '—', ['menu.divisao']),
  sv('fam', 'Família e convites', 'Convite pelo WhatsApp; todos veem os mesmos números', 'Menu → Família', 'no_ar', 'gratis', 'nao', 'Supabase Auth', ['menu.familia']),
  sv('push', 'Notificações', 'Um aviso por dia no máximo e resumo de domingo; avisos da família', 'Menu → Notificações', 'no_ar', 'gratis', 'nao', 'Web Push; Vercel Cron', ['menu.avisos']),
  sv('priv', 'Modo privacidade', 'Esconde todos os valores', 'Olho no topo', 'no_ar', 'gratis', 'nao', '—', ['privacidade']),
  sv('pat', 'Patrimônio e dívidas', 'Investimentos, bens, financiamentos e projeção do sonho', 'Menu → Patrimônio', 'no_ar', 'gratis', 'nao', '—', ['menu.patrimonio']),
  sv('backup', 'Backup', 'Baixar e importar todos os dados', 'Menu → Backup', 'no_ar', 'gratis', 'nao', '—', ['menu.backup']),
  sv('faq', 'Dúvidas', 'Perguntas frequentes; o assistente responde o que não está lá', 'Menu → Dúvidas', 'teste', 'gratis', 'sim', 'IA (rápida)', ['duvida.ler', 'duvida.perguntar']),
  sv('opiniao', 'Dar opinião', 'Erro, ideia ou crítica, falando ou escrevendo', 'Balão no topo; Menu → Dar opinião', 'teste', 'gratis', 'nao', '—', ['opiniao.erro', 'opiniao.ideia', 'opiniao.critica']),
  sv('msgs', 'Novidades e recados', 'Aviso do teste alpha, "O que mudou" e recado pessoal quando o pedido fica pronto', 'Pop-up ao abrir; menu ☰ → Ajuda', 'teste', 'gratis', 'nao', 'Web Push (recado no celular)', []),
  sv('of', 'Open Finance', 'Dados do banco sem mandar PDF', '—', 'planejado', 'pago', 'nao', 'Agregador (R$ 540 a 6.000 por mês)', []),
];
export const SV_STATUS = { no_ar: 'No ar', teste: 'Em teste', planejado: 'Planejado', pausado: 'Pausado' };
export const SV_PLAN = { gratis: 'Grátis', pago: 'Pago', a_definir: 'A definir' };
export const SV_AI = { sim: 'Sim', as_vezes: 'Às vezes', nao: 'Não' };

export const DOCS = [
  { id: 'visao', title: 'Visão geral', body: `**Pra Onde Foi** mostra para a família para onde vai o dinheiro, sem conectar no banco.
A família manda o PDF da fatura e do extrato (de qualquer banco), lança pix e dinheiro falando, e o app mostra quanto sobrou, onde dá para economizar e se estão no caminho do sonho.
## Fase atual
- MVP em teste com família e amigos.
- Foco: entender se as pessoas voltam no mês seguinte e fecham o mês.
- Sem custo extra além do uso de IA.` },
  { id: 'como', title: 'Como funciona', body: `## Caminho dos dados
- A pessoa baixa o PDF no app do banco e envia em Lançar.
- O PDF é lido no próprio celular (pdf.js). Se o layout é novo, o texto vai para a IA, que devolve os lançamentos.
- O app confere a soma com o total do PDF antes de salvar.
- As categorias vêm das regras aprendidas da família; o que sobra vai para a IA sugerir.
- Só os lançamentos são salvos no banco de dados. O PDF e a senha nunca.
## Cálculo da sobra
- Cada categoria tem um grupo: receita (fixa, variável, extra), despesa (fixa, variável, extra) ou "não conta".
- Sobra = receitas fixas e variáveis menos despesas fixas e variáveis. Os extras aparecem separados.
- O cartão conta no mês em que a fatura é paga.` },
  { id: 'dados', title: 'Dados e privacidade', body: `## O que guardamos
- Lançamentos, categorias, metas e ajustes de cada família. Só os membros veem (regra no banco: is_member).
- Dias em que cada pessoa abriu o app e quais partes usou (só o nome da parte, nunca valores).
- Opiniões e dúvidas enviadas, com a tela e o tipo de celular.
## O que nunca guardamos
- Arquivo do PDF, senha do PDF, senha de banco, foto da nota, áudio.
## Quem vê o quê
- A Central do produto e as métricas: só os e-mails em ADMIN_EMAILS.
- Excluir a conta apaga a pessoa; opiniões ficam sem nome.` },
  { id: 'infra', title: 'Infraestrutura e custos', body: `| Serviço | Para que | Custo hoje |
| Vercel | Hospeda o app e as funções do servidor | Grátis (Hobby) |
| Supabase | Login e banco de dados | Grátis (até 500 MB) |
| Anthropic | Leitura de PDF difícil, categorias, voz, nota, Perguntar, Dúvidas | Por uso |
| Pexels | Fotos | Grátis |
## Variáveis na Vercel (só os nomes)
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY (opcional: CLAUDE_MODEL, CLAUDE_MODEL_QUICK, ALLOWED_EMAILS)
- ADMIN_EMAILS
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (notificações)` },
  { id: 'publicar', title: 'Como publicar uma mudança', body: `- O código fica no GitHub (ltufik/app-financeiro). Cada envio para o GitHub publica sozinho na Vercel em 1 a 2 minutos.
- Mudou o banco de dados? Rodar o arquivo supabase/schema.sql inteiro no SQL Editor do Supabase. Ele pode ser rodado de novo sem estragar nada.
- Mudou variável na Vercel? Fazer um Redeploy.
- Antes de publicar: testes automáticos (unidade, banco e navegador) precisam passar.
- No celular, o app novo aparece ao fechar e abrir de novo.` },
  { id: 'rotina', title: 'Rotina da fase de teste', body: `## Toda semana
- Opiniões: ler as novas, marcar como "Lida", virar item do backlog ou "Resolvida".
- Algo pedido ficou pronto: mandar o recado para a pessoa (Opiniões → Avisar a pessoa).
- Publicou uma versão: escrever em Novidades o que mudou, em palavras simples.
- Dúvidas com "não resolveu": escrever a resposta e publicar nas Dúvidas.
- Uso: quem não volta há mais de 7 dias; quais partes ninguém usa.
## Todo mês
- Funil: quantas famílias importaram 1 mês, 2 meses, fecharam um mês.
- Rever o backlog: o que sobe para Agora.` },
  { id: 'glossario', title: 'Glossário da interface', body: `Palavras que o usuário vê e o que elas querem dizer. Usar sempre estas, do mesmo jeito.
- **Sobra**: o que entrou menos o que saiu no mês.
- **Limite do cartão**: até quanto a fatura pode chegar por mês.
- **Quanto guardar**: parte da renda que a família quer que sobre (%).
- **Sonho**: quanto querem ter investido e com que idade.
- **Extra**: receita ou despesa fora do comum, mostrada à parte.
- **Não conta**: movimento que não é gasto nem renda (ex.: transferência entre contas).
- **A classificar**: lançamento sem categoria.
- **Fechar o mês**: conferência e retrospectiva do mês que passou.
## Nunca usar sozinhas
- meta (dizer qual: limite, quanto guardar ou sonho), aporte, recebível, retorno real, piso da fatura.` },
];
