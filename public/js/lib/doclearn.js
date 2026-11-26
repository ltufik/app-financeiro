// Reading that learns (3.0.5): when the person corrects what the app read in a statement or bill (today: the bank),
// the family remembers it for that kind of document, and the next one comes right ("aprendi com a sua correção").
// A document's marks are its agency and account, the finals of its cards and its header lines (the lines without
// values, in order). Only a short hash of each mark is kept (settings.readlearn), never the numbers themselves.
// Pure, tested in tests/lib.test.mjs.

const MOVE = /\d,\d{2}\b|\b(pix|ted|doc|transf|pagamento|boleto|dep[oó]sito|recebid[oa]|enviad[oa])\b/i;
const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// FNV-1a, 32 bits, base 36: enough to tell documents apart, impossible to read the account from.
export function hashMark(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/*
  docMarks(text, { cards }) -> ['a:<hash>' agency+account, 'c:<hash>' per card final, 'h:<hash>' header] (strongest first).
  Header: up to 4 lines with letters before the first movement (a Pix's second line, between movements, changes every
  month), digits removed (dates and pages change).
*/
export function docMarks(text, { cards = [] } = {}) {
  const t = strip(text), out = [];
  const ag = t.match(/ag(?:encia)?\.?\s*[:n.o]*\s*(\d{3,5})/), cc = t.match(/\bc(?:onta|\/c|c)\.?\s*(?:corrente)?\s*[:n.o]*\s*([\d.\-]{5,15}\d)/);
  if (ag && cc) out.push('a:' + hashMark(ag[1] + '/' + cc[1].replace(/\D/g, '')));
  for (const c of [...new Set((cards || []).map(c => String(c || '').replace(/\D/g, '').slice(-4)).filter(c => c.length === 4))].sort()) out.push('c:' + hashMark('card' + c));
  const ls = t.split('\n'), fm = ls.findIndex(l => MOVE.test(l));
  const head = (fm < 0 ? ls : ls.slice(0, fm)).filter(l => /[a-z]{3}/.test(l)).slice(0, 4).map(l => l.replace(/[\d\W_]+/g, ' ').trim()).filter(Boolean);
  if (head.length >= 2) out.push('h:' + hashMark(head.join('|')));
  return out;
}

const WEIGHT = { a: 3, c: 2, h: 1 };
const weight = m => WEIGHT[String(m)[0]] || 0;

// What the family taught for these marks: { bank, how: 'conta' | 'cartao' | 'cabecalho' } or null.
// The strongest shared mark wins; among equals, the latest correction.
export function recall(list = [], marks = []) {
  let best = null;
  for (const e of list || []) {
    const shared = (e.marks || []).filter(m => marks.includes(m)); if (!shared.length || !e.bank) continue;
    const w = Math.max(...shared.map(weight));
    if (!best || w > best.w || (w === best.w && String(e.at) > String(best.e.at))) best = { w, e };
  }
  return best ? { bank: best.e.bank, how: best.w === 3 ? 'conta' : best.w === 2 ? 'cartao' : 'cabecalho' } : null;
}

// Saves a correction: the marks now point to this bank (older entries lose these marks; empty ones go). At most 60.
export function learn(list = [], marks = [], bank, at = new Date().toISOString().slice(0, 10)) {
  if (!marks.length || !bank) return list || [];
  const rest = (list || []).map(e => ({ ...e, marks: (e.marks || []).filter(m => !marks.includes(m)) })).filter(e => e.marks.length);
  return [{ marks: [...marks], bank, at }, ...rest].slice(0, 60);
}
