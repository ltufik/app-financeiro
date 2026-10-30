// Privacy mode: hides every amount in reais (R$ 1.234,56 -> R$ ••••) with one tap, e.g. to open the app in public.
// Text is masked as it appears on screen; turning it off redraws the screen with the real values.
const MONEY = /([−-]?\s?R\$\s?)[\d.]+(,\d{1,2})?(\s?mil)?/g;
const KEY = 'fin.privacy';
let obs = null;
export const hidden = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

function maskNode(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('textarea, input, script, style, .no-mask') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; while (w.nextNode()) list.push(w.currentNode);
  for (const n of list) if (/R\$\s?\d/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(MONEY, '$1••••');
}
function start() {
  document.body.classList.add('privacy'); maskNode(document.body);
  obs = obs || new MutationObserver(ms => { if (!hidden()) return; for (const m of ms) { if (m.type === 'characterData') maskNode(m.target.parentNode || document.body); m.addedNodes.forEach(n => { if (n.nodeType === 1) maskNode(n); else if (n.nodeType === 3 && n.parentNode) maskNode(n.parentNode); }); } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}
export function initPrivacy(btn, redraw) {
  const paint = () => { btn.setAttribute('aria-pressed', hidden()); btn.setAttribute('aria-label', hidden() ? 'Mostrar valores' : 'Esconder valores'); btn.innerHTML = hidden()
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'; };
  btn.onclick = () => {
    const on = !hidden(); try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (on) start(); else { document.body.classList.remove('privacy'); obs && obs.disconnect(); obs = null; redraw(); }
    paint();
  };
  paint(); if (hidden()) start();
}
