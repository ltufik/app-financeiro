// Small DOM helpers shared by the views.
import { esc, pct } from './lib/format.js';
import { KINDS, kindOf } from './lib/calc.js';

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
export function catPicker(categories, current, pending, onPick) {
  const wrap = document.createElement('span');
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.style.fontSize = '13px'; b.textContent = current || 'Escolher';
  if (pending) b.style.borderColor = 'var(--warn)';
  b.onclick = () => {
    const sel = document.createElement('select');
    const byG = {}; for (const c of categories) (byG[kindOf(c).key] ||= []).push(c.name);
    sel.innerHTML = (current ? '' : '<option value="" selected disabled>Escolher</option>') +
      KINDS.map(k => k.key).filter(g => byG[g]).map(g => `<optgroup label="${esc(KINDS.find(k => k.key === g).label)}">${byG[g].sort((a, c) => a.localeCompare(c, 'pt')).map(n => `<option${n === current ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
    wrap.replaceChildren(sel); sel.focus();
    sel.onchange = () => onPick(sel.value);
    // Deferred: the table may be redrawn while the select still has focus.
    sel.onblur = () => setTimeout(() => { if (sel.isConnected && (!sel.value || sel.value === current)) wrap.replaceChildren(b); });
  };
  wrap.append(b); return wrap;
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
