// "Parcelas já comprometidas": from the latest card bill, how much of each next month is already taken by
// installments ("03/10"), which purchases weigh the most and when each one ends. Same counting as schedule()
// in calc.js (a purchase that shows up twice in the bill with the same installment is not counted twice).
// Pure module, tested in tests/lib.test.mjs.
import { addM } from './format.js';

export function installmentPlan(cardTxs, from, n = 12) {
  const re = /^(\d{2})\/(\d{2})$/, seen = {}, key = (t, tot) => (t.day || '') + '|' + t.description + '|' + tot;
  for (const t of cardTxs || []) { const m = re.exec(t.installment || ''); if (m) seen[key(t, m[2])] = (seen[key(t, m[2])] || 0) + 1; }
  const months = Array.from({ length: n }, (_, i) => ({ month: addM(from, i + 1), total: 0 })), items = [];
  for (const t of cardTxs || []) {
    const m = re.exec(t.installment || ''); if (!m || seen[key(t, m[2])] > 1 || !(+t.amount > 0)) continue;
    const left = +m[2] - +m[1]; if (left <= 0) continue;
    for (let i = 0; i < Math.min(left, n); i++) months[i].total += +t.amount;
    items.push({ description: t.description, amount: +t.amount, left, ends: addM(from, left), of: +m[2] });
  }
  for (const x of months) x.total = Math.round(x.total * 100) / 100;
  items.sort((a, b) => b.amount * b.left - a.amount * a.left);
  const total = Math.round(items.reduce((a, x) => a + x.amount * x.left, 0) * 100) / 100;
  const last = items.reduce((a, x) => x.ends > a ? x.ends : a, '');
  return { months: months.filter((x, i) => x.total > 0 || i < 3), items, total, last };
}
