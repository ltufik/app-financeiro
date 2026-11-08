// "Regras que aprendem" on screen: after a category change (Extrato, Fechar o mês), asks whether everything with
// the same name goes to that category, with the preview of what changes; and the list of taught rules (Categorias),
// each one with "Desfazer". The decisions live in lib/learn.js.
import { S, settings, reindex } from './state.js';
import * as db from './db.js';
import { toast, confirmInline, invalid, clearInvalid } from './ui.js';
import { track } from './usage.js';
import { esc, brl, norm } from './lib/format.js';
import { suggestRule, rulePattern, ruleLabel, ruleMatches, undoMoves, LEARN_PRIORITY } from './lib/learn.js';

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const mShort = k => (k ? `${k.slice(5, 7)}/${k.slice(2, 4)}` : '');

// Resolves when the person answers (or right away, when there is nothing to ask). onChange: re-render.
export function askRule(tx, category, { onChange } = {}) {
  const s = suggestRule(tx, category, S.txs, S.rules); if (!s) return Promise.resolve(null);
  track('regras.sugeriu');
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove());
  return new Promise(resolve => {
    let cur = s;
    const wrap = document.createElement('div'); wrap.className = 'cfm-wrap';
    wrap.innerHTML = `<div class="cfm lrn" role="dialog" aria-modal="true" aria-labelledby="lrnT">
      <p class="eyebrow">Ensinar o app</p><h3 id="lrnT"></h3><p class="small" id="lrnX"></p><ul class="lrn-list small" id="lrnL"></ul>
      <details class="lrn-adj"><summary class="small">Ajustar o nome</summary>
        <label class="f">Tudo que tiver<input type="text" id="lrnIn" maxlength="40" value="${esc(s.label)}" autocomplete="off"></label>
        <p class="tiny muted">Use uma parte do nome que aparece no lançamento, como IFOOD ou POSTO SHELL.</p></details>
      <div class="rowbtn"><button class="btn primary" type="button" data-y></button><button class="btn" type="button" data-n>Só este</button></div></div>`;
    document.body.append(wrap); document.body.classList.add('cfm-open');
    const $ = q => wrap.querySelector(q), yes = $('[data-y]'), inp = $('#lrnIn');
    const draw = () => {
      $('#lrnT').textContent = `Quer que tudo com "${cur.label}" vá para ${category}?`;
      const others = [...new Set(cur.change.map(t => t.category || 'A classificar'))];
      $('#lrnX').innerHTML = cur.change.length
        ? `Isso muda <strong>${plural(cur.change.length, 'lançamento', 'lançamentos')}</strong> (hoje em ${others.slice(0, 3).map(esc).join(', ')}${others.length > 3 ? '…' : ''}) e vale para os próximos que chegarem.`
        : `Nenhum outro lançamento muda agora; vale para os próximos que chegarem.`;
      $('#lrnL').innerHTML = cur.change.slice(0, 4).map(t => `<li><span>${esc(t.description)}</span><span class="tiny muted">${mShort(t.month)} · ${brl(t.amount)} · ${esc(t.category || 'A classificar')} → ${esc(category)}</span></li>`).join('') + (cur.change.length > 4 ? `<li class="tiny muted">e mais ${cur.change.length - 4}</li>` : '');
      yes.textContent = cur.change.length ? `Sim, todos (${cur.change.length})` : 'Sim, para os próximos';
    };
    draw();
    inp.addEventListener('input', () => {
      clearInvalid(wrap);
      const label = ruleLabel(inp.value), pattern = rulePattern(label);
      if (!pattern || label.length < 3) { yes.disabled = true; return invalid(inp, 'Escreva pelo menos 3 letras do nome.'); }
      if (!new RegExp(pattern).test(norm(tx.description))) { yes.disabled = true; return invalid(inp, `"${label}" não aparece em "${tx.description}". Use uma parte do nome deste lançamento.`); }
      const all = ruleMatches(pattern, S.txs, tx.source).filter(t => t.id !== tx.id);
      cur = { ...cur, label, pattern, change: all.filter(t => t.category !== category) }; yes.disabled = false; draw();
    });
    const done = v => { wrap.remove(); document.body.classList.remove('cfm-open'); resolve(v); };
    $('[data-n]').onclick = () => { track('regras.so_este'); done('one'); };
    wrap.onclick = e => { if (e.target === wrap) done(null); };
    wrap.onkeydown = e => { if (e.key === 'Escape') done(null); };
    yes.onclick = async () => {
      yes.disabled = true; yes.textContent = 'Aplicando…';
      try { const n = await applyRule(tx, cur, category); done('all'); toast(n ? `Pronto! ${plural(n, 'lançamento foi', 'lançamentos foram')} para ${category}. Dá para desfazer em Categorias.` : `Pronto! Os próximos com "${cur.label}" vão para ${category}.`); onChange && onChange(); }
      catch (e) { yes.disabled = false; draw(); toast('Não foi possível aplicar agora. ' + db.errorText(e)); }
    };
    setTimeout(() => yes.focus(), 30);
  });
}

async function applyRule(tx, s, category) {
  const moved = s.change.map(t => [t.id, t.category || 'A classificar']);
  await db.addRule(S.hh.id, { source: tx.source, kind: 'regex', pattern: s.pattern, category, priority: LEARN_PRIORITY });
  if (moved.length) await db.setCategoryMany(moved.map(m => m[0]), category);
  const ids = new Set(moved.map(m => m[0])); S.txs.forEach(t => { if (ids.has(t.id)) { t.category = category; t.pending = false; } });
  S.rules = S.rules.filter(r => !(r.kind === 'regex' && r.source === tx.source && r.pattern === s.pattern)); S.rules.push({ source: tx.source, kind: 'regex', pattern: s.pattern, category, priority: LEARN_PRIORITY }); reindex();
  const cur = settings(), log = { at: new Date().toISOString(), source: tx.source, label: s.label, pattern: s.pattern, category, moved: moved.slice(0, 500), by: S.user?.id || null };
  const next = { ...cur, ruleLog: [...(cur.ruleLog || []).filter(l => !(l.source === log.source && l.pattern === log.pattern)), log].slice(-40) };
  try { await db.saveSettings(S.hh.id, next); S.hh.settings = next; } catch (e) { /* the rule is in; only the undo list missed */ }
  track('regras.aplicou');
  return moved.length;
}

// Categorias: the rules the family taught, with how many entries each one covers and "Desfazer".
export function renderTaught(box, { onChange } = {}) {
  if (!box) return;
  const logs = settings().ruleLog || [], mine = S.rules.filter(r => r.kind === 'regex' && +r.priority === LEARN_PRIORITY);
  if (!mine.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  const rows = mine.map(r => ({ r, log: logs.find(l => l.source === r.source && l.pattern === r.pattern) || null, n: ruleMatches(r.pattern, S.txs, r.source).length }));
  box.innerHTML = `<h3 style="margin-top:10px">Regras que vocês ensinaram <span class="tiny muted">${rows.length}</span></h3>
    <p class="tiny muted">Quando você muda uma categoria, o app pergunta se tudo com o mesmo nome vai junto. Estas valem para os próximos lançamentos, antes das regras do próprio app.</p>
    <ul class="lrn-rules">${rows.map((x, i) => `<li><span class="small"><strong>${esc(x.log?.label || x.r.pattern.replace(/\(\^\|\[\^A-Z0-9\]\)|\(\$\|\[\^A-Z0-9\]\)/g, '').replace(/\[\^A-Z0-9\]\+/g, ' '))}</strong> → ${esc(x.r.category)} <span class="tiny muted">· ${x.r.source === 'cartao' ? 'cartão' : 'conta'} · ${plural(x.n, 'lançamento', 'lançamentos')}</span></span><button class="chip" type="button" data-undo="${i}">Desfazer</button></li>`).join('')}</ul>`;
  box.querySelectorAll('[data-undo]').forEach(b => b.onclick = async () => {
    const { r, log } = rows[+b.dataset.undo], back = undoMoves(log, S.txs);
    if (!await confirmInline(b, { title: 'Desfazer esta regra?', text: `Os próximos com "${esc(log?.label || '')}" deixam de ir sozinhos para ${esc(r.category)}.${back.length ? ` ${plural(back.length, 'lançamento volta', 'lançamentos voltam')} para a categoria que tinha antes.` : ''}`, yes: 'Sim, desfazer', danger: true })) return;
    try {
      const by = {}; for (const [id, prev] of back) (by[prev] ||= []).push(id);
      for (const [prev, ids] of Object.entries(by)) await db.setCategoryMany(ids, prev);
      const backIds = new Map(back); S.txs.forEach(t => { if (backIds.has(t.id)) t.category = backIds.get(t.id); });
      await db.deleteRule(S.hh.id, r.source, r.pattern);
      S.rules = S.rules.filter(x => !(x.kind === 'regex' && x.source === r.source && x.pattern === r.pattern)); reindex();
      const cur = settings(), next = { ...cur, ruleLog: (cur.ruleLog || []).filter(l => !(l.source === r.source && l.pattern === r.pattern)) };
      await db.saveSettings(S.hh.id, next).then(() => { S.hh.settings = next; }, () => {});
      track('regras.desfez'); toast(back.length ? `Regra desfeita. ${plural(back.length, 'lançamento voltou', 'lançamentos voltaram')}.` : 'Regra desfeita.'); onChange ? onChange() : renderTaught(box);
    } catch (e) { toast('Não foi possível desfazer agora. ' + db.errorText(e)); }
  });
}
