// Custom charts: turn a saved chart definition into data, and data into SVG.
// Pure functions (no DOM), tested in tests/lib.test.mjs.

export const TYPES = { pizza: 'Pizza', barra: 'Barras', linha: 'Linha' };
export const METRICS = {
  categorias: 'Despesas por categoria',
  escolhidas: 'Categorias que eu escolher',
  sobra: 'Sobra do mês',
  rendaGastos: 'Receitas e despesas',
  cartao: 'Fatura do cartão',
  taxa: 'Taxa de poupança',
};
// Metrics that are a breakdown (fit a pizza). The others are values month by month.
export const BREAKDOWN = new Set(['categorias', 'escolhidas']);
export const PERIODS = { mes: 'Mês escolhido no topo', m3: 'Últimos 3 meses', m6: 'Últimos 6 meses', m12: 'Últimos 12 meses', ano: 'Um ano', faixa: 'De um mês até outro' };

// Months of the period, in order. `all` = sorted month keys with data, `anchor` = month picked in the header.
export function periodMonths(p = {}, all = [], anchor) {
  const ks = [...all].sort(); if (!ks.length) return [];
  const a = anchor && ks.includes(anchor) ? anchor : ks[ks.length - 1];
  const upto = ks.filter(k => k <= a);
  switch (p.kind) {
    case 'mes': return [a];
    case 'm3': return upto.slice(-3);
    case 'm6': return upto.slice(-6);
    case 'm12': return upto.slice(-12);
    case 'ano': { const y = String(p.year || a.slice(0, 4)); return ks.filter(k => k.startsWith(y + '-')); }
    case 'faixa': { const f = p.from || ks[0], t = p.to || ks[ks.length - 1]; const [lo, hi] = f <= t ? [f, t] : [t, f]; return ks.filter(k => k >= lo && k <= hi); }
    default: return upto.slice(-6);
  }
}

// Check a definition before saving. Returns '' when fine, or a message in Portuguese.
export function checkChart(c = {}) {
  if (!c.title || c.title.trim().length < 2) return 'Dê um nome ao gráfico (pelo menos 2 letras).';
  if (c.title.trim().length > 60) return 'O nome do gráfico pode ter no máximo 60 letras.';
  if (!TYPES[c.type]) return 'Escolha o tipo de gráfico.';
  if (!METRICS[c.metric]) return 'Escolha o que mostrar.';
  if (c.type === 'pizza' && !BREAKDOWN.has(c.metric)) return 'Pizza mostra como um total se divide. Escolha "Despesas por categoria" ou "Categorias que eu escolher", ou troque para barras ou linha.';
  if (c.metric === 'escolhidas' && !(c.cats || []).length) return 'Marque pelo menos uma categoria.';
  if (c.metric === 'escolhidas' && c.cats.length > 8) return 'Escolha no máximo 8 categorias para o gráfico ficar legível.';
  if (!PERIODS[c.period?.kind]) return 'Escolha o período.';
  if (c.period.kind === 'faixa' && (!/^\d{4}-\d{2}$/.test(c.period.from || '') || !/^\d{4}-\d{2}$/.test(c.period.to || ''))) return 'Informe o mês inicial e o final.';
  if (c.period.kind === 'faixa' && c.period.from > c.period.to) return 'O mês inicial precisa ser antes do final.';
  return '';
}

// Build what to draw. src: { months:[...], calc(k) -> monthCalc result, cats(k) -> {category: spent} }.
// Returns { kind: 'pie'|'hbar'|'bars'|'lines', unit: 'brl'|'pct', labels, series:[{name, values}] } or { empty: msg }.
export function buildChart(c, src) {
  const ms = src.months;
  if (!ms.length) return { empty: 'Não há meses com dados nesse período.' };
  const totals = () => {
    const t = {}; for (const k of ms) { const m = src.cats(k); for (const x in m) t[x] = (t[x] || 0) + m[x]; }
    return Object.entries(t).filter(e => e[1] > 0.005).sort((a, b) => b[1] - a[1]);
  };
  if (BREAKDOWN.has(c.metric) && (c.type !== 'linha' || ms.length === 1) && !(c.type === 'barra' && c.metric === 'escolhidas' && ms.length > 1)) {
    let rows = totals();
    if (c.metric === 'escolhidas') { const want = new Set(c.cats); rows = rows.filter(r => want.has(r[0])); }
    else if (rows.length > 8) { const rest = rows.slice(7).reduce((a, r) => a + r[1], 0); rows = [...rows.slice(0, 7), ['Outras', rest]]; }
    if (!rows.length) return { empty: c.metric === 'escolhidas' ? 'Essas categorias não tiveram gastos no período.' : 'Não houve despesas no período.' };
    return { kind: c.type === 'pizza' ? 'pie' : 'hbar', unit: 'brl', labels: rows.map(r => r[0]), series: [{ name: 'Gasto', values: rows.map(r => round(r[1])) }] };
  }
  const kind = c.type === 'linha' ? 'lines' : 'bars';
  if (BREAKDOWN.has(c.metric)) {
    const names = c.metric === 'escolhidas' ? c.cats : totals().slice(0, 5).map(r => r[0]);
    if (!names.length) return { empty: 'Não houve despesas no período.' };
    return { kind, unit: 'brl', labels: ms, series: names.map(n => ({ name: n, values: ms.map(k => round(src.cats(k)[n] || 0)) })) };
  }
  const C = ms.map(k => src.calc(k));
  const S = {
    sobra: [{ name: 'Sobra', values: C.map(x => x.res) }],
    rendaGastos: [{ name: 'Receitas', values: C.map(x => x.E) }, { name: 'Despesas', values: C.map(x => x.out) }],
    cartao: [{ name: 'Fatura', values: C.map(x => x.cardTotal) }],
    taxa: [{ name: 'Poupança', values: C.map(x => x.tx) }],
  }[c.metric];
  return { kind, unit: c.metric === 'taxa' ? 'pct' : 'brl', labels: ms, series: S.map(s => ({ ...s, values: s.values.map(c.metric === 'taxa' ? (v => Math.round(v * 1000) / 1000) : round) })) };
}
const round = v => Math.round(v * 100) / 100;

// ---------- SVG ----------
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mLabel = k => /^\d{4}-\d{2}$/.test(k) ? `${MES[+k.slice(5) - 1]}/${k.slice(2, 4)}` : k;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const fmtVal = (v, unit, short) => unit === 'pct' ? `${(v * 100).toFixed(0)}%`
  : short ? (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v).toLocaleString('pt-BR')}`)
  : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const col = i => `var(--c${(i % 8) + 1})`;
const niceMax = v => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

export function legendHTML(d) {
  if (d.kind === 'pie' || d.kind === 'hbar') {
    const tot = d.series[0].values.reduce((a, b) => a + b, 0) || 1;
    return `<ul class="ch-legend">${d.labels.map((l, i) => `<li><span class="sw" style="background:${d.kind === 'pie' ? col(i) : col(0)}"></span><span class="ln">${esc(l)}</span><span class="lv">${fmtVal(d.series[0].values[i], d.unit)} · ${Math.round(d.series[0].values[i] / tot * 100)}%</span></li>`).join('')}</ul>`;
  }
  if (d.series.length < 2) return '';
  return `<ul class="ch-legend row">${d.series.map((s, i) => `<li><span class="sw" style="background:${col(i)}"></span><span class="ln">${esc(s.name)}</span></li>`).join('')}</ul>`;
}

export function chartSVG(d, { title = '' } = {}) {
  if (d.kind === 'pie') return pie(d, title);
  if (d.kind === 'hbar') return hbar(d, title);
  return xy(d, title);
}

function pie(d, title) {
  const v = d.series[0].values, tot = v.reduce((a, b) => a + b, 0) || 1, R = 90, r = 54, cx = 110, cy = 110;
  let a0 = -Math.PI / 2;
  const arcs = v.map((x, i) => {
    const a1 = a0 + (x / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
    const path = v.length === 1 ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
      : `M ${p(R, a0)} A ${R} ${R} 0 ${big} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${big} 0 ${p(r, a0)} Z`;
    a0 = a1;
    return `<path d="${path}" fill="${col(i)}" stroke="var(--card)" stroke-width="2" fill-rule="evenodd"><title>${esc(d.labels[i])}: ${fmtVal(x, d.unit)}</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 220 220" class="ch ch-pie" role="img" aria-label="${esc(title)}">${arcs}
    <text x="110" y="104" text-anchor="middle" class="ch-t">Total</text><text x="110" y="126" text-anchor="middle" class="ch-big">${fmtVal(tot, d.unit, true)}</text></svg>`;
}

function hbar(d, title) {
  const v = d.series[0].values, mx = niceMax(Math.max(...v)), rowH = 30, W = 340, L = 0, top = 4, H = top + v.length * rowH;
  return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(title)}">${v.map((x, i) => {
    const y = top + i * rowH, w = Math.max(2, (x / mx) * (W - 120));
    return `<text x="${L}" y="${y + 11}" class="ch-t">${esc(d.labels[i]).slice(0, 28)}</text>
      <rect x="${L}" y="${y + 15}" width="${w.toFixed(1)}" height="9" rx="4" fill="${col(0)}"><title>${esc(d.labels[i])}: ${fmtVal(x, d.unit)}</title></rect>
      <text x="${(L + w + 6).toFixed(1)}" y="${y + 23}" class="ch-t ch-v">${fmtVal(x, d.unit, true)}</text>`;
  }).join('')}</svg>`;
}

function xy(d, title) {
  const W = 340, H = 210, l = 52, r = 8, t = 10, b = 26, n = d.labels.length;
  const all = d.series.flatMap(s => s.values), hi = Math.max(0, ...all), lo = Math.min(0, ...all);
  const top = niceMax(hi), bot = lo < 0 ? -niceMax(-lo) : 0, span = top - bot || 1;
  const Y = v => t + (H - t - b) * (1 - (v - bot) / span);
  const ticks = [bot, bot + span / 4, bot + span / 2, bot + span * 3 / 4, top];
  const step = (W - l - r) / n;
  const X = i => l + step * (i + 0.5);
  const grid = ticks.map(v => `<line x1="${l}" x2="${W - r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="ch-grid${v === 0 ? ' zero' : ''}"/><text x="${l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="ch-t">${fmtVal(v, d.unit, true)}</text>`).join('');
  const every = Math.ceil(n / 6);
  const xl = d.labels.map((k, i) => i % every ? '' : `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ch-t">${esc(mLabel(k))}</text>`).join('');
  let marks = '';
  if (d.kind === 'bars') {
    const m = d.series.length, bw = Math.min(28, (step * 0.72) / m);
    marks = d.series.map((s, si) => s.values.map((v, i) => {
      const x = X(i) - (bw * m) / 2 + si * bw, y0 = Y(0), y1 = Y(v);
      return `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="3" fill="${v < 0 ? 'var(--coral)' : col(si)}"><title>${esc(s.name)} · ${esc(mLabel(d.labels[i]))}: ${fmtVal(v, d.unit)}</title></rect>`;
    }).join('')).join('');
  } else {
    marks = d.series.map((s, si) => `<polyline fill="none" stroke="${col(si)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>` +
      s.values.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="${col(si)}" stroke="var(--card)" stroke-width="1.5"><title>${esc(s.name)} · ${esc(mLabel(d.labels[i]))}: ${fmtVal(v, d.unit)}</title></circle>`).join('')).join('');
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(title)}">${grid}${marks}${xl}</svg>`;
}
