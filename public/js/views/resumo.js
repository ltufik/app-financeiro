import { S, goals, monthKeys, calcMonth, calcMonths, txsOf, manualOf, nextFatura, patrimonio, presets, projectFor, needPmtFor, hasFinancing } from '../state.js';
import { insights } from '../lib/insights.js';
import { monthToClose } from '../lib/closing.js';
import { budgetStatus, budgetsOf } from '../lib/budget.js';
import { findRecurring } from '../lib/recurring.js';
import { settle } from '../lib/settle.js';
import { settings } from '../state.js';
import { expandSplits } from '../lib/calc.js';
import { todayISO } from '../lib/format.js';
import { byCategory } from '../lib/calc.js';
import { brl, brl0, pct, esc, mLong, mShort } from '../lib/format.js';
import { meter, pill } from '../ui.js';
import { renderSteps } from '../steps.js';
import { demoSummary, DEMO_FAMILY, DEMO_MONTH } from '../lib/demo.js';
import { track } from '../usage.js';

let goalPreset = 0, showAllInsights = false;
const moreOpen = () => { try { return localStorage.getItem('fin.home.more') === '1'; } catch (e) { return false; } };
const first = () => (S.user?.user_metadata?.display_name || '').split(' ')[0] || 'você';

// While the family has no data: a fictional month, with the same math as the real summary.
function demoCard() {
  const d = demoSummary(), mx = d.top[0]?.v || 1;
  return `<div class="panel demo" id="demoCard">
    <div class="demo-tag">Exemplo · ${DEMO_FAMILY} (fictícia) · ${DEMO_MONTH}</div>
    <p class="muted small">Sobra do mês</p><div class="big num">${brl0(d.res)}</div>
    <div class="chips" style="margin-top:8px"><span class="pill ok">Guardaram ${pct(d.tx)} do que ganharam</span></div>
    <h3 style="margin-top:14px">Para onde foi o dinheiro</h3>
    <div style="margin-top:6px">${d.top.map(x => `<div class="catbar"><span class="small">${esc(x.cat)}</span><span class="small" style="font-weight:600">${brl0(x.v)}</span><span class="b"><span style="width:${x.v / mx * 100}%"></span></span></div>`).join('')}</div>
    <h3 style="margin-top:14px">O que o app percebeu</h3>
    <ul class="small" style="margin:6px 0 0">${d.findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="small" style="margin-top:14px;font-weight:600">Agora com os números de vocês:</p>
    <div class="rowbtn"><button class="btn primary" type="button" id="demoPdf">Enviar a última fatura</button><button class="btn" type="button" id="demoFalar">Lançar um gasto falando</button></div>
    <p class="tiny muted">A fatura em PDF, foto ou print, de qualquer banco. Leva 2 minutos.</p>
  </div>`;
}

export function render(el) {
  const ks = monthKeys(), G = goals();
  if (!ks.length) {
    el.innerHTML = `<div class="panel hero"><h2>Boas-vindas, ${esc(first())}!</h2><p class="muted" style="margin-top:6px">O resumo do mês aparece aqui assim que vocês mandarem o primeiro PDF ou lançarem o primeiro gasto. Veja abaixo como fica, com uma família de exemplo.</p></div>${demoCard()}<div class="panel" id="stepsBox"></div><div id="insights"></div>`;
    el.querySelector('#demoPdf').onclick = () => { track('exemplo.fatura'); S.go('lancar'); import('./lancar.js').then(m => m.openMode('pdf', true)); };
    el.querySelector('#demoFalar').onclick = () => { track('exemplo.falar'); S.go('lancar'); import('./lancar.js').then(m => m.openMode('falar', true)); };
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
    <div class="chips" style="margin-top:10px">${pill('Guardaram', a.tx, G.savings)}${fin ? pill('Sem contar o financiamento', a.tx2, G.savingsNoFin) : ''}${nMan ? `<span class="pill at">inclui ${nMan} lançamento${nMan > 1 ? 's' : ''} manual${nMan > 1 ? 'is' : ''}</span>` : ''}</div>
    <div class="row" style="margin-top:14px">${[['Receitas', a.E], ['Despesas', a.out], ['Extras (fora da sobra)', a.EX - a.DX]].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${brl0(v)}</span></div>`).join('')}</div>
  </div>
  <div id="closeCard"></div>
  <div id="insights" class="insights"></div>
  <div class="panel" id="stepsBox" hidden></div>
  <div class="panel" id="budgetBox" hidden></div>
  <div class="panel">
    <h3>Para onde foi o dinheiro${yr ? ' no período' : ''}</h3>
    <p class="muted small">Despesas por categoria, conta e cartão juntos.</p>
    <div style="margin-top:6px" id="catBars">${top.map(([c, v], i) => `<div class="catbar"${i >= 5 ? ' hidden data-more' : ''}><span class="small">${esc(c)}</span><span class="small" style="font-weight:600">${brl0(v)}</span><span class="b"><span style="width:${v / mx * 100}%"></span></span></div>`).join('') || '<p class="small muted">Sem gastos ainda.</p>'}</div>
    ${top.length > 5 ? `<button class="linkbtn small" type="button" id="catMore">Ver todas as ${top.length} categorias</button>` : ''}
  </div>
  <div class="grid2">
    <div class="panel">
      <h3>Cartão</h3>
      <p class="muted small">${yr ? 'Média por fatura' : 'Fatura de ' + mLong(S.m)}${G.cardMonthly ? ' · limite ' + brl0(G.cardMonthly) : ''}</p>
      <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(a.cardTotal / n)}</div>
      ${meter(a.cardTotal / n, G.cardMonthly, 0)}
      <p class="tiny muted" style="margin-top:6px">Entra na sobra: ${brl0(a.card / n)}. O resto são despesas extras ou o que não conta.</p>
    </div>
    <div class="panel">
      <h3>Próxima fatura</h3>
      ${nf ? `<p class="muted small">${mLong(nf.month)}: parcelas já contratadas + recorrentes${nf.manuais ? ' + lançados' : ''}</p>
      <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(nf.total)}</div>
      ${meter(nf.total, G.cardMonthly, 0)}
      <p class="tiny muted" style="margin-top:6px">Parcelas ${brl0(nf.parcelas)} · recorrentes ${brl0(nf.recorrentes)}${nf.manuais ? ' · lançados ' + brl0(nf.manuais) : ''}${G.cardMonthly ? '. Ainda cabe no limite: ' + brl0(G.cardMonthly - nf.total) : ''}.</p>` : '<p class="muted small">Aparece quando houver uma fatura importada.</p>'}
    </div>
  </div>
  <details class="more" id="homeMore"${moreOpen() ? ' open' : ''}>
    <summary><span><strong>Mais detalhes</strong><br><span class="tiny muted">Assinaturas, quem paga o quê, quanto guardaram mês a mês, patrimônio e o sonho de vocês</span></span></summary>
    <div class="stack">
      <div class="panel">
        <h3>Quanto guardaram, mês a mês</h3>
        <p class="muted small">Quanto da renda sobrou em cada mês. A linha tracejada é quanto vocês combinaram guardar.${fin ? ' Barras vazadas: sem o financiamento.' : ''}</p>
        <svg class="chart" viewBox="0 0 700 220" role="img" aria-label="Taxa de poupança por mês">${chart(ks, G, fin)}</svg>
      </div>
      <div class="grid2">
        <div class="panel">
          <h3>Patrimônio</h3>
          ${P0.rows.length ? `<div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(P0.total)}</div><ul class="list small">${P0.rows.map(r => `<li><span>${esc(r.name)}<br><span class="tiny muted">${esc(r.note)}</span></span><span class="amt">${brl0(r.value)}</span></li>`).join('')}</ul>` : '<p class="small muted">Cadastre investimentos, imóveis e veículos no menu ☰, em Patrimônio e dívidas.</p>'}
        </div>
        <div class="panel" id="goalBox"></div>
      </div>
      <div class="panel" id="subsBox"></div>
      <div class="panel" id="settleBox" hidden></div>
    </div>
  </details>`;
  renderSubs(el.querySelector('#subsBox'));
  if (!yr) renderSettle(el.querySelector('#settleBox'), list[0]);
  const cm = el.querySelector('#catMore');
  if (cm) cm.onclick = () => { const hid = el.querySelectorAll('#catBars [data-more]'); const show = [...hid].some(x => x.hidden); hid.forEach(x => { x.hidden = !show; }); cm.textContent = show ? 'Mostrar só as 5 maiores' : `Ver todas as ${top.length} categorias`; };
  el.querySelector('#homeMore').ontoggle = e => { try { localStorage.setItem('fin.home.more', e.target.open ? '1' : '0'); } catch (x) { /* storage blocked */ } };
  renderGoal(el.querySelector('#goalBox'), G, pr);
  renderSteps(el.querySelector('#stepsBox'));
  renderInsights(el.querySelector('#insights'));
  if (!yr) renderBudget(el.querySelector('#budgetBox'), cats);
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
    goals: G, nextFatura: nextFatura(), budgets: budgetsOf(settings()), recurring: findRecurring(S.txs, monthKeys(), { idx }), toClose: monthToClose(monthKeys(), settings().closed || {}, todayISO()),
    etaYears: pmt => { if (!(pmt > 0) || !G.patrimonio) return null; const pts = projectFor(pmt, 0, { years: 40 }); const i = pts.findIndex(v => v >= G.patrimonio); return i < 0 ? null : i; },
  }).filter(x => x.id !== 'close');
  const cc = document.getElementById('closeCard'), m2c = monthToClose(monthKeys(), settings().closed || {}, todayISO());
  if (cc) {
    cc.innerHTML = m2c ? `<article class="closecard"><div><span class="tiny">Hora de fechar o mês</span><h3>${esc(mLong(m2c))}</h3><p class="small">Confira se falta algo e veja a retrospectiva. Leva poucos minutos.</p></div><button class="btn primary" type="button" id="goClose">Fechar ${esc(mLong(m2c).split(' ')[0])}</button></article>` : '';
    const g = document.getElementById('goClose'); if (g) g.onclick = () => { S.closeMonth = m2c; S.go('fechar'); };
  }
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  const shown = showAllInsights ? list : list.slice(0, 2);
  box.innerHTML = shown.map(x => `<article class="insight ${x.tone}"><span class="ii" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${ICON[x.tone]}</svg></span>
    <div><h3>${esc(x.title)}</h3><p class="small">${esc(x.text)}</p>${x.action ? `<button class="linkbtn small" type="button" data-go='${esc(JSON.stringify(x.action.go))}'>${esc(x.action.label)} →</button>` : ''}</div></article>`).join('');
  if (list.length > 2) { box.insertAdjacentHTML('beforeend', `<button class="linkbtn small" type="button" id="insMore">${showAllInsights ? 'Mostrar menos avisos' : 'Ver mais ' + (list.length - 2) + (list.length - 2 > 1 ? ' avisos' : ' aviso')}</button>`); box.querySelector('#insMore').onclick = () => { showAllInsights = !showAllInsights; renderInsights(box); }; }
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const g = JSON.parse(b.dataset.go); if (g[0] === 'fechar') S.closeMonth = null; S.go(g[0], g[1], g[2]); });
}

function renderGoal(box, G, pr) {
  if (!G.patrimonio) { box.innerHTML = '<h3>O sonho de vocês</h3><p class="small muted">Diga no menu ☰ → Metas quanto querem ter investido e com que idade. Aqui aparece se o que vocês guardam hoje leva até lá.</p>'; return; }
  const p = pr[goalPreset], pts = projectFor(p[1], p[2]), end = pts[pts.length - 1];
  const need = Math.ceil(needPmtFor(p[2], G.patrimonio) / 50) * 50;
  box.innerHTML = `<h3>Sonho: ${brl0(G.patrimonio)} investidos${G.ageGoal ? ' aos ' + G.ageGoal + ' anos' : ''}</h3>
    <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(end)}</div>
    <p class="small muted">${esc(p[0])}: aporte de ${brl0(p[1])}/mês${p[2] ? ' + ' + brl0(p[2]) + '/ano' : ''}, retorno de ${pct(G.ret ?? 0.05)} ao ano acima da inflação. ${end >= G.patrimonio ? 'Nesse ritmo, vocês chegam lá.' : 'Para chegar lá, o aporte mensal precisa ser de ' + brl0(need) + '.'}</p>
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

// Budget per category for the month on screen.
let showAllBudget = false;
function renderBudget(box, spent) {
  const b = budgetsOf(settings());
  box.hidden = false;
  if (!Object.keys(b).length) {
    box.innerHTML = `<h3>Orçamento do mês</h3><p class="small muted">Defina um limite para as categorias que mais pesam e o app avisa antes de estourar.</p><div><button class="chip" type="button" data-bset>Definir orçamento</button></div>`;
    box.querySelector('[data-bset]').onclick = () => S.go('ajustes', '#bSuggest', 'metas'); return;
  }
  const rows = budgetStatus({ budgets: b, spent, month: S.m, today: todayISO() }), shown = showAllBudget ? rows : rows.slice(0, 5);
  const col = { ok: 'var(--accent)', attention: 'var(--warn)', over: 'var(--coral)' };
  box.innerHTML = `<h3>Orçamento de ${esc(mLong(S.m))}</h3>
    <div class="budget">${shown.map(r => `<div class="brow2"><span class="small">${esc(r.category)}</span><span class="small"><strong>${brl0(r.spent)}</strong> <span class="muted">de ${brl0(r.limit)}</span></span>
      <span class="b"><span style="width:${Math.min(100, r.pct * 100)}%;background:${col[r.status]}"></span></span>
      ${r.status !== 'ok' ? `<span class="tiny" style="color:${col[r.status]}">${r.status === 'over' ? 'Passou ' + brl0(r.spent - r.limit) : r.projected > r.limit && r.daysLeft ? 'No ritmo atual, fecha o mês em ' + brl0(r.projected) : 'Já usou ' + pct(r.pct)}</span>` : ''}</div>`).join('')}</div>
    <div class="rowbtn">${rows.length > 5 ? `<button class="linkbtn small" type="button" data-ball>${showAllBudget ? 'Mostrar só 5' : 'Ver todas as ' + rows.length}</button>` : ''}<button class="linkbtn small" type="button" data-bset>Ajustar limites</button></div>`;
  box.querySelector('[data-bset]').onclick = () => S.go('ajustes', '#bRows', 'metas');
  const all = box.querySelector('[data-ball]'); if (all) all.onclick = () => { showAllBudget = !showAllBudget; renderBudget(box, spent); };
}

// Subscriptions and fixed charges found in the statements.
function renderSubs(box) {
  const subs = findRecurring(S.txs, monthKeys(), { idx: S.catIdx });
  if (!subs.length) { box.innerHTML = '<h3>Assinaturas e cobranças fixas</h3><p class="small muted">Aparecem aqui quando a mesma cobrança vier em pelo menos 3 dos últimos 4 meses.</p>'; return; }
  const tot = subs.filter(x => x.current).reduce((a, x) => a + x.last, 0);
  box.innerHTML = `<h3>Assinaturas e cobranças fixas</h3>
    <p class="small muted">${subs.length} encontradas · ${brl0(tot)} por mês no último mês. Revise de vez em quando: é dinheiro que sai sem você perceber.</p>
    <ul class="list small">${subs.map(x => `<li><span>${esc(x.name)}<br><span class="tiny muted">${x.months} dos últimos 4 meses${x.current ? '' : ' · não veio no último mês'}</span>${x.rise ? `<br><span class="tiny" style="color:var(--coral)">Subiu ${brl(x.rise)} (era ${brl(x.prev)})</span>` : ''}</span><span class="amt">${brl(x.last)}</span></li>`).join('')}</ul>`;
}

// Settle-up between the people of the family for the month on screen.
function renderSettle(box, month) {
  if (S.members.length < 2) { box.hidden = true; return; }
  const r = settle({ txs: txsOf(month), idx: S.catIdx, members: S.members, split: settings().split || {} });
  const name = id => S.members.find(m => m.user_id === id)?.display_name?.split(' ')[0] || 'Alguém';
  box.hidden = false;
  box.innerHTML = `<h3>Quem pagou o quê em ${esc(mLong(month))}</h3>
    <ul class="list small">${r.balances.map(b => `<li><span>${esc(name(b.id))}<br><span class="tiny muted">parte justa ${brl0(b.due)}</span></span><span class="amt">${brl0(b.paid)}</span></li>`).join('')}
      ${r.unknown ? `<li><span>Sem dono definido<br><span class="tiny muted">cartão ou conta ainda sem pessoa ligada</span></span><span class="amt">${brl0(r.unknown)}</span></li>` : ''}</ul>
    <p class="small" style="margin-top:8px"><strong>${r.transfers.length ? r.transfers.map(t => `${esc(name(t.from))} passa ${brl0(t.amount)} para ${esc(name(t.to))}`).join('; ') : 'Está tudo equilibrado.'}</strong></p>
    <button class="linkbtn small" type="button" data-split>Ajustar quem paga o quê</button>`;
  box.querySelector('[data-split]').onclick = () => S.go('ajustes', null, 'divisao');
}
