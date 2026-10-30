// Monthly budget per category: how much was used, the pace, and suggestions from past months.
// Pure functions, tested in tests/lib.test.mjs.

// Budgets saved by older versions are a list of [category, limit] pairs; today they are an object.
export function budgetsOf(settings) {
  const b = settings?.budgets;
  if (Array.isArray(b)) return Object.fromEntries(b.filter(x => Array.isArray(x) && x[0] && +x[1] > 0).map(x => [String(x[0]), +x[1]]));
  return b && typeof b === 'object' ? Object.fromEntries(Object.entries(b).filter(([, v]) => +v > 0).map(([k, v]) => [k, +v])) : {};
}

const r50 = v => Math.max(50, Math.round(v / 50) * 50);

// budgets: {category: limit}; spent: {category: amount spent in month m}; today: 'AAAA-MM-DD'.
// Returns one row per budgeted category, worst first: {category, limit, spent, pct, projected, status}.
// projected = spent at month end if the pace continues (only for the current month).
export function budgetStatus({ budgets = {}, spent = {}, month, today }) {
  const cur = today.slice(0, 7) === month;
  const day = +today.slice(8, 10), last = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const frac = cur ? Math.min(1, day / last) : 1;
  return Object.entries(budgets).filter(([, v]) => +v > 0).map(([category, limit]) => {
    const s = Math.max(0, +spent[category] || 0), pct = s / limit;
    const projected = cur && frac >= 0.2 ? s / frac : s;
    const status = pct >= 1 ? 'over' : (pct >= 0.8 || (cur && frac >= 0.2 && projected > limit * 1.1)) ? 'attention' : 'ok';
    return { category, limit: +limit, spent: Math.round(s * 100) / 100, pct, projected: Math.round(projected), status, daysLeft: cur ? last - day : 0 };
  }).sort((a, b) => b.pct - a.pct);
}

// Suggested limits: average of the last months (rounded to R$ 50), for the biggest categories.
export function suggestBudgets(history, { top = 8 } = {}) {
  const tot = {}, n = history.length || 1;
  history.forEach(m => { for (const c in m) if (m[c] > 0) tot[c] = (tot[c] || 0) + m[c]; });
  return Object.fromEntries(Object.entries(tot).filter(([c]) => c !== 'A classificar').sort((a, b) => b[1] - a[1]).slice(0, top).map(([c, v]) => [c, r50(v / n)]));
}
