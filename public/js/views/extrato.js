import { askRule } from '../learnask.js';
import { renderDups, deleteManual } from '../dupfix.js';
import { S, txsOf, latestClosed, monthKeys, settings } from '../state.js';
import * as db from '../db.js';
import { brl, esc, mLong, norm } from '../lib/format.js';
import { $, toast, catPicker, confirmInline, openNoteSheet } from '../ui.js';
import { withMemo } from '../lib/memo.js';
import { track } from '../usage.js';
import { shortTag } from '../lib/statements.js';

let src = 'cartao', pendOnly = false, q = '', cat = '';

export function render(el) {
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="panel stack dup" id="dupBox" hidden></div><div class="panel"><h2>Lançamentos do mês</h2>
      <div class="chips" style="margin-top:10px" id="srcChips"></div>
      <div class="rowbtn" style="margin-top:10px"><input type="search" id="lSearch" placeholder="Buscar" aria-label="Buscar lançamentos" style="flex:1 1 200px"><button class="chip" id="lPend" aria-pressed="false" type="button">Para conferir</button></div>
      <label class="f" style="margin-top:10px">Categoria<select id="lCat" aria-label="Filtrar por categoria"></select></label>
      <p class="tiny muted" style="margin-top:8px">Trocar a categoria corrige o lançamento e ensina o app: da próxima vez o mesmo lançamento já vem certo.</p>
      <p class="small pend-info" id="lPendInfo" hidden></p></div>
      <ul class="xlist" id="lRows"></ul>
      <p class="small muted" id="lCount"></p>`;
    $('#lSearch').oninput = e => { q = norm(e.target.value); draw(); };
    $('#lPend').onclick = () => { pendOnly = !pendOnly; draw(); };
    $('#lCat').onchange = e => { cat = e.target.value; if (cat) track('extrato.categoria'); draw(); };
  }
  renderDups($('#dupBox'), { onDone: () => S.render() });
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

// "Para conferir": the app guessed the category and is not sure (or there is none yet).
const isPend = t => !t.splits?.length && (t.pending || !t.category || t.category === 'A classificar');

function draw() {
  // From "N lançamentos para conferir" (Início): only those, in their month, on the side (card/account) that has them.
  if (String(S.sec || '').startsWith('pend:')) {
    const pm = S.sec.slice(5); S.sec = null; pendOnly = true; q = ''; cat = ''; const sb = $('#lSearch'); if (sb) sb.value = '';
    if (pm && pm !== S.m && monthKeys().includes(pm)) { S.m = pm; const ms = $('#monthSel'); if (ms) ms.value = pm; }
  }
  const m = S.m.startsWith('ano:') ? (latestClosed() || monthKeys().pop()) : S.m;
  if (pendOnly && m) { const n = k => txsOf(m).filter(t => t.source === k && isPend(t)).length; if (!n(src) && n(src === 'cartao' ? 'conta' : 'cartao')) src = src === 'cartao' ? 'conta' : 'cartao'; }
  if (!m) { $('#lRows').innerHTML = ''; $('#lCount').textContent = 'Nenhum lançamento ainda.'; return; }
  $('#srcChips').innerHTML = [['cartao', 'Cartão'], ['conta', 'Conta']].map(([k, l]) => `<button class="chip" type="button" aria-pressed="${src === k}" data-k="${k}">${l}</button>`).join('');
  $('#srcChips').querySelectorAll('.chip').forEach(b => b.onclick = () => { src = b.dataset.k; draw(); });
  $('#lPend').setAttribute('aria-pressed', pendOnly);
  // Category filter: the categories of this month and source, with how many entries each (receipt parts count).
  const catsOf = t => t.splits?.length ? t.splits.map(x => x.category) : [t.category || 'A classificar'];
  const base = txsOf(m).filter(t => t.source === src), counts = {};
  base.forEach(t => catsOf(t).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
  if (cat && !counts[cat]) cat = '';
  $('#lCat').innerHTML = `<option value="">Todas as categorias</option>` + Object.keys(counts).sort((a, b) => a.localeCompare(b, 'pt')).map(c => `<option value="${esc(c)}"${c === cat ? ' selected' : ''}>${esc(c)} (${counts[c]})</option>`).join('');
  const rows = base.filter(t => (!q || norm(t.description + ' ' + catsOf(t).join(' ') + ' ' + (t.note || '')).includes(q)) && (!pendOnly || isPend(t)) && (!cat || catsOf(t).includes(cat)))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.day || '').localeCompare(b.day || ''));
  const tb = $('#lRows'); tb.innerHTML = '';
  for (const t of rows) {
    // One card per transaction: what and when on the left, amount on the right, category below.
    const tr = document.createElement('li'); tr.className = 'xrow' + (t.pending ? ' pend' : '');
    tr.innerHTML = `<div class="xmain"><span class="xd">${esc(t.description)}${t.installment ? ' <span class="tiny muted">' + esc(t.installment) + '</span>' : ''}</span>
      <span class="tiny muted">${esc(t.day || (t.date || '').split('-').reverse().slice(0, 2).join('/'))}${t.card ? ' · ' + esc(shortTag(t.card)) : ''}${t.manual ? ' · <span class="pill at" style="font-size:11px;padding:1px 6px">manual</span>' : ''}</span>
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
        toast('Categoria salva'); S.render(); askRule(t, c, { onChange: () => S.render() });
      } catch (e) { toast('Não foi possível salvar.'); draw(); }
    }, { description: t.description, amount: t.amount }));
    if (isPend(t) && t.category && t.category !== 'A classificar') {
      const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'chip'; ok.textContent = `Está certo: ${t.category}`;
      ok.onclick = async () => {
        try { await db.updateTransaction(t.id, { pending: false }); t.pending = false; if (!t.manual) { await db.learnRule(S.hh.id, t.source, norm(t.description), t.category).catch(() => {}); S.rules.push({ source: t.source, kind: 'exact', pattern: norm(t.description), category: t.category }); } track('extrato.confirmou'); toast('Confirmado'); S.render(); }
        catch (e) { toast('Não foi possível salvar.'); }
      };
      tr.querySelector('.xcat').append(ok);
    }
    tr.querySelector('.xcat').append(noteButton(t));
    if (t.manual) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'chip'; del.textContent = 'Apagar';
      del.onclick = async () => { try { if (await deleteManual(t, del)) { toast('Lançamento apagado'); S.render(); } } catch (e) { toast('Não foi possível apagar agora. ' + db.errorText(e)); } };
      tr.querySelector('.xcat').append(del);
    }
    tb.append(tr);
  }
  // With a category chosen, the total is what went to that category (only the matching parts of a receipt).
  const amt = t => cat && t.splits?.length ? t.splits.filter(x => x.category === cat).reduce((a, x) => a + Math.sign(t.amount || 1) * Math.abs(+x.amount), 0) : t.amount;
  const tot = rows.reduce((a, t) => a + amt(t), 0);
  const pi = $('#lPendInfo'), np = { cartao: txsOf(m).filter(t => t.source === 'cartao' && isPend(t)).length, conta: txsOf(m).filter(t => t.source === 'conta' && isPend(t)).length };
  pi.hidden = !pendOnly;
  pi.innerHTML = !pendOnly ? '' : np.cartao + np.conta ? `<strong>Mostrando só ${np.cartao + np.conta === 1 ? 'o 1 lançamento' : `os ${np.cartao + np.conta} lançamentos`} para conferir</strong> de ${esc(mLong(m))}${np.cartao && np.conta ? ` (cartão: ${np.cartao}; conta: ${np.conta})` : ''}. Se a categoria estiver certa, toque em "Está certo"; se não, troque. Para ver todos, toque em "Para conferir" de novo.` : `<strong>Pronto! Nada para conferir em ${esc(mLong(m))}.</strong> Toque em "Para conferir" para ver todos os lançamentos.`;
  $('#lCount').textContent = rows.length ? `${rows.length} lançamentos${cat ? ` de ${cat}` : ''} em ${mLong(m)}, somando ${brl(tot)}.` : `Nada em ${mLong(m)} com esse filtro.`;
}
