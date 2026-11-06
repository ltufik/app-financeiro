// Dynamic home: a notice that is new or changed since the family last saw the home screen goes to the top,
// marked as new (after something was added: "Depois do que vocês lançaram"). Pure module, tested in tests/lib.test.mjs.
const RANK = { bad: 0, warn: 1, good: 2, info: 3 };
export const sig = x => x.id + '|' + x.text;
// seen: {id: sig} from the last visit (null = first visit: nothing is "new"). Returns {list, fresh: [ids], seen}.
export function rankFeed(list, seen) {
  const fresh = seen ? list.filter(x => seen[x.id] !== sig(x)).map(x => x.id) : [];
  const f = new Set(fresh), top = list.filter(x => f.has(x.id)).sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  return { list: [...top, ...list.filter(x => !f.has(x.id))], fresh, seen: Object.fromEntries(list.map(x => [x.id, sig(x)])) };
}

// Engagement of Início (Central): who acts (not only looks) and how often people come back. people = product_usage
// people ({ days, last_day, features }); acting = touched "Para fazer agora", informed the open bill or confirmed a payoff.
export const ACT_FEATURES = ['inicio.acao', 'inicio.previsao_checkin', 'patrimonio.amortizou', 'fechar.mes'];
export function homeEngagement(people = []) {
  const active = people.filter(p => +p.days > 0), acted = active.filter(p => ACT_FEATURES.some(f => +(p.features || {})[f] > 0));
  const days = active.map(p => +p.days).sort((a, b) => a - b), mid = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : 0;
  return { active: active.length, acted: acted.length, actedPct: active.length ? Math.round(acted.length / active.length * 100) : 0, daysMedian: mid };
}

