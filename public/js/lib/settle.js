// "Quem pagou o quê": who paid the family's expenses in a month and the transfer that evens it out.
// Pure function, tested in tests/lib.test.mjs.
import { expandSplits } from './calc.js';

// split = { cards: {final: userId}, conta: userId, share: {userId: 0..1} }  (share defaults to equal parts)
// Who paid: card purchases -> owner of the card; manual entries -> who entered them; account -> account owner.
export function payerOf(t, split = {}) {
  if (t.source === 'cartao' && t.card && split.cards?.[t.card]) return split.cards[t.card];
  if (t.manual && t.created_by) return t.created_by;
  if (t.source === 'conta' && split.conta) return split.conta;
  if (t.source === 'cartao' && split.cartao) return split.cartao;
  return null;
}

export function settle({ txs, idx, members, split = {} }) {
  const ids = members.map(m => m.user_id), paid = Object.fromEntries(ids.map(id => [id, 0]));
  let total = 0, unknown = 0;
  for (const t of expandSplits(txs)) {
    const c = idx.get(t.category); if (!c || !['dia', 'fora'].includes(c.grp)) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!v) continue;
    const who = payerOf(t, split);
    total += v;
    if (who && who in paid) paid[who] += v; else unknown += v;
  }
  const known = total - unknown;
  const sh = split.share && ids.every(id => +split.share[id] >= 0) && Math.abs(ids.reduce((a, id) => a + (+split.share[id] || 0), 0) - 1) < 0.001
    ? split.share : Object.fromEntries(ids.map(id => [id, 1 / ids.length]));
  const bal = ids.map(id => ({ id, paid: Math.round(paid[id] * 100) / 100, due: Math.round(known * sh[id] * 100) / 100 })).map(b => ({ ...b, diff: Math.round((b.paid - b.due) * 100) / 100 }));
  // Transfers from who paid less to who paid more (greedy; with 2 people it's a single transfer).
  const pos = bal.filter(b => b.diff > 0.5).map(b => ({ ...b })), neg = bal.filter(b => b.diff < -0.5).map(b => ({ ...b }));
  const transfers = [];
  while (pos.length && neg.length) {
    const p = pos[0], n = neg[0], v = Math.min(p.diff, -n.diff);
    transfers.push({ from: n.id, to: p.id, amount: Math.round(v * 100) / 100 });
    p.diff -= v; n.diff += v; if (p.diff < 0.5) pos.shift(); if (n.diff > -0.5) neg.shift();
  }
  return { total: Math.round(total * 100) / 100, unknown: Math.round(unknown * 100) / 100, balances: bal, transfers, share: sh };
}
