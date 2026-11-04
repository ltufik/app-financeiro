// Financing (financiamento) balance over time, and the link between a property (bem) and its financing.
// The family types the balance once ("saldo" on the date "saldoEm"); from then on the app:
//  - takes off, every month, the part of the installment that pays the debt (estimated from the rate):
//    "price" (equal installments): installment minus the month's interest; "sac" (installments that go down):
//    the balance divided by the months left;
//  - takes off every extra payment (amortização) the family confirms, e.g. from a receipt;
//  - starts again from a real value whenever the family types a new balance or sends the financing statement.
// Pure module, tested in tests/lib.test.mjs.

export const SISTEMAS = [['price', 'Parcelas iguais (Price)'], ['sac', 'Parcelas que diminuem (SAC)']];
export const monthlyRate = taxa => (+taxa > 0 ? Math.pow(1 + +taxa, 1 / 12) - 1 : 0);
const r2 = v => Math.round(v * 100) / 100;
const ym = d => String(d || '').slice(0, 7);
// Months between two "AAAA-MM": how many installments fell due after the balance was taken.
const monthsBetween = (a, b) => { if (!a || !b) return 0; const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return Math.max(0, (y2 - y1) * 12 + (m2 - m1)); };
const addMonth = (k, n) => { const [y, m] = k.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

// One installment: how much of it pays the debt (the rest is interest).
export function installmentSplit(saldo, { taxa, parcela, sistema = 'price', meses } = {}) {
  const juros = r2(saldo * monthlyRate(taxa));
  if (sistema === 'sac') { const n = +meses > 0 ? +meses : 0; const amort = n ? r2(saldo / n) : Math.max(0, r2((+parcela || 0) - juros)); return { amort: Math.min(saldo, amort), juros }; }
  return { amort: Math.min(saldo, Math.max(0, r2((+parcela || 0) - juros))), juros };
}

// Balance today. d: {saldo, saldoEm: "AAAA-MM-DD", saldoAt (when it was typed), taxa, parcela, sistema, meses,
// log: [{date, at (when it was recorded), kind, value, note}]}. A payment counts when it was recorded after the
// balance was typed (a balance typed later already includes it). Without saldoEm nothing is estimated yet.
// Returns {saldo, base, estimated (installments taken off by estimate), amortized (extra payments), history, interest}.
// history: oldest first, [{date, kind: 'inicio'|'parcelas'|'amortizacao', value, saldo, note}].
export function debtNow(d, today) {
  const base = Math.max(0, +d?.saldo || 0), from = d?.saldoEm && d.saldoEm <= today ? d.saldoEm : today, cur = ym(today);
  let s = base, meses = +d?.meses || 0, estimated = 0, interest = 0, amortized = 0;
  const history = [{ date: from, kind: 'inicio', value: base, saldo: base, note: d?.saldoNote || '' }];
  const events = (d?.log || []).filter(e => e && e.kind === 'amortizacao' && +e.value > 0 && (!d.saldoAt || String(e.at || '') > d.saldoAt)).sort((a, b) => a.date < b.date ? -1 : 1);
  // Installments due since the balance date: whole months only (30/09 to 04/11 is one).
  const n = !d?.saldoEm ? 0 : Math.max(0, monthsBetween(ym(from), cur) - (+today.slice(8, 10) < +from.slice(8, 10) ? 1 : 0));
  let k = ym(from), byMonth = 0;
  const applyEvents = upTo => { while (events.length && ym(events[0].date) <= upTo) { const e = events.shift(), v = Math.min(s, +e.value); s = r2(s - v); amortized += v; history.push({ date: e.date, kind: 'amortizacao', value: v, saldo: s, note: e.note || '' }); } };
  applyEvents(k);
  for (let i = 0; i < n && s > 0; i++) {
    k = addMonth(k, 1);
    const { amort, juros } = installmentSplit(s, { ...d, meses });
    s = r2(s - amort); estimated += amort; interest += juros; byMonth++; if (meses) meses--;
    applyEvents(k);
  }
  applyEvents(cur);
  if (byMonth) history.push({ date: today, kind: 'parcelas', value: r2(estimated), saldo: null, note: `${byMonth} parcela${byMonth > 1 ? 's' : ''} desde ${brDate(from)} (estimado)` });
  return { saldo: Math.max(0, r2(s)), base, estimated: r2(estimated), amortized: r2(amortized), interest: r2(interest), months: byMonth, history };
}
const brDate = d => (d || '').split('-').reverse().join('/');

// Which financing a property uses: the one it was linked to; otherwise the one with the same name words or the same balance.
const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'financiamento', 'emprestimo', 'casa', 'apartamento', 'ap', 'apto', 'imovel', 'carro', 'em', 'no', 'na']);
export const nameWords = s => plain(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
export function debtOfAsset(asset, debts = []) {
  if (!asset) return null;
  if (asset.debtId) return debts.find(d => d.id === asset.debtId) || null;
  if (!(+asset.debt > 0)) return null;
  const w = new Set(nameWords(asset.name));
  return debts.find(d => nameWords(d.name).some(x => w.has(x))) || debts.find(d => Math.abs((+d.saldo || 0) - (+asset.debt || 0)) < 1) || null;
}

// A transaction that looks like paying a financing: words in the description or note, or the debt's own name.
const PAY = /amortiz|financiament|quita[cç]|saldo devedor|abatimento|habitacional|\bsfh\b|cr[eé]dito imobili/;
export function debtForTx(tx, debts = []) {
  if (!debts.length || !tx) return null;
  const text = plain(`${tx.description || ''} ${tx.note || ''}`), words = new Set(text.split(/[^a-z0-9]+/));
  const byName = debts.find(d => nameWords(d.name).some(x => words.has(x)));
  if (byName && (PAY.test(text) || /parcela|pagamento|pix|ted|transf/.test(text))) return byName;
  if (PAY.test(text)) return byName || (debts.length === 1 ? debts[0] : null);
  return null;
}
export const looksLikeDebtPayment = tx => PAY.test(plain(`${tx?.description || ''} ${tx?.note || ''}`));

// Extra payments still to confirm: money out, much bigger than one installment, that looks like paying a financing,
// not yet linked (log txId) nor dismissed.
export function pendingAmortizations(txs = [], debts = [], dismissed = []) {
  const linked = new Set(debts.flatMap(d => (d.log || []).map(e => e.txId).filter(Boolean))), skip = new Set(dismissed || []);
  return txs.filter(t => t.source === 'conta' && +t.amount < 0 && !linked.has(t.id) && !skip.has(t.id) && looksLikeDebtPayment(t))
    .map(t => ({ tx: t, debt: debtForTx(t, debts) })).filter(x => x.debt && Math.abs(+x.tx.amount) > Math.max(1000, 1.5 * (+x.debt.parcela || 0)));
}

// The investments, brought to today with the family's yearly return (they are worth more than on the statement date).
export function investNow(invest, ret = 0.05, today) {
  const total = +invest?.total || 0, date = invest?.date;
  if (!total || !date || date >= today) return { value: total, estimated: false, days: 0 };
  const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(date + 'T12:00:00Z')) / 864e5);
  return { value: r2(total * Math.pow(1 + (+ret || 0), days / 365)), estimated: days > 0, days };
}
