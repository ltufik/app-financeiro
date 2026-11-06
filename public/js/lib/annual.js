// "Gastos do ano": IPVA, IPTU, school and other payments that come back every year, and the months that usually
// carry an extra payment. The app finds them in the family's history (the family confirms), places them on the
// calendar by the state's or city's rules (when payment starts, how many installments, the discount for paying
// at once), says how much to set aside per month and suggests paying at once or in installments from the
// family's own situation. Pure module, tested in tests/lib.test.mjs.

// IPVA 2026 rules by state (sources: Secretarias da Fazenda via Agência SP, Terra, Exame, dez/2025-jan/2026).
// car/moto: rates; desc: discount for paying at once; start: month the payment starts (the discount is in it);
// parc: most installments. Missing values are asked to the family. Reviewed every year.
export const IPVA_RULES = {
  SP: { car: 0.04, moto: 0.02, desc: 0.03, start: 1, parc: 5 }, RJ: { car: 0.04, moto: 0.02, desc: 0.03, start: 1, parc: 3 },
  MG: { car: 0.04, desc: 0.03, start: 2, parc: 3 }, PR: { car: 0.019, moto: 0.019, desc: 0.06, start: 1, parc: 5 },
  SC: { start: 1, parc: 3 }, RS: { car: 0.03, moto: 0.02, desc: 0.03, start: 1 }, DF: { car: 0.03, moto: 0.02, desc: 0.10, start: 2, parc: 6 },
  ES: { car: 0.02, moto: 0.01, desc: 0.15, start: 4, parc: 6 }, BA: { car: 0.025, moto: 0.025, desc: 0.15, start: 2, parc: 5 },
  GO: { desc: 0.08, start: 1, parc: 10 }, PE: { desc: 0.07, start: 2, parc: 10 }, CE: { desc: 0.10, start: 1, parc: 5 },
  MS: { car: 0.03, moto: 0.02, desc: 0.15, start: 1, parc: 5 }, AM: { desc: 0.10, start: 1, parc: 3 }, AP: { desc: 0.20, start: 3, parc: 6 },
  MA: { desc: 0.10, start: 2, parc: 3 }, MT: { desc: 0.05, start: 3, parc: 8 }, PA: { desc: 0.05, start: 1, parc: 6 },
  PB: { car: 0.025, moto: 0.025, desc: 0.10, start: 3, parc: 3 }, PI: { car: 0.025, moto: 0.02, desc: 0.15, start: 1, parc: 3 },
  RN: { start: 3, parc: 7 }, RR: { desc: 0.10, start: 2, parc: 10 }, SE: { car: 0.025, moto: 0.02, desc: 0.10, start: 3, parc: 1 },
  AC: { desc: 0.10, parc: 5 }, RO: { desc: 0.05 }, TO: {}, AL: {},
};
export const UFS = Object.keys(IPVA_RULES).sort();
// IPTU depends on the city; São Paulo 2026 as the example the family can change: 3% at once, up to 10x, from February.
export const IPTU_SP = { desc: 0.03, start: 2, parc: 10 };
export const KINDS = { ipva: 'IPVA', licenciamento: 'Licenciamento', iptu: 'IPTU', escola: 'Escola (matrícula, material)', seguro: 'Seguro', outro: 'Outro' };

const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const r2 = v => Math.round(v * 100) / 100;
const cost = t => t.source === 'conta' ? -(+t.amount || 0) : +t.amount || 0;
const PAT = {
  ipva: /\bdetran\b|\bipva\b|sefaz|secretaria (da|de estado da) fazenda|\bdare\b|\bgare\b/,
  licenciamento: /licenciament|\bcrlv\b/,
  iptu: /\biptu\b|prefeitura|tributos? munic|\bpmsp\b/,
  escola: /matricula|material escolar|uniforme escolar/,
};
// Fines ("multa", in the text or in the person's note) and federal taxes are not the yearly vehicle/property tax.
export const kindOfTx = t => { const p = plain(`${t.description} ${t.note || ''}`); if (/ministerio da fazenda|receita federal|\bdas\b|simples nacional|\bmultas?\b|infracao|infracoes/.test(p)) return null; for (const k of ['licenciamento', 'ipva', 'iptu', 'escola']) if (PAT[k].test(p)) return k; return null; };
const payee = t => plain(t.description).replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

// Payments of the last 12 months that look like the year's taxes and school costs, grouped by who received them.
// Returns [{key, kind, name, months: ['AAAA-MM'], total, count, mode: 'avista'|'parcelado', start (month number)}].
export function detectAnnual(txs, today, skip = []) {
  const from = String(+today.slice(0, 4) - 1) + today.slice(4, 7), groups = new Map(), sk = new Set(skip);
  for (const t of txs) {
    if (!t.month || t.month < from || cost(t) <= 0) continue;
    const kind = kindOfTx(t); if (!kind) continue;
    // IPVA is one payment (or its installments) a year: each month of a state payee is looked at on its own,
    // and only a payment of R$ 400 or more counts (smaller ones are fees or fines).
    if (kind === 'ipva' && cost(t) < 400) continue;
    const k = kind + '|' + payee(t) + (kind === 'ipva' ? '|' + t.month : ''), g = groups.get(k) || { key: k, kind, name: t.description, rows: [] };
    g.rows.push(t); groups.set(k, g);
  }
  const out = [];
  for (const g of groups.values()) {
    if (sk.has(g.key)) continue;
    const months = [...new Set(g.rows.map(t => t.month))].sort(), total = r2(g.rows.reduce((a, t) => a + cost(t), 0));
    if (total < 100) continue;
    const kind = g.kind;
    out.push({ key: g.key, kind, name: g.name, months, total, count: g.rows.length, mode: months.length > 1 ? 'parcelado' : 'avista', parcelas: months.length, start: +months[0].slice(5), once: months.length === 1 && kind === 'iptu' && total >= 5000 });
  }
  return out.sort((a, b) => b.total - a.total);
}

// Months that usually carry an extra payment: in the last 12 months, a day-to-day category that weighed at least
// R$ 500 and 1.5 times its usual month. Returns [{category, month (number), extra}].
// Only categories that are seasonal by nature (school, gifts, trips): with one year of history the app cannot tell
// a month that repeats every year from a month that happened once.
const SEASONAL = /escola|educa|col[eé]gio|faculdade|curso|material|presente|natal|viage|f[eé]rias/i;
export function extraMonths(txs, idx, today) {
  const from = String(+today.slice(0, 4) - 1) + today.slice(4, 7), by = {};
  for (const t of txs) { if (!t.month || t.month < from) continue; const c = idx.get(t.category); if (!c || c.grp !== 'dia' || !SEASONAL.test(t.category)) continue; const v = cost(t); (by[t.category] ||= {})[t.month] = ((by[t.category] || {})[t.month] || 0) + v; }
  const out = [];
  for (const [cat, ms] of Object.entries(by)) {
    const vals = Object.values(ms).sort((a, b) => a - b); if (vals.length < 4) continue;
    const med = vals[Math.floor(vals.length / 2)];
    for (const [k, v] of Object.entries(ms)) if (v - med >= 500 && v >= med * 1.5) out.push({ category: cat, month: +k.slice(5), extra: r2(v - med) });
  }
  return out.sort((a, b) => b.extra - a.extra);
}

// The next value of an item: what was paid in the last year (IPVA: the vehicle's value can go up or down; in SP 2026
// it went up 2.51%), with a range. A value the family typed wins.
export function nextValue(item) {
  const base = +item.value || +item.lastPaid || 0;
  return { value: r2(base), low: r2(base * (item.typed ? 1 : 0.95)), high: r2(base * (item.typed ? 1 : 1.05)) };
}
// IPVA paid and the state's rate tell the vehicle's value in the state's table (FIPE).
export const fipeFromIpva = (ipva, uf, tipo = 'car', desc = 0) => { const a = IPVA_RULES[uf]?.[tipo]; return a ? r2(ipva / (1 - desc) / a) : null; };

// Payments of the next `ahead` months (1 = next month): items by their mode, and the usual extra months.
// items: [{name, kind, value, mode, parcelas, start, desc}]. Returns [{month: 'AAAA-MM', total, rows: [{name, value}]}].
export function calendar(items, extras, today, ahead = 6) {
  const cur = today.slice(0, 7), add = (k, n) => { const [y, m] = k.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const months = Array.from({ length: ahead }, (_, i) => ({ month: add(cur, i + 1), total: 0, rows: [] }));
  const put = (mNum, name, v, kind) => { for (const x of months) if (+x.month.slice(5) === mNum) { x.rows.push({ name, value: r2(v), kind }); x.total = r2(x.total + v); return; } };
  for (const it of items) {
    const v = nextValue(it).value, start = +it.start || 1;
    if (!v) continue;
    if (it.mode === 'parcelado' && +it.parcelas > 1) for (let p = 0; p < +it.parcelas; p++) put(((start - 1 + p) % 12) + 1, `${it.name} (${p + 1}/${it.parcelas})`, v / it.parcelas, it.kind);
    else put(start, it.name, v * (1 - (+it.desc || 0)), it.kind);
  }
  for (const e of extras || []) put(e.month, `${e.category} (mais que o normal)`, e.extra, 'extra');
  return months;
}
// How much to set aside per month, from now, to have each month's payments in hand when they come.
export function setAside(cal) { let acc = 0, need = 0; cal.forEach((m, i) => { acc += m.total; need = Math.max(need, acc / (i + 1)); }); return Math.ceil(need / 10) * 10; }

// At once or in installments, from the family's situation. f: {invest, reserve (3 months of fixed costs),
// avgLeft (average monthly leftover), redMonths (of the last 6), interest (card interest lately), ret (yearly return)}.
export function payAdvice(item, f) {
  const v = nextValue(item).value, d = +item.desc || 0, n = Math.max(1, +item.parcelas || 1), monthsTo = Math.max(1, +item.monthsTo || 1);
  const atOnce = v * (1 - d), rm = Math.pow(1 + (+f.ret || 0.1), 1 / 12) - 1, keep = v * rm * (n - 1) / 2; // what the money earns while paying in installments
  if (!d || n === 1) return { pick: n > 1 ? 'parcelado' : 'avista', why: d ? 'Só há pagamento à vista.' : 'Sem desconto à vista: parcelar deixa o dinheiro rendendo por mais tempo.' };
  if (f.interest > 0 || f.redMonths >= 2) return { pick: 'parcelado', why: `Parcelem em ${n}x sem juros. ${f.interest > 0 ? 'Teve juros na fatura' : `Teve ${f.redMonths} meses no vermelho`}: tirar ${R(atOnce)} de uma vez pode levar ao cartão ou ao cheque especial, que custam muito mais que o desconto de ${P(d)}.` };
  if (f.invest - atOnce >= f.reserve) return d * v > keep ? { pick: 'avista', why: `Paguem à vista com o dinheiro aplicado: o desconto de ${P(d)} (${R(v * d)}) vale mais que os ${R(keep)} que ele renderia até a última parcela, e a reserva de emergência continua de pé.` } : { pick: 'parcelado', why: `Parcelem: o dinheiro aplicado rende ${R(keep)} até a última parcela, mais que o desconto de ${R(v * d)}.` };
  if (f.avgLeft * monthsTo >= atOnce) return { pick: 'avista', why: `Separem ${R(Math.ceil(atOnce / monthsTo / 10) * 10)} por mês até lá e paguem à vista com ${P(d)} de desconto (${R(v * d)}). A sobra média de vocês (${R(f.avgLeft)} por mês) dá conta.` };
  if (f.invest > 0) return { pick: 'parcelado', why: `Parcelem em ${n}x: pagar à vista deixaria a reserva de emergência abaixo de 3 meses das despesas fixas.` };
  return { pick: 'parcelado', why: `Parcelem em ${n}x sem juros: a sobra dos próximos meses não cobre ${R(atOnce)} de uma vez.` };
}
const R = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR'), P = v => Math.round(v * 100) + '%';

// Paid this year: the payments of the same kind and payee in the current calendar year (IPVA: R$ 400 or more).
// With more than one IPVA in the list, an item with no payment tied to it (the scooter suggested from Patrimônio)
// counts nothing: the payments could be of the other vehicle, and saying "paid" without knowing is worse than not
// saying. The smallest IPVA counted follows the expected value, so a cheap motorcycle IPVA still counts.
export function paidThisYear(item, txs, today, items = []) {
  const y = today.slice(0, 4), who = item.from ? payee({ description: item.from }) : null;
  if (!who && item.kind === 'ipva' && (items || []).some(o => o !== item && o.kind === 'ipva')) return { total: 0, months: [] };
  const taken = new Set();
  const exp = +(item.fromAsset?.atOnce || item.value || 0), min = item.kind === 'ipva' ? Math.min(400, exp > 0 ? exp * 0.5 : 400) : 0;
  const rows = txs.filter(t => String(t.month || '').startsWith(y + '-') && cost(t) > 0 && kindOfTx(t) === item.kind && (!who || payee(t) === who) && !taken.has(payee(t)) && !(cost(t) < min));
  return { total: r2(rows.reduce((a, t) => a + cost(t), 0)), months: [...new Set(rows.map(t => t.month))].sort() };
}

// Properties from Patrimônio: what kind (property, car, motorcycle) and where they are registered decide the tax.
export const ASSET_TYPES = [['imovel', 'Imóvel'], ['carro', 'Carro'], ['moto', 'Moto'], ['outro', 'Outro']];
export function guessAssetType(name) {
  const p = plain(name);
  if (/\b(casa|apartamento|apto|ap|terreno|sala|imovel|sitio|chacara|loja|kitnet|cobertura)\b/.test(p)) return 'imovel';
  if (/\b(moto|motocicleta|scooter|biz|cg|titan|fan|pcx|lead|nmax|xre|bros)\b/.test(p)) return 'moto';
  if (/\b(carro|civic|corolla|gol|onix|hb20|compass|renegade|hilux|polo|t-cross|tcross|creta|kicks|tracker|hr-v|hrv|fit|city|sandero|kwid|argo|mobi|toro|strada|ranger|s10|byd|dolphin|jeep|toyota|hyundai|fiat|chevrolet|volkswagen|vw|ford|renault|nissan|bmw|audi|mercedes|volvo|peugeot|citroen|kia|mitsubishi|suv|sedan|picape|caminhonete)\b/.test(p)) return 'carro';
  return 'outro';
}
export const isVehicle = a => ['carro', 'moto'].includes(a?.tipo || guessAssetType(a?.name));
// IPVA of a vehicle from its value and the rate of its state: a year, at once (with the state's discount), each installment.
export function ipvaOf(asset) {
  const r = IPVA_RULES[asset?.uf] || {}, rate = (a => a === 'moto' ? r.moto : r.car)(asset?.tipo || guessAssetType(asset?.name));
  if (!rate || !(+asset?.value > 0)) return null;
  const base = r2(+asset.value * rate);
  return { base, rate, desc: r.desc || 0, atOnce: r2(base * (1 - (r.desc || 0))), parc: r.parc || 1, start: r.start || 1 };
}
// Items as they count today: an IPVA linked to a vehicle of Patrimônio takes its value, state and rules from it.
export function effectiveItems(items, assets) {
  return (items || []).map(it => {
    const a = it.assetName ? (assets || []).find(x => x.name === it.assetName) : null;
    if (it.kind !== 'ipva' || !a) return { ...it, asset: a || null, gone: !!it.assetName && !a };
    const q = ipvaOf(a); if (!q) return { ...it, asset: a, uf: a.uf || it.uf };
    return { ...it, asset: a, uf: a.uf, tipo: a.tipo || guessAssetType(a.name), value: q.base, desc: q.desc, start: q.start, maxParc: q.parc, parcelas: it.mode === 'parcelado' ? Math.min(it.parcelas || q.parc, q.parc) : q.parc, typed: true, fromAsset: q };
  });
}
// Vehicles of Patrimônio without an IPVA item: "IPVA do Honda Civic (ES): R$ 2.780 por ano".
export function vehicleSuggestions(items, assets, skip = []) {
  const has = new Set((items || []).map(i => i.assetName).filter(Boolean)), sk = new Set(skip);
  return (assets || []).filter(a => isVehicle(a) && a.uf && !has.has(a.name) && !sk.has('veic|' + a.name)).map(a => ({ key: 'veic|' + a.name, asset: a, q: ipvaOf(a) })).filter(x => x.q);
}
