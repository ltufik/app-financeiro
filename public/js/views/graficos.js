// Gráficos: charts the family builds themselves (type, what to show, period), saved in the household settings.
import { S, settings, monthKeys, calcMonth, txsOf } from '../state.js';
import { byCategory } from '../lib/calc.js';
import { esc, mLong } from '../lib/format.js';
import * as db from '../db.js';
import { $, toast, invalid, clearInvalid, confirmInline } from '../ui.js';
import { TYPES, METRICS, BREAKDOWN, PERIODS, periodMonths, checkChart, buildChart, chartSVG, legendHTML } from '../lib/charts.js';

const SUGGESTED = [
  { id: 'sug1', title: 'Para onde foi o dinheiro', type: 'pizza', metric: 'categorias', period: { kind: 'mes' } },
  { id: 'sug2', title: 'Sobra mês a mês', type: 'barra', metric: 'sobra', period: { kind: 'm6' } },
];
let editing = null; // chart being edited (copy), or null

const charts = () => settings().charts || [];
const dataFor = c => {
  const ms = periodMonths(c.period, monthKeys(), S.m?.startsWith('ano:') ? null : S.m);
  return buildChart(c, { months: ms, calc: calcMonth, cats: k => byCategory(txsOf(k), S.catIdx) });
};
const periodText = c => {
  const ms = periodMonths(c.period, monthKeys(), S.m?.startsWith('ano:') ? null : S.m);
  if (!ms.length) return PERIODS[c.period.kind];
  return ms.length === 1 ? mLong(ms[0]) : `${mLong(ms[0])} a ${mLong(ms[ms.length - 1])}`;
};
function card(c, saved) {
  const d = dataFor(c);
  return `<article class="panel stack chcard" data-id="${esc(c.id)}">
    <div class="ch-head"><div><h3>${esc(c.title)}</h3><p class="tiny muted">${TYPES[c.type]} · ${METRICS[c.metric]} · ${esc(periodText(c))}</p></div>
      <div class="rowbtn">${saved ? `<button class="chip" type="button" data-edit="${esc(c.id)}">Editar</button><button class="chip" type="button" data-del="${esc(c.id)}">Remover</button>` : `<button class="chip" type="button" data-copy="${esc(c.id)}">Salvar este</button>`}</div></div>
    ${d.empty ? `<p class="small muted">${esc(d.empty)}</p>` : `<div class="ch-wrap${d.kind === 'pie' ? ' pie' : ''}">${chartSVG(d, { title: c.title })}${legendHTML(d)}</div>`}
  </article>`;
}

export function render(el) {
  const list = charts();
  if (!monthKeys().length) {
    el.innerHTML = `<div class="panel stack"><h2>Gráficos</h2><p class="small muted">Os gráficos aparecem quando houver lançamentos. Comece mandando uma fatura ou extrato em Lançar.</p><div><button class="btn primary" type="button" id="chGoLancar">Ir para Lançar</button></div></div>`;
    $('#chGoLancar').onclick = () => S.go('lancar', '#drop');
    return;
  }
  el.innerHTML = `<div class="panel stack"><div class="ch-head"><div><h2>Gráficos</h2><p class="small muted">Monte do seu jeito: escolha o tipo, o que mostrar e o período.</p></div>
      <button class="btn primary" type="button" id="chNew">Criar gráfico</button></div><div id="chForm"></div></div>
    ${list.map(c => card(c, true)).join('')}
    ${list.length ? '' : `<p class="small muted" style="margin:0 2px">Sugestões para começar. Toque em "Salvar este" para guardar ou em "Criar gráfico" para fazer o seu.</p>${SUGGESTED.map(c => card(c, false)).join('')}`}`;
  $('#chNew').onclick = () => openForm(el, { id: 'c' + Date.now().toString(36), title: '', type: 'pizza', metric: 'categorias', cats: [], period: { kind: 'mes' } }, false);
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(el, JSON.parse(JSON.stringify(list.find(c => c.id === b.dataset.edit))), true));
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    const c = SUGGESTED.find(x => x.id === b.dataset.copy);
    if (!await confirmInline(b, { text: `Salvar o gráfico "${esc(c.title)}"?`, yes: 'Sim, salvar' })) return;
    await store([...list, { ...c, id: 'c' + Date.now().toString(36) }], 'Gráfico salvo', el);
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const c = list.find(x => x.id === b.dataset.del);
    if (!await confirmInline(b, { text: `Remover o gráfico "${esc(c.title)}"? Os dados não são apagados, só o gráfico.`, yes: 'Sim, remover', danger: true })) return;
    await store(list.filter(x => x.id !== c.id), 'Gráfico removido', el);
  });
  if (editing) openForm(el, editing.c, editing.saved);
}

async function store(next, msg, el) {
  const st = { ...settings(), charts: next };
  try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; editing = null; toast(msg); render(el); }
  catch (e) { toast('Não foi possível salvar. ' + db.errorText(e)); }
}

function openForm(el, c, saved) {
  editing = { c, saved };
  const box = $('#chForm'), ks = monthKeys(), years = [...new Set(ks.map(k => k.slice(0, 4)))].sort().reverse();
  const cats = S.categories.filter(x => x.grp === 'dia').map(x => x.name).sort((a, b) => a.localeCompare(b, 'pt'));
  box.innerHTML = `<div class="chform stack">
    <label class="f">Nome do gráfico<input type="text" id="chTitle" maxlength="60" placeholder="Suplementos por mês" value="${esc(c.title)}"></label>
    <div class="f"><span>Tipo</span><div class="seg" role="group" aria-label="Tipo de gráfico">${Object.entries(TYPES).map(([k, l]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${c.type === k}">${l}</button>`).join('')}</div></div>
    <label class="f">O que mostrar<select id="chMetric">${Object.entries(METRICS).map(([k, l]) => `<option value="${k}"${c.metric === k ? ' selected' : ''}${c.type === 'pizza' && !BREAKDOWN.has(k) ? ' disabled' : ''}>${l}${c.type === 'pizza' && !BREAKDOWN.has(k) ? ' (não cabe em pizza)' : ''}</option>`).join('')}</select></label>
    <fieldset class="f chcats" id="chCats" ${c.metric === 'escolhidas' ? '' : 'hidden'}><legend>Categorias (até 8)</legend>
      <div class="chcatlist">${cats.map(n => `<label class="tiny"><input type="checkbox" value="${esc(n)}" ${(c.cats || []).includes(n) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div></fieldset>
    <label class="f">Período<select id="chPeriod">${Object.entries(PERIODS).map(([k, l]) => `<option value="${k}"${c.period.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f" id="chYearRow" ${c.period.kind === 'ano' ? '' : 'hidden'}>Ano<select id="chYear">${years.map(y => `<option${String(c.period.year || years[0]) === y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <div class="grid2" id="chRange" ${c.period.kind === 'faixa' ? '' : 'hidden'}>
      <label class="f">De<input type="month" id="chFrom" min="${ks[0]}" max="${ks[ks.length - 1]}" value="${esc(c.period.from || ks[0])}"></label>
      <label class="f">Até<input type="month" id="chTo" min="${ks[0]}" max="${ks[ks.length - 1]}" value="${esc(c.period.to || ks[ks.length - 1])}"></label></div>
    <div class="chprev" id="chPrev" aria-live="polite"></div>
    <p class="err small" id="chErr" role="alert" hidden></p>
    <div class="rowbtn"><button class="btn primary" type="button" id="chSave">${saved ? 'Salvar alterações' : 'Salvar gráfico'}</button><button class="btn" type="button" id="chCancel">Cancelar</button></div>
  </div>`;
  const read = () => {
    c.title = $('#chTitle').value.trim();
    c.metric = $('#chMetric').value;
    c.cats = [...box.querySelectorAll('#chCats input:checked')].map(i => i.value);
    const kind = $('#chPeriod').value;
    c.period = kind === 'ano' ? { kind, year: $('#chYear').value } : kind === 'faixa' ? { kind, from: $('#chFrom').value, to: $('#chTo').value } : { kind };
  };
  const preview = () => {
    read();
    const msg = checkChart({ ...c, title: c.title || 'x' }), p = $('#chPrev');
    if (msg) { p.innerHTML = `<p class="small muted">${esc(msg)}</p>`; return; }
    const d = dataFor(c);
    p.innerHTML = d.empty ? `<p class="small muted">${esc(d.empty)}</p>` : `<div class="ch-wrap${d.kind === 'pie' ? ' pie' : ''}">${chartSVG(d, { title: c.title })}${legendHTML(d)}</div>`;
  };
  box.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    read(); c.type = b.dataset.type;
    if (c.type === 'pizza' && !BREAKDOWN.has(c.metric)) c.metric = 'categorias';
    openForm(el, c, saved);
  });
  $('#chMetric').onchange = () => { read(); $('#chCats').hidden = c.metric !== 'escolhidas'; preview(); };
  $('#chPeriod').onchange = () => { $('#chYearRow').hidden = $('#chPeriod').value !== 'ano'; $('#chRange').hidden = $('#chPeriod').value !== 'faixa'; preview(); };
  box.querySelectorAll('#chCats input, #chYear, #chFrom, #chTo').forEach(i => i.onchange = preview);
  $('#chCancel').onclick = () => { editing = null; box.innerHTML = ''; };
  $('#chSave').onclick = async e => {
    read(); clearInvalid(box); const err = $('#chErr'); err.hidden = true;
    const msg = checkChart(c);
    if (msg) {
      const target = /nome/i.test(msg) ? $('#chTitle') : /categoria/i.test(msg) ? null : /mês/i.test(msg) ? $('#chFrom') : $('#chMetric');
      if (target) invalid(target, msg); else { err.hidden = false; err.textContent = msg; }
      return;
    }
    const list = charts();
    if (list.some(x => x.id !== c.id && x.title.toLowerCase() === c.title.toLowerCase())) { invalid($('#chTitle'), 'Já existe um gráfico com esse nome.'); return; }
    if (!await confirmInline(e.target, { text: saved ? `Salvar as alterações em "${esc(c.title)}"?` : `Salvar o gráfico "${esc(c.title)}"?`, yes: 'Sim, salvar' })) return;
    await store(saved ? list.map(x => x.id === c.id ? c : x) : [...list, c], saved ? 'Gráfico atualizado' : 'Gráfico salvo', el);
  };
  preview();
  $('#chTitle').focus();
}
