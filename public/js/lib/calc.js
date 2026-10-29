// Pure finance calculations. A transaction is
// {source: 'conta'|'cartao', month, amount, category, installment, day, description}.
// conta amounts are signed (negative = money out); cartao amounts are positive for purchases.

export const GROUPS = {
  renda: 'Renda recorrente',
  entrada: 'Outras entradas do dia a dia',
  pontual: 'Entrada pontual (fora da sobra)',
  dia: 'Gasto do dia a dia',
  fora: 'Gasto fora do dia a dia',
  neutro: 'Não conta (transferências, investimentos, fatura)',
};

export const catIndex = categories => new Map((categories || []).map(c => [c.name, c]));

const groupOf = (t, idx) => {
  const c = idx.get(t.category);
  if (c) return c;
  return { grp: t.source === 'conta' && t.amount > 0 ? 'entrada' : 'dia', financing: false };
};

// Monthly totals. sobra (res) = entradas do dia a dia - saídas do dia a dia - cartão do dia a dia.
export function monthCalc(txs, idx) {
  let E = 0, EX = 0, D = 0, DX = 0, card = 0, cardTotal = 0, cardFora = 0, renda = 0, fin = 0;
  for (const t of txs || []) {
    const v = +t.amount || 0, c = groupOf(t, idx);
    if (t.source === 'conta') {
      if (c.grp === 'renda') { E += v; renda += v; }
      else if (c.grp === 'entrada') E += v;
      else if (c.grp === 'pontual') EX += v;
      else if (c.grp === 'dia') { D -= v; if (c.financing) fin -= v; }
      else if (c.grp === 'fora') DX -= v;
    } else {
      cardTotal += v;
      if (c.grp === 'fora') cardFora += v;
      else if (c.grp !== 'neutro') card += v;
    }
  }
  const res = E - D - card;
  return { E, EX, D, DX: DX + cardFora, card, cardTotal, out: D + card, res, renda, fin, tx: renda ? res / renda : 0, tx2: renda ? (res + fin) / renda : 0 };
}

export function sumCalcs(list) {
  const a = {};
  for (const r of list) for (const k in r) if (typeof r[k] === 'number') a[k] = (a[k] || 0) + r[k];
  a.tx = a.renda ? a.res / a.renda : 0; a.tx2 = a.renda ? (a.res + a.fin) / a.renda : 0;
  return a;
}

// Day-to-day spending by category. src: undefined (both) | 'conta' | 'cartao'.
export function byCategory(txs, idx, src) {
  const g = {};
  for (const t of txs || []) {
    if (src && t.source !== src) continue;
    const c = groupOf(t, idx); if (c.grp !== 'dia') continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount;
    g[t.category || 'A classificar'] = (g[t.category || 'A classificar'] || 0) + v;
  }
  return g;
}

// Installments still due after a card statement: array where [0] = next statement.
// The same purchase listed twice with the same total (an anticipated installment) is skipped.
export function schedule(cardTxs, n = 12) {
  const s = Array(n).fill(0), seen = {};
  const key = (t, tot) => (t.day || '') + '|' + t.description + '|' + tot;
  for (const t of cardTxs || []) { const m = /^(\d{2})\/(\d{2})$/.exec(t.installment || ''); if (m) seen[key(t, m[2])] = (seen[key(t, m[2])] || 0) + 1; }
  for (const t of cardTxs || []) {
    const m = /^(\d{2})\/(\d{2})$/.exec(t.installment || ''); if (!m || seen[key(t, m[2])] > 1) continue;
    const left = +m[2] - +m[1];
    for (let i = 0; i < Math.min(left, n); i++) s[i] += +t.amount;
  }
  return s;
}

// Investment projection in today's money. receivables: [{monthly, left|null}] (null = no end).
// redemptions: [{value, at}] where at = month number from now (1 = next month).
export function project(o) {
  const r = Math.pow(1 + (o.ret ?? 0.05), 1 / 12) - 1; let v = o.start || 0; const pts = [v];
  const years = Math.max(0, Math.round(o.years || 0));
  for (let m = 1; m <= years * 12; m++) {
    let add = o.pmt || 0;
    for (const x of o.receivables || []) if (x.left == null || m <= x.left) add += +x.monthly || 0;
    for (const x of o.redemptions || []) if (x.at === m) add += +x.value || 0;
    v = v * (1 + r) + add;
    if (m % 12 === 0) { v += o.ext || 0; pts.push(v); }
  }
  return pts;
}

export function needPmt(o, goal) {
  let lo = 0, hi = 1e6;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; const p = project({ ...o, pmt: mid }); p[p.length - 1] < goal ? lo = mid : hi = mid; }
  return hi;
}

// Loan payoff keeping the installment and shortening the term. rate = annual.
export function payoff(o) {
  const i = Math.pow(1 + o.rate, 1 / 12) - 1; let pv = o.saldo - (o.amort || 0), m = 0, paid = o.amort || 0;
  if (pv <= 0) return { months: 0, paid, juros: paid - o.saldo };
  if (pv * i >= o.parcela + (o.extraM || 0)) return { months: null, paid: null, juros: null };
  while (pv > 0.01 && m < 600) {
    m++; const pay = Math.min(pv * (1 + i), o.parcela + (o.extraM || 0)); pv = pv * (1 + i) - pay; paid += pay;
    if (m % 12 === 0 && pv > 0) { const x = Math.min(pv, o.extraY || 0); pv -= x; paid += x; }
  }
  return { months: m, paid, juros: paid - o.saldo };
}
