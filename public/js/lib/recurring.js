// Subscriptions and fixed charges found in the statements, and price increases.
// Pure functions, tested in tests/lib.test.mjs.
import { expandSplits } from './calc.js';

// Merchant key: uppercase, no accents, no digits/symbols noise ("NETFLIX.COM 123*" -> "NETFLIX COM").
export const merchant = d => String(d || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(PARC|PARCELA)\b.*$/, '').replace(/[0-9*#.\-/_]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');

// txs: all transactions; months: sorted month keys to look at (the last ones count most).
// A subscription = same merchant in at least 3 of the last 4 months, about the same value (within 20%), not installments.
export function findRecurring(txs, months, { idx } = {}) {
  const last4 = months.slice(-4); if (last4.length < 3) return [];
  const by = new Map();
  for (const t of expandSplits(txs)) {
    if (!last4.includes(t.month) || t.installment) continue;
    const c = idx && idx.get(t.category); if (c && !['dia', 'fora'].includes(c.grp)) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!(v > 0)) continue;
    const k = merchant(t.description); if (k.length < 3) continue;
    const m = by.get(k) || new Map(); m.set(t.month, (m.get(t.month) || 0) + v); by.set(k, m);
  }
  const out = [];
  for (const [name, m] of by) {
    const ks = [...m.keys()].sort(); if (ks.length < 3) continue;
    const vals = ks.map(k => m.get(k)), mn = Math.min(...vals), mx = Math.max(...vals);
    // Price changes are allowed once (an increase); otherwise values must stay close.
    const prevVals = vals.slice(0, -1), prevMax = Math.max(...prevVals), prevMin = Math.min(...prevVals);
    if (prevMax > prevMin * 1.2 || mx > 3000) continue;
    const lastMonth = ks[ks.length - 1], last = vals[vals.length - 1], prev = vals[vals.length - 2];
    if (last > prev * 2.5 || last < prev * 0.4) continue;
    const rise = last - prev >= 1 && last > prev * 1.03 ? Math.round((last - prev) * 100) / 100 : 0;
    out.push({ name, months: ks.length, lastMonth, last: Math.round(last * 100) / 100, prev: Math.round(prev * 100) / 100, rise, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100, current: lastMonth === months[months.length - 1] });
  }
  return out.sort((a, b) => b.last - a.last);
}
