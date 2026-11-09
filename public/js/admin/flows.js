// Screens and flows of the app for the product console ("Fluxos"). Images: public/flows/<id>.jpg,
// taken from the real app with a fictional family (tests/local/flow-screens.mjs).
// `key` links a screen to the usage recorded by the app, so each flow shows how many people got there.

export const SCREENS = {
  boas_vindas: { title: 'Boas-vindas', where: 'Abrir o link sem estar logado' },
  cadastro: { title: 'Cadastro', where: 'Criar conta grátis' },
  nome: { title: 'Como quer ser chamado', where: 'Depois do cadastro' },
  biometria: { title: 'Proteger com a digital', where: 'Depois do nome, no celular com digital ou rosto', key: 'seguranca.biometria' },
  familia: { title: 'Criar a família', where: 'Depois do nome (ou entra por convite)' },
  apresentacao: { title: 'Apresentação', where: 'Primeiro acesso; menu ☰ → Ajuda' },
  tour: { title: 'Tour guiado', where: 'Depois da apresentação; menu ☰ → Ajuda' },
  alpha: { title: 'Aviso do teste alpha', where: 'Uma vez, depois do tour', key: null },
  inicio_exemplo: { title: 'Mês de exemplo', where: 'Início, enquanto a família não tem dados', key: null },
  inicio: { title: 'Início', where: 'Aba Início', key: 'aba.inicio' },
  inicio_mais: { title: 'Mais detalhes', where: 'Início → fim da tela', key: 'aba.inicio' },
  retro_evolucao: { title: 'Retrospectiva: evolução e onde melhorar', where: 'Telas da retrospectiva, antes do nível', key: 'retro.ano' },
  retro_historias: { title: 'Retrospectiva em histórias (nível)', where: 'Início: aviso "A retrospectiva está pronta" ou Mais detalhes → Retrospectiva do ano', key: ['retro.ano', 'retro.compartilhar'] },
  retro_ano: { title: 'Retrospectiva do ano', where: 'Início → Mais detalhes → Retrospectiva do ano (em dezembro e janeiro, cartão no topo)', key: ['retro.ano', 'retro.compartilhar'] },
  fechar: { title: 'Fechar o mês', where: 'Cartão "Hora de fechar o mês" no Início', key: 'aba.fechar' },
  lancar: { title: 'Lançar', where: 'Aba Lançar', key: 'aba.lancar' },
  lancar_falar: { title: 'Falar ou escrever', where: 'Lançar → Falar ou escrever', key: 'lancar.falar' },
  lancar_salvo: { title: 'Lançamento salvo', where: 'Depois de Salvar', key: 'lancar.salvar' },
  lancar_nota: { title: 'Nota fiscal lida', where: 'Lançar → Foto da nota', key: 'lancar.nota' },
  lancar_pdf: { title: 'Enviar fatura ou extrato', where: 'Lançar → Fatura ou extrato', key: 'lancar.pdf' },
  lendo: { title: 'Lendo o documento', where: 'Enquanto lê uma fatura, extrato, nota ou vários arquivos', key: null },
  planilha: { title: 'Trazer de uma planilha', where: 'Lançar → Fatura ou extrato, escolhendo um Excel ou CSV', key: 'lancar.planilha' },
  varios_arquivos: { title: 'Vários arquivos de uma vez', where: 'Lançar → Fatura ou extrato, escolhendo mais de um arquivo', key: 'lancar.varios' },
  lancar_revisao: { title: 'Revisão da fatura', where: 'Depois de enviar o PDF', key: 'lancar.pdf_ok' },
  extrato_categoria: { title: 'Extrato por categoria', where: 'Extrato → Categoria', key: 'extrato.categoria' },
  juntar_categorias: { title: 'Categorias parecidas', where: 'Menu ☰ → Configurações → Categorias (e aviso no Início)', key: 'categorias.juntar' },
  pesquisa: { title: 'Pesquisa de satisfação', where: 'Cartão no Início, só no momento certo de cada pessoa', key: 'inicio.pesquisa_respondeu' },
  saque: { title: 'No que foi o saque', where: 'Lançar (quando há saque sem detalhe) e aviso no Início', key: 'lancar.saque_detalhado' },
  regra_aprender: { title: 'Ensinar o app (regra pelo nome)', where: 'Depois de mudar a categoria no Extrato ou no Fechar o mês', key: 'regras.aplicou' },
  anotacao: { title: 'Anotar um lançamento', where: 'Extrato → Anotar', key: 'extrato.anotacao' },
  categoria: { title: 'Escolher a categoria', where: 'Toque na categoria de um lançamento (revisão, Extrato, Fechar o mês)', key: null },
  graficos: { title: 'Gráficos', where: 'Aba Gráficos', key: 'aba.graficos' },
  perguntar: { title: 'Perguntar', where: 'Aba Perguntar', key: 'aba.perguntar' },
  perguntar_resposta: { title: 'Resposta do assistente', where: 'Perguntar → Enviar', key: 'perguntar.enviar' },
  extrato: { title: 'Extrato', where: 'Aba Extrato', key: 'aba.extrato' },
  menu: { title: 'Menu ☰', where: 'Botão ☰ no topo', key: 'aba.menu' },
  menu_familia: { title: 'Família e convites', where: 'Menu ☰', key: 'menu.familia' },
  menu_divisao: { title: 'Quem paga o quê', where: 'Menu ☰', key: 'menu.divisao' },
  menu_metas: { title: 'Metas', where: 'Menu ☰', key: 'menu.metas' },
  menu_patrimonio: { title: 'Patrimônio e dívidas', where: 'Menu ☰', key: 'menu.patrimonio' },
  menu_gastos_ano: { title: 'Gastos do ano: achados no histórico', where: 'Menu ☰ → Família e metas → Gastos do ano (e o aviso no Início)', key: ['menu.gastos_ano', 'ano.confirmou', 'ano.nao_volta'] },
  gastos_ano_calendario: { title: 'Gastos do ano: calendário, quanto separar e como pagar', where: 'Gastos do ano, depois de confirmar', key: ['ano.editou', 'ano.adicionou'] },
  menu_categorias: { title: 'Categorias', where: 'Menu ☰', key: 'menu.categorias' },
  menu_avisos: { title: 'Notificações', where: 'Menu ☰', key: 'menu.avisos' },
  avisos_celular: { title: 'Ajustes do celular para os avisos', where: 'Notificações → depois de ativar, se o aviso de teste não apareceu', key: 'avisos.teste_nao_chegou' },
  convite_avisos: { title: 'Notificações desligadas', where: 'Ao abrir o app ou voltar do bloqueio, se as notificações estão desligadas (1 vez por dia, até 7 vezes)', key: 'avisos.convite_sim' },
  menu_applepay: { title: 'Atalhos do iPhone', where: 'Menu ☰', key: 'menu.applepay' },
  menu_contexto: { title: 'O que o assistente sabe', where: 'Menu ☰', key: 'menu.contexto' },
  comprovante_amortizacao: { title: 'Comprovante que abate o financiamento', where: 'Lançar: comprovante de pagamento grande ou com "amortização" no texto', key: 'patrimonio.amortizou' },
  patrimonio_financiamento: { title: 'Financiamento hoje e pagamentos a confirmar', where: 'Menu ☰ → Família e metas → Patrimônio e dívidas (o mesmo aviso aparece no Início)', key: ['patrimonio.amortizou', 'patrimonio.nao_abate'] },
  lancar_comprovante: { title: 'Comprovante compartilhado', where: 'Compartilhar → Pra Onde Foi (Android; no iPhone, pelo atalho 3)', key: 'lancar.comprovante' },
  menu_duvidas: { title: 'Dúvidas', where: 'Menu ☰', key: 'menu.duvidas' },
  menu_opiniao: { title: 'Dar opinião', where: 'Balão no topo; menu ☰', key: 'menu.opiniao' },
  menu_ajuda: { title: 'Ajuda', where: 'Menu ☰', key: 'menu.ajuda' },
  menu_backup: { title: 'Backup', where: 'Menu ☰', key: 'menu.backup' },
  menu_sobre: { title: 'Sobre o app', where: 'Menu ☰', key: 'menu.sobre' },
  menu_conta: { title: 'Conta', where: 'Menu ☰', key: 'menu.conta' },
  duvidas_resposta: { title: 'Resposta a uma dúvida', where: 'Dúvidas → Perguntar', key: 'duvida.perguntar' },
  opiniao_confirmar: { title: 'Confirmar envio', where: 'Dar opinião → Enviar', key: null },
  opiniao_enviada: { title: 'Opinião enviada', where: 'Depois de confirmar', key: ['opiniao.erro', 'opiniao.ideia', 'opiniao.critica'] },
  recado: { title: 'Recado personalizado', where: 'Ao abrir o app, quando o pedido fica pronto', key: null },
  novidades: { title: 'O que mudou', where: 'Ao abrir o app depois de uma atualização', key: null },
  sininho: { title: 'Sininho de novidades', where: 'Sino no topo: últimos 30 dias', key: 'sininho' },
  aviso_inatividade: { title: 'Vamos desconectar em 30 s', where: '30 segundos antes do tempo sem uso (escolhido em menu ☰ → Dados e conta → Conta; na Central, 1 hora)', key: ['seguranca.aviso', 'seguranca.continuar', 'seguranca.desconectar'] },
  bloqueio: { title: 'Desconectado: entrar com a senha', where: 'Depois do tempo sem uso, ao abrir o app depois desse tempo, ou em Desconectar agora', key: 'seguranca.desbloqueio_senha' },
  entrar_digital: { title: 'Desconectado: entrar com a digital', where: 'A mesma tela, para quem ligou a digital ou o rosto: o celular só pede ao tocar em Entrar', key: 'seguranca.desbloqueio_bio' },
  saiu: { title: 'Mensagem de segurança ao sair', where: 'Depois de Sair da conta', key: null },
};

// key: null = not measured at this step (the screen's own key would count everyone who opened it).
const st = (s, action, key) => key === undefined ? { s, action } : { s, action, key };
export const FLOWS = [
  { id: 'geral', title: 'Visão geral', desc: 'Todas as telas, agrupadas por onde ficam.', map: [
    { title: 'Entrada', screens: ['boas_vindas', 'cadastro', 'nome', 'biometria', 'familia', 'apresentacao', 'tour', 'alpha'] },
    { title: 'Abas', screens: ['inicio_exemplo', 'inicio', 'lancar', 'graficos', 'perguntar', 'extrato'] },
    { title: 'Dentro das abas', screens: ['inicio_mais', 'retro_evolucao', 'retro_historias', 'retro_ano', 'fechar', 'lancar_falar', 'lancar_salvo', 'lancar_nota', 'lancar_pdf', 'lendo', 'lancar_revisao', 'varios_arquivos', 'planilha', 'categoria', 'anotacao', 'extrato_categoria', 'juntar_categorias', 'perguntar_resposta'] },
    { title: 'Menu ☰', screens: ['menu', 'menu_familia', 'menu_divisao', 'menu_metas', 'menu_gastos_ano', 'menu_patrimonio', 'menu_categorias', 'menu_avisos', 'menu_applepay', 'menu_contexto', 'menu_duvidas', 'menu_opiniao', 'menu_ajuda', 'menu_backup', 'menu_sobre', 'menu_conta'] },
    { title: 'Lançar sem abrir o app', screens: ['menu_applepay', 'lancar_comprovante'] },
    { title: 'Opinião e dúvidas', screens: ['opiniao_confirmar', 'opiniao_enviada', 'duvidas_resposta'] },
    { title: 'Mensagens ao abrir', screens: ['alpha', 'recado', 'novidades', 'convite_avisos', 'avisos_celular', 'sininho'] },
    { title: 'Segurança', screens: ['biometria', 'menu_conta', 'aviso_inatividade', 'bloqueio', 'entrar_digital', 'saiu'] },
    { title: 'Gastos do ano', screens: ['menu_gastos_ano', 'gastos_ano_calendario'] },
    { title: 'Patrimônio e financiamentos', screens: ['menu_patrimonio', 'comprovante_amortizacao', 'patrimonio_financiamento'] },
  ] },
  { id: 'primeiro', title: 'Primeiro acesso', desc: 'Do link até ver o Início pela primeira vez.', steps: [
    st('boas_vindas', 'Toca em Criar conta grátis'), st('cadastro', 'Nome, e-mail, senha e concordância'), st('nome', 'Diz como quer ser chamado'), st('biometria', 'Liga a digital ou o rosto (ou "Agora não")'),
    st('familia', 'Cria a família (ou entra pelo convite)'), st('apresentacao', '7 slides, pode pular'), st('tour', 'Balões nos botões de verdade'),
    st('alpha', 'Aviso do teste e do balão de opinião'), st('inicio_exemplo', 'Vê um mês de exemplo e toca em Enviar a última fatura', ['exemplo.fatura', 'exemplo.falar']), st('inicio', 'A régua mostra o próximo passo')] },
  { id: 'fatura', title: 'Importar fatura ou extrato', desc: 'O caminho que faz o app ter valor: o primeiro mês importado.', steps: [
    st('inicio_exemplo', 'Mês de exemplo: "Enviar a última fatura"', 'exemplo.fatura'), st('inicio', 'Régua: "Envie a última fatura"'), st('lancar', 'Abre Lançar'), st('lancar_pdf', 'Escolhe o PDF, a foto ou o print (e a senha, se tiver); o app vê pelo conteúdo o que é'), st('lendo', 'Enquanto lê: o símbolo do app se montando, o passo e o percentual', null),
    st('lancar_revisao', 'Confere a soma e as categorias, toca em Salvar'), st('varios_arquivos', 'Com várias faturas e o extrato: um por vez ("1 de 3"), o próximo começa sozinho e no fim vem o resumo', 'lancar.varios'), st('categoria', 'Troca uma categoria: busca ("estacionamento") ou toca numa sugestão', null), st('inicio', 'Sobra do mês atualizada', null)] },
  { id: 'planilha', title: 'Trazer a planilha antiga', desc: 'Quase todo mundo já controlava os gastos numa planilha: começar com o histórico faz o app ter valor no primeiro dia.', steps: [
    st('lancar_pdf', 'Escolhe o Excel ou CSV (dá junto com as faturas)', null), st('planilha', 'Confere as colunas, diz para onde vai cada categoria e salva', 'lancar.planilha'), st('juntar_categorias', 'Junta categorias parecidas, se o app sugerir', 'categorias.juntar')] },
  { id: 'categorias', title: 'Organizar as categorias', desc: 'Categorias repetidas deixam gráficos e orçamento confusos; o app sugere juntar.', steps: [
    st('inicio', 'Aviso no Início: "Duas categorias parecem a mesma"', null), st('juntar_categorias', 'Em Categorias, toca em "Juntar em…" e confirma', 'categorias.juntar'),
    st('extrato_categoria', 'No Extrato, filtra pela categoria e vê o total só dela', 'extrato.categoria')] },
  { id: 'regras', title: 'Ensinar o app pelo nome', desc: 'Mudar um lançamento e todos os parecidos irem junto: menos trabalho a cada fatura.', steps: [
    st('extrato', 'No Extrato, muda a categoria de um lançamento'), st('regra_aprender', 'O app pergunta se tudo com o mesmo nome vai junto e mostra quantos mudam', 'regras.aplicou'),
    st('juntar_categorias', 'Em Categorias, vê as regras ensinadas (e desfaz, se quiser)', 'regras.desfez')] },
  { id: 'pesquisa', title: 'Responder a pesquisa', desc: 'Cada pessoa vê a pesquisa do seu momento (sem fatura, um mês, família ou geral), nunca logo ao entrar.', steps: [
    st('inicio', 'Vê o cartão "Sua opinião · 1 minuto" no Início', 'inicio.pesquisa_viu'), st('pesquisa', 'Toca em Responder e responde uma pergunta por vez', 'inicio.pesquisa_abriu'), st('pesquisa', 'Envia e recebe o agradecimento com o nome', 'inicio.pesquisa_respondeu')] },
  { id: 'saques', title: 'Contar no que foi o saque', desc: 'Dinheiro vivo some do controle; uma frase curta devolve a sobra certa.', steps: [
    st('inicio', 'Aviso no Início: "R$ … em saques sem detalhe"', null), st('saque', 'Em Lançar, escreve ou fala "200 feira, 100 uber" e salva', 'lancar.saque_detalhado')] },
  { id: 'falar', title: 'Lançar falando', desc: 'Pix e dinheiro antes do extrato chegar.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_falar', 'Fala "gastei 45 na padaria no pix" e toca em Interpretar'), st('lancar_salvo', 'Confere e salva')] },
  { id: 'nota', title: 'Nota fiscal', desc: 'Uma compra com itens de categorias diferentes.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_nota', 'Envia a foto; cada item ganha a sua categoria'), st('lancar_salvo', 'Salva a nota', 'lancar.nota_ok')] },
  { id: 'fechar', title: 'Fechar o mês', desc: 'O ritual mensal que faz a família voltar.', steps: [
    st('inicio', 'Cartão "Hora de fechar o mês"', null), st('fechar', 'Confere o que falta, vê a retrospectiva e fecha')] },
  { id: 'gastos_ano', title: 'Gastos do ano: IPVA, IPTU e escola sem susto', desc: 'O app acha no histórico, a família confirma, e ele mostra o calendário, quanto separar por mês e se vale pagar à vista ou parcelar.', steps: [
    st('inicio', 'O Início avisa: "Gastos que voltam todo ano: achamos N no histórico"', null), st('menu_gastos_ano', 'Confirma o que volta todo ano (e o estado do veículo) ou diz que foi só uma vez', 'ano.confirmou'),
    st('gastos_ano_calendario', 'Vê os próximos 6 meses, "separem R$ X por mês" e a sugestão de à vista ou parcelado; ajusta valor, mês e forma de pagar', 'ano.editou')] },
  { id: 'financiamento', title: 'Financiamento: o saldo que diminui sozinho', desc: 'O bem ligado ao financiamento; as parcelas abatem o saldo todo mês (estimado) e cada amortização confirmada abate na hora; o patrimônio líquido sobe.', steps: [
    st('menu_patrimonio', 'Cadastra o bem e o financiamento (saldo, juros, parcela, tipo de parcela) e liga um ao outro', 'menu.patrimonio'), st('comprovante_amortizacao', 'Manda o comprovante da amortização; a revisão pergunta "Isso abate um financiamento?"', 'patrimonio.amortizou'),
    st('patrimonio_financiamento', 'Pagamento já salvo que parece amortização: "Sim, abater" ou "Não é"; o histórico mostra o saldo de cada financiamento', 'patrimonio.nao_abate'), st('inicio', 'O patrimônio do Início mostra quanto falta e o líquido maior', null)] },
  { id: 'metas', title: 'Metas e sonho', desc: 'Combinados da família e a projeção.', steps: [
    st('menu', 'Abre o menu'), st('menu_metas', 'Limite do cartão, quanto guardar, sonho'), st('inicio', 'Selos "Guardaram X% · queriam Y%"', null), st('inicio_mais', 'Projeção do sonho em Mais detalhes', null)] },
  { id: 'semabrir', title: 'Lançar sem abrir o app', desc: 'iPhone: Apple Pay, Siri e Compartilhar pelo app Atalhos. Android: Compartilhar e segurar o ícone.', steps: [
    st('menu', 'Abre o menu'), st('menu_applepay', 'Gera o código e monta os atalhos no app Atalhos', 'applepay.codigo'), st('lancar_comprovante', 'Android: compartilha o comprovante, a fatura ou a nota do banco; o app vê o que é e leva para o lugar certo', 'atalho.compartilhar')] },
  { id: 'seguranca', title: 'Segurança: desconectar por inatividade e entrar de novo', desc: 'Como nos apps de banco: o app não fica aberto com os números da família à vista, avisa antes de desconectar e só pede a digital quando a pessoa toca em Entrar.', steps: [
    st('menu_conta', 'Escolhe o tempo para desconectar e, se quiser, liga a digital ou o rosto', 'seguranca.biometria'), st('aviso_inatividade', 'Parado: 30 s antes, o aviso com a contagem; Continuar no app ou Desconectar agora', 'seguranca.aviso'), st('bloqueio', 'Sem tocar: a tela de entrada com "Olá" e o motivo; entra com a senha'), st('entrar_digital', 'Quem ligou a digital: toca em Entrar e o celular pede a digital ou o rosto'), st('inicio', 'Volta para onde estava', null), st('saiu', 'Ao sair da conta, a mensagem de segurança')] },
  { id: 'notificacoes', title: 'Ligar as notificações', desc: 'Sem notificação, a pessoa não fica sabendo das novidades nem das respostas. O app não liga sozinho: avisa e leva até lá.', steps: [
    st('convite_avisos', 'Ao abrir o app, o convite com o nome', 'avisos.convite_sim'), st('menu_avisos', 'Toca em Ativar avisos neste celular e em Permitir', 'avisos.ligou'),
    st('avisos_celular', 'O app manda um teste e pergunta se apareceu; se não, mostra os ajustes do celular', 'avisos.teste_nao_chegou')] },
  { id: 'perguntar', title: 'Perguntar ao assistente', desc: 'Perguntas sobre os números da família.', steps: [
    st('perguntar', 'Escolhe uma sugestão ou escreve'), st('perguntar_resposta', 'Resposta com os números da família')] },
  { id: 'opiniao', title: 'Dar opinião e receber o recado', desc: 'O ciclo com quem testa: manda, a equipe faz, a pessoa é avisada.', steps: [
    st('menu_opiniao', 'Toca no balão, escolhe o tipo e fala'), st('opiniao_confirmar', 'Confirma o envio'), st('opiniao_enviada', 'Vê "Recebida" na lista'),
    st('recado', 'Quando fica pronto: recado com o nome dela'), st('novidades', 'E a novidade para todos'), st('sininho', 'Tudo fica no sininho por 30 dias', 'sininho')] },
  { id: 'duvidas', title: 'Tirar uma dúvida', desc: 'Achar a resposta sozinho, sem perguntar no WhatsApp.', steps: [
    st('menu', 'Abre o menu'), st('menu_duvidas', 'Procura a dúvida'), st('duvidas_resposta', 'Não achou: o assistente responde; diz se resolveu')] },
  { id: 'convite', title: 'Convidar a família', desc: 'Duas pessoas na mesma família ficam mais tempo no app.', steps: [
    st('menu', 'Abre o menu'), st('menu_familia', 'Convidar alguém: nome e WhatsApp'), st('menu_divisao', 'Depois: quem paga o quê')] },
];

// People who reached each step (from the usage per feature), and the drop from the step before.
export function flowFunnel(steps, features = {}) {
  const usersOf = key => { if (!key) return null; const ks = Array.isArray(key) ? key : [key]; return ks.reduce((m, k) => Math.max(m, features[k]?.users || 0), 0); };
  let prev = null;
  return steps.map(x => {
    const users = usersOf('key' in x ? x.key : SCREENS[x.s]?.key);
    const drop = users != null && prev != null && prev > 0 ? Math.round((1 - users / prev) * 100) : null;
    if (users != null) prev = users;
    return { ...x, users, drop };
  });
}
