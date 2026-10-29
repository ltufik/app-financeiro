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
    sel.onblur = () => { if (!sel.value || sel.value === current) wrap.replaceChildren(b); };
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
