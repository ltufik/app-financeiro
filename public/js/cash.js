// "No que foi o dinheiro do saque?" (Lançar, and Início sends here): one withdrawal at a time; the person says or
// writes "200 feira, 100 uber" and the withdrawal is split by category (what is not said stays as the withdrawal).
import { S, settings } from './state.js';
import * as db from './db.js';
import { toast, confirmInline } from './ui.js';
import { track } from './usage.js';
import { attachMic } from './speech.js';
import { todayISO, esc, brl0 } from './lib/format.js';
import { pendingCash, parseCashText, cashSplits } from './lib/cash.js';

const brD = d => String(d || '').split('-').reverse().slice(0, 2).join('/');
const brl2 = v => 'R$ ' + (+v).toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const cashPending = () => pendingCash(S.txs, { today: todayISO(), skip: settings().cashSkip || [] });

export function renderCash(box, { onDone } = {}) {
  if (!box) return;
  const list = cashPending(); box.hidden = !list.length; if (!list.length) { box.innerHTML = ''; return; }
  const t = list[0], total = Math.abs(+t.amount), rest0 = t.category || 'A classificar';
  let parts = [];
  box.innerHTML = `<p class="eyebrow">Saques e dinheiro vivo</p><h3>No que foi o dinheiro do saque?</h3>
    <p class="small"><strong>${brl0(total)}</strong> sacados em ${brD(t.date)}${list.length > 1 ? ` (depois deste, mais ${list.length - 1})` : ''}. Dinheiro vivo some do controle: conte em poucas palavras e a sobra do mês fica certa.</p>
    <div class="rowbtn cash-in"><label class="f" style="flex:1">No que foi gasto<input type="text" id="cashTxt" placeholder="Ex.: 200 feira, 100 uber, 50 presente" autocomplete="off"></label><button id="cashMic" type="button"></button></div>
    <div id="cashPrev" class="small"></div>
    <div class="rowbtn"><button class="btn primary" type="button" id="cashSave" disabled>Salvar</button><button class="btn" type="button" id="cashSkip">Não lembro</button></div>`;
  const inp = box.querySelector('#cashTxt'), prev = box.querySelector('#cashPrev'), save = box.querySelector('#cashSave');
  const cats = () => S.categories.filter(c => c.name !== 'A classificar').sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const draw = () => {
    const said = parts.reduce((a, p) => a + p.amount, 0), over = said - total > 0.009, rest = Math.max(0, total - said);
    prev.innerHTML = !parts.length ? '' : `<ul class="cash-list">${parts.map((p, i) => `<li><span>${brl2(p.amount)} · ${esc(p.label)}</span><select data-i="${i}" aria-label="Categoria de ${esc(p.label)}"><option value="A classificar">A classificar</option>${cats().map(c => `<option${c.name === p.category ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></li>`).join('')}</ul>
      ${over ? `<p class="status err">Isso soma ${brl2(said)}, mais que o saque de ${brl0(total)}. Confira os valores.</p>` : rest > 0.009 ? `<p class="tiny muted">O resto, ${brl2(rest)}, continua como ${esc(rest0)}.</p>` : ''}`;
    prev.querySelectorAll('select[data-i]').forEach(s => s.onchange = () => { parts[+s.dataset.i].category = s.value; });
    save.disabled = !parts.length || over;
  };
  inp.addEventListener('input', () => { parts = parseCashText(inp.value, S.categories); draw(); });
  attachMic(box.querySelector('#cashMic'), inp);
  save.onclick = async () => {
    const splits = cashSplits(t.amount, parts, rest0); if (!splits) return;
    if (!await confirmInline(save, { title: 'Salvar no que foi o saque?', text: splits.map(s => `${brl2(s.amount)} em ${s.category}`).join(', ') + '. O saque passa a contar assim na sobra do mês.', yes: 'Sim, salvar' })) return;
    save.disabled = true;
    try { await db.updateTransaction(t.id, { splits }); t.splits = splits; track('lancar.saque_detalhado'); toast(list.length > 1 ? 'Pronto! Agora o próximo saque.' : 'Pronto! Saque detalhado.'); onDone ? onDone() : renderCash(box, { onDone }); }
    catch (e) { save.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  };
  box.querySelector('#cashSkip').onclick = async e => {
    if (!await confirmInline(e.target, { text: `O saque de ${brl0(total)} fica como ${rest0}, sem detalhe. O app não pergunta mais sobre ele.`, yes: 'Não lembro' })) return;
    try { const cur = settings(), next = { ...cur, cashSkip: [...new Set([...(cur.cashSkip || []), t.id])].slice(-300) }; await db.saveSettings(S.hh.id, next); S.hh.settings = next; track('lancar.saque_nao_lembro'); toast('Combinado.'); onDone ? onDone() : renderCash(box, { onDone }); }
    catch (err) { toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  };
}
