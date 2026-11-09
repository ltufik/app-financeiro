// Pesquisa de satisfação dentro do app: which survey (if any) this person sees now, chosen by where they are in the
// app, and the questions of each. Pure, tested in tests/lib.test.mjs.
//
// Rules (the same for everyone):
// - Never to someone who just arrived: at least 3 days since joining and 2 days of use.
// - At most one survey every 30 days per person; after "Agora não", that survey waits 7 days; after 2 "Agora não"
//   it is not shown again. A survey answered is not asked again (the general one, "nps", again after 90 days).
// - The survey matches the person's moment: no bill sent yet, sent one month and stopped, uses it regularly, or was
//   invited to a family (each a different survey).
const DAY = 864e5;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;

export const SURVEYS = {
  sem_fatura: { title: 'O que faltou para mandar a primeira fatura?', intro: 'Você entrou no app, mas ainda não mandou nenhuma fatura ou extrato. Queremos entender o motivo para facilitar. Leva 1 minuto.',
    questions: [
      { id: 'motivo', type: 'many', q: 'O que te impediu até agora?', options: [['pdf', 'Não sei baixar o PDF no app do banco'], ['receio', 'Tenho receio de mandar os dados do banco'], ['trabalho', 'Parece dar trabalho'], ['tempo', 'Ainda não tive tempo'], ['senha', 'O PDF pede senha e não deu certo'], ['nao_entendi', 'Não entendi para que serve'], ['outro', 'Outro motivo']] },
      { id: 'ajudaria', type: 'text', q: 'O que faria você mandar? (opcional)', optional: true },
    ] },
  um_mes: { title: 'Você mandou um mês. O que faltou para o próximo?', intro: 'Você já viu para onde foi o dinheiro de um mês. Queremos saber o que faltou para continuar. Leva 1 minuto.',
    questions: [
      { id: 'motivo', type: 'many', q: 'Por que ainda não mandou o mês seguinte?', options: [['esqueci', 'Esqueci'], ['trabalho', 'Dá trabalho baixar todo mês'], ['nao_ajudou', 'O que vi não me ajudou tanto'], ['numeros', 'Os números não bateram'], ['fatura_nao_fechou', 'A fatura ainda não fechou'], ['outro', 'Outro motivo']] },
      { id: 'lembrete', type: 'one', q: 'Um aviso no celular quando a fatura fecha ajudaria?', options: [['sim', 'Sim'], ['nao', 'Não'], ['ja_tenho', 'Já recebo']] },
      { id: 'ajudaria', type: 'text', q: 'O que te faria usar todo mês? (opcional)', optional: true },
    ] },
  nps: { title: 'Como está sendo usar o Pra Onde Foi?', intro: 'Você já usa o app há um tempo. Sua opinião decide o que vem a seguir. Leva 1 minuto.',
    questions: [
      { id: 'nota', type: 'scale', q: 'De 0 a 10, quanto você indicaria o app a um amigo?' },
      { id: 'ajudou', type: 'many', q: 'O que mais ajuda vocês?', options: [['para_onde', 'Ver para onde foi o dinheiro'], ['previsao', 'A previsão do mês'], ['avisos', 'Os avisos no celular'], ['metas', 'Metas e nível do ano'], ['gastos_ano', 'Gastos do ano (IPVA, IPTU...)'], ['perguntar', 'Perguntar ao assistente'], ['familia', 'Ver junto com a família']] },
      { id: 'falta', type: 'text', q: 'O que falta ou atrapalha? (opcional)', optional: true },
    ] },
  familia: { title: 'Como é usar em família?', intro: 'Você entrou pelo convite da família. Queremos saber se o app ajuda vocês a conversar sobre dinheiro. Leva 1 minuto.',
    questions: [
      { id: 'conversa', type: 'one', q: 'O app ajudou vocês a conversar sobre o dinheiro da casa?', options: [['muito', 'Ajudou muito'], ['um_pouco', 'Um pouco'], ['nao', 'Ainda não']] },
      { id: 'privado', type: 'one', q: 'Você gostaria de ter gastos só seus, que a família não vê?', options: [['sim', 'Sim'], ['nao', 'Não'], ['tanto_faz', 'Tanto faz']] },
      { id: 'falta', type: 'text', q: 'O que deixaria melhor para a família? (opcional)', optional: true },
    ] },
};

/*
  pickSurvey(ctx) -> survey id or null.
  ctx: { now, joined, activeDays, months (months with a bill or statement), closed (months closed), owner (created the
    family), history: [{ survey, kind: 'mostrou'|'adiou'|'respondeu', at }] }
*/
export function pickSurvey({ now, joined, activeDays = 0, months = 0, closed = 0, owner = true, history = [] } = {}) {
  if (!joined || !now || days(joined, now) < 3 || activeDays < 2) return null;
  const h = history || [], since = at => days(at, now);
  if (h.some(x => x.kind === 'respondeu' && since(x.at) < 30)) return null;
  const ok = id => {
    const mine = h.filter(x => x.survey === id), ans = mine.filter(x => x.kind === 'respondeu'), later = mine.filter(x => x.kind === 'adiou');
    if (ans.length && (id !== 'nps' || ans.some(x => since(x.at) < 90))) return false;
    if (later.length >= 2 && !ans.length) return false;
    if (later.some(x => since(x.at) < 7)) return false;
    return true;
  };
  const order = [];
  if (!months) order.push('sem_fatura');
  else if (months === 1 && !closed && days(joined, now) >= 10) order.push('um_mes');
  if (!owner && months >= 1 && activeDays >= 3) order.push('familia');
  if ((months >= 2 || closed >= 1) && days(joined, now) >= 14) order.push('nps');
  return order.find(ok) || null;
}

// Answers are complete when every required question has something.
export function surveyDone(id, answers = {}) {
  const s = SURVEYS[id]; if (!s) return false;
  return s.questions.every(q => q.optional || (q.type === 'many' ? (answers[q.id] || []).length : answers[q.id] != null && answers[q.id] !== ''));
}

// Central: the results of one survey. rows: product_surveys rows of that survey.
export function surveyResults(id, rows = []) {
  const tests = rows.filter(r => r.survey === id && r.answers?._teste).length; rows = rows.filter(r => !r.answers?._teste);
  const s = SURVEYS[id], ans = rows.filter(r => r.survey === id && r.kind === 'respondeu');
  const shown = new Set(rows.filter(r => r.survey === id && r.kind === 'mostrou').map(r => r.name + '|' + r.family)).size;
  const later = rows.filter(r => r.survey === id && r.kind === 'adiou').length;
  const qs = (s?.questions || []).map(q => {
    if (q.type === 'text') return { ...q, texts: ans.map(r => ({ text: r.answers?.[q.id], name: r.name, at: r.at })).filter(x => x.text) };
    if (q.type === 'scale') { const v = ans.map(r => r.score ?? r.answers?.[q.id]).filter(x => x != null).map(Number);
      const pro = v.filter(x => x >= 9).length, det = v.filter(x => x <= 6).length;
      return { ...q, n: v.length, avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null, nps: v.length ? Math.round((pro - det) / v.length * 100) : null }; }
    const counts = Object.fromEntries((q.options || []).map(([k]) => [k, 0]));
    for (const r of ans) for (const k of [].concat(r.answers?.[q.id] ?? [])) if (k in counts) counts[k]++;
    return { ...q, counts };
  });
  return { id, title: s?.title || id, shown, later, answered: ans.length, tests, questions: qs };
}
