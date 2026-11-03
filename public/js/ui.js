// Small DOM helpers shared by the views.
import { esc, pct } from './lib/format.js';
import { KINDS, kindOf } from './lib/calc.js';
import { rankCategories, suggestCategories, groupCategories, plain } from './lib/catsearch.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Result pop-up: success or error, closes by itself in 5 s (countdown shown) or on the X.
// kind: 'ok' | 'err' | 'info'; when omitted it is guessed from the text.
const ERR = /^(não (foi possível|consegui|deu)|erro|falhou|sem conexão)|não foi possível|parou no meio/i;
export function toast(t, kind) {
  const el = $('#toast'); if (!el) return;
  kind = kind || (ERR.test(t) ? 'err' : 'ok');
  if (kind === 'err') window.__onToastErr?.(t);
  clearInterval(toast.h);
  let left = 5;
  const icon = kind === 'err' ? '<path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/>' : kind === 'info' ? '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' : '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>';
  el.className = 'toast ' + kind; el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `<span class="ti" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>
    <span class="tt"><strong>${kind === 'err' ? 'Algo deu errado' : kind === 'info' ? 'Aviso' : 'Pronto!'}</strong><span>${esc(t)}</span><span class="tc">Fecha em <b>5</b>s</span></span>
    <button type="button" class="tx" aria-label="Fechar">×</button>`;
  el.hidden = false;
  const close = () => { clearInterval(toast.h); el.hidden = true; };
  el.querySelector('.tx').onclick = close;
  toast.h = setInterval(() => { left--; const b = el.querySelector('.tc b'); if (b) b.textContent = left; if (left <= 0) close(); }, 1000);
}

export function banner(t) { const b = $('#sysBanner'); b.hidden = !t; b.textContent = t || ''; }

export function meter(v, goal, max) {
  max = Math.max(max || 0, v * 1.05, goal * 1.15, 1);
  const c = !goal ? 'var(--accent)' : v <= goal ? 'var(--good)' : v <= goal * 1.1 ? 'var(--warn)' : 'var(--bad)';
  return `<div class="meter"><span style="width:${Math.min(100, v / max * 100)}%;background:${c}"></span>${goal ? `<span class="goal" style="left:${goal / max * 100}%"></span>` : ''}</div>`;
}

export function pill(label, v, goal) {
  if (!goal) return `<span class="pill ok">${esc(label)} ${pct(v)}</span>`;
  const c = v >= goal ? 'ok' : v >= goal - 0.05 ? 'at' : 'no';
  return `<span class="pill ${c}">${esc(label)} ${pct(v)} <span style="font-weight:400">· queriam ${pct(goal)}</span></span>`;
}

// Category chooser: a chip that turns into a grouped <select>.
// Category picker: a chip that opens a sheet with what is being classified, a search box (also by everyday
// words: "estacionamento" finds Transporte), suggestions for this entry and the list in plain groups.
// ctx: { description, amount } of the entry. The app plugs in usage counts and creating a category.
const PICK = { usage: () => ({}), create: null };
export function configureCatPicker(o) { Object.assign(PICK, o); }
export function catPicker(categories, current, pending, onPick, ctx = {}) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip catchip' + (pending ? ' pend' : ''); b.textContent = current || 'Escolher';
  b.onclick = () => openCatSheet(categories, current, ctx, onPick);
  return b;
}
export function openCatSheet(categories, current, ctx, onPick) {
  document.querySelectorAll('.cps-wrap').forEach(x => x.remove());
  const wrap = document.createElement('div'); wrap.className = 'cps-wrap';
  const money = v => (+v < 0 ? '−' : '') + 'R$ ' + Math.abs(+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  wrap.innerHTML = `<div class="cps" role="dialog" aria-modal="true" aria-labelledby="cpsT">
    <div class="cps-top"><div class="cps-h"><h3 id="cpsT">Qual a categoria?</h3>${ctx.description ? `<p class="cps-ctx"><strong>${esc(ctx.description)}</strong>${ctx.amount != null ? ` · ${money(ctx.amount)}` : ''}</p>` : ''}</div>
      <button type="button" class="tx" aria-label="Fechar">×</button></div>
    <input type="search" class="cps-q" placeholder="Buscar: estacionamento, mercado, farmácia…" aria-label="Buscar categoria" autocomplete="off" enterkeyhint="search">
    <div class="cps-body"></div></div>`;
  document.body.append(wrap); document.body.classList.add('cfm-open');
  const close = () => { wrap.remove(); if (!document.querySelector('.cfm-wrap')) document.body.classList.remove('cfm-open'); };
  const pick = n => { close(); if (n && n !== current) onPick(n); };
  const body = wrap.querySelector('.cps-body'), q = wrap.querySelector('.cps-q');
  const item = n => `<button type="button" class="cps-it${n === current ? ' on' : ''}" data-n="${esc(n)}">${esc(n)}${n === current ? '<span class="cps-ok">atual</span>' : ''}</button>`;
  const draw = () => {
    const text = q.value.trim();
    if (!text) {
      const sug = suggestCategories(ctx.description || '', categories, PICK.usage());
      body.innerHTML = (sug.length ? `<p class="cps-sec">Sugestões</p><div class="cps-sug">${sug.map(n => `<button type="button" class="chip" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : '')
        + groupCategories(categories).map(g => `<p class="cps-sec">${esc(g.title)}</p>${g.names.map(item).join('')}`).join('');
    } else {
      const found = rankCategories(text, categories), exact = categories.some(c => plain(c.name) === plain(text));
      body.innerHTML = (found.length ? found.map(item).join('') : `<p class="small muted cps-none">Nenhuma categoria com "${esc(text)}".</p>`)
        + (PICK.create && !exact && text.length >= 2 ? `<button type="button" class="cps-new" data-new="${esc(text)}">+ Criar a categoria "${esc(text.charAt(0).toUpperCase() + text.slice(1))}"</button><p class="tiny muted cps-tip">Ela entra como gasto do dia a dia. Dá para mudar em menu ☰ → Categorias.</p>` : '');
    }
    body.querySelectorAll('[data-n]').forEach(x => x.onclick = () => pick(x.dataset.n));
    const nb = body.querySelector('[data-new]');
    if (nb) nb.onclick = async () => {
      nb.disabled = true; const name = nb.dataset.new.charAt(0).toUpperCase() + nb.dataset.new.slice(1);
      try { const n = await PICK.create(name); toast(`Categoria "${n}" criada.`); pick(n); } catch (e) { nb.disabled = false; toast('Não foi possível criar a categoria. Tente de novo.'); }
    };
  };
  q.oninput = draw; draw();
  q.onkeydown = e => { if (e.key === 'Enter') { const f = body.querySelector('[data-n]'); if (f) pick(f.dataset.n); } };
  wrap.querySelector('.tx').onclick = close;
  wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // On a phone the keyboard would cover the list: focus the search only on bigger screens.
  if (matchMedia('(min-width: 700px)').matches) q.focus(); else wrap.querySelector('.cps').focus?.();
}

// Minimal, safe Markdown for assistant answers: paragraphs, bold, lists, tables, headings.
export function md(s) {
  const lines = esc(s).split('\n'); let html = '', inList = false, tbl = [];
  const flushT = () => {
    if (!tbl.length) return;
    const rows = tbl.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim()));
    html += '<div class="tw"><table>' + rows.map((r, i) => '<tr>' + r.map(c => i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>').join('') + '</table></div>'; tbl = [];
  };
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^\s*\|/.test(l)) { if (inList) { html += '</ul>'; inList = false; } tbl.push(l); continue; }
    flushT();
    if (/^\s*[-*•]\s+/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + l.replace(/^\s*[-*•]\s+/, '') + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^#{1,4}\s+/.test(l)) html += '<p><strong>' + l.replace(/^#{1,4}\s+/, '') + '</strong></p>';
    else if (l.trim()) html += '<p>' + l + '</p>';
  }
  flushT(); if (inList) html += '</ul>';
  return html;
}

export const micSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

// ---------- validation feedback ----------
// Marks a field as invalid with a message under it. Returns false so callers can `return invalid(...)`.
export function invalid(input, msg) {
  input.setAttribute('aria-invalid', 'true');
  let e = input.nextElementSibling?.classList.contains('ferr') ? input.nextElementSibling : null;
  if (!e) { e = document.createElement('span'); e.className = 'ferr'; e.setAttribute('role', 'alert'); input.insertAdjacentElement('afterend', e); }
  e.textContent = msg; input.focus();
  input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); e.remove(); }, { once: true });
  return false;
}
export function clearInvalid(root) {
  root.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
  root.querySelectorAll('.ferr').forEach(e => e.remove());
}
// Runs [input, message] checks in order; marks the first failure. Returns true when all pass.
export function validate(pairs) {
  for (const [input, msg] of pairs) if (msg) return invalid(input, msg);
  return true;
}

// ---------- double confirmation ----------
// Shows "text [Sim] [Cancelar]" right after `anchor` and resolves true/false. Used before every add/delete.
export function confirmInline(anchor, { text, yes = 'Sim, confirmar', no = 'Cancelar', danger = false, title } = {}) {
  // "Are you sure?" pop-up in the middle of the screen (the anchor is only used to give focus back).
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove());
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'cfm-wrap';
    wrap.innerHTML = `<div class="cfm${danger ? ' danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="cfmT" aria-describedby="cfmX">
      <h3 id="cfmT">${esc(title || (danger ? 'Tem certeza?' : 'Confirma?'))}</h3><p class="small" id="cfmX">${text}</p>
      <div class="rowbtn"><button class="btn ${danger ? 'danger-fill' : 'primary'}" type="button" data-y>${esc(yes)}</button><button class="btn" type="button" data-n>${esc(no)}</button></div></div>`;
    document.body.append(wrap); document.body.classList.add('cfm-open');
    const done = v => { wrap.remove(); document.body.classList.remove('cfm-open'); if (anchor && anchor.focus) try { anchor.focus({ preventScroll: true }); } catch (e) { /* gone */ } resolve(v); };
    wrap.querySelector('[data-y]').onclick = () => done(true);
    wrap.querySelector('[data-n]').onclick = () => done(false);
    wrap.onclick = e => { if (e.target === wrap) done(false); };
    wrap.onkeydown = e => { if (e.key === 'Escape') done(false); };
    wrap.querySelector(danger ? '[data-n]' : '[data-y]').focus();
  });
}

// Message pop-up (welcome, what's new, a personal reply). Resolves with 'primary', 'secondary' or 'close'.
// html is trusted markup built by the caller (escape any user text first).
export function announce({ eyebrow = '', title, html = '', primary = 'Entendi', secondary = '', tone = 'accent' }) {
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove());
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'cfm-wrap';
    wrap.innerHTML = `<div class="cfm ann ann-${tone}" role="dialog" aria-modal="true" aria-labelledby="annT">
      <div class="ann-top">${eyebrow ? `<span class="ann-eb">${esc(eyebrow)}</span>` : '<span></span>'}<button type="button" class="tx" aria-label="Fechar">×</button></div>
      <h3 id="annT">${esc(title)}</h3><div class="small ann-body">${html}</div>
      <div class="rowbtn"><button class="btn primary" type="button" data-p>${esc(primary)}</button>${secondary ? `<button class="btn" type="button" data-s>${esc(secondary)}</button>` : ''}</div></div>`;
    document.body.append(wrap); document.body.classList.add('cfm-open');
    const done = v => { wrap.remove(); document.body.classList.remove('cfm-open'); resolve(v); };
    wrap.querySelector('[data-p]').onclick = () => done('primary');
    if (secondary) wrap.querySelector('[data-s]').onclick = () => done('secondary');
    wrap.querySelector('.tx').onclick = () => done('close');
    wrap.onkeydown = e => { if (e.key === 'Escape') done('close'); };
    wrap.querySelector('[data-p]').focus();
  });
}

// "Working on it" card while a long task runs (reading a PDF or a receipt). set(text) updates the step.
export function busy(text) {
  document.querySelectorAll('.busy').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'busy'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<span class="spin" aria-hidden="true"></span><span class="bt"><strong>Só um instante</strong><span></span></span>`;
  document.body.append(el);
  const set = t => { el.querySelector('.bt span').textContent = t; };
  set(text);
  return { set, done: () => el.remove() };
}
