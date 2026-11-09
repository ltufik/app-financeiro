import { S, goals, monthKeys, calcMonth, calcMonths, txsOf, manualOf, nextFatura, patrimonio, presets, projectFor, needPmtFor, hasFinancing } from '../state.js';
import { insights } from '../lib/insights.js';
import { monthToClose, yearRetro, levelProgress, sundayHabit } from '../lib/closing.js';
import { budgetStatus, budgetsOf } from '../lib/budget.js';
import { findRecurring } from '../lib/recurring.js';
import { settle } from '../lib/settle.js';
import { settings, closeDay } from '../state.js';
import { renderPendingPayments } from '../debtpay.js';
import { installmentPlan } from '../lib/parcelas.js';
import { rankFeed } from '../lib/homefeed.js';
import { retroVersion, retroSeen } from '../wrapped.js';
import { annualPlan } from '../annual.js';
import { feesOf, FEE_LABEL } from '../lib/bankfees.js';
import { addM } from '../lib/format.js';
import { mergeSuggestions } from '../lib/catmerge.js';
import { expandSplits } from '../lib/calc.js';
import { todayISO } from '../lib/format.js';
import { byCategory } from '../lib/calc.js';
import { brl, brl0, pct, esc, mLong, mShort } from '../lib/format.js';
import { meter, pill } from '../ui.js';
import { renderSteps } from '../steps.js';
import { demoSummary, DEMO_FAMILY, DEMO_MONTH } from '../lib/demo.js';
import { track } from '../usage.js';
import { renderForecast } from '../forecast.js';
import { cashPending } from '../cash.js';
import { familyDups, familyFunding } from '../dupfix.js';
import { renderSurvey } from '../survey.js';

let goalPreset = 0;
// Início sections: a clear one-line description; the person opens for the detail (remembered per section).
const SEC_OPEN = id => { try { return localStorage.getItem('fin.home.' + id) === '1'; } catch (e) { return false; } };
const sec = (id, title, line, body) => `<details class="sum" id="sum_${id}" data-sec="${id}"${SEC_OPEN(id) ? ' open' : ''}><summary><span class="sum-t">${title}</span><span class="sum-l">${line}</span></summary><div class="sum-b stack">${body}</div></details>`;
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
    el.innerHTML = `<div class="panel stack surv-card" id="survBox" hidden></div><div class="panel hero"><h2>Boas-vindas, ${esc(first())}!</h2><p class="muted" style="margin-top:6px">O resumo do mês aparece aqui assim que vocês mandarem o primeiro PDF ou lançarem o primeiro gasto. Veja abaixo como fica, com uma família de exemplo.</p></div>${demoCard()}<div class="panel" id="stepsBox"></div><div id="insights"></div>`;
    el.querySelector('#demoPdf').onclick = () => { track('exemplo.fatura'); S.go('lancar'); import('./lancar.js').then(m => m.openMode('pdf', true)); };
    el.querySelector('#demoFalar').onclick = () => { track('exemplo.falar'); S.go('lancar'); import('./lancar.js').then(m => m.openMode('falar', true)); };
    renderInsights(el.querySelector('#insights'));
    renderSteps(el.querySelector('#stepsBox'));
    renderSurvey(el.querySelector('#survBox'));
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

  const fees = feesHTML(), lvl = levelHTML(), subsAll = findRecurring(S.txs, monthKeys(), { idx: S.catIdx });
  el.innerHTML = `<p class="hello">Olá, ${esc(first())}.</p>
  <div class="panel stack surv-card" id="survBox" hidden></div>
  <section class="todo" id="todo">
    <div class="todo-head"><p class="eyebrow" id="todoEyebrow">Seu próximo passo</p></div>
    <div id="closeCard"></div>
    <div class="stack" id="debtPayBox" hidden></div>
    <div class="panel" id="stepsBox" hidden></div>
    <div id="insights" class="insights"></div>
    <button class="linkbtn small todo-more" type="button" id="todoMore" hidden></button>
    <div id="todoAttn" hidden></div>
    <p class="small todo-done" id="todoDone" hidden>Tudo em dia por aqui. O próximo passo é no domingo: informar a fatura aberta para a previsão ficar certa.</p>
  </section>
  <div class="panel" id="fcBox" hidden></div>
  <div id="retroCard"></div>
  ${lvl}
  ${sec('sobra', `Sobra ${yr ? 'em ' + S.m.slice(4) + ' até agora' : 'de ' + mLong(S.m)}`, `<span class="big num" style="color:${a.res < 0 ? 'var(--bad)' : 'var(--ink)'}">${brl(a.res)}</span><span class="tiny muted">${a.renda > 0 ? `Guardaram ${pct(a.tx)}${G.savings ? `; a meta é ${pct(G.savings)}` : ''}. ` : ''}Abra para ver receitas, despesas e para onde foi o dinheiro.</span>`,
`  <div class="panel hero">
    <div class="chips" style="margin-top:10px">${pill('Guardaram', a.tx, G.savings)}${nMan ? `<span class="pill at">inclui ${nMan} lançamento${nMan > 1 ? 's' : ''} manual${nMan > 1 ? 'is' : ''}</span>` : ''}</div>
    <div class="row" style="margin-top:14px">${[['Receitas', a.E], ['Despesas', a.out], ['Extras (fora da sobra)', a.EX - a.DX]].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${brl0(v)}</span></div>`).join('')}</div>
  </div>
  <div class="panel" id="budgetBox" hidden></div>
  <div class="panel">
    <h3>Para onde foi o dinheiro${yr ? ' no período' : ''}</h3>
    <p class="muted small">Despesas por categoria, conta e cartão juntos.</p>
    <div style="margin-top:6px" id="catBars">${top.map(([c, v], i) => `<div class="catbar"${i >= 5 ? ' hidden data-more' : ''}><span class="small">${esc(c)}</span><span class="small" style="font-weight:600">${brl0(v)}</span><span class="b"><span style="width:${v / mx * 100}%"></span></span></div>`).join('') || '<p class="small muted">Sem gastos ainda.</p>'}</div>
    ${top.length > 5 ? `<button class="linkbtn small" type="button" id="catMore">Ver todas as ${top.length} categorias</button>` : ''}
  </div>
`)}
  ${sec('cartao', 'Cartão', `<span class="small"><strong>${yr ? 'Média por fatura' : 'Fatura de ' + mShort(S.m)}: ${brl0(a.cardTotal / n)}</strong>${nf ? ` · próxima: ${brl0(nf.total)}` : ''}</span><span class="tiny muted">Abra para ver o limite e as parcelas já comprometidas.</span>`, `  <div class="grid2">
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
      <p class="tiny muted" style="margin-top:6px">Parcelas ${brl0(nf.parcelas)} · recorrentes ${brl0(nf.recorrentes)}${nf.manuais ? ' · lançados ' + brl0(nf.manuais) : ''}${G.cardMonthly ? '. Ainda cabe no limite: ' + brl0(G.cardMonthly - nf.total) : ''}.</p>${plansHTML(nf)}` : '<p class="muted small">Aparece quando houver uma fatura importada.</p>'}
    </div>
  </div>
`)}
  ${fees ? sec('banco', 'Quanto o banco cobrou', `<span class="small"><strong>${brl0(feesOf(S.txs.filter(t => t.month > addM(todayISO().slice(0, 7), -12))).total)}</strong> nos últimos 12 meses</span><span class="tiny muted">Juros, IOF, anuidade e tarifas. Abra para ver o que foi cobrado.</span>`, fees) : ''}
  <div id="infoBox"></div>
  <div id="homeMore" class="secs">
  ${sec('fixos', 'Assinaturas e custos fixos', `<span class="small">${subsAll.length ? `<strong>${subsAll.length}</strong> que voltam todo mês · <strong>${brl0(subsAll.filter(x => x.current).reduce((a, x) => a + x.last, 0))}</strong> no último mês` : 'Aparecem quando a mesma conta vier 3 meses seguidos'}</span><span class="tiny muted">O que sai todo mês sem vocês perceberem. Abra para revisar e cortar o que não usam.</span>`, '<div class="panel" id="subsBox"></div>')}
  ${sec('patrimonio', 'Patrimônio', `<span class="small">${P0.rows.length ? `<strong>${brl0(P0.total)}</strong> em imóveis, veículos e investimentos, já sem o que falta pagar` : 'Ainda não cadastrado'}</span><span class="tiny muted">Abra para ver cada bem e o que falta de cada financiamento.</span>`,
    `<div class="panel">${P0.rows.length ? `<ul class="list small">${P0.rows.map(r => `<li><span>${esc(r.name)}<br><span class="tiny muted">${esc(r.note)}</span></span><span class="amt">${brl0(r.value)}</span></li>`).join('')}</ul>` : '<p class="small muted">Cadastre investimentos, imóveis e veículos no menu ☰, em Patrimônio e dívidas.</p>'}</div>`)}
  ${sec('sonho', 'O sonho de vocês', '<span class="tiny muted">Quanto falta e quando chegam lá no ritmo de hoje. Abra para ver e ajustar o plano.</span>', '<div class="panel" id="goalBox"></div>')}
  ${sec('poupanca', 'Quanto guardaram, mês a mês', `<span class="tiny muted">Quanto da renda sobrou em cada mês, comparado com a meta de ${pct(G.savings || 0.2)}. Abra para ver o gráfico.</span>`,
    `<div class="panel"><p class="muted small">A linha tracejada é quanto vocês combinaram guardar.${fin ? ' Barras vazadas: sem o financiamento.' : ''}</p><svg class="chart" viewBox="0 0 700 220" role="img" aria-label="Taxa de poupança por mês">${chart(ks, G, fin)}</svg></div>`)}
  ${sec('retro', `Retrospectiva de ${todayISO().slice(0, 4)}`, '<span class="tiny muted">O ano em uma página, com os meses que já têm o extrato da conta.</span>', `<div class="panel"><button class="btn" type="button" data-retro="${todayISO().slice(0, 4)}">Ver ${todayISO().slice(0, 4)} até agora</button></div>`)}
  ${S.members.length > 1 && !yr ? sec('divisao', 'Quem pagou o quê', '<span class="tiny muted">O acerto do mês entre vocês. Abra para ver quem passa quanto para quem.</span>', '<div class="panel" id="settleBox" hidden></div>') : '<div class="panel" id="settleBox" hidden></div>'}
  </div>`;
  renderSubs(el.querySelector('#subsBox'));
  if (!yr) renderSettle(el.querySelector('#settleBox'), list[0]);
  const cm = el.querySelector('#catMore');
  if (cm) cm.onclick = () => { const hid = el.querySelectorAll('#catBars [data-more]'); const show = [...hid].some(x => x.hidden); hid.forEach(x => { x.hidden = !show; }); cm.textContent = show ? 'Mostrar só as 5 maiores' : `Ver todas as ${top.length} categorias`; };
  renderGoal(el.querySelector('#goalBox'), G, pr);
  renderPendingPayments(el.querySelector('#debtPayBox'), { onDone: () => S.render() });
  el.querySelector('#plansMore')?.addEventListener('toggle', e => { if (e.target.open) track('inicio.parcelas'); });
  el.querySelector('#feesMore')?.addEventListener('toggle', e => { if (e.target.open) track('inicio.tarifas_lista'); });
  renderSteps(el.querySelector('#stepsBox'));
  if (!yr) renderSurvey(el.querySelector('#survBox'));
  renderInsights(el.querySelector('#insights'));
  if (!yr) renderForecast(el.querySelector('#fcBox'));
  // The year retrospective: on top while there is a new edition (retroNotice); always in "Mais detalhes".
  el.querySelectorAll('[data-retro]').forEach(b => b.onclick = () => import('../wrapped.js').then(m => m.openWrapped(b.dataset.retro)));
  if (!yr) renderBudget(el.querySelector('#budgetBox'), cats);
  bindSecs(el); arrangeTodo();
}

// Home insights: what happened this month and what to do about it.
const ICON = { good: '<path d="M5 12l5 5 9-10"/>', warn: '<path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/>', bad: '<path d="M12 5v10M7 10l5 5 5-5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' };
// The home notices, the same way for the screen and for "tem novidade no Início" after saving.
export function homeInsights() {
  const G = goals(), idx = S.catIdx;
  return retroNotice().concat(annualNotice(), insights({
    name: S.members.find(m => m.user_id === S.user?.id)?.display_name || S.user?.user_metadata?.display_name || '',
    today: todayISO(), months: monthKeys(), calc: calcMonth,
    cats: k => byCategory(txsOf(k), idx),
    fixed: k => expandSplits(txsOf(k)).reduce((a, t) => { const c = idx.get(t.category); return c && c.grp === 'dia' && c.recurring ? a + (t.source === 'conta' ? -t.amount : +t.amount) : a; }, 0),
    has: (k, src) => S.txs.some(t => t.month === k && t.source === src && !t.manual),
    fees: k => feesOf(txsOf(k)), feesYear: () => feesOf(S.txs.filter(t => t.month > addM(todayISO().slice(0, 7), -12))),
    manualCount: k => S.txs.filter(t => t.month === k && t.manual).length,
    pending: k => S.txs.filter(t => t.month === k && (t.pending || !t.category || t.category === 'A classificar')).length,
    fixedCats: [...idx.values()].filter(c => c.grp === 'dia' && c.recurring).map(c => c.name), closeDay: closeDay(),
    ...(() => { const u = {}; for (const t of S.txs) for (const c of (t.splits?.length ? t.splits.map(x => x.category) : [t.category])) if (c) u[c] = (u[c] || 0) + 1; const m = mergeSuggestions(S.categories, u, settings().catKeepApart || []); return { catMerge: m.length, catMergeText: m[0] ? `"${m[0].drop}" e "${m[0].keep}" parecem a mesma coisa. Juntar deixa os gráficos e o orçamento mais claros.` : '' }; })(),
    goals: G, nextFatura: nextFatura(), checkins: settings().checkins || [], cashPending: cashPending(), dups: (d => d.pairs.length + d.orphans.length)(familyDups()), funding: familyFunding(), budgets: budgetsOf(settings()), recurring: findRecurring(S.txs, monthKeys(), { idx }), toClose: monthToClose(monthKeys(), settings().closed || {}, todayISO()),
    etaYears: pmt => { if (!(pmt > 0) || !G.patrimonio) return null; const pts = projectFor(pmt, 0, { years: 40 }); const i = pts.findIndex(v => v >= G.patrimonio); return i < 0 ? null : i; },
  }).filter(x => x.id !== 'close'));
}
// Until the family opens it once: "A retrospectiva de 2026 está pronta", on top (it is new) with the way to it.
export const retroKey = y => `fin.retro.${S.hh?.id || ''}.${y}`;
// Gastos do ano on Início: payments found to confirm; then, when the next 3 months carry R$ 500 or more of them,
// how much comes and how much to set aside per month (warn when the first one is next month).
function annualNotice() {
  let P; try { P = annualPlan(); } catch (e) { return []; }
  const go = { label: 'Ver os gastos do ano', go: ['ajustes', null, 'gastos_ano'] };
  if (P.found.length && !P.items.length) return [{ id: 'ano_achou', tone: 'info', title: 'Gastos que voltam todo ano', text: `Achamos ${P.found.length} no histórico (${P.found.slice(0, 2).map(f => esc(f.name)).join(', ')}${P.found.length > 2 ? '…' : ''}). Confirmem e o app avisa com antecedência quanto separar.`, action: go }];
  if (P.next3 < 500) return [];
  const firstM = P.cal.find(m => m.total > 0), soon = P.cal[0].total > 0;
  return [{ id: 'ano_previsto', tone: soon ? 'warn' : 'info', title: soon ? `${mLong(P.cal[0].month)[0].toUpperCase() + mLong(P.cal[0].month).slice(1)} tem ${brl0(P.cal[0].total)} de gastos do ano` : 'Gastos do ano chegando', text: `${brl0(P.next3)} nos próximos 3 meses, a partir de ${mLong(firstM.month)}. Separem ${brl0(P.aside)} por mês para não apertar.`, action: go }];
}
function retroNotice() {
  const td = todayISO(), out = [];
  // In January, the year that ended (year-end edition); during the year, the current one up to the last closed month.
  for (const y of td.slice(5, 7) === '01' ? [String(+td.slice(0, 4) - 1), td.slice(0, 4)] : [td.slice(0, 4)]) {
    const ms = [...new Set(S.txs.filter(t => t.month.startsWith(y + '-') && t.source === 'conta' && !t.manual).map(t => t.month))].sort();
    if (ms.length < 3 || retroSeen(y)) continue;
    const last = ms[ms.length - 1], full = last === y + '-12', upTo = mLong(last).split(' de ')[0];
    out.push({ id: 'retro', tone: 'good', title: full ? `O fechamento de ${y} está pronto` : `A retrospectiva de ${y} até ${upTo} está pronta`, text: full ? 'O ano completo: quanto guardaram, a evolução mês a mês, os marcos, o nível e onde dá para melhorar em ' + (+y + 1) + '.' : `${ms.length} meses em telas: quanto guardaram, a evolução, os marcos, o nível até agora e onde dá para melhorar. Ela se atualiza a cada mês fechado.`, action: { label: 'Ver a retrospectiva', go: ['retro', y] } });
    break;
  }
  return out;
}
// What the family saw last time (per family, on this device): what is new or changed goes to the top.
const SEEN = () => 'fin.feed.' + (S.hh?.id || '');
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN()) || 'null'); } catch (e) { return null; } };
const FRESH = new Set(); // new in this session: stays marked until the app is opened again
export function freshNotices() { const r = rankFeed(homeInsights(), readSeen()); return r.list.filter(x => r.fresh.includes(x.id)); }
function renderInsights(box) {
  const r = rankFeed(homeInsights(), readSeen());
  r.fresh.forEach(id => FRESH.add(id)); try { localStorage.setItem(SEEN(), JSON.stringify(r.seen)); } catch (e) { /* private mode */ }
  let list = [...r.list.filter(x => FRESH.has(x.id)), ...r.list.filter(x => !FRESH.has(x.id))];
  if (list.some(x => FRESH.has(x.id))) track('inicio.novo_aviso');
  const cc = document.getElementById('closeCard'), m2c = monthToClose(monthKeys(), settings().closed || {}, todayISO());
  if (cc) {
    cc.innerHTML = m2c ? `<article class="closecard"><div><span class="tiny">Hora de fechar o mês</span><h3>${esc(mLong(m2c))}</h3><p class="small">Confira se falta algo e veja a retrospectiva. Leva poucos minutos.</p></div><button class="btn primary" type="button" id="goClose">Fechar ${esc(mLong(m2c).split(' ')[0])}</button></article>` : '';
    const g = document.getElementById('goClose'); if (g) g.onclick = () => { S.closeMonth = m2c; S.go('fechar'); };
  }
  const infoBox = document.getElementById('infoBox'), infos = list.filter(x => !x.action);
  ATTN = infos.find(x => x.tone === 'bad' || x.tone === 'warn') || null;
  if (infoBox) {
    infoBox.innerHTML = infos.length ? sec('avisos', 'Outros avisos', `<span class="small">${infos.length} ${infos.length > 1 ? 'avisos' : 'aviso'}: ${esc(infos[0].title)}${infos.length > 1 ? '…' : ''}</span><span class="tiny muted">Para saber; não pedem nada de vocês.</span>`,
      infos.map(x => `<article class="insight ${x.tone}"><div><h3>${esc(x.title)}</h3><p class="small">${esc(x.text)}</p></div></article>`).join('')) : '';
    bindSecs(infoBox);
  }
  list = list.filter(x => x.action);
  if (!list.length) { box.hidden = true; box.innerHTML = ''; arrangeTodo(); return; }
  box.hidden = false;
  const shown = list;
  const after = S.savedAt && Date.now() - S.savedAt < 30 * 60e3;
  box.innerHTML = shown.map(x => `<article class="insight ${x.tone}${FRESH.has(x.id) ? ' fresh' : ''}">${FRESH.has(x.id) ? `<span class="newtag">${after ? 'Depois do que vocês lançaram' : 'Novo'}</span>` : ''}<span class="ii" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${ICON[x.tone]}</svg></span>
    <div><h3>${esc(x.title)}</h3><p class="small">${esc(x.text)}</p>${x.action ? `<button class="btn small act" type="button" data-go='${esc(JSON.stringify(x.action.go))}'>${esc(x.action.label)}</button>` : ''}</div></article>`).join('');
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { track('inicio.acao'); const g = JSON.parse(b.dataset.go); if (g[0] === 'retro') { import('../wrapped.js').then(m => m.openWrapped(g[1])); return; } if (g[0] === 'fechar') S.closeMonth = null; S.go(g[0], g[1], g[2]); });
  arrangeTodo();
}

// Opening a section is remembered and counted (engagement: which sections people open).
const SEC_TRACK = { fixos: 'inicio.abriu_fixos', patrimonio: 'inicio.abriu_patrimonio', sonho: 'inicio.abriu_sonho', poupanca: 'inicio.abriu_poupanca', retro: 'inicio.abriu_retro', divisao: 'inicio.abriu_divisao', sobra: 'inicio.abriu_sobra', cartao: 'inicio.abriu_cartao', banco: 'inicio.tarifas', nivel: 'inicio.abriu_nivel', avisos: 'inicio.abriu_avisos' };
function bindSecs(root) {
  root.querySelectorAll('details.sum[data-sec]').forEach(d => d.addEventListener('toggle', () => {
    try { localStorage.setItem('fin.home.' + d.dataset.sec, d.open ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (d.open && SEC_TRACK[d.dataset.sec]) track(SEC_TRACK[d.dataset.sec]);
  }));
}
// The top of Início guides to ONE thing: what is new since the last visit first; otherwise what needs a decision
// (payoff to confirm, month to close), then what needs attention (bad before warning), then the first steps.
// The rest waits behind "Depois disso". Nothing to do: what to keep an eye on; nothing at all: "tudo em dia".
let ATTN = null, todoOpen = false;
function arrangeTodo() {
  const t = document.getElementById('todo'); if (!t) return;
  const vis = e => e && !e.hidden && e.innerHTML.trim();
  const ins = document.getElementById('insights'), arts = ins ? [...ins.querySelectorAll(':scope > .insight')] : [];
  const rank = a => a.classList.contains('bad') ? 0 : a.classList.contains('warn') ? 1 : 2;
  const fresh = arts.filter(a => a.classList.contains('fresh')), rest = arts.filter(a => !a.classList.contains('fresh')).sort((a, b) => rank(a) - rank(b));
  const blocks = ['debtPayBox', 'closeCard'].map(id => document.getElementById(id)).filter(vis), steps = document.getElementById('stepsBox');
  const units = [...fresh, ...blocks, ...rest, ...(vis(steps) ? [steps] : [])];
  [...arts, ...blocks, steps].forEach(e => e && e.classList.remove('later'));
  units.forEach((u, i) => { u.style.order = String(i + 1); if (i && !todoOpen) u.classList.add('later'); });
  if (ins) ins.style.order = String(arts.length ? Math.min(...arts.map(a => +a.style.order || 99)) : 99);
  const n = units.length, first = units[0];
  t.querySelector('#todoEyebrow').textContent = n ? (first.classList.contains('fresh') ? 'Novidade desde a sua última visita' : 'Seu próximo passo') : ATTN ? 'Vale ficar de olho' : 'Tudo em dia';
  const more = t.querySelector('#todoMore');
  more.hidden = n < 2; more.textContent = todoOpen ? 'Mostrar só o próximo passo' : `Depois disso: mais ${n - 1} ${n - 1 > 1 ? 'itens' : 'item'}`;
  more.onclick = () => { todoOpen = !todoOpen; track('inicio.todo_mais'); arrangeTodo(); };
  const at = t.querySelector('#todoAttn');
  at.hidden = !!n || !ATTN;
  at.innerHTML = !n && ATTN ? `<article class="insight ${ATTN.tone}"><div><h3>${esc(ATTN.title)}</h3><p class="small">${esc(ATTN.text)}</p></div></article>` : '';
  t.querySelector('#todoDone').hidden = !!n || !!ATTN;
}

// The level of the year, during the year: where the family is, what is missing for the next one, and the rules.
const MEDAL = { ouro: '🥇', prata: '🥈', bronze: '🥉', inicio: '🌱' };
function levelHTML() {
  const td = todayISO(), y = td.slice(0, 4), r = yearRetro({ year: y, txs: S.txs, idx: S.catIdx, goals: goals() });
  if (!r.n) return '';
  const p = levelProgress(r, { habit: sundayHabit(settings().checkins, td, y), today: td });
  const low = t => t ? t[0].toLowerCase() + t.slice(1) : 'manter o ritmo';
  const line = p.next ? `Para chegar ao ${p.nextLabel}: ${low(p.missing[0]?.text)}.` : 'Vocês estão no nível mais alto. Agora é manter até dezembro.';
  const bar = `<span class="lvbar" aria-hidden="true"><i style="width:${Math.round((p.next ? p.frac : 1) * 100)}%"></i></span>`;
  return sec('nivel', `${MEDAL[p.level]} Nível de ${y}: ${esc(p.label)}`, `${bar}<span class="small">${esc(line)}</span><span class="tiny muted">Abra para ver o que falta e as regras de cada nível.</span>`,
    `<div class="panel">${p.next ? `<h3>O que falta para o ${esc(p.nextLabel)}</h3><ul class="small lvmiss">${p.missing.map(m => `<li>${esc(m.text)}.</li>`).join('')}</ul>
      <p class="tiny muted">Conta com os ${r.n} meses de ${y} que já têm o extrato da conta: sobra de ${brl0(r.res)}, ${pct(r.tx)} do que ganharam; ${r.positive} de ${r.n} meses no azul.</p>` : `<p class="small">Sobra de ${brl0(r.res)} no ano, ${pct(r.tx)} do que ganharam.</p>`}
      <h3 style="margin-top:12px">Regras dos níveis</h3>
      <ul class="lvrules small">${p.rules.map(x => `<li class="${x.ok ? 'ok' : ''}"><span aria-hidden="true">${x.ok ? '✓' : '○'}</span><span><strong>${MEDAL[x.level]} ${x.title}</strong>: ${esc(x.text)}</span></li>`).join('')}</ul>
      <p class="tiny muted">O nível muda a cada mês fechado e aparece na retrospectiva do ano.${p.habit?.counts ? '' : ' A partir do quarto domingo com a previsão, o Ouro também pede a fatura aberta informada em pelo menos metade dos domingos.'}</p></div>`);
}

// What the bank charged in the last 12 months: interest, IOF, annual fee and account fees, with the biggest ones.
function feesHTML() {
  const f = feesOf(S.txs.filter(t => t.month > addM(todayISO().slice(0, 7), -12)));
  if (f.total < 1) return '';
  return `<div class="panel" id="feesBox"><h3>Quanto o banco cobrou</h3><p class="muted small">Nos últimos 12 meses, da fatura e do extrato</p>
    <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(f.total)}</div>
    <p class="small">${Object.entries(f.by).filter(e => e[1] > 0).map(e => `${FEE_LABEL[e[0]]} ${brl0(e[1])}`).join(' · ')}</p>
    ${f.by.juros > 0 ? '<p class="small"><strong>Juros e multa são o custo mais caro:</strong> pagar a fatura inteira, no dia, evita.</p>' : ''}
    <details class="help" id="feesMore"><summary>O que foi cobrado</summary><ul class="small">${f.items.slice(0, 10).map(x => `<li>${esc(x.description)} (${mShort(x.month)}): ${brl(x.value)}</li>`).join('')}</ul>
    <p class="tiny muted">Anuidade e tarifas costumam ter isenção: peça ao banco ou troque por um cartão ou pacote sem custo.</p></details></div>`;
}

// Installments already taken for the next months, from the latest bill: bars per month and what weighs the most.
const yy = k => mShort(k) + '/' + k.slice(2, 4);
function plansHTML(nf) {
  const p = installmentPlan(txsOf(nf.from).filter(t => t.source === 'cartao'), nf.from, 12);
  if (!p.items.length) return '';
  const max = Math.max(...p.months.map(x => x.total), 1), first = p.months.slice(0, 6);
  return `<div class="plans" id="plans"><p class="small"><strong>Parcelas já comprometidas</strong>: ${brl0(p.total)} até ${yy(p.last)}</p>
    <p class="tiny muted">Só as parcelas que já vieram na última fatura; compras parceladas novas entram por cima.</p>
    <ul class="pbars">${first.map(x => `<li><span class="pm">${mShort(x.month)}</span><span class="pb"><i style="width:${Math.round(x.total / max * 100)}%"></i></span><span class="pv num">${brl0(x.total)}</span></li>`).join('')}</ul>
    <details class="help" id="plansMore"><summary>As que mais pesam (${p.items.length})</summary><ul class="small">${p.items.slice(0, 8).map(x => `<li>${esc(x.description)}: ${brl0(x.amount)} por mês, faltam ${x.left} (até ${yy(x.ends)})</li>`).join('')}</ul></details></div>`;
}

function renderGoal(box, G, pr) {
  if (!G.patrimonio) { box.innerHTML = '<h3>O sonho de vocês</h3><p class="small muted">Diga no menu ☰ → Metas quanto querem ter investido e com que idade. Aqui aparece se o que vocês guardam hoje leva até lá.</p>'; return; }
  const p = pr[goalPreset], pts = projectFor(p[1], p[2]), end = pts[pts.length - 1];
  const need = Math.ceil(needPmtFor(p[2], G.patrimonio) / 50) * 50;
  box.innerHTML = `<h3>Sonho: ${brl0(G.patrimonio)} investidos${G.ageGoal ? ' aos ' + G.ageGoal + ' anos' : ''}</h3>
    <div class="num" style="font-size:26px;font-weight:700;margin-top:6px">${brl0(end)}</div>
    <p class="small muted">${esc(p[0])}${p[3] ? ` (${esc(p[3])})` : ''}: aporte de ${brl0(p[1])}/mês${p[2] ? ' + ' + brl0(p[2]) + '/ano' : ''}, retorno de ${pct(G.ret ?? 0.05)} ao ano acima da inflação. ${end >= G.patrimonio ? 'Nesse ritmo, vocês chegam lá.' : 'Para chegar lá, o aporte mensal precisa ser de ' + brl0(need) + '.'}</p>
    <div class="chips" style="margin-top:10px">${pr.map((x, i) => `<button class="chip" type="button" aria-pressed="${i === goalPreset}" data-i="${i}">${esc(x[0])}</button>`).join('')}</div>
    <p class="tiny muted" style="margin-top:6px">Quanto acham que conseguem guardar, a idade e o valor do sonho: menu ☰ → Família e metas → Metas.</p>`;
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
  if (!subs.length) { box.innerHTML = '<h3>Assinaturas e custos fixos</h3><p class="small muted">Aparecem aqui quando a mesma cobrança vier em pelo menos 3 dos últimos 4 meses.</p>'; return; }
  const tot = subs.filter(x => x.current).reduce((a, x) => a + x.last, 0);
  box.innerHTML = `<h3>Assinaturas e custos fixos</h3>
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
