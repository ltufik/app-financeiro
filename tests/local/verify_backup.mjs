// Prints the monthly summary of a backup file: node tests/local/verify_backup.mjs caminho/backup.json
import fs from 'fs';
import { catIndex, monthCalc, schedule } from '../../public/js/lib/calc.js';
const b = JSON.parse(fs.readFileSync(process.argv[2]));
const idx = catIndex(b.categories), by = {};
for (const t of b.transactions) (by[t.month] ||= []).push(t);
for (const k of Object.keys(by).sort()) { const r = monthCalc(by[k], idx); console.log(k, 'sobra', r.res.toFixed(2), 'taxa', (r.tx * 100).toFixed(1) + '%', 'sem fin', (r.tx2 * 100).toFixed(1) + '%', 'cartão dia', r.card.toFixed(0), 'fatura', r.cardTotal.toFixed(0)); }
const last = Object.keys(by).sort().pop();
console.log('parcelas próximas', schedule(by[last].filter(t => t.source === 'cartao'), 3).map(v => v.toFixed(0)).join(' / '));
