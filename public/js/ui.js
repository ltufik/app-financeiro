// Small DOM helpers shared by the views.
import { esc, pct } from './lib/format.js';
import { GROUPS } from './lib/calc.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 3400);
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
  return `<span class="pill ${c}">${esc(label)} ${pct(v)} <span style="font-weight:400">meta ${pct(goal)}</span></span>`;
}

// Category chooser: a chip that turns into a grouped <select>.
export function catPicker(categories, current, pending, onPick) {
  const wrap = document.createElement('span');
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.style.fontSize = '13px'; b.textContent = current || 'Escolher';
  if (pending) b.style.borderColor = 'var(--warn)';
  b.onclick = () => {
    const sel = document.createElement('select');
    const byG = {}; for (const c of categories) (byG[c.grp] ||= []).push(c.name);
    sel.innerHTML = (current ? '' : '<option value="" selected disabled>Escolher</option>') +
      Object.keys(GROUPS).filter(g => byG[g]).map(g => `<optgroup label="${esc(GROUPS[g])}">${byG[g].sort((a, c) => a.localeCompare(c, 'pt')).map(n => `<option${n === current ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('');
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
export function confirmInline(anchor, { text, yes = 'Sim, confirmar', no = 'Cancelar', danger = false } = {}) {
  document.querySelectorAll('.cfm-row, .cfm').forEach(x => x.remove());
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'cfm' + (danger ? ' danger' : ''); box.setAttribute('role', 'alertdialog');
    box.innerHTML = `<p class="small">${text}</p><div class="rowbtn"><button class="btn ${danger ? 'danger-fill' : 'primary'}" type="button" data-y>${esc(yes)}</button><button class="btn" type="button" data-n>${esc(no)}</button></div>`;
    const host = anchor.closest('li, tr, .rowbtn, .confirm') || anchor;
    let holder = box;
    if (host.tagName === 'TR') { holder = document.createElement('tr'); holder.className = 'cfm-row'; const td = document.createElement('td'); td.colSpan = 99; td.append(box); holder.append(td); }
    host.insertAdjacentElement('afterend', holder);
    const done = v => { holder.remove(); resolve(v); };
    box.querySelector('[data-y]').onclick = () => done(true);
    box.querySelector('[data-n]').onclick = () => done(false);
    box.querySelector('[data-y]').focus();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
