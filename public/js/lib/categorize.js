// Rule-based categorization. rules: [{source, kind: 'exact'|'regex', pattern, category, min_abs, max_abs, priority}]
import { norm } from './format.js';

// The database keeps one rule per (source, kind, pattern). Two regex rules with the same pattern but a different
// value range (e.g. "PIX from Luana" ≥ 5,000 is salary, below is other income) are both kept: the second gets
// an empty group "(?:)", which matches exactly the same text. Repeated exact rules: the last one wins.
export function uniqueRules(rules) {
  const seen = new Map(), out = [];
  for (const r of rules || []) {
    let p = r.pattern; const key = () => `${r.source}|${r.kind}|${p}`;
    if (seen.has(key())) {
      if (r.kind !== 'regex') { out[seen.get(key())] = { ...r }; continue; }
      while (seen.has(key())) p += '(?:)';
    }
    seen.set(key(), out.length); out.push({ ...r, pattern: p });
  }
  return out;
}

export function prepareRules(rules) {
  const exact = { conta: new Map(), cartao: new Map() }, regex = { conta: [], cartao: [] };
  for (const r of rules || []) {
    if (!exact[r.source]) continue;
    if (r.kind === 'exact') exact[r.source].set(r.pattern, r.category);
    else { try { regex[r.source].push({ ...r, re: new RegExp(r.pattern, 'i') }); } catch (e) { /* invalid pattern: ignore */ } }
  }
  for (const k in regex) regex[k].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  return { exact, regex };
}

// tx: {source, description, amount, installment, day}. prevCard: last month's card transactions,
// used to carry the category of an installment that continues.
export function classify(tx, prepared, prevCard) {
  const n = norm(tx.description);
  if (tx.source === 'cartao' && prevCard) {
    const pm = /^(\d{2})\/(\d{2})$/.exec(tx.installment || '');
    if (pm && +pm[1] > 1) {
      const want = String(+pm[1] - 1).padStart(2, '0') + '/' + pm[2];
      const hit = prevCard.find(p => p.day === tx.day && norm(p.description) === n && p.installment === want && p.category);
      if (hit) return { category: hit.category, how: 'parcela' };
    }
  }
  const ex = prepared.exact[tx.source]?.get(n);
  if (ex) return { category: ex, how: 'aprendido' };
  const a = Math.abs(+tx.amount || 0);
  for (const r of prepared.regex[tx.source] || []) {
    if (!r.re.test(n)) continue;
    if (r.min_abs != null && a < r.min_abs) continue;
    if (r.max_abs != null && a > r.max_abs) continue;
    return { category: r.category, how: 'regra' };
  }
  return null;
}
