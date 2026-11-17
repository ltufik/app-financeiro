// The trail (3.0): five steps, one at a time, each one unlocks tools. Replaces the starter missions on Início.
// Families that already used the app before 3.0, or that brought months of history, start with everything open:
// nothing they had disappears. Pure, tested in tests/lib.test.mjs.

export const TRAIL_SINCE = '2026-11-17';

// Every tool of the app, with the name of everyday life (3.0 names) and the step that opens it (0 = open from the start).
export const TOOLS = {
  gastos: { name: 'Gastos', desc: 'Cada gasto do mês, por categoria, com o gráfico', step: 1 },
  perguntar: { name: 'Perguntar', desc: '"Quanto foi de delivery?" e o app responde', step: 1 },
  sobra: { name: 'Quanto sobrou', desc: 'O que entrou menos o que saiu no mês', step: 2 },
  previsao: { name: 'Como deve fechar o mês', desc: 'A previsão, dia a dia', step: 2 },
  fechar: { name: 'Fechar o mês', desc: 'Conferir e guardar o mês', step: 2 },
  metas: { name: 'Metas e sonho', desc: 'Quanto guardar e para quê', step: 3 },
  contas_casa: { name: 'Contas da casa', desc: 'Celular, internet, assinaturas e ofertas', step: 3 },
  semana: { name: 'Conferir a semana', desc: 'Cinco minutos no domingo', step: 3 },
  contas_ano: { name: 'Contas do ano', desc: 'IPVA, IPTU, escola: quanto separar', step: 4 },
  divisao: { name: 'Divisão do casal', desc: 'Quem paga o quê e o acerto', step: 4 },
  patrimonio: { name: 'O que vocês têm e devem', desc: 'Bens, investimentos e dívidas', step: 5 },
  retro: { name: 'Retrospectiva', desc: 'O ano de vocês em histórias', step: 5 },
};

/*
  f: { hasCard, hasConta, closedCount, reviews (Sundays reviewed), months (months with statements or bills) }
  Each step: { n, key, title, why, minutes, go: 'pdf' | 'fechar' | 'revisar', done(f) }.
*/
export const TRAIL = [
  { n: 1, key: 'primeira', minutes: 2, go: 'pdf', done: f => !!(f.hasCard || f.hasConta),
    title: () => 'Mandar a primeira fatura ou extrato', why: () => 'Em 2 minutos vocês veem para onde foi o dinheiro.' },
  { n: 2, key: 'outro', minutes: 2, go: 'pdf', done: f => !!(f.hasCard && f.hasConta),
    title: f => f.hasCard ? 'Mandar o extrato da conta' : 'Mandar a fatura do cartão', why: f => f.hasCard ? 'Com a conta junto, o app mostra quanto sobrou no mês.' : 'Com o cartão junto, o app mostra quanto sobrou no mês.' },
  { n: 3, key: 'fechar', minutes: 5, go: 'fechar', done: f => (+f.closedCount || 0) > 0,
    title: () => 'Conferir os marcados e fechar o mês', why: () => 'O mês fica guardado e libera metas e as contas da casa.' },
  { n: 4, key: 'semana', minutes: 5, go: 'revisar', done: f => (+f.reviews || 0) > 0,
    title: () => 'Conferir a semana', why: () => 'Cinco minutos: o que entrou na semana fica certo.' },
  { n: 5, key: 'dois', minutes: 5, go: 'fechar', done: f => (+f.closedCount || 0) >= 2,
    title: () => 'Fechar o segundo mês', why: () => 'Com dois meses, o app compara e mostra o que mudou.' },
];

// legacy: the household existed before 3.0, or brought 3 months or more of history.
export const isLegacy = (createdAt, months) => !!((createdAt && String(createdAt).slice(0, 10) < TRAIL_SINCE) || (+months || 0) >= 3);

/*
  trailState(f, { legacy }) -> { steps: [{ n, key, title, why, minutes, go, done, opens: [tool ids] }], current (first not done) | null,
    doneCount, finished, open: Set of tool ids unlocked, locked: [tool ids] }
  A step counts as done only when every step before it is done too (one at a time).
*/
export function trailState(f = {}, { legacy = false } = {}) {
  let ok = true;
  const steps = TRAIL.map(s => { ok = ok && s.done(f); return { n: s.n, key: s.key, title: s.title(f), why: s.why(f), minutes: s.minutes, go: s.go, done: ok, opens: Object.keys(TOOLS).filter(k => TOOLS[k].step === s.n) }; });
  const doneCount = steps.filter(s => s.done).length, finished = legacy || doneCount === steps.length;
  const open = new Set(Object.keys(TOOLS).filter(k => finished || TOOLS[k].step === 0 || steps[TOOLS[k].step - 1]?.done));
  return { steps, current: finished ? null : steps.find(s => !s.done) || null, doneCount, finished, open, locked: Object.keys(TOOLS).filter(k => !open.has(k)) };
}

// Steps done that the family has not celebrated yet (settings.trail.seen: { n: 'AAAA-MM-DD' }). Legacy: none.
export function newlyDone(state, seen = {}, legacy = false) {
  if (!state || legacy) return [];
  return state.steps.filter(s => s.done && !(seen || {})[s.n]).map(s => s.n);
}

// The "Liberado" screen for step n: what was opened and what comes next.
export function unlockScreen(state, n) {
  const s = state.steps.find(x => x.n === n); if (!s) return null;
  const next = state.steps.find(x => !x.done) || null;
  return { n, total: state.steps.length, tools: s.opens.map(k => ({ id: k, ...TOOLS[k] })), next: next ? { n: next.n, title: next.title, why: next.why, minutes: next.minutes, go: next.go } : null };
}
