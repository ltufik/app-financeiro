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
];
