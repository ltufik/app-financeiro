// Release manifest: one entry per version of the app (`version` = VERSION in public/sw.js).
// Each entry has the "O que mudou" note shown to everyone in a pop-up (or `semNovidade` with the reason),
// the backlog ids it finishes (they get the personal message) and new backlog items.
// The server applies each entry once, at the first app opening after the deploy.
// tests/release.test.mjs blocks a release without its entry (Definição de pronto, see CLAUDE.md).
export const RELEASES = [
  { id: 'r27', version: 'v26', at: '2026-10-30T15:00:00Z', backlog: [], news: { id: 'n20261030', title: 'Sua opinião agora tem lugar no app', items: [
    'Toque no balão no topo para mandar um erro, uma ideia ou uma crítica, falando ou escrevendo.',
    'Menu ☰ → Dúvidas: as perguntas mais comuns e um assistente que responde as outras.',
    'Metas mais claras: limite do cartão, quanto guardar e o sonho de vocês.',
    'Quem paga o quê, assinaturas e modo privacidade (o olho no topo).',
  ] } },
  { id: 'r33', version: 'v33', semNovidade: 'Testando o atalho do Apple Pay; a novidade sai junto com a da Siri (v35).', at: '2026-10-30T22:30:00Z', backlog: [], addBacklog: [
    { id: 'notificacoes_do_banco_android', title: 'Lançamento automático pelas notificações do banco (Android)', status: 'proximo', origin: 'Equipe', effort: 'G', problem: 'Todo mundo esquece de lançar; o banco já avisa cada compra, Pix e TED no celular', cost: true, notes: 'Exige o app na Play Store (US$ 25 uma vez) e a permissão Acesso a notificações. Pegar prints das notificações dos bancos dos testadores.', from: [], where: '' },
    { id: 'compras_com_apple_pay_atalho_do_iphone', title: 'Compras com Apple Pay entram sozinhas (atalho do iPhone)', status: 'feito', origin: 'Equipe', effort: 'M', problem: 'iPhone não deixa ler notificações de outros apps', cost: false, notes: '', from: [], where: 'Menu ☰ → Compras com Apple Pay' },
  ] },
  { id: 'r34', version: 'v34', semNovidade: 'Saiu na v35, junto com o resto do pacote.', at: '2026-10-30T23:30:00Z', backlog: [], addBacklog: [
    { id: 'siri_gastei', title: 'Lançar falando com a Siri ("E aí Siri, gastei")', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Lançar sem abrir o app', cost: false, notes: '', from: [], where: 'Menu ☰ → Atalhos do iPhone' },
    { id: 'atalhos_no_icone_android', title: 'Atalhos no ícone do app (falar, nota, PDF)', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Lançar em um toque', cost: false, notes: '', from: [], where: 'Segurar o ícone do app (Android)' },
    { id: 'lembrete_fim_do_dia', title: 'Lembrete do fim do dia (21h, só se não lançou nada)', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Todo mundo esquece o pix e o dinheiro', cost: false, notes: '', from: [], where: 'Menu ☰ → Notificações' },
    { id: 'compartilhar_comprovante', title: 'Compartilhar comprovante de Pix/TED com o app (Android)', status: 'feito', origin: 'Equipe', effort: 'M', problem: 'Transferências pequenas ficam de fora até o extrato', cost: false, notes: '', from: [], where: 'Botão Compartilhar do app do banco' },
    { id: 'macrodroid_teste_notificacoes', title: 'Teste das notificações do banco com MacroDroid (Android, sem loja)', status: 'ideia', origin: 'Equipe', effort: 'P', problem: 'Validar o formato das notificações de cada banco antes do app da Play Store', cost: false, notes: '', from: [], where: '' },
    { id: 'lancar_pelo_email_do_banco', title: 'Lançar pelo e-mail que o banco manda a cada compra e Pix', status: 'depois', origin: 'Equipe', effort: 'M', problem: 'Muitos bancos avisam por e-mail', cost: false, notes: 'Precisa do domínio e do e-mail próprio', from: [], where: '' },
    { id: 'whatsapp_lancar', title: 'Lançar pelo WhatsApp (áudio, texto ou comprovante)', status: 'depois', origin: 'Equipe', effort: 'G', problem: 'Canal que o brasileiro mais usa', cost: true, notes: 'Configuração da Meta é burocrática; custo baixo em conversas iniciadas pela pessoa', from: [], where: '' },
  ] },
  { id: 'r35', version: 'v35', at: '2026-10-30T23:50:00Z', backlog: [], news: { id: 'n20261030b', title: 'Lançar sem abrir o app', items: [
    'iPhone: com o atalho do Apple Pay, cada compra por aproximação entra sozinha. Configure em menu ☰ → Atalhos do iPhone.',
    'iPhone: diga "E aí Siri, gastei" e fale o gasto, como "45 na padaria no pix".',
    'Android: segure o ícone do app para abrir direto o microfone, a foto da nota ou o PDF.',
    'Android: no app do banco, toque em Compartilhar comprovante e escolha o Pra Onde Foi.',
    'Às 21h, se você não lançou nada no dia, o app lembra. Dá para desligar em Notificações.',
  ] } },
  { id: 'r36', version: 'v36', at: '2026-10-31T00:00:00Z', backlog: [], semNovidade: 'Ajuste técnico: o app passa a aparecer no Compartilhar de bancos que mandam o comprovante em formato genérico (ex.: Santander). A novidade do compartilhamento já saiu na v35.' },
  { id: 'r37', version: 'v37', at: '2026-10-31T00:30:00Z', backlog: [], news: { id: 'n20261031', title: 'Endereço novo: praondefoi.app.br', items: [
    'O app agora tem endereço próprio: praondefoi.app.br. O link antigo continua funcionando e leva para o novo.',
    'Se o app pedir, entre de novo com o seu e-mail e senha. Seus dados continuam todos lá.',
    'Instalou o app no celular? Apague o ícone antigo e instale de novo pelo endereço novo. As notificações e os atalhos do iPhone continuam funcionando.',
  ] } },
  { id: 'r38', version: 'v38', at: '2026-10-31T00:45:00Z', backlog: [], semNovidade: 'Ajuste no passo a passo de instalação no Android (aba anônima, ícone de download, "Instalar" em vez de "Criar atalho"); não muda o uso do app.' },
  { id: 'r39', version: 'v39', at: '2026-10-31T00:50:00Z', backlog: [], semNovidade: 'Botão "Instalar o app no celular" na tela de entrada, para quem não está logado; quem já usa não vê diferença.' },
  { id: 'r40', version: 'v40', at: '2026-10-31T00:55:00Z', backlog: [], semNovidade: 'O convite para instalar volta a cada visita até a pessoa instalar, com a opção "Não mostrar mais"; muda só para quem ainda não instalou, então não vale pop-up para todos.' },
  { id: 'r41', version: 'v41', at: '2026-10-31T00:40:00Z', backlog: [], news: { id: 'n20261031b', title: 'Sininho de novidades', items: [
    'Toque no sino no topo para ver tudo o que mudou no app, os recados para você e o que a família fez nos últimos 30 dias.',
    'O número no sino mostra o que você ainda não viu. Ao abrir o app aparece no máximo um aviso; o resto fica no sininho.',
    'Comprovante em PDF compartilhado pelo banco agora entra como um lançamento só, sem os avisos de extrato.',
  ] } },
  { id: 'r42', version: 'v42', at: '2026-10-31T01:15:00Z', backlog: [], news: { id: 'n20261031c', title: 'O app entende o que você enviou', items: [
    'Pode mandar PDF, foto ou print: o app lê o que está escrito e descobre sozinho se é fatura, extrato, comprovante ou nota fiscal.',
    'Foto ou print da fatura agora também é importado, com a soma conferida.',
    'Enviou pelo botão errado? Sem problema: um comprovante em "Fatura ou extrato" vira um lançamento, e uma fatura em "Foto da nota" vai para a importação.',
  ] } },
  { id: 'r43', version: 'v43', at: '2026-10-31T02:45:00Z', backlog: [], semNovidade: 'Central do produto boa de usar no celular e no tablet (menu no botão ☰, tabelas em cartões); só o dono do produto vê, então não vale pop-up para as famílias.' },
  { id: 'r44', version: 'v44', at: '2026-10-31T12:40:00Z', backlog: [], news: { id: 'n20261031d', title: 'Comprovante pelo Compartilhar, agora no iPhone', items: [
    'No iPhone, monte o atalho em menu ☰ → Atalhos do iPhone → Atalho 3. Depois é só abrir o comprovante no banco, tocar em Compartilhar e escolher Pra Onde Foi.',
    'Vale PDF, print ou foto. Se for fatura, extrato ou nota fiscal, o atalho avisa para enviar pelo app.',
    'Dica: o atalho da Siri pode virar um ícone na tela de início que já abre o ditado.',
  ] } },
  { id: 'r45', version: 'v45', at: '2026-10-31T15:05:00Z', backlog: [], semNovidade: 'Só itens novos no backlog (biometria e bloqueio por tempo); nada muda no app.', addBacklog: [
    { id: 'entrar_com_biometria', title: 'Entrar com a digital ou o rosto (biometria)', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Digitar e-mail e senha toda vez é chato, e o app lida com os números da família', cost: false, notes: 'Chaves de acesso (passkeys/WebAuthn): Face ID e Touch ID no iPhone, digital no Android. O Supabase já tem suporte a MFA/WebAuthn; ver se dá para usar como login principal ou como desbloqueio rápido. Junto com o bloqueio por tempo, o desbloqueio vira a biometria.', from: [], where: 'Tela de entrada; menu ☰ → Conta' },
    { id: 'bloqueio_por_tempo', title: 'Bloquear o app depois de um tempo parado (timeout)', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'O app mostra números da família e não pode ficar aberto se o celular ficar largado', cost: false, notes: 'Depois de X minutos sem uso (ou ao voltar para o app depois de X minutos), cobre a tela e pede biometria ou senha para continuar. Tempo ajustável em menu ☰ → Conta (ex.: 1, 5, 15 min). A Central do produto também.', from: [], where: 'Todo o app; menu ☰ → Conta' },
  ] },
  { id: 'r46', version: 'v46', at: '2026-10-31T16:00:00Z', backlog: ['entrar_com_biometria', 'bloqueio_por_tempo'], news: { id: 'n20261031e', title: 'Mais segurança: bloqueio automático e digital', items: [
    'Depois de 5 minutos sem uso, o app se bloqueia sozinho e esconde os números da família. Para voltar, use a senha.',
    'Melhor ainda: em menu ☰ → Conta → Segurança, ligue a digital ou o rosto e desbloqueie com um toque. A digital fica no seu celular; o app nunca recebe.',
    'Lá também dá para escolher o tempo (de 1 a 30 minutos) e bloquear na hora.',
  ] } },
  { id: 'r47', version: 'v47', at: '2026-10-31T16:37:00Z', backlog: [], semNovidade: 'O próprio app passa a oferecer a digital ou o rosto, num pop-up que já explica e diz como desligar (até 3 vezes, uma por semana). Uma novidade a mais seria um segundo aviso sobre o mesmo assunto da v46.' },
  { id: 'r48', version: 'v48', at: '2026-10-31T17:07:00Z', backlog: [], semNovidade: 'A oferta da digital passa a aparecer também logo depois de criar a conta, no cadastro; só quem se cadastra a partir de agora vê, e quem já usa recebe a oferta ao abrir o app (v47).' },
  { id: 'r49', version: 'v49', at: '2026-11-01T17:02:00Z', backlog: [], semNovidade: 'Correção da medição da Central: telas e toques ficavam na tela anterior, blocos de Lançar com o exemplo junto e o funil da nota contando lançamentos falados. Nada muda para as famílias.' },
  { id: 'r50', version: 'v50', at: '2026-11-01T17:15:00Z', backlog: ['mes_de_exemplo_antes_do_primeiro_pdf'], news: { id: 'n20261101a', title: 'Um mês de exemplo para começar', items: [
    'Enquanto o app de vocês está vazio, o Início mostra um mês de uma família de exemplo: a sobra, para onde foi o dinheiro e o que o app percebeu.',
    'Logo abaixo, um toque leva para enviar a última fatura (PDF, foto ou print) ou para lançar um gasto falando.',
    'E o lembrete da noite, para quem ainda não mandou nada, passa a lembrar do primeiro passo: a fatura do cartão.',
  ] }, addBacklog: [
    { id: 'pesquisa_no_app', title: 'Pesquisa de uso dentro do app', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'Saber por que as pessoas usam pouco ou param, sem perguntar por fora do app', cost: false, notes: 'Depois de estimular o uso (mês de exemplo, lembrete do primeiro passo). Poucas perguntas, uma por tela, no máximo uma vez por pessoa; resultado na Central. Respeitar o limite de um pop-up por abertura.', from: [], where: 'Pop-up ao abrir o app; resultados na Central' },
    { id: 'revisao_de_custos_planos', title: 'Revisão de custos: TV, internet, celular e streaming', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Planos e assinaturas sobem de preço e se acumulam sem ninguém rever', cost: false, notes: 'O app já acha cobranças repetidas e aumentos de preço (Assinaturas e aumentos). Próximo passo: juntar por tipo (TV, internet, celular, streaming), mostrar o total do ano e sugerir como reduzir (serviços repetidos, plano mais barato, combo, cancelar o que não usa). Sem vender nada nesta etapa.', from: [], where: 'Início → Mais detalhes; um aviso quando houver economia possível' },
    { id: 'parcerias_e_servicos', title: 'Serviços e parcerias com base nos dados (cross-sell)', status: 'ideia', origin: 'Luiz', effort: 'G', problem: 'Gerar receita ajudando a família com ofertas que fazem sentido para ela', cost: false, notes: 'Ex.: plano de internet mais barato, seguro, portabilidade de crédito. Só com consentimento explícito (LGPD), oferta claramente marcada como parceria, nunca compartilhar dados sem a pessoa pedir. Depende da revisão de custos e de definir o modelo de negócio (preço e canvas na Central).', from: [], where: 'A definir' },
  ] },
];
