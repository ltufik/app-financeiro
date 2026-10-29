// Runs the app's parsers on a real PDF (local only; PDFs are never committed).
// node tests/local/parse_pdf.mjs <caminho/pdf.mjs do pdfjs-dist> <arquivo.pdf> [senha]
import fs from 'fs';
import { lineify, detect, parseFaturaSantander, parseExtratoSantander, faturaMonth } from '../../public/js/lib/parse.js';
const pdfjs = await import(process.argv[2]);
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[3])), password: process.argv[4] }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1 }); const tc = await pg.getTextContent(); pages.push({ w: vp.width, items: tc.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width })) }); }
const l1 = pages.flatMap(p => lineify(p.items, p.w, 1)); const type = detect(l1.join('\n'));
console.log('tipo:', type);
if (type === 'fatura-santander') { const r = parseFaturaSantander(pages.flatMap((p, i) => lineify(p.items, p.w, i === 0 ? 1 : 2))); console.log({ ok: r.ok, itens: r.items.length, total: r.net, venc: r.vencimento, mes: faturaMonth(r.vencimento), checks: r.checks }); }
else { const r = parseExtratoSantander(l1); console.log({ ok: r.ok, movimentos: r.rows.length, saldoIni: r.saldoIni, saldoFim: r.saldoFim, mes: r.month }); }
