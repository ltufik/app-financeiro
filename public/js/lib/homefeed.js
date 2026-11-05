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
