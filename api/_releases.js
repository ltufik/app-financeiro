// Release manifest. Each version that ships something people asked for gets an entry here:
// the backlog ids it finishes (button "Pedir ao Claude" in the console gives the id) and the
// "O que mudou" note. The server applies each entry once (first app opening after the deploy):
// publishes the note, marks the items as done and sends the automatic message to who asked.
export const RELEASES = [
  { id: 'r27', at: '2026-10-30T15:00:00Z', backlog: [], news: { id: 'n20261030', title: 'Sua opinião agora tem lugar no app', items: [
    'Toque no balão no topo para mandar um erro, uma ideia ou uma crítica, falando ou escrevendo.',
    'Menu ☰ → Dúvidas: as perguntas mais comuns e um assistente que responde as outras.',
    'Metas mais claras: limite do cartão, quanto guardar e o sonho de vocês.',
    'Quem paga o quê, assinaturas e modo privacidade (o olho no topo).',
  ] } },
  { id: 'r33', at: '2026-10-30T22:30:00Z', backlog: [], addBacklog: [
    { id: 'notificacoes_do_banco_android', title: 'Lançamento automático pelas notificações do banco (Android)', status: 'proximo', origin: 'Equipe', effort: 'G', problem: 'Todo mundo esquece de lançar; o banco já avisa cada compra, Pix e TED no celular', cost: true, notes: 'Exige o app na Play Store (US$ 25 uma vez) e a permissão Acesso a notificações. Pegar prints das notificações dos bancos dos testadores.', from: [], where: '' },
    { id: 'compras_com_apple_pay_atalho_do_iphone', title: 'Compras com Apple Pay entram sozinhas (atalho do iPhone)', status: 'feito', origin: 'Equipe', effort: 'M', problem: 'iPhone não deixa ler notificações de outros apps', cost: false, notes: '', from: [], where: 'Menu ☰ → Compras com Apple Pay' },
  ] },
];
