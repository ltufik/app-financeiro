import { S, txsOf, latestClosed, monthKeys } from '../state.js';
import * as db from '../db.js';
import { brl, esc, mLong, norm } from '../lib/format.js';
import { $, toast, catPicker, confirmInline } from '../ui.js';

let src = 'cartao', pendOnly = false, q = '';

export function render(el) {
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="panel"><h2>Lançamentos do mês</h2>
      <div class="chips" style="margin-top:10px" id="srcChips"></div>
      <div class="rowbtn" style="margin-top:10px"><input type="search" id="lSearch" placeholder="Buscar" aria-label="Buscar lançamentos" style="flex:1 1 200px"><button class="chip" id="lPend" aria-pressed="false" type="button">Só a classificar</button></div>
      <p class="tiny muted" style="margin-top:8px">Trocar a categoria corrige o lançamento e ensina o app: da próxima vez o mesmo lançamento já vem certo.</p></div>
      <div class="tw"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody id="lRows"></tbody></table></div>
      <p class="small muted" id="lCount"></p>`;
    $('#lSearch').oninput = e => { q = norm(e.target.value); draw(); };
    $('#lPend').onclick = () => { pendOnly = !pendOnly; draw(); };
  }
  draw();
}

function draw() {
  const m = S.m.startsWith('ano:') ? (latestClosed() || monthKeys().pop()) : S.m;
  if (!m) { $('#lRows').innerHTML = ''; $('#lCount').textContent = 'Nenhum lançamento ainda.'; return; }
  $('#srcChips').innerHTML = [['cartao', 'Cartão'], ['conta', 'Conta']].map(([k, l]) => `<button class="chip" type="button" aria-pressed="${src === k}" data-k="${k}">${l}</button>`).join('');
  $('#srcChips').querySelectorAll('.chip').forEach(b => b.onclick = () => { src = b.dataset.k; draw(); });
  $('#lPend').setAttribute('aria-pressed', pendOnly);
  const rows = txsOf(m).filter(t => t.source === src && (!q || norm(t.description + ' ' + (t.category || '')).includes(q)) && (!pendOnly || t.pending || !t.category))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.day || '').localeCompare(b.day || ''));
  const tb = $('#lRows'); tb.innerHTML = '';
  for (const t of rows) {
    const tr = document.createElement('tr'); if (t.pending) tr.className = 'pend';
    tr.innerHTML = `<td>${esc(t.day || (t.date || '').split('-').reverse().slice(0, 2).join('/'))}</td><td style="min-width:180px">${esc(t.description)}${t.installment ? ' <span class="tiny muted">' + esc(t.installment) + '</span>' : ''}${t.manual ? ' <span class="pill at" style="font-size:11px;padding:1px 6px">manual</span>' : ''}${t.splits?.length ? `<span class="tiny muted splits">Nota${t.receipt?.store ? ' ' + esc(t.receipt.store) : ''}: ${t.splits.map(x => esc(x.category) + ' ' + brl(x.amount)).join(' · ')}</span>` : ''}</td><td></td><td class="r${src === 'conta' && t.amount > 0 ? ' neg' : ''}">${brl(t.amount)}</td>`;
    if (t.splits?.length) {
      tr.dataset.split = '1';
      tr.children[2].innerHTML = `<span class="tiny">Dividido pela nota</span><br><button class="chip" type="button" style="font-size:12px;margin-top:4px">Desfazer</button>`;
      tr.children[2].querySelector('button').onclick = async e => {
        if (!await confirmInline(e.target, { text: `Desfazer a divisão da nota em "${esc(t.description)}"? O lançamento volta para uma categoria só (${esc(t.category || 'A classificar')}).`, yes: 'Sim, desfazer', danger: true })) return;
        try { await db.updateTransaction(t.id, { splits: null, receipt: null }); t.splits = null; t.receipt = null; toast('Divisão desfeita'); S.render(); } catch (err) { toast('Não foi possível desfazer.'); }
      };
      tb.append(tr); continue;
    }
    tr.children[2].append(catPicker(S.categories, t.category, t.pending, async c => {
      try {
        await db.updateTransaction(t.id, { category: c, pending: false }); t.category = c; t.pending = false;
        if (!t.manual) { await db.learnRule(S.hh.id, t.source, norm(t.description), c).catch(() => {}); S.rules.push({ source: t.source, kind: 'exact', pattern: norm(t.description), category: c }); }
        toast('Categoria salva'); S.render();
      } catch (e) { toast('Não foi possível salvar.'); draw(); }
    }));
    tb.append(tr);
  }
  const tot = rows.reduce((a, t) => a + t.amount, 0);
  $('#lCount').textContent = rows.length ? `${rows.length} lançamentos em ${mLong(m)}, somando ${brl(tot)}.` : `Nada em ${mLong(m)} com esse filtro.`;
}
