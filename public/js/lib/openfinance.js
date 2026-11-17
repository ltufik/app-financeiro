// Open Finance test (Central → Teste Open Finance, owner only): turns what Pluggy returns for one connection
// (item, accounts, transactions, bills) into what the app would see, without storing anything.
// Pure, tested in tests/lib.test.mjs. The server (api/_pluggy.js) fetches; this file only reads.

const num = v => (Number.isFinite(+v) ? +v : 0);
const day = v => String(v || '').slice(0, 10);
const month = v => day(v).slice(0, 7);
const r2 = v => Math.round(v * 100) / 100;

// Account kind in the app: card bill (cartao) or bank statement (conta).
export const ofKind = a => (a?.type === 'CREDIT' || a?.subtype === 'CREDIT_CARD') ? 'cartao' : 'conta';

export function ofLabel(a = {}) {
  const kind = ofKind(a), last4 = String(a.number || '').replace(/\D/g, '').slice(-4);
  const base = a.marketingName || a.name || (kind === 'cartao' ? 'Cartão' : 'Conta');
  return base + (last4 ? ` · final ${last4}` : '');
}

// Money out or in, whatever sign convention the bank uses: the type decides (DEBIT = saiu), the amount only gives the size.
const out = t => t?.type ? t.type === 'DEBIT' : num(t?.amount) < 0;

// The app's own shape: cartão = expense positive; conta = expense negative (as an imported statement).
export function ofToTxs(account, txs = []) {
  const kind = ofKind(account);
  return txs.filter(t => t && t.date).map(t => {
    const v = Math.abs(num(t.amount)), o = out(t);
    return {
      date: day(t.date), month: month(t.date), description: String(t.description || t.descriptionRaw || '').trim() || '(sem descrição)',
      amount: r2(kind === 'cartao' ? (o ? v : -v) : (o ? -v : v)), source: kind, pending: t.status === 'PENDING',
      category: t.category || '', installment: t.creditCardMetadata?.totalInstallments > 1 ? `${t.creditCardMetadata.installmentNumber}/${t.creditCardMetadata.totalInstallments}` : '',
      inBill: !!t.creditCardMetadata?.billId,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// Open bill (what Luiz cannot download as PDF): card purchases not yet tied to a closed bill.
export function ofOpenBill(account, txs = []) {
  if (ofKind(account) !== 'cartao') return null;
  const mine = ofToTxs(account, txs), open = mine.filter(t => !t.inBill), spend = open.filter(t => t.amount > 0);
  return { n: spend.length, total: r2(spend.reduce((s, t) => s + t.amount, 0)), since: spend.length ? spend[spend.length - 1].date : null,
    closeDate: day(account.creditData?.balanceCloseDate) || null, dueDate: day(account.creditData?.balanceDueDate) || null,
    known: mine.some(t => t.inBill) };
}

// Spend per month (what the app would add up), newest first.
export function ofMonths(account, txs = []) {
  const by = {};
  for (const t of ofToTxs(account, txs)) {
    const spend = t.source === 'cartao' ? t.amount : -t.amount;
    if (spend > 0) { by[t.month] = by[t.month] || { month: t.month, out: 0, n: 0 }; by[t.month].out += spend; by[t.month].n++; }
    else if (t.source === 'conta') { by[t.month] = by[t.month] || { month: t.month, out: 0, n: 0 }; by[t.month].in = (by[t.month].in || 0) - spend; }
  }
  return Object.values(by).map(m => ({ ...m, out: r2(m.out), in: r2(m.in || 0) })).sort((a, b) => b.month.localeCompare(a.month));
}

/*
  ofSummary({ item, accounts: [{ account, txs, bills }] }, today) -> {
    bank, status, updatedAt, stale (days since the last update), accounts: [{ label, kind, balance, limit, available,
    txCount, firstDate, months, openBill, bills, sample (latest 12), pending }], findings: [text] }
*/
export function ofSummary({ item = {}, accounts = [] } = {}, today = new Date().toISOString().slice(0, 10)) {
  const updatedAt = item.lastUpdatedAt || item.updatedAt || null;
  const stale = updatedAt ? Math.max(0, Math.round((Date.parse(today) - Date.parse(day(updatedAt))) / 864e5)) : null;
  const accs = accounts.map(({ account = {}, txs = [], bills = [] }) => {
    const mine = ofToTxs(account, txs), kind = ofKind(account), cd = account.creditData || {};
    return {
      label: ofLabel(account), kind, balance: num(account.balance),
      limit: kind === 'cartao' && cd.creditLimit != null ? num(cd.creditLimit) : null,
      available: kind === 'cartao' && cd.availableCreditLimit != null ? num(cd.availableCreditLimit) : null,
      txCount: mine.length, firstDate: mine.length ? mine[mine.length - 1].date : null, pending: mine.filter(t => t.pending).length,
      months: ofMonths(account, txs), openBill: ofOpenBill(account, txs),
      bills: (bills || []).map(b => ({ due: day(b.dueDate), total: num(b.totalAmount) })).filter(b => b.due).sort((a, b) => b.due.localeCompare(a.due)).slice(0, 6),
      sample: mine.slice(0, 12),
    };
  });
  const findings = [];
  const cards = accs.filter(a => a.kind === 'cartao'), banks = accs.filter(a => a.kind === 'conta');
  if (cards.some(a => a.openBill?.n)) { const c = cards.find(a => a.openBill?.n); findings.push(`Fatura aberta chega: ${c.openBill.n} ${c.openBill.n === 1 ? "compra" : "compras"} desde ${c.openBill.since.split('-').reverse().join('/')}, sem esperar o PDF.`); }
  else if (cards.length) findings.push('Cartão conectado, mas nenhuma compra da fatura aberta veio.');
  if (banks.some(a => a.txCount)) findings.push(`Extrato da conta chega: ${banks.reduce((s, a) => s + a.txCount, 0)} movimentações, com pix.`);
  if (accs.some(a => a.pending)) findings.push('Algumas compras vêm como pendentes: o app teria de esperar elas firmarem.');
  if (stale != null) findings.push(stale <= 1 ? 'Atualizado nas últimas 24 horas.' : `Última atualização há ${stale} dias.`);
  if (!accs.length) findings.push('Nenhuma conta veio nesta conexão.');
  return { bank: item.connector?.name || 'Banco', status: item.status || '', updatedAt, stale, accounts: accs, findings };
}
