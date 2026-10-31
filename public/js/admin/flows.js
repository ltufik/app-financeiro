// Screens and flows of the app for the product console ("Fluxos"). Images: public/flows/<id>.jpg,
// taken from the real app with a fictional family (tests/local/flow-screens.mjs).
// `key` links a screen to the usage recorded by the app, so each flow shows how many people got there.

export const SCREENS = {
  boas_vindas: { title: 'Boas-vindas', where: 'Abrir o link sem estar logado' },
  cadastro: { title: 'Cadastro', where: 'Criar conta grátis' },
  nome: { title: 'Como quer ser chamado', where: 'Depois do cadastro' },
  familia: { title: 'Criar a família', where: 'Depois do nome (ou entra por convite)' },
  apresentacao: { title: 'Apresentação', where: 'Primeiro acesso; menu ☰ → Ajuda' },
  tour: { title: 'Tour guiado', where: 'Depois da apresentação; menu ☰ → Ajuda' },
  alpha: { title: 'Aviso do teste alpha', where: 'Uma vez, depois do tour', key: null },
  inicio: { title: 'Início', where: 'Aba Início', key: 'aba.inicio' },
  inicio_mais: { title: 'Mais detalhes', where: 'Início → fim da tela', key: 'aba.inicio' },
  fechar: { title: 'Fechar o mês', where: 'Cartão "Hora de fechar o mês" no Início', key: 'aba.fechar' },
  lancar: { title: 'Lançar', where: 'Aba Lançar', key: 'aba.lancar' },
  lancar_falar: { title: 'Falar ou escrever', where: 'Lançar → Falar ou escrever', key: 'lancar.falar' },
  lancar_salvo: { title: 'Lançamento salvo', where: 'Depois de Salvar', key: 'lancar.salvar' },
  lancar_nota: { title: 'Nota fiscal lida', where: 'Lançar → Foto da nota', key: 'lancar.nota' },
  lancar_pdf: { title: 'Enviar fatura ou extrato', where: 'Lançar → Fatura ou extrato', key: 'lancar.pdf' },
  lancar_revisao: { title: 'Revisão da fatura', where: 'Depois de enviar o PDF', key: 'lancar.pdf_ok' },
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
};

// key: null = not measured at this step (the screen's own key would count everyone who opened it).
const st = (s, action, key) => key === undefined ? { s, action } : { s, action, key };
export const FLOWS = [
  { id: 'geral', title: 'Visão geral', desc: 'Todas as telas, agrupadas por onde ficam.', map: [
    { title: 'Entrada', screens: ['boas_vindas', 'cadastro', 'nome', 'familia', 'apresentacao', 'tour', 'alpha'] },
    { title: 'Abas', screens: ['inicio', 'lancar', 'graficos', 'perguntar', 'extrato'] },
    { title: 'Dentro das abas', screens: ['inicio_mais', 'fechar', 'lancar_falar', 'lancar_salvo', 'lancar_nota', 'lancar_pdf', 'lancar_revisao', 'perguntar_resposta'] },
    { title: 'Menu ☰', screens: ['menu', 'menu_familia', 'menu_divisao', 'menu_metas', 'menu_patrimonio', 'menu_categorias', 'menu_avisos', 'menu_applepay', 'menu_contexto', 'menu_duvidas', 'menu_opiniao', 'menu_ajuda', 'menu_backup', 'menu_sobre', 'menu_conta'] },
    { title: 'Lançar sem abrir o app', screens: ['menu_applepay', 'lancar_comprovante'] },
    { title: 'Opinião e dúvidas', screens: ['opiniao_confirmar', 'opiniao_enviada', 'duvidas_resposta'] },
    { title: 'Mensagens ao abrir', screens: ['alpha', 'recado', 'novidades', 'sininho'] },
  ] },
  { id: 'primeiro', title: 'Primeiro acesso', desc: 'Do link até ver o Início pela primeira vez.', steps: [
    st('boas_vindas', 'Toca em Criar conta grátis'), st('cadastro', 'Nome, e-mail, senha e concordância'), st('nome', 'Diz como quer ser chamado'),
    st('familia', 'Cria a família (ou entra pelo convite)'), st('apresentacao', '7 slides, pode pular'), st('tour', 'Balões nos botões de verdade'),
    st('alpha', 'Aviso do teste e do balão de opinião'), st('inicio', 'A régua mostra o próximo passo')] },
  { id: 'fatura', title: 'Importar fatura ou extrato', desc: 'O caminho que faz o app ter valor: o primeiro mês importado.', steps: [
    st('inicio', 'Régua: "Envie a última fatura"'), st('lancar', 'Abre Lançar'), st('lancar_pdf', 'Escolhe o PDF, a foto ou o print (e a senha, se tiver); o app vê pelo conteúdo o que é'),
    st('lancar_revisao', 'Confere a soma e as categorias, toca em Salvar'), st('inicio', 'Sobra do mês atualizada', null)] },
  { id: 'falar', title: 'Lançar falando', desc: 'Pix e dinheiro antes do extrato chegar.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_falar', 'Fala "gastei 45 na padaria no pix" e toca em Interpretar'), st('lancar_salvo', 'Confere e salva')] },
  { id: 'nota', title: 'Nota fiscal', desc: 'Uma compra com itens de categorias diferentes.', steps: [
    st('lancar', 'Abre Lançar'), st('lancar_nota', 'Envia a foto; cada item ganha a sua categoria'), st('lancar_salvo', 'Salva a nota')] },
  { id: 'fechar', title: 'Fechar o mês', desc: 'O ritual mensal que faz a família voltar.', steps: [
    st('inicio', 'Cartão "Hora de fechar o mês"', null), st('fechar', 'Confere o que falta, vê a retrospectiva e fecha')] },
  { id: 'metas', title: 'Metas e sonho', desc: 'Combinados da família e a projeção.', steps: [
    st('menu', 'Abre o menu'), st('menu_metas', 'Limite do cartão, quanto guardar, sonho'), st('inicio', 'Selos "Guardaram X% · queriam Y%"', null), st('inicio_mais', 'Projeção do sonho em Mais detalhes', null)] },
  { id: 'semabrir', title: 'Lançar sem abrir o app', desc: 'iPhone: Apple Pay, Siri e Compartilhar pelo app Atalhos. Android: Compartilhar e segurar o ícone.', steps: [
    st('menu', 'Abre o menu'), st('menu_applepay', 'Gera o código e monta os atalhos no app Atalhos', 'applepay.codigo'), st('lancar_comprovante', 'Android: compartilha o comprovante, a fatura ou a nota do banco; o app vê o que é e leva para o lugar certo', 'atalho.compartilhar')] },
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
