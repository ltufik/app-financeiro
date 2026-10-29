// PDF text parsing. Input is pdf.js text items; output is plain rows the app reviews before saving.
// Bank-specific parsers validate themselves against the document's own totals; anything else goes to Claude.

export const num = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
export const MONEY = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

// Group text items of one page into lines, column by column. items: [{str, x, y, w}]
export function lineify(items, pageWidth, columns = 1) {
  const out = [];
  for (let c = 0; c < columns; c++) {
    const lo = pageWidth * c / columns, hi = pageWidth * (c + 1) / columns;
    const its = items.filter(it => it.str && it.str.trim() !== '' && it.x >= lo - 1 && it.x < hi - 1);
    const rows = [];
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    for (const it of its) {
      let r = rows.find(r => Math.abs(r.y - it.y) <= 2.5);
      if (!r) { r = { y: it.y, parts: [] }; rows.push(r); }
      r.parts.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x);
      let line = '', end = null;
      for (const p of r.parts) { if (end !== null && p.x - end > 1.5) line += ' '; line += p.str; end = p.x + (p.w || 0); }
      out.push(line.replace(/\s+/g, ' ').trim());
    }
  }
  return out;
}

export function detect(text) {
  if (/Detalhamento da Fatura|XXXX\s*XXXX\s*\d{4}/i.test(text)) return 'fatura-santander';
  if (/EXTRATO DE CONTA\s*-\s*CONTA CORRENTE/i.test(text)) return 'extrato-santander';
  if (/fatura|vencimento|limite de cr[eé]dito|pagamento m[ií]nimo/i.test(text) && /cart[aã]o/i.test(text)) return 'fatura';
  if (/extrato|saldo anterior|saldo do dia|conta corrente/i.test(text)) return 'extrato';
  if (/renda fixa|fundos de investimento|carteira|posi[cç][aã]o consolidada|rentabilidade/i.test(text)) return 'investimentos';
  return text.replace(/\s/g, '').length < 200 ? 'imagem' : 'desconhecido';
}

// Santander credit card statement.
export function parseFaturaSantander(lines) {
  const items = [], totals = [];
  let card = null, sec = null, vencimento = null, totalPagar = null;
  for (let l of lines) {
    l = l.trim();
    const v = l.match(/^R\$\s*[\d.]+,\d{2}\s+(\d{2}\/\d{2}\/\d{4})/) || l.match(/Vencimento\s*(\d{2}\/\d{2}\/\d{4})/); if (v && !vencimento) vencimento = v[1];
    const tp = l.match(/Saldo Desta Fatura\s+(-?[\d.]+,\d{2})/); if (tp) totalPagar = num(tp[1]);
    const m = l.match(/XXXX\s*XXXX\s*(\d{4})/);
    if (m && /-\s*\d{4}\s*XXXX/.test(l)) { card = m[1]; continue; }
    if (/Resumo da Fatura/.test(l)) { card = null; continue; }
    if (/Pagamento e Demais/i.test(l)) { sec = 'cred'; continue; }
    if (/^Parcelamentos/.test(l)) { sec = 'parc'; continue; }
    if (/^Despesas/.test(l)) { sec = 'desp'; continue; }
    if (!card) continue;
    if (/^VALOR TOTAL/.test(l)) { const ms = l.match(MONEY); if (ms) totals.push([card, num(ms[0])]); continue; }
    if (/COTA[CÇ][AÃ]O/i.test(l)) continue;
    if (/^IOF DESPESA/i.test(l)) { const ms = l.match(MONEY); if (ms) items.push({ card, sec, day: '', description: 'IOF DESPESA NO EXTERIOR', installment: '', amount: num(ms[ms.length - 1]) }); continue; }
    const mm = l.match(/^[^0-9]*(?:\d\s+)?(\d{2}\/\d{2})\s+(.*)$/);
    if (!mm) continue;
    const rest = mm[2], ms = [...rest.matchAll(MONEY)];
    if (!ms.length) continue;
    let pick = ms[ms.length - 1];
    if (ms.length >= 2) { const a = ms[ms.length - 2], b = ms[ms.length - 1]; if (rest.slice(a.index + a[0].length, b.index).trim() === '') pick = a; }
    let desc = rest.slice(0, pick.index).trim(), parc = '';
    const pm = desc.match(/(\d{2}\/\d{2})\s*$/); if (pm) { parc = pm[1]; desc = desc.slice(0, pm.index).trim(); }
    items.push({ card, sec, day: mm[1], description: desc.replace(/\s+/g, ' '), installment: parc, amount: num(pick[0]) });
  }
  const checks = totals.map(([c, t]) => {
    const s = items.filter(i => i.card === c && i.sec !== 'cred' && i.amount > 0).reduce((a, i) => a + i.amount, 0);
    return { card: c, total: t, sum: Math.round(s * 100) / 100, ok: Math.abs(s - t) < 0.05 };
  });
  const kept = items.filter(i => !/DEB AUTOM/i.test(i.description));
  const net = Math.round(kept.reduce((a, i) => a + i.amount, 0) * 100) / 100;
  const ok = checks.length > 0 && checks.every(c => c.ok) && (totalPagar == null || Math.abs(net - totalPagar) < 1);
  return { items: kept.map(({ sec, ...r }) => r), checks, net, totalPagar, vencimento, ok };
}

// Month a card statement belongs to: the due-date month (due dates on days 1-5 count for the previous month).
export function faturaMonth(venc) {
  if (!venc) return null;
  const [d, m, y] = venc.split('/'); let mo = +m, yy = +y;
  if (+d <= 5) { mo -= 1; if (mo === 0) { mo = 12; yy -= 1; } }
  return `${yy}-${String(mo).padStart(2, '0')}`;
}

// Santander current-account statement (internet banking export).
export function parseExtratoSantander(lines) {
  const rows = []; let saldoIni = null, cur = null;
  const re = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{3,4})\s+(.+?)\s+(?:(\d{3,})\s+)?(-?[\d.]+,\d{2})\s+([DC])\s+(-?[\d.]+,\d{2})$/;
  for (const l of lines) {
    const si = l.match(/^Saldo anterior\s+(-?[\d.]+,\d{2})/); if (si) { if (saldoIni === null) saldoIni = num(si[1]); cur = null; continue; }
    const m = l.match(re);
    if (m) { cur = { day: m[1] + '/' + m[2], date: `${m[3]}-${m[2]}-${m[1]}`, ym: m[3] + '-' + m[2], hist: m[5].trim(), name: '', amount: num(m[7]), saldo: num(m[9]) }; rows.push(cur); continue; }
    if (cur && l && !/^(Página|Santander Data|EXTRATO DE CONTA|Conta \d|Data início|Produto|-{10}|Dt\. contábil|about:blank|\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2})/.test(l) && !cur.name) cur.name = l.trim();
    else if (/^(Página|-{10}|about:blank)/.test(l)) cur = null;
  }
  let prev = saldoIni, chain = true;
  for (const r of rows) { if (prev !== null && Math.abs(prev + r.amount - r.saldo) > 0.01) chain = false; prev = r.saldo; }
  const saldoFim = rows.length ? rows[rows.length - 1].saldo : saldoIni;
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const cnt = {}; rows.forEach(r => cnt[r.ym] = (cnt[r.ym] || 0) + 1);
  const month = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    rows: rows.map(r => ({ day: r.day, date: r.date, description: (r.hist + (r.name ? ' ' + r.name : '')).replace(/\s+/g, ' '), amount: r.amount })),
    saldoIni, saldoFim, sum: Math.round(sum * 100) / 100, month,
    ok: rows.length > 0 && chain && saldoIni !== null && Math.abs(saldoIni + sum - saldoFim) < 0.02,
  };
}

// Check rows that Claude extracted against the totals it also read from the document.
export function checkFatura(items, cards) {
  const checks = (cards || []).map(c => {
    const s = items.filter(i => String(i.card) === String(c.final) && i.amount > 0).reduce((a, i) => a + i.amount, 0);
    return { card: String(c.final), total: +c.valorTotal, sum: Math.round(s * 100) / 100, ok: Math.abs(s - c.valorTotal) < 0.05 };
  });
  return { checks, ok: checks.length > 0 && checks.every(c => c.ok) };
}
export function checkExtrato(rows, saldoIni, saldoFim) {
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  return saldoIni != null && saldoFim != null && Math.abs(+saldoIni + sum - +saldoFim) < 1;
}
