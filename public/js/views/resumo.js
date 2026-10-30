import { S, goals, monthKeys, calcMonth, calcMonths, txsOf, manualOf, nextFatura, patrimonio, presets, projectFor, needPmtFor, hasFinancing } from '../state.js';
import { insights } from '../lib/insights.js';
import { expandSplits } from '../lib/calc.js';
import { todayISO } from '../lib/format.js';
import { byCategory } from '../lib/calc.js';
import { brl, brl0, pct, esc, mLong, mShort } from '../lib/format.js';
import { meter, pill } from '../ui.js';
import { renderSteps } from '../steps.js';

let goalPreset = 0;
const first = () => (S.user?.user_metadata?.display_name || '').split(' ')[0] || 'você';

export function render(el) {
  const ks = monthKeys(), G = goals();
  if (!ks.length) {
    el.innerHTML = `<div class="panel hero"><h2>Boas-vindas, ${esc(first())}!</h2><p class="muted" style="margin-top:6px">O resumo do mês aparece aqui assim que vocês mandarem o primeiro PDF ou lançarem o primeiro gasto. Siga os passos abaixo, um de cada vez.</p></div><div class="panel" id="stepsBox"></div><div id="insights"></div>`;
    renderInsights(el.querySelector('#insights'));
    renderSteps(el.querySelector('#stepsBox'));
    return;
  }
  const yr = S.m.startsWith('ano:'), list = yr ? ks.filter(k => k.startsWith(S.m.slice(4))) : [S.m];
  const a = calcMonths(list), n = list.length, fin = hasFinancing();
  const nMan = list.reduce((s, k) => s + manualOf(k).length, 0);
  const nf = nextFatura();
  const cats = {}; list.forEach(k => { const c = byCategory(txsOf(k), S.catIdx); for (const x in c) cats[x] = (cats[x] || 0) + c[x]; });
  const top = Object.entries(cats).filter(e => e[1] > 0).sort((x, y) => y[1] - x[1]), mx = top[0]?.[1] || 1;
  const P0 = patrimonio(), pr = presets();
  if (goalPreset >= pr.length) goalPreset = 0;

  el.innerHTML = `<p class="hello">Olá, ${esc(first())}.</p>
  <div class="panel hero">
    <p class="muted small">Sobra ${yr ? 'em ' + S.m.slice(4) + ' até agora' : 'em ' + mLong(S.m)}</p>
    <div class="big num" style="color:${a.res < 0 ? 'var(--bad)' : 'var(--ink)'}">${brl(a.res)}</div>
    <div class="chips" style="margin-top:10px">${pill('Poupança', a.tx, G.savings)}${fin ? pill('Sem o financiamento', a.tx2, G.savingsNoFin) : ''}${nMan ? `<span class="pill at">inclui ${nMan} lançamento${nMan > 1 ? 's' : ''} manual${nMan > 1 ? 'is' : ''}</span>` : ''}</div>
    <div class="row" style="margin-top:14px">${[['Receitas', a.E], ['Despesas', a.out], ['Extras (fora da sobra)', a.EX - a.DX]].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${brl0(v)}</span></div>`).join('')}</div>
  </div>
  <div id="insights" class="insights"></div>
  <div class="panel" id="stepsBox" hidden></div>
  <div class="grid2">
    <div class="panel">
      <h3>Cartão</h3>
      <p class="muted small">${yr ? 'Média por fatura' : 'Fatura de ' + mLong(S.m)}${G.cardMonthly ? ' · meta ' + brl0(G.cardMonthly) : ''}</p>
      <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(a.cardTotal / n)}</div>
      ${meter(a.cardTotal / n, G.cardMonthly, 0)}
      <p class="tiny muted" style="margin-top:6px">Entra na sobra: ${brl0(a.card / n)}. O resto são despesas extras ou o que não conta.</p>
    </div>
    <div class="panel">
      <h3>Próxima fatura</h3>
      ${nf ? `<p class="muted small">${mLong(nf.month)}: parcelas já contratadas + recorrentes${nf.manuais ? ' + lançados' : ''}</p>
      <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(nf.total)}</div>
      ${meter(nf.total, G.cardMonthly, 0)}
      <p class="tiny muted" style="margin-top:6px">Parcelas ${brl0(nf.parcelas)} · recorrentes ${brl0(nf.recorrentes)}${nf.manuais ? ' · lançados ' + brl0(nf.manuais) : ''}${G.cardMonthly ? '. Espaço até a meta: ' + brl0(G.cardMonthly - nf.total) : ''}.</p>` : '<p class="muted small">Aparece quando houver uma fatura importada.</p>'}
    </div>
  </div>
  <div class="panel">
    <h3>Taxa de poupança mês a mês</h3>
    <p class="muted small">Sobra ÷ receitas fixas.${fin ? ' Barras vazadas: sem o financiamento.' : ''}</p>
    <svg class="chart" viewBox="0 0 700 220" role="img" aria-label="Taxa de poupança por mês">${chart(ks, G, fin)}</svg>
  </div>
  <div class="panel">
    <h3>Para onde foi o dinheiro${yr ? ' no período' : ''}</h3>
    <p class="muted small">Despesas por categoria, conta e cartão juntos.</p>
    <div style="margin-top:6px">${top.slice(0, 12).map(([c, v]) => `<div class="catbar"><span class="small">${esc(c)}</span><span class="small" style="font-weight:600">${brl0(v)}</span><span class="b"><span style="width:${v / mx * 100}%"></span></span></div>`).join('') || '<p class="small muted">Sem gastos ainda.</p>'}
    ${top.length > 12 ? `<p class="tiny muted" style="margin-top:6px">Outras ${top.length - 12} categorias somam ${brl0(top.slice(12).reduce((s, e) => s + e[1], 0))}.</p>` : ''}</div>
  </div>
  <div class="grid2">
    <div class="panel">
      <h3>Patrimônio</h3>
      ${P0.rows.length ? `<div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(P0.total)}</div><ul class="list small">${P0.rows.map(r => `<li><span>${esc(r.name)}<br><span class="tiny muted">${esc(r.note)}</span></span><span class="amt">${brl0(r.value)}</span></li>`).join('')}</ul>` : '<p class="small muted">Cadastre investimentos, imóveis e veículos no menu ☰, em Patrimônio e dívidas.</p>'}
    </div>
    <div class="panel" id="goalBox"></div>
  </div>`;
  renderGoal(el.querySelector('#goalBox'), G, pr);
  renderSteps(el.querySelector('#stepsBox'));
  renderInsights(el.querySelector('#insights'));
}

// Home insights: what happened this month and what to do about it.
const ICON = { good: '<path d="M5 12l5 5 9-10"/>', warn: '<path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/>', bad: '<path d="M12 5v10M7 10l5 5 5-5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' };
function renderInsights(box) {
  const G = goals(), idx = S.catIdx;
  const list = insights({
    today: todayISO(), months: monthKeys(), calc: calcMonth,
    cats: k => byCategory(txsOf(k), idx),
    fixed: k => expandSplits(txsOf(k)).reduce((a, t) => { const c = idx.get(t.category); return c && c.grp === 'dia' && c.recurring ? a + (t.source === 'conta' ? -t.amount : +t.amount) : a; }, 0),
    has: (k, src) => S.txs.some(t => t.month === k && t.source === src && !t.manual),
    manualCount: k => S.txs.filter(t => t.month === k && t.manual).length,
    pending: k => S.txs.filter(t => t.month === k && (t.pending || !t.category || t.category === 'A classificar')).length,
    goals: G, nextFatura: nextFatura(),
    etaYears: pmt => { if (!(pmt > 0) || !G.patrimonio) return null; const pts = projectFor(pmt, 0, { years: 40 }); const i = pts.findIndex(v => v >= G.patrimonio); return i < 0 ? null : i; },
  }).slice(0, 4);
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = list.map(x => `<article class="insight ${x.tone}"><span class="ii" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${ICON[x.tone]}</svg></span>
    <div><h3>${esc(x.title)}</h3><p class="small">${esc(x.text)}</p>${x.action ? `<button class="linkbtn small" type="button" data-go='${esc(JSON.stringify(x.action.go))}'>${esc(x.action.label)} →</button>` : ''}</div></article>`).join('');
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const g = JSON.parse(b.dataset.go); S.go(g[0], g[1], g[2]); });
}

function renderGoal(box, G, pr) {
  if (!G.patrimonio) { box.innerHTML = '<h3>Meta de patrimônio</h3><p class="small muted">Defina no menu ☰, em Metas, quanto quer ter investido e com que idade para ver a projeção.</p>'; return; }
  const p = pr[goalPreset], pts = projectFor(p[1], p[2]), end = pts[pts.length - 1];
  const need = Math.ceil(needPmtFor(p[2], G.patrimonio) / 50) * 50;
  box.innerHTML = `<h3>Meta de ${brl0(G.patrimonio)}${G.ageGoal ? ' aos ' + G.ageGoal : ''}</h3>
    <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(end)}</div>
    <p class="small muted">${esc(p[0])}: aporte de ${brl0(p[1])}/mês${p[2] ? ' + ' + brl0(p[2]) + '/ano' : ''}, retorno de ${pct(G.ret ?? 0.05)} ao ano acima da inflação. ${end >= G.patrimonio ? 'Passa da meta.' : 'Para chegar lá, o aporte mensal precisa ser de ' + brl0(need) + '.'}</p>
    <div class="chips" style="margin-top:10px">${pr.map((x, i) => `<button class="chip" type="button" aria-pressed="${i === goalPreset}" data-i="${i}">${esc(x[0])}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { goalPreset = +b.dataset.i; renderGoal(box, G, pr); });
}

function chart(ks, G, fin) {
  const W = 700, H = 220, L = 40, B = 26, T = 14, mx = 0.5, mn = -0.2;
  const y = v => T + (mx - Math.max(mn, Math.min(mx, v))) / (mx - mn) * (H - B - T);
  const shown = ks.slice(-12), n = shown.length, bw = (W - L - 8) / n * (fin ? 0.32 : 0.5);
  let s = '';
  [-0.2, 0, 0.2, 0.4].forEach(t => s += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" ${t === 0 ? 'stroke-width="2"' : ''}/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${pct(t)}</text>`);
  [[G.savings], fin ? [G.savingsNoFin] : null].filter(Boolean).forEach(([v]) => { if (v) s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--warn)" stroke-dasharray="5 4"/><text x="${W - 2}" y="${y(v) - 4}" text-anchor="end" style="fill:var(--warn)">${pct(v)}</text>`; });
  shown.forEach((k, i) => {
    const r = calcMonth(k), x = L + (i + 0.17) * (W - L - 8) / n, sel = k === S.m;
    s += `<rect x="${x}" y="${Math.min(y(r.tx), y(0))}" width="${bw}" height="${Math.max(1, Math.abs(y(r.tx) - y(0)))}" rx="3" fill="${r.tx < 0 ? 'var(--bad)' : sel ? 'var(--ink)' : 'var(--accent)'}"><title>${mLong(k)}: ${pct(r.tx)}</title></rect>`;
    if (fin) s += `<rect x="${x + bw + 2}" y="${Math.min(y(r.tx2), y(0))}" width="${bw}" height="${Math.max(1, Math.abs(y(r.tx2) - y(0)))}" rx="3" fill="none" stroke="${sel ? 'var(--ink)' : 'var(--accent)'}" stroke-width="1.5"><title>sem o financiamento: ${pct(r.tx2)}</title></rect>`;
    const cx = x + (fin ? bw : bw / 2);
    s += `<text x="${cx}" y="${Math.min(y(r.tx), fin ? y(r.tx2) : y(r.tx), y(0)) - 5}" text-anchor="middle" style="${sel ? 'fill:var(--ink);font-weight:700' : ''}">${pct(r.tx)}</text><text x="${cx}" y="${H - 8}" text-anchor="middle" style="${sel ? 'fill:var(--ink);font-weight:700' : ''}">${mShort(k)}</text>`;
  });
  return s;
}
