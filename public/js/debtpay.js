// "Isso abate um financiamento?": links a payment (a receipt, or a big transfer already saved) to a financing.
// Confirming takes the value off the balance (log of the financing), moves the payment to the category
// "Amortização de financiamento" (does not count in the month's leftover: the money became property) and
// the equity goes up. Used by Lançar (receipt review), Início and Patrimônio e dívidas.
import { S, settings, reindex, debtsNow, pendingDebtPayments } from './state.js';
import * as db from './db.js';
import { toast, confirmInline } from './ui.js';
import { track } from './usage.js';
import { todayISO, esc } from './lib/format.js';
import { debtNow } from './lib/debt.js';

const brl0 = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const brD = d => String(d || '').split('-').reverse().join('/');
export const AMORT_CAT = 'Amortização de financiamento';

async function amortCategory() {
  let c = S.categories.find(x => x.name === AMORT_CAT);
  if (!c) { c = await db.addCategory(S.hh.id, { name: AMORT_CAT, grp: 'neutro', recurring: false }); S.categories.push(c); reindex(); }
  return c.name;
}

// The financing's log gets the payment; the transaction (when saved) moves to the amortization category.
export async function applyAmortization(debtId, { value, date, txId = null, note = '' }) {
  const st = settings(), debts = (st.debts || []).map(d => d.id !== debtId ? d : { ...d, log: [...(d.log || []), { date, at: new Date().toISOString(), kind: 'amortizacao', value: Math.abs(+value), txId, note: String(note || '').slice(0, 140) }] });
  const d = debts.find(x => x.id === debtId); if (!d) throw new Error('financiamento não encontrado');
  const next = { ...st, debts };
  await db.saveSettings(S.hh.id, next); S.hh.settings = next;
  if (txId) {
    const cat = await amortCategory(), t = S.txs.find(x => x.id === txId);
    await db.updateTransaction(txId, { category: cat }); if (t) t.category = cat;
  }
  track('patrimonio.amortizou');
  return debtNow(d, todayISO()).saldo;
}

export async function dismissPayment(txId) {
  const st = settings(), next = { ...st, debtSkip: [...new Set([...(st.debtSkip || []), txId])].slice(-200) };
  await db.saveSettings(S.hh.id, next); S.hh.settings = next; track('patrimonio.nao_abate');
}

// Cards "Este pagamento abate o Financiamento de X?" for the payments already saved.
export function renderPendingPayments(box, { onDone } = {}) {
  const list = pendingDebtPayments();
  box.hidden = !list.length; if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<h3>Pagamentos que parecem amortização</h3>
    ${list.map(({ tx, debt }, i) => `<div class="dpay" data-i="${i}"><p class="small"><strong>${brl0(Math.abs(tx.amount))}</strong> em ${brD(tx.date)}: ${esc(tx.description)}${tx.note ? `<br><span class="tiny muted">${esc(tx.note)}</span>` : ''}</p>
      <p class="small">Isso abate o <strong>${esc(debt.name)}</strong>?</p>
      <div class="rowbtn"><button class="btn primary" type="button" data-yes="${i}">Sim, abater</button><button class="btn" type="button" data-no="${i}">Não é</button></div></div>`).join('')}`;
  box.querySelectorAll('[data-yes]').forEach(b => b.onclick = async () => {
    const { tx, debt } = list[+b.dataset.yes], before = debtsNow().find(d => d.id === debt.id)?.now.saldo || 0;
    if (!await confirmInline(b, { title: 'Abater do financiamento?', text: `${brl0(Math.abs(tx.amount))} saem do saldo do ${esc(debt.name)} (de ${brl0(before)} para ${brl0(Math.max(0, before - Math.abs(tx.amount)))}) e o patrimônio líquido sobe o mesmo valor. O lançamento passa para "${AMORT_CAT}", fora da sobra do mês.`, yes: 'Sim, abater' })) return;
    b.disabled = true;
    try { const s = await applyAmortization(debt.id, { value: tx.amount, date: tx.date, txId: tx.id, note: tx.note || tx.description }); toast(`O saldo do ${debt.name} agora é ${brl0(s)}.`); onDone?.(); }
    catch (e) { b.disabled = false; toast('Não foi possível abater agora. ' + db.errorText(e)); }
  });
  box.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => {
    const { tx } = list[+b.dataset.no];
    if (!await confirmInline(b, { text: 'Esse pagamento não abate nenhum financiamento? O app não pergunta de novo.', yes: 'Não abate' })) return;
    try { await dismissPayment(tx.id); toast('Combinado, não pergunto mais.'); onDone?.(); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
}
