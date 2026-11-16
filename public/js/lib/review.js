// Caixa "a revisar": everything that waits for the family in one queue (categories the app was not sure of,
// possible repeats, cash withdrawals without a destination, payments that may lower a financing, money that came in
// to pay a payoff). The Início line, the review screen and the Sunday push all count from here. Pure; tested in
// tests/lib.test.mjs.
import { findDups } from './dups.js';
import { pendingCash } from './cash.js';
import { fundingPairs } from './funding.js';
import { pendingAmortizations } from './debt.js';

export const AMORT_CAT = 'Amortização de financiamento';
const addM = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export const isPendingCat = t => !!t && !t.virtual && (t.pending || !t.category || t.category === 'A classificar');

// Order of the queue: what changes the numbers the most first.
export const KINDS = ['entrada', 'amortizacao', 'repetido', 'saque', 'categoria'];
const WORD = { categoria: ['categoria', 'categorias'], repetido: ['repetido', 'repetidos'], saque: ['saque', 'saques'], amortizacao: ['pagamento de financiamento', 'pagamentos de financiamento'], entrada: ['entrada para conferir', 'entradas para conferir'] };

/*
  reviewQueue({ txs, idx, settings, today }) -> { items: [{ kind, key, ... }], counts: { kind: n }, total }
  Categories: the last 3 months (older ones are history; Fechar o mês still shows them month by month).
*/
export function reviewQueue({ txs = [], idx = new Map(), settings = {}, today }) {
  const st = settings || {}, debts = st.debts || [], from = addM(today.slice(0, 7), -2), items = [];
  for (const x of fundingPairs(txs, idx, { amortCat: AMORT_CAT, skip: st.fundSkip || [] })) items.push({ kind: 'entrada', key: 'e' + x.income.id, ...x });
  if (debts.length) for (const x of pendingAmortizations(txs, debts, st.debtSkip || [])) items.push({ kind: 'amortizacao', key: 'a' + x.tx.id, ...x });
  const d = findDups(txs, debts, st.dupSkip || []);
  for (const x of d.pairs) items.push({ kind: 'repetido', key: `r${x.manual.id}|${x.bank.id}`, ...x });
  for (const x of d.orphans) items.push({ kind: 'repetido', key: `o${x.bank.id}`, orphan: true, ...x });
  for (const t of pendingCash(txs, { today, skip: st.cashSkip || [] })) items.push({ kind: 'saque', key: 's' + t.id, tx: t });
  txs.filter(t => isPendingCat(t) && t.month >= from).sort((a, b) => ((b.date || b.month) > (a.date || a.month) ? 1 : -1))
    .forEach(t => items.push({ kind: 'categoria', key: 'c' + t.id, tx: t, suggestion: t.category && t.category !== 'A classificar' ? t.category : '' }));
  const counts = Object.fromEntries(KINDS.map(k => [k, items.filter(i => i.kind === k).length]));
  return { items, counts, total: items.length };
}

// "5 categorias, 2 repetidos e 1 saque"
export function reviewSummary(counts = {}) {
  const parts = ['categoria', 'repetido', 'saque', 'amortizacao', 'entrada'].filter(k => counts[k] > 0).map(k => `${counts[k]} ${WORD[k][counts[k] > 1 ? 1 : 0]}`);
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : parts[0] || '';
}

// The Início line under "N para revisar": "Luiz, falta conferir 5 categorias e 1 saque de vocês · uns 2 minutos".
export const reviewLine = (counts, total, name = '') => { const n = String(name || '').trim().split(/\s+/)[0], m = reviewMinutes(total); return `${n ? n + ', f' : 'F'}alta conferir ${reviewSummary(counts)} de vocês · ${m <= 1 ? 'um minuto' : `uns ${m} minutos`}`; };

// About 20 seconds per item, at least 1 minute.
export const reviewMinutes = n => Math.max(1, Math.round(n / 3));

// Sunday review hour (the person picks it in Notificações; 9h by default). Only 8h to 21h: pushes never go out at night.
export const SUNDAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
export const sundayHour = prefs => { const h = +(prefs || {}).domingoHora; return SUNDAY_HOURS.includes(h) ? h : 9; };

/*
  sundayReview({ total, counts, name, checkedIn, sent, today }) -> { msg } | null
  The Sunday push: the queue and the open card bill. Once a week per device. Nothing waiting and the bill already
  checked: no push.
*/
export function sundayReview({ total = 0, counts = {}, name = '', checkedIn = false, sent = {}, today }) {
  if (sent.domingo && Math.round((Date.parse(today) - Date.parse(sent.domingo)) / 864e5) < 6) return null;
  const n = String(name || '').trim().split(/\s+/)[0], hi = n ? n + ', ' : '';
  if (total > 0) return { msg: { title: `${hi}${reviewMinutes(total) <= 5 ? '5 minutos' : reviewMinutes(total) + ' minutos'} para fechar a semana`, body: `${total} ${total > 1 ? 'lançamentos' : 'lançamento'} para revisar (${reviewSummary(counts)})${checkedIn ? ' de vocês' : ' e a fatura aberta de vocês para conferir'}. Revisar tudo conta para a sequência de semanas.`.slice(0, 220), tag: 'domingo' } };
  if (!checkedIn) return { msg: { title: `${hi}a semana já está revisada`, body: `Só falta a fatura aberta de vocês: com ela, a previsão do mês fica exata.`.slice(0, 220), tag: 'domingo' } };
  return null;
}
