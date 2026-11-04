// Bringing entries from a spreadsheet (Excel or CSV): find the columns, read Brazilian numbers and dates,
// decide account or card and the sign, match the family's categories and leave out what is already in the app.
// Pure module, tested in tests/lib.test.mjs. Reading the .xlsx itself happens in the view (SheetJS from the CDN).
import { cycleMonth, round2 } from './format.js';
import { sameReason } from './catmerge.js';
import { kindOf } from './calc.js';

const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// CSV from Excel in Brazil uses ";" (comma is the decimal); others use ",". Quotes may hold separators.
export function parseCSV(text) {
  const t = String(text || '').replace(/^﻿/, ''), first = t.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

// "R$ -1.234,56", "(45,00)", "1,234.56", 12.5 -> number (null when it is not an amount).
export function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v ?? '').trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-|-$|\bD$/i.test(s.replace(/R\$\s*/i, '').trim());
  s = s.replace(/[^\d,.]/g, ''); if (!/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else if (ld > lc && lc >= 0) s = s.replace(/,/g, ''); else if (lc < 0 && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? (neg ? -Math.abs(n) : n) : null;
}

// "05/10/2026", "5/10/26", "2026-10-05", Excel's day number (45935) or a Date -> "AAAA-MM-DD" (null otherwise).
export function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3], mo = +m[2], d = +m[1]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  return null;
}

// Which column is which, from the header words; when there is no header, from what the cells look like.
const HEAD = {
  date: /^(data|dia|date|data da compra|data do gasto|data de pagamento|vencimento|quando)/,
  description: /(descri|histor|estabelec|lancamento|item|o que|gasto$|^nome|detalhe|local|favorecido)/,
  amount: /^(valor|quantia|total|preco|r\$|montante|amount|vlr)/,
  category: /(categoria|classifica|grupo|tipo de gasto|^tipo$|rubrica)/,
  source: /(forma|meio|pagamento|conta ou cartao|cartao ou conta|^onde|origem|cartao$|conta$)/,
  kind: /(entrada.*saida|receita.*despesa|^natureza|^sentido|^e\/s)/,
};
export const COLS = ['date', 'description', 'amount', 'category', 'source', 'kind'];
export function detectColumns(rows) {
  const scan = rows.slice(0, 15);
  let best = { row: -1, map: {}, score: 0 };
  scan.forEach((r, i) => {
    const map = {}; r.forEach((c, j) => { const p = plain(c); if (!p || p.length > 40) return; for (const k of COLS) if (map[k] == null && HEAD[k].test(p)) { map[k] = j; break; } });
    const score = Object.keys(map).length + (map.amount != null ? 1 : 0);
    if (score > best.score && map.amount != null) best = { row: i, map, score };
  });
  if (best.row >= 0 && best.map.description != null) return { header: best.row, map: best.map };
  // No (complete) header: look at the cells of the first rows with data.
  const body = rows.slice(best.row + 1, best.row + 31), n = Math.max(0, ...body.map(r => r.length)), map = { ...best.map }, taken = new Set(Object.values(map));
  const share = (j, f) => body.filter(r => f(r[j])).length / Math.max(1, body.length);
  const free = Array.from({ length: n }, (_, j) => j).filter(j => !taken.has(j));
  const pick = (k, f, min) => { if (map[k] != null) return; const j = free.filter(x => !taken.has(x)).sort((a, b) => share(b, f) - share(a, f))[0]; if (j != null && share(j, f) >= min) { map[k] = j; taken.add(j); } };
  pick('date', v => !!parseDate(v), 0.6);
  pick('amount', v => parseAmount(v) != null && !parseDate(v), 0.6);
  pick('description', v => typeof v === 'string' && /[a-z]{3}/i.test(v) && parseAmount(v) == null, 0.6);
  return { header: best.row, map };
}

const isCard = v => /cart|credit|credito|visa|master|elo|amex|nubank/.test(plain(v));
const isIncome = v => /^(entrada|receita|credito|recebid|e$)/.test(plain(v));
const isExpense = v => /^(saida|despesa|debito|gasto|pago|s$)/.test(plain(v));

// A sheet category -> the family's category: same name, a similar one, or null (new).
export function matchCategory(name, categories) {
  const p = plain(name); if (!p) return null;
  const exact = categories.find(c => plain(c.name) === p); if (exact) return exact.name;
  const near = categories.find(c => c.name !== 'A classificar' && sameReason(name, c.name)); return near ? near.name : null;
}

// rows: all rows of the sheet; opts: { map, header, defaultSource: 'conta'|'cartao', positives: 'saida'|'entrada',
// closeDay, categories, catMap: {sheet category: family category | '' (A classificar)} }.
// Returns { entries: [{date, month, day, source, description, amount, category, sheetCategory}], skipped, sheetCats }.
export function buildEntries(rows, { map, header = -1, defaultSource = 'conta', positives = 'saida', closeDay = 24, categories = [], catMap = {} }) {
  const idx = new Map(categories.map(c => [c.name, c])), entries = [], sheetCats = {};
  let skipped = 0;
  for (const r of rows.slice(header + 1)) {
    const date = parseDate(r[map.date]), raw = parseAmount(r[map.amount]), desc = String(r[map.description] ?? '').replace(/\s+/g, ' ').trim();
    if (!date || raw == null || raw === 0 || !desc || /^(total|saldo|subtotal)\b/i.test(desc)) { if (r.some(c => String(c ?? '').trim())) skipped++; continue; }
    const sc = map.category != null ? String(r[map.category] ?? '').trim() : '';
    if (sc) sheetCats[sc] = (sheetCats[sc] || 0) + 1;
    const cat = sc ? (sc in catMap ? catMap[sc] : matchCategory(sc, categories) || '') : '';
    const source = map.source != null && String(r[map.source] ?? '').trim() ? (isCard(r[map.source]) ? 'cartao' : 'conta') : defaultSource;
    // Money in or out: the "entrada/saída" column, else the category's side, else the sign, else the choice for positives.
    const kv = map.kind != null ? r[map.kind] : '', c = idx.get(cat);
    const income = isIncome(kv) ? true : isExpense(kv) ? false : c ? kindOf(c).side === 'Receitas' : raw < 0 ? false : positives === 'entrada';
    const v = Math.abs(raw), amount = round2(source === 'conta' ? (income ? v : -v) : (income ? -v : v));
    entries.push({ date, month: source === 'cartao' ? cycleMonth(date, closeDay) : date.slice(0, 7), day: `${date.slice(8, 10)}/${date.slice(5, 7)}`, source, description: desc.slice(0, 200), amount, category: cat || 'A classificar', sheetCategory: sc });
  }
  return { entries, skipped, sheetCats };
}

// Rows already in the app (same source, same value, date within 3 days): left out so nothing doubles.
export function markDuplicates(entries, existing) {
  const day = d => Date.parse(d + 'T12:00:00Z') / 864e5;
  const pool = (existing || []).filter(t => t.date).map(t => ({ s: t.source, a: Math.abs(+t.amount), d: day(t.date) }));
  return entries.map(e => ({ ...e, dup: pool.some(p => p.s === e.source && Math.abs(p.a - Math.abs(e.amount)) < 0.01 && Math.abs(p.d - day(e.date)) <= 3) }));
}
