// "Categorias parecidas": finds categories that are probably the same thing ("Mercado" and "Mercados",
// "Saúde" and "Saúde e terapia", "Farmácia" and "Remédios") and suggests joining them into the one with more
// entries. Only expense with expense or income with income. Pure module, tested in tests/lib.test.mjs.
import { kindOf } from './calc.js';

const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'com', 'para', 'a', 'o', 'em']);
const stem = w => w.length > 4 ? w.replace(/(oes|aes)$/, 'ao').replace(/(is)$/, 'l').replace(/s$/, '') : w;
const words = s => plain(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);

// Everyday names for the same thing (each line: words that mean the same category).
const SAME = [
  ['farmacia', 'remedio', 'drogaria', 'medicamento'], ['mercado', 'supermercado', 'feira', 'compra mercado'], ['combustivel', 'gasolina', 'posto', 'etanol'],
  ['restaurante', 'restaurantes', 'comer fora', 'alimentacao fora'], ['delivery', 'ifood', 'pedido comida'], ['pet', 'animai', 'cachorro', 'gato', 'veterinario'],
  ['escola', 'colegio', 'mensalidade escolar'], ['educacao', 'curso', 'estudo'], ['streaming', 'assinatura digital', 'servico digital'],
  ['academia', 'ginastica', 'esporte'], ['salao', 'cabeleireiro', 'beleza', 'estetica'], ['presente', 'presentes'], ['viagem', 'viagen', 'ferias viagem'],
  ['transporte', 'mobilidade'], ['uber', 'taxi', 'aplicativo transporte'], ['saude', 'medico', 'consulta'], ['seguro', 'seguros'],
];
const synonymKey = name => { const p = words(name).join(' '); const i = SAME.findIndex(g => g.some(w => p === stem(w) || p === w)); return i < 0 ? null : i; };

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Why two names look like the same category, or null.
export function sameReason(a, b) {
  const wa = words(a), wb = words(b), ja = wa.join(' '), jb = wb.join(' ');
  if (!ja || !jb) return null;
  if (ja === jb) return 'mesmo nome';
  // One name inside the other ("Saúde" in "Saúde e terapia"): only when the longer one adds a single word
  // (two for "Outros"), and never for very specific names ("Salário Luana: consignado", "Móveis (presente)").
  const [short, long, longName] = wa.length <= wb.length ? [wa, wb, b] : [wb, wa, a];
  const sl = new Set(long), extra = long.length - short.length;
  if (short.length && short.every(w => sl.has(w)) && !/[:(]/.test(longName) && extra <= (short.length === 1 && /^outro/.test(short[0]) ? 2 : 1)) return 'um nome está dentro do outro';
  if (ja.length >= 5 && jb.length >= 5 && lev(ja, jb) <= (Math.min(ja.length, jb.length) >= 9 ? 2 : 1)) return 'nomes quase iguais';
  const ka = synonymKey(a), kb = synonymKey(b);
  if (ka != null && ka === kb) return 'querem dizer a mesma coisa';
  return null;
}

// categories: [{id, name, grp, recurring}]; usage: {name: number of entries}; dismissed: ['A|B', ...] pairs the
// family said to keep apart. Returns [{keep, drop, reason, keepCount, dropCount}] (the one with more entries is kept).
export const pairKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, 'pt')).join('|');
export function mergeSuggestions(categories, usage = {}, dismissed = []) {
  const cats = (categories || []).filter(c => c && c.name && c.name !== 'A classificar'), out = [], used = new Set();
  const side = c => kindOf(c).side;
  for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
    const a = cats[i], b = cats[j];
    if (side(a) !== side(b) || used.has(a.name) || used.has(b.name) || dismissed.includes(pairKey(a.name, b.name))) continue;
    const reason = sameReason(a.name, b.name); if (!reason) continue;
    // "Inside the other" is a weaker sign: only between categories of the same type (variable, fixed, extra...).
    if (reason === 'um nome está dentro do outro' && kindOf(a).key !== kindOf(b).key) continue;
    const ua = usage[a.name] || 0, ub = usage[b.name] || 0;
    const [keep, drop] = ua > ub || (ua === ub && a.name.length >= b.name.length) ? [a, b] : [b, a];
    out.push({ keep: keep.name, drop: drop.name, keepId: keep.id, dropId: drop.id, reason, keepCount: usage[keep.name] || 0, dropCount: usage[drop.name] || 0 });
    used.add(drop.name);
  }
  return out.sort((x, y) => (y.dropCount + y.keepCount) - (x.dropCount + x.keepCount));
}

// The family's settings after joining `drop` into `keep`: budgets add up, remembered notes stay.
export function mergeSettings(st = {}, drop, keep) {
  const out = { ...st };
  if (st.budgets && typeof st.budgets === 'object' && drop in st.budgets) {
    const b = { ...st.budgets }; b[keep] = (+b[keep] || 0) + (+b[drop] || 0); delete b[drop]; out.budgets = b;
  }
  return out;
}
