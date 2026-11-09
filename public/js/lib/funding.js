// Money that came in to pay a financing payoff: the payoff is out of the month's leftover (it only lowers the debt),
// so the money that paid it must be out too, or the month looks like it saved what was only passing through.
// The app asks; "Sim" moves the income to an "entrada pontual" category. Pure, tested in tests/lib.test.mjs.
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/*
  fundingPairs(txs, idx, { amortCat, skip }) -> [{ payoff, income }]
  payoff: an account entry in the payoff category (amortCat); income: an account entry that counts as income
  (group renda or entrada), between half and 1.2 times the payoff, from 20 days before to 5 days after it.
  skip: income ids the person said are really income.
*/
export function fundingPairs(txs = [], idx = new Map(), { amortCat = 'Amortização de financiamento', skip = [] } = {}) {
  const no = new Set(skip || []), used = new Set(), out = [];
  const payoffs = txs.filter(t => t.source === 'conta' && !t.virtual && t.category === amortCat && +t.amount <= -1000 && t.date).sort((a, b) => a.amount - b.amount);
  for (const p of payoffs) {
    const A = Math.abs(+p.amount);
    const c = txs.filter(t => t.source === 'conta' && !t.virtual && +t.amount >= A * 0.5 && +t.amount <= A * 1.2 && t.date && !used.has(t.id) && !no.has(t.id)
      && ['renda', 'entrada'].includes(idx.get(t.category)?.grp || (+t.amount > 0 ? 'entrada' : 'dia'))
      && dayDiff(t.date, p.date) >= -5 && dayDiff(t.date, p.date) <= 20)
      .sort((x, y) => Math.abs(+x.amount - A) - Math.abs(+y.amount - A))[0];
    if (c) { used.add(c.id); out.push({ payoff: p, income: c }); }
  }
  return out;
}
