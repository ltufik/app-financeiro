// "Baixar planilha": every entry of the family in a CSV that opens straight in Excel or Google Sheets
// (Brazilian Excel: ";" between columns, comma for decimals, accents kept). Pure module, tested in tests/lib.test.mjs.
import { expandSplits, kindOf } from './calc.js';

const HEAD = ['Data', 'Mês', 'Onde', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Parcela', 'Cartão ou conta', 'Anotação'];
const cell = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const money = n => (Math.round((+n || 0) * 100) / 100).toFixed(2).replace('.', ',');
const brDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';

// txs: the family's entries; categories: [{name, grp, recurring}]. A receipt split becomes one line per part.
export function toCSV(txs, categories) {
  const idx = new Map((categories || []).map(c => [c.name, c]));
  const rows = expandSplits(txs).slice().sort((a, b) => String(a.month).localeCompare(String(b.month)) || String(a.date || a.day || '').localeCompare(String(b.date || b.day || '')));
  const lines = rows.map(t => [brDate(t.date) || t.day || '', t.month || '', t.source === 'cartao' ? 'Cartão' : 'Conta', t.description, t.category,
    idx.get(t.category) ? kindOf(idx.get(t.category)).label : '', money(t.amount), t.installment || '', t.card || '', t.note || ''].map(cell).join(';'));
  return '﻿' + [HEAD.join(';'), ...lines].join('\r\n') + '\r\n';
}
