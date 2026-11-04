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
  juntar_categorias: { title: 'Categorias parecidas', where: 'Menu ☰ → Organizar o app → Categorias (e aviso no Início)', key: 'categorias.juntar' },
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
  menu_categorias: { title: 'Categorias', where: 'Menu ☰', key: 'menu.categorias' },
  menu_avisos: { title: 'Notificações', where: 'Menu ☰', key: 'menu.avisos' },
  avisos_celular: { title: 'Ajustes do celular para os avisos', where: 'Notificações → depois de ativar, se o aviso de teste não apareceu', key: 'avisos.teste_nao_chegou' },
  convite_avisos: { title: 'Notificações desligadas', where: 'Ao abrir o app ou voltar do bloqueio, se as notificações estão desligadas (1 vez por dia, até 7 vezes)', key: 'avisos.convite_sim' },
  menu_applepay: { title: 'Atalhos do iPhone', where: 'Menu ☰', key: 'menu.applepay' },
  menu_contexto: { title: 'O que o assistente sabe', where: 'Menu ☰', key: 'menu.contexto' },
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
  bloqueio: { title: 'App bloqueado', where: 'Depois de alguns minutos sem uso, ou menu ☰ → Conta → Bloquear agora', key: ['seguranca.desbloqueio_bio', 'seguranca.desbloqueio_senha'] },
  saiu: { title: 'Mensagem de segurança ao sair', where: 'Depois de Sair da conta', key: null },
};

// key: null = not measured at this step (the screen's own key would count everyone who opened it).
const st = (s, action, key) => key === undefined ? { s, action } : { s, action, key };
export const FLOWS = [
  { id: 'geral', title: 'Visão geral', desc: 'Todas as telas, agrupadas por onde ficam.', map: [
    { title: 'Entrada', screens: ['boas_vindas', 'cadastro', 'nome', 'biometria', 'familia', 'apresentacao', 'tour', 'alpha'] },
    { title: 'Abas', screens: ['inicio_exemplo', 'inicio', 'lancar', 'graficos', 'perguntar', 'extrato'] },
    { title: 'Dentro das abas', screens: ['inicio_mais', 'fechar', 'lancar_falar', 'lancar_salvo', 'lancar_nota', 'lancar_pdf', 'lendo', 'lancar_revisao', 'varios_arquivos', 'planilha', 'categoria', 'anotacao', 'extrato_categoria', 'juntar_categorias', 'perguntar_resposta'] },
    { title: 'Menu ☰', screens: ['menu', 'menu_familia', 'menu_divisao', 'menu_metas', 'menu_patrimonio', 'menu_categorias', 'menu_avisos', 'menu_applepay', 'menu_contexto', 'menu_duvidas', 'menu_opiniao', 'menu_ajuda', 'menu_backup', 'menu_sobre', 'menu_conta'] },
    { title: 'Lançar sem abrir o app', screens: ['menu_applepay', 'lancar_comprovante'] },
    { title: 'Opinião e dúvidas', screens: ['opiniao_confirmar', 'opiniao_enviada', 'duvidas_resposta'] },
    { title: 'Mensagens ao abrir', screens: ['alpha', 'recado', 'novidades', 'convite_avisos', 'avisos_celular', 'sininho'] },
    { title: 'Segurança', screens: ['biometria', 'menu_conta', 'bloqueio', 'saiu'] },
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
  { id: 'falar', title: 'Lançar falando', desc: 'Pix e dinheiro antes do extrato chegar.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_falar', 'Fala "gastei 45 na padaria no pix" e toca em Interpretar'), st('lancar_salvo', 'Confere e salva')] },
  { id: 'nota', title: 'Nota fiscal', desc: 'Uma compra com itens de categorias diferentes.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_nota', 'Envia a foto; cada item ganha a sua categoria'), st('lancar_salvo', 'Salva a nota', 'lancar.nota_ok')] },
  { id: 'fechar', title: 'Fechar o mês', desc: 'O ritual mensal que faz a família voltar.', steps: [
    st('inicio', 'Cartão "Hora de fechar o mês"', null), st('fechar', 'Confere o que falta, vê a retrospectiva e fecha')] },
  { id: 'metas', title: 'Metas e sonho', desc: 'Combinados da família e a projeção.', steps: [
    st('menu', 'Abre o menu'), st('menu_metas', 'Limite do cartão, quanto guardar, sonho'), st('inicio', 'Selos "Guardaram X% · queriam Y%"', null), st('inicio_mais', 'Projeção do sonho em Mais detalhes', null)] },
  { id: 'semabrir', title: 'Lançar sem abrir o app', desc: 'iPhone: Apple Pay, Siri e Compartilhar pelo app Atalhos. Android: Compartilhar e segurar o ícone.', steps: [
    st('menu', 'Abre o menu'), st('menu_applepay', 'Gera o código e monta os atalhos no app Atalhos', 'applepay.codigo'), st('lancar_comprovante', 'Android: compartilha o comprovante, a fatura ou a nota do banco; o app vê o que é e leva para o lugar certo', 'atalho.compartilhar')] },
  { id: 'seguranca', title: 'Segurança: bloqueio e biometria', desc: 'O app não fica aberto com os números da família à vista.', steps: [
    st('menu_conta', 'Escolhe o tempo do bloqueio e liga a digital ou o rosto', 'seguranca.biometria'), st('bloqueio', 'Depois do tempo sem uso, o app cobre a tela'), st('inicio', 'Desbloqueia com a digital, o rosto ou a senha', null), st('saiu', 'Ao sair da conta, a mensagem de segurança')] },
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
