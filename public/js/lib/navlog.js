// Helpers for the navigation log (tested in tests/lib.test.mjs): where a tap fell, the name of
// the button tapped, and an error message without personal data.

// Tap position on a grid 20 columns wide; rows have the same size (5% of the screen width).
export function tapCell(x, y, width) {
  if (!(width > 0) || !(x >= 0) || !(y >= 0)) return null;
  const cx = Math.min(19, Math.floor(x / width * 20)), cy = Math.floor(y / width * 20);
  return cy > 199 ? null : { x: cx, y: cy };
}

// Name of the button, tab or link tapped. Never form fields or anything typed; numbers become #.
const PICK = 'button, a, summary, [role=button], [role=radio], [role=tab], .tab, .chip, .ltile';
export function tapLabel(target) {
  const el = target && target.closest ? target.closest(PICK) : null;
  if (!el || el.closest('input, textarea, select')) return '';
  // A tile with a title and a description (Lançar): only the title.
  const title = el.querySelector ? el.querySelector('strong') : null;
  const raw = el.getAttribute('aria-label') || title?.textContent || el.textContent || el.id || '';
  return String(raw).replace(/\s+/g, ' ').trim().replace(/R\$\s*/g, '').replace(/\d[\d.,]*/g, '#').slice(0, 60);
}

// Error text without e-mails or long numbers (account, card, phone), at most 400 characters.
const NOISE = /^(Script error\.?|ResizeObserver loop|Load failed|cancel)/i;
export function cleanError(m) {
  const s = String(m || '').replace(/\s+/g, ' ').trim();
  if (!s || NOISE.test(s)) return '';
  return s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<e-mail>').replace(/\d[\d.\-/ ]{5,}\d/g, '#').slice(0, 400);
}
