// "Meu, seu, nosso": an entry (or a whole card or account) can be "só meu". The database only shows it to its owner
// (RLS); the rest of the family gets totals by month, source and category group, so the leftover of the month stays
// right without showing where the money went. Pure, tested in tests/lib.test.mjs.

const GRP_LABEL = { dia: 'gastos', fora: 'gastos fora da conta', pontual: 'entradas pontuais', renda: 'renda', entrada: 'entradas', neutro: 'movimentações' };
const first = n => String(n || '').trim().split(/\s+/)[0] || 'alguém da família';

// Totals of other people's private entries, as the database function private_totals returns them (and as the 9h
// robot builds them from the rows it reads): [{ month, source, user_id, grp, fin, amount, n }].
export function privateTotals(txs = [], idx = new Map(), viewer = null) {
  const g = new Map();
  for (const t of txs) {
    if (!t.private_to || t.private_to === viewer) continue;
    const sp = Array.isArray(t.splits) ? t.splits.filter(x => x && x.category && +x.amount) : [];
    const parts = sp.length ? sp.map(x => ({ category: x.category, amount: (+t.amount < 0 ? -1 : 1) * Math.abs(+x.amount) })) : [{ category: t.category, amount: +t.amount }];
    for (const p of parts) {
      const c = idx.get(p.category), grp = c?.grp || (t.source === 'conta' && p.amount > 0 ? 'entrada' : 'dia'), fin = !!c?.financing;
      const k = [t.month, t.source, t.private_to, grp, fin].join('|'), cur = g.get(k) || { month: t.month, source: t.source, user_id: t.private_to, grp, fin, amount: 0, n: 0 };
      cur.amount = Math.round((cur.amount + p.amount) * 100) / 100; cur.n++; g.set(k, cur);
    }
  }
  return [...g.values()];
}

// The rows the family sees in place of someone's private entries: one per month, source and group, read-only.
// They carry their own group (monthCalc reads vgrp), so no category is needed.
export function virtualRows(totals = [], members = []) {
  return totals.filter(x => +x.amount).map(x => {
    const who = first(members.find(m => m.user_id === x.user_id)?.display_name);
    return { id: `priv:${x.user_id}:${x.month}:${x.source}:${x.grp}:${x.fin ? 1 : 0}`, virtual: true, private_owner: x.user_id, household_id: null,
      source: x.source, month: x.month, date: null, day: null, description: `Pessoal de ${who}`, note: `${x.n} ${x.n === 1 ? 'lançamento' : 'lançamentos'} de ${GRP_LABEL[x.grp] || 'gastos'}; o detalhe fica só com ${who}.`,
      amount: +x.amount, category: `Pessoal de ${who}`, vgrp: x.grp, vfin: !!x.fin, manual: false, pending: false, splits: null };
  });
}

// For the 9h robot (reads every row with the server key): other people's private entries become totals.
export const privatize = (txs, idx, members, viewer = null) => [...txs.filter(t => !t.private_to || t.private_to === viewer), ...virtualRows(privateTotals(txs, idx, viewer), members)];

// The cards and accounts someone marked as theirs (households.settings.privateCards: [{ source, card, user }]).
export const privateCardOwner = (list = [], source, card) => (card && (list || []).find(p => p.source === source && p.card === card)?.user) || null;
