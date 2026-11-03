import { S, txsOf, latestClosed, monthKeys, settings } from '../state.js';
import * as db from '../db.js';
import { brl, esc, mLong, norm } from '../lib/format.js';
import { $, toast, catPicker, confirmInline, openNoteSheet } from '../ui.js';
import { withMemo } from '../lib/memo.js';
import { track } from '../usage.js';

let src = 'cartao', pendOnly = false, q = '';

export function render(el) {
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="panel"><h2>Lançamentos do mês</h2>
      <div class="chips" style="margin-top:10px" id="srcChips"></div>
      <div class="rowbtn" style="margin-top:10px"><input type="search" id="lSearch" placeholder="Buscar" aria-label="Buscar lançamentos" style="flex:1 1 200px"><button class="chip" id="lPend" aria-pressed="false" type="button">Só a classificar</button></div>
      <p class="tiny muted" style="margin-top:8px">Trocar a categoria corrige o lançamento e ensina o app: da próxima vez o mesmo lançamento já vem certo.</p></div>
      <ul class="xlist" id="lRows"></ul>
      <p class="small muted" id="lCount"></p>`;
    $('#lSearch').oninput = e => { q = norm(e.target.value); draw(); };
    $('#lPend').onclick = () => { pendOnly = !pendOnly; draw(); };
  }
  draw();
}

// "Anotar": a personal note on the entry, remembered for the next ones with the same name.
function noteButton(t) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip notechip'; b.textContent = t.note ? 'Editar anotação' : 'Anotar';
  b.onclick = async () => {
    const r = await openNoteSheet({ description: t.description, amount: t.amount, note: t.note || '' }); if (!r) return;
    try {
      await db.updateTransaction(t.id, { note: r.note || null }); t.note = r.note || null;
      if (r.remember && !t.manual) { const memos = withMemo(settings().memos, t.source, t.description, r.note); await db.saveSettings(S.hh.id, { ...settings(), memos }); S.hh.settings = { ...settings(), memos }; }
      track('extrato.anotacao'); toast(r.note ? 'Anotação salva' : 'Anotação removida'); draw();
    } catch (e) { toast(/note/.test(String(e?.message)) ? 'O banco de dados precisa de uma atualização para guardar anotações. Avise quem cuida do app.' : 'Não foi possível salvar a anotação.'); }
  };
  return b;
}

function draw() {
  const m = S.m.startsWith('ano:') ? (latestClosed() || monthKeys().pop()) : S.m;
  if (!m) { $('#lRows').innerHTML = ''; $('#lCount').textContent = 'Nenhum lançamento ainda.'; return; }
  $('#srcChips').innerHTML = [['cartao', 'Cartão'], ['conta', 'Conta']].map(([k, l]) => `<button class="chip" type="button" aria-pressed="${src === k}" data-k="${k}">${l}</button>`).join('');
  $('#srcChips').querySelectorAll('.chip').forEach(b => b.onclick = () => { src = b.dataset.k; draw(); });
  $('#lPend').setAttribute('aria-pressed', pendOnly);
  const rows = txsOf(m).filter(t => t.source === src && (!q || norm(t.description + ' ' + (t.category || '') + ' ' + (t.note || '')).includes(q)) && (!pendOnly || t.pending || !t.category))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.day || '').localeCompare(b.day || ''));
  const tb = $('#lRows'); tb.innerHTML = '';
  for (const t of rows) {
    // One card per transaction: what and when on the left, amount on the right, category below.
    const tr = document.createElement('li'); tr.className = 'xrow' + (t.pending ? ' pend' : '');
    tr.innerHTML = `<div class="xmain"><span class="xd">${esc(t.description)}${t.installment ? ' <span class="tiny muted">' + esc(t.installment) + '</span>' : ''}</span>
      <span class="tiny muted">${esc(t.day || (t.date || '').split('-').reverse().slice(0, 2).join('/'))}${t.card ? ' · cartão ' + esc(t.card) : ''}${t.manual ? ' · <span class="pill at" style="font-size:11px;padding:1px 6px">manual</span>' : ''}</span>
      ${t.note ? `<span class="xnote">${esc(t.note)}</span>` : ''}
      ${t.splits?.length ? `<span class="tiny muted splits">Nota${t.receipt?.store ? ' ' + esc(t.receipt.store) : ''}: ${t.splits.map(x => esc(x.category) + ' ' + brl(x.amount)).join(' · ')}</span>` : ''}</div>
      <span class="xv${src === 'conta' && t.amount > 0 ? ' pos' : ''}">${brl(t.amount)}</span><div class="xcat"></div>`;
    if (t.splits?.length) {
      tr.dataset.split = '1';
      tr.querySelector('.xcat').innerHTML = `<span class="tiny">Dividido pela nota</span> <button class="chip" type="button" style="font-size:12px">Desfazer</button>`;
      tr.querySelector('.xcat button').onclick = async e => {
        if (!await confirmInline(e.target, { text: `Desfazer a divisão da nota em "${esc(t.description)}"? O lançamento volta para uma categoria só (${esc(t.category || 'A classificar')}).`, yes: 'Sim, desfazer', danger: true })) return;
        try { await db.updateTransaction(t.id, { splits: null, receipt: null }); t.splits = null; t.receipt = null; toast('Divisão desfeita'); S.render(); } catch (err) { toast('Não foi possível desfazer.'); }
      };
      tb.append(tr); continue;
    }
    tr.querySelector('.xcat').append(catPicker(S.categories, t.category, t.pending, async c => {
      try {
        await db.updateTransaction(t.id, { category: c, pending: false }); t.category = c; t.pending = false;
        if (!t.manual) { await db.learnRule(S.hh.id, t.source, norm(t.description), c).catch(() => {}); S.rules.push({ source: t.source, kind: 'exact', pattern: norm(t.description), category: c }); }
        toast('Categoria salva'); S.render();
      } catch (e) { toast('Não foi possível salvar.'); draw(); }
    }, { description: t.description, amount: t.amount }));
    tr.querySelector('.xcat').append(noteButton(t));
    tb.append(tr);
  }
  const tot = rows.reduce((a, t) => a + t.amount, 0);
  $('#lCount').textContent = rows.length ? `${rows.length} lançamentos em ${mLong(m)}, somando ${brl(tot)}.` : `Nada em ${mLong(m)} com esse filtro.`;
}
