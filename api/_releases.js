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
];
