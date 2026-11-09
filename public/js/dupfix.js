// "Repetidos": a typed entry (or a receipt) that the statement brought again. Shown on Extrato (and pointed to from
// Início); one tap keeps one entry, with the person's category and words, and the financing payoff still counted
// once. The pairs come from lib/dups.js.
import { S, settings } from './state.js';
import * as db from './db.js';
import { toast, confirmInline } from './ui.js';
import { track } from './usage.js';
import { esc, brl } from './lib/format.js';
import { findDups, mergeInto } from './lib/dups.js';
import { amortCategory } from './debtpay.js';

const brD = d => String(d || '').split('-').reverse().slice(0, 2).join('/');
export const familyDups = () => findDups(S.txs, settings().debts || [], settings().dupSkip || []);

// The bank's entry keeps the category and note; links to a financing move to it; the typed one is deleted.
export async function joinPair(manual, bank) {
  const set = mergeInto(manual, bank), st = settings();
  const moved = (st.debts || []).some(d => (d.log || []).some(e => e.txId === manual.id));
  if (moved) set.category = await amortCategory();
  if (Object.keys(set).length) { await db.updateTransaction(bank.id, set); Object.assign(bank, set); }
  if (moved || (st.debtSkip || []).includes(bank.id)) {
    const next = { ...st, debts: (st.debts || []).map(d => ({ ...d, log: (d.log || []).map(e => e.txId === manual.id ? { ...e, txId: bank.id } : e) })), debtSkip: moved ? (st.debtSkip || []).filter(x => x !== bank.id) : st.debtSkip };
    await db.saveSettings(S.hh.id, next); S.hh.settings = next;
  }
  await db.deleteTransaction(manual.id); S.txs = S.txs.filter(t => t.id !== manual.id);
}

// A payoff whose typed entry already left: the statement's entry is that payoff (counted once, not as spending).
export async function joinOrphan(debt, entry, bank) {
  const cat = await amortCategory(), st = settings();
  await db.updateTransaction(bank.id, { category: cat, pending: false }); bank.category = cat; bank.pending = false;
  const next = { ...st, debts: (st.debts || []).map(d => d.id !== debt.id ? d : { ...d, log: (d.log || []).map(e => e === entry || (e.at === entry.at && e.txId === entry.txId) ? { ...e, txId: bank.id } : e) }), debtSkip: (st.debtSkip || []).filter(x => x !== bank.id) };
  await db.saveSettings(S.hh.id, next); S.hh.settings = next;
}

export function renderDups(box, { onDone } = {}) {
  if (!box) return;
  const { pairs, orphans } = familyDups(), n = pairs.length + orphans.length;
  box.hidden = !n; if (!n) { box.innerHTML = ''; return; }
  box.innerHTML = `<p class="eyebrow">Repetidos</p><h3>${n === 1 ? 'Um lançamento apareceu duas vezes' : `${n} lançamentos apareceram duas vezes`}</h3>
    <p class="small">${pairs.length ? 'Você lançou à mão e o extrato ou a fatura trouxe de novo. ' : ''}Juntando, fica um só, com a categoria e o que você escreveu.</p>
    <ul class="dup-list">${pairs.map((p, i) => `<li><span class="small"><strong>${brl(p.manual.amount)}</strong> · ${esc(p.manual.description)} <span class="tiny muted">(à mão, ${brD(p.manual.date)})</span><br><span class="tiny muted">= ${esc(p.bank.description)} (${p.bank.source === 'cartao' ? 'fatura' : 'extrato'}, ${brD(p.bank.date) || esc(p.bank.day || '')})</span></span>
      <span class="rowbtn"><button class="btn primary" type="button" data-p="${i}">Juntar</button><button class="chip" type="button" data-np="${i}">Não é repetido</button></span></li>`).join('')}
    ${orphans.map((o, i) => `<li><span class="small"><strong>${brl(o.bank.amount)}</strong> · ${esc(o.bank.description)} <span class="tiny muted">(extrato, ${brD(o.bank.date)})</span><br><span class="tiny muted">É a amortização de ${esc(o.debt.name || 'financiamento')} que você já informou: o saldo já foi abatido. Juntando, não conta como gasto do mês e não abate de novo.</span></span>
      <span class="rowbtn"><button class="btn primary" type="button" data-o="${i}">Juntar</button></span></li>`).join('')}</ul>
    ${n > 1 ? `<button class="btn" type="button" id="dupAll">Juntar todos (${n})</button>` : ''}`;
  const done = msg => { toast(msg); onDone ? onDone() : renderDups(box, { onDone }); };
  const fail = e => toast('Não foi possível juntar agora. ' + db.errorText(e));
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    const p = pairs[+b.dataset.p]; b.disabled = true;
    try { await joinPair(p.manual, p.bank); track('extrato.repetido_juntou'); done('Pronto! Ficou um só.'); } catch (e) { b.disabled = false; fail(e); }
  });
  box.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => {
    const o = orphans[+b.dataset.o]; b.disabled = true;
    try { await joinOrphan(o.debt, o.entry, o.bank); track('extrato.repetido_juntou'); done('Pronto! A amortização conta uma vez só e não entra como gasto do mês.'); } catch (e) { b.disabled = false; fail(e); }
  });
  box.querySelectorAll('[data-np]').forEach(b => b.onclick = async () => {
    const p = pairs[+b.dataset.np];
    if (!await confirmInline(b, { text: `Os dois lançamentos de ${brl(p.manual.amount)} ficam, e o app não pergunta mais sobre eles.`, yes: 'Não é repetido' })) return;
    try { const cur = settings(), next = { ...cur, dupSkip: [...new Set([...(cur.dupSkip || []), `${p.manual.id}|${p.bank.id}`])].slice(-200) }; await db.saveSettings(S.hh.id, next); S.hh.settings = next; track('extrato.repetido_nao_e'); done('Combinado.'); } catch (e) { fail(e); }
  });
  const all = box.querySelector('#dupAll'); if (all) all.onclick = async () => {
    if (!await confirmInline(all, { text: `Juntar os ${n}? Fica um de cada, com a categoria e o que você escreveu.`, yes: 'Sim, juntar' })) return;
    all.disabled = true;
    try { for (const p of pairs) await joinPair(p.manual, p.bank); for (const o of orphans) await joinOrphan(o.debt, o.entry, o.bank); track('extrato.repetido_juntou'); done(`Pronto! ${n} repetidos juntados.`); } catch (e) { all.disabled = false; fail(e); }
  };
}

// Extrato: delete an entry typed by hand (also after the statement came).
export async function deleteManual(t, btn) {
  const linked = (settings().debts || []).some(d => (d.log || []).some(e => e.txId === t.id));
  if (!await confirmInline(btn, { title: 'Apagar este lançamento?', text: `${esc(t.description)}, ${brl(t.amount)}, lançado à mão.${linked ? ' Ele abateu um financiamento: o saldo não muda (para desfazer o abatimento, use Patrimônio).' : ''} Só apague o que não aconteceu ou já veio no extrato.`, yes: 'Sim, apagar', danger: true })) return false;
  await db.deleteTransaction(t.id); S.txs = S.txs.filter(x => x.id !== t.id); track('extrato.apagou_manual');
  return true;
}
