// Product console (/admin): dashboard, backlog, benchmarking, pricing and product design.
// Only for ADMIN_EMAILS: the data comes from /api/admin and /api/metrics, which check the login.
import * as db from '../db.js';
import { esc } from '../lib/format.js';
import { $, toast, confirmInline, invalid, clearInvalid } from '../ui.js';
import { checkName, checkNumber } from '../lib/validate.js';
import { renderMetrics } from '../metrics.js';
import { BACKLOG, BENCH, PRICING, CANVAS } from './seed.js';
import { pricingCalc } from '../lib/pricing.js';

const STATUS = { agora: 'Agora', proximo: 'Próximo', ideia: 'Ideia', depois: 'Depois', feito: 'Feito', descartado: 'Descartado' };
const EFFORT = { P: 'Pequeno', M: 'Médio', G: 'Grande' };
const D = { backlog: null, pricing: null, canvas: null };
let token = '', tab = 'painel', view = 'quadro', filter = '';
const money = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const uid = () => Math.random().toString(36).slice(2, 10);

async function api(method, key, data) {
  const r = await fetch('/api/admin' + (method === 'GET' ? '?key=' + key : ''), { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: method === 'PUT' ? JSON.stringify({ key, data }) : undefined });
  if (!r.ok) { const e = new Error(String(r.status)); e.status = r.status; throw e; }
  return r.json();
}
async function save(key, msg) {
  try { await api('PUT', key, D[key]); if (msg) toast(msg); } catch (e) { toast('Não foi possível salvar. Verifique a internet e tente de novo.'); }
}

(async function boot() {
  try { await db.init(); } catch (e) { $('#aMain').innerHTML = '<div class="panel"><p>O app ainda não foi configurado.</p></div>'; return; }
  const { data } = await db.sb.auth.getSession();
  token = data?.session?.access_token || '';
  if (!token) { $('#aMain').innerHTML = '<div class="panel stack"><h2>Entre primeiro</h2><p class="small">Abra o app, entre com o seu e-mail e senha e volte para esta página.</p><div><a class="btn primary" href="/">Abrir o app</a></div></div>'; return; }
  $('#aWho').textContent = data.session.user.email;
  try {
    const [b, p, c] = await Promise.all(['backlog', 'pricing', 'canvas'].map(k => api('GET', k)));
    D.backlog = b.data || { items: BACKLOG }; D.pricing = p.data || { ...PRICING }; D.canvas = c.data || JSON.parse(JSON.stringify(CANVAS));
  } catch (e) {
    $('#aMain').innerHTML = e.status === 403 ? '<div class="panel"><h2>Só para o dono do produto</h2><p class="small">Esta página aparece só para os e-mails cadastrados em ADMIN_EMAILS.</p></div>'
      : '<div class="panel"><h2>Não foi possível carregar</h2><p class="small">Confira se o schema.sql foi rodado de novo e se as variáveis do servidor estão certas.</p></div>';
    return;
  }
  $('#aNav').hidden = false;
  document.querySelectorAll('#aNav [data-t]').forEach(b => b.onclick = () => go(b.dataset.t));
  const h = location.hash.slice(1); go(['painel', 'backlog', 'bench', 'preco', 'desenho'].includes(h) ? h : 'painel');
})();

function go(t) {
  tab = t; history.replaceState(null, '', '#' + t);
  document.querySelectorAll('#aNav [data-t]').forEach(b => b.toggleAttribute('aria-current', b.dataset.t === t));
  ({ painel, backlog, bench, preco, desenho })[t]($('#aMain'));
  window.scrollTo(0, 0);
}

// ---------- Painel ----------
function painel(el) {
  const items = D.backlog.items, count = s => items.filter(i => i.status === s).length;
  el.innerHTML = `<div class="ahead"><h1>Painel</h1><span class="tiny muted">Números somados de todas as famílias</span></div>
    <div class="mgrid">${[['No backlog agora', count('agora')], ['Próximos', count('proximo')], ['Ideias', count('ideia')], ['Feitos', count('feito')]].map(([k, v]) => `<div class="mcard"><span class="tiny muted">${k}</span><span class="num">${v}</span></div>`).join('')}</div>
    <div class="panel stack" id="mBox"></div>`;
  renderMetrics(el.querySelector('#mBox'));
}

// ---------- Backlog ----------
function backlog(el) {
  const items = D.backlog.items, shown = items.filter(i => !filter || i.status === filter);
  el.innerHTML = `<div class="ahead"><h1>Backlog</h1><div class="rowbtn"><button class="chip" type="button" data-v="quadro" aria-pressed="${view === 'quadro'}">Quadro</button><button class="chip" type="button" data-v="lista" aria-pressed="${view === 'lista'}">Lista</button></div></div>
    <details class="panel" id="bNew"><summary><strong>Nova ideia</strong></summary>
      <div class="stack" style="margin-top:10px"><label class="f">Ideia<input type="text" id="nTitle" maxlength="120" placeholder="Ex.: Revisão de domingo"></label>
      <label class="f">Problema que resolve<input type="text" id="nProb" maxlength="240"></label>
      <div class="grid2"><label class="f">De onde veio<input type="text" id="nOrig" maxlength="60" placeholder="Ex.: Cliente, Luiz, Benchmarking"></label>
      <label class="f">Esforço<select id="nEff">${Object.entries(EFFORT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="f">Status<select id="nStat">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === 'ideia' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="nCost" style="width:auto"> Tem custo de infraestrutura</label></div>
      <div><button class="btn primary" type="button" id="nAdd">Adicionar</button></div></div></details>
    ${view === 'lista' ? `<div class="chips">${[['', 'Todos'], ...Object.entries(STATUS)].map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${v} <span class="tiny muted">${k ? items.filter(i => i.status === k).length : items.length}</span></button>`).join('')}</div>
      <div class="blist">${shown.map(rowHTML).join('') || '<p class="small muted">Nada aqui.</p>'}</div>`
    : `<div class="kanban">${['agora', 'proximo', 'ideia', 'depois', 'feito'].map(s => `<section class="kcol"><h3>${STATUS[s]} <span class="tiny muted">${items.filter(i => i.status === s).length}</span></h3>${items.filter(i => i.status === s).map(cardHTML).join('')}</section>`).join('')}</div>`}`;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; backlog(el); });
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; backlog(el); });
  el.querySelectorAll('[data-st]').forEach(s => s.onchange = async () => { const i = items.find(x => x.id === s.dataset.st); i.status = s.value; await save('backlog', `"${i.title}" foi para ${STATUS[i.status]}.`); backlog(el); });
  el.querySelectorAll('[data-ef]').forEach(s => s.onchange = async () => { items.find(x => x.id === s.dataset.ef).effort = s.value; await save('backlog'); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    const i = items.find(x => x.id === b.dataset.del);
    if (!await confirmInline(e.target, { text: `Apagar a ideia "${esc(i.title)}" do backlog?`, yes: 'Sim, apagar', danger: true })) return;
    D.backlog.items = items.filter(x => x.id !== i.id); await save('backlog', 'Ideia apagada.'); backlog(el);
  });
  $('#nAdd').onclick = async e => {
    clearInvalid(el);
    const title = $('#nTitle').value.trim(); const m = checkName(title, 'a ideia', 3, 120); if (m) return invalid($('#nTitle'), m);
    if (items.some(i => i.title.toLowerCase() === title.toLowerCase())) return invalid($('#nTitle'), 'Essa ideia já está no backlog.');
    if (!await confirmInline(e.target, { text: `Adicionar "${esc(title)}" ao backlog como ${STATUS[$('#nStat').value]}?`, yes: 'Sim, adicionar' })) return;
    items.unshift({ id: uid(), title, problem: $('#nProb').value.trim(), origin: $('#nOrig').value.trim() || 'Luiz', effort: $('#nEff').value, status: $('#nStat').value, cost: $('#nCost').checked, notes: '' });
    await save('backlog', 'Ideia adicionada.'); backlog(el);
  };
}
const statusSel = i => `<select data-st="${i.id}" aria-label="Status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === i.status ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
const cardHTML = i => `<article class="kcard"><strong>${esc(i.title)}</strong>${i.problem ? `<span class="tiny">${esc(i.problem)}</span>` : ''}
  <span><span class="tag">${EFFORT[i.effort] || ''}</span> ${i.cost ? '<span class="tag cost">custo</span>' : ''} <span class="tiny">${esc(i.origin || '')}</span></span>${statusSel(i)}</article>`;
const rowHTML = i => `<div class="brow3"><span><strong>${esc(i.title)}</strong>${i.problem ? `<br><span class="tiny muted">${esc(i.problem)}</span>` : ''}<br><span class="tiny muted">${esc(i.origin || '')}</span> ${i.cost ? '<span class="tag cost">custo</span>' : ''}</span>
  ${statusSel(i)}<select data-ef="${i.id}" aria-label="Esforço">${Object.entries(EFFORT).map(([k, v]) => `<option value="${k}"${k === i.effort ? ' selected' : ''}>${v}</option>`).join('')}</select>
  <button class="chip" type="button" data-del="${i.id}" aria-label="Apagar">×</button></div>`;

// ---------- Benchmarking ----------
function bench(el) {
  el.innerHTML = `<div class="ahead"><h1>Benchmarking</h1><span class="tiny muted">Pesquisa de 30/10/2026. Valores sem confirmação estão marcados.</span></div>
    <div class="panel"><div class="tw"><table class="atable"><thead><tr><th>App</th><th>País</th><th>Foco</th><th>Destaques</th><th>Preço</th><th>Principal reclamação</th></tr></thead>
    <tbody>${BENCH.map(r => `<tr>${r.map((c, i) => i === 0 ? `<td><strong>${esc(c)}</strong></td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="cgrid">
      <div class="cbox"><h3>O que quase todos têm</h3><p class="small">Categorias com gráfico, orçamento com aviso, metas, cartões, contas a pagar, senha ou biometria. Sincronização automática, que é também a maior fonte de reclamação.</p></div>
      <div class="cbox"><h3>O que diferencia</h3><p class="small">Casal incluído sem cobrar por pessoa; categorias que aprendem; um ritual curto (revisão semanal ou mensal); assistente que responde sobre os próprios dados; lançar com quase zero esforço; sem anúncios e cobrança clara.</p></div>
      <div class="cbox"><h3>Por que abandonam</h3><p class="small">Pendências que se acumulam; números em que não confiam; método rígido demais; grátis que encolhe; cobrança abusiva; não serve para todos da família; suporte lento.</p></div>
    </div>
    <p class="small muted">As 25 ideias tiradas desta pesquisa estão no Backlog, com a origem "Benchmarking".</p>`;
}

// ---------- Precificação ----------
const FIELDS = [
  ['families', 'Famílias usando o app', 1, 1e7, true], ['payingPct', 'Que pagam (%)', 0, 100, false], ['priceMonthly', 'Preço mensal (R$)', 0, 1000, false], ['priceYearly', 'Preço anual (R$)', 0, 10000, false],
  ['yearlyShare', 'Dos que pagam, quantos no anual (%)', 0, 100, false], ['activePct', 'Famílias ativas no mês (%)', 0, 100, false], ['aiPerFamily', 'Custo de IA por família ativa (R$/mês, estimativa)', 0, 100, false],
  ['feePct', 'Taxa de pagamento (%)', 0, 30, false], ['fx', 'Dólar (R$)', 1, 20, false], ['supabaseUsd', 'Supabase (US$/mês; 0 no grátis, 25 no Pro)', 0, 10000, false], ['vercelUsd', 'Vercel (US$/mês; 0 no grátis, 20 no Pro)', 0, 10000, false],
];
function preco(el) {
  const p = D.pricing;
  el.innerHTML = `<div class="ahead"><h1>Precificação</h1><span class="tiny muted">Simulador por mês. Mude os números e veja o resultado.</span></div>
    <div class="pgrid"><div class="panel stack"><h2>Premissas</h2>${FIELDS.map(([k, l]) => `<label class="f">${l}<input type="number" step="any" data-p="${k}" value="${p[k]}"></label>`).join('')}
      <div class="rowbtn"><button class="btn primary" type="button" id="pSave">Salvar cenário</button><button class="btn" type="button" id="pReset">Voltar ao padrão</button></div></div>
    <div class="stack"><div class="panel stack"><h2>Resultado por mês</h2><div class="pout" id="pOut"></div><p class="tiny muted" id="pBe"></p></div>
      <div class="panel stack"><h2>Por tamanho</h2><div class="tw"><table class="atable" id="pScale"></table></div></div>
      <div class="panel stack"><h2>Referência do mercado (Brasil)</h2><p class="small">Anual de R$ 99,90 a R$ 179,90 (cerca de R$ 8 a 15 por mês); mensal de R$ 20 a 33. Mobills R$ 99,90/ano; Organizze R$ 32,90/mês ou R$ 159/ano; Kinvo R$ 179,90/ano. Lá fora, US$ 95 a 109 por ano com o parceiro incluído.</p>
      <p class="small">Sugestão da pesquisa: cobrar por família (não por pessoa), R$ 9,90 a 14,90 por mês ou R$ 89,90 a 119,90 por ano; no grátis, PDF e fechamento do mês; no pago, o que usa IA.</p></div></div></div>`;
  const draw = () => {
    const r = pricingCalc(p), cls = v => v >= 0 ? 'pos' : 'neg';
    $('#pOut').innerHTML = [['Assinantes', Math.round(r.payers)], ['Receita', money(r.revenue)], ['Custo de IA', money(r.ai)], ['Taxas de pagamento', money(r.fees)], ['Servidores', money(r.infra)], ['Resultado', `<span class="${cls(r.result)}">${money(r.result)}</span>`]]
      .map(([k, v]) => `<div class="mcard"><span class="tiny muted">${k}</span><span class="num">${v}</span></div>`).join('');
    $('#pBe').textContent = r.breakEven == null ? 'Com essas premissas, cada família dá prejuízo: aumente o preço ou a % que paga, ou reduza o custo de IA.' : r.infra ? `Ponto de equilíbrio: cerca de ${r.breakEven.toLocaleString('pt-BR')} famílias. Margem atual: ${Math.round(r.margin * 100)}%.` : `Sem custo fixo de servidor: dá resultado desde a primeira família pagante. Margem: ${Math.round(r.margin * 100)}%.`;
    $('#pScale').innerHTML = `<thead><tr><th>Famílias</th><th>Assinantes</th><th>Receita</th><th>Resultado</th></tr></thead><tbody>${[100, 500, 1000, 5000, 20000].map(f => { const x = pricingCalc({ ...p, families: f }); return `<tr><td>${f.toLocaleString('pt-BR')}</td><td>${Math.round(x.payers).toLocaleString('pt-BR')}</td><td>${money(x.revenue)}</td><td class="${cls(x.result)}">${money(x.result)}</td></tr>`; }).join('')}</tbody>`;
  };
  el.querySelectorAll('[data-p]').forEach(i => i.oninput = () => { const v = +String(i.value).replace(',', '.'); if (isFinite(v)) { p[i.dataset.p] = v; draw(); } });
  $('#pSave').onclick = async e => {
    clearInvalid(el);
    for (const [k, l, mn, mx, int] of FIELDS) { const m = checkNumber(p[k], { min: mn, max: mx, integer: int, label: l }); if (m) return invalid(el.querySelector(`[data-p="${k}"]`), m); }
    if (!await confirmInline(e.target, { text: 'Salvar este cenário de preço?', yes: 'Sim, salvar' })) return;
    await save('pricing', 'Cenário salvo.');
  };
  $('#pReset').onclick = async e => { if (!await confirmInline(e.target, { text: 'Voltar as premissas para o padrão? O cenário salvo só muda se você salvar depois.', yes: 'Sim, voltar' })) return; D.pricing = { ...PRICING }; preco(el); };
  draw();
}

// ---------- Desenho do produto ----------
const CBOX = [['problema', 'Problema'], ['publico', 'Para quem'], ['proposta', 'Proposta de valor'], ['diferenciais', 'Diferenciais'], ['metricas', 'Métricas-chave'], ['canais', 'Canais'], ['receita', 'Receita'], ['custos', 'Custos'], ['riscos', 'Riscos']];
function desenho(el) {
  const c = D.canvas;
  el.innerHTML = `<div class="ahead"><h1>Desenho do produto</h1><button class="btn primary" type="button" id="cSave">Salvar</button></div>
    <h2>Canvas</h2><div class="cgrid">${CBOX.map(([k, l]) => `<div class="cbox"><h3>${l}</h3><textarea data-c="${k}" aria-label="${l}">${esc(c[k] || '')}</textarea></div>`).join('')}</div>
    <div class="ahead"><h2>Personas</h2><button class="chip" type="button" id="pnAdd">Adicionar persona</button></div>
    <div class="cgrid" id="pnList">${c.personas.map((p, i) => `<div class="cbox"><input type="text" data-pn="${i}" data-k="nome" value="${esc(p.nome)}" aria-label="Nome da persona" style="font-weight:700">
      ${[['quem', 'Quem é'], ['quer', 'O que quer'], ['dor', 'O que dói']].map(([k, l]) => `<label class="f tiny">${l}<textarea data-pn="${i}" data-k="${k}" style="min-height:60px">${esc(p[k] || '')}</textarea></label>`).join('')}
      <button class="linkbtn tiny" type="button" data-pndel="${i}">Remover</button></div>`).join('')}</div>
    <h2>Jornada</h2><div class="jgrid">${c.jornada.map((j, i) => `<div class="jstep"><input type="text" data-jn="${i}" data-k="etapa" value="${esc(j.etapa)}" aria-label="Etapa" style="font-weight:700">
      <label class="f tiny">Objetivo<textarea data-jn="${i}" data-k="objetivo" style="min-height:60px">${esc(j.objetivo)}</textarea></label><label class="f tiny">Métrica<input type="text" data-jn="${i}" data-k="metrica" value="${esc(j.metrica)}"></label></div>`).join('')}</div>`;
  el.querySelectorAll('[data-c]').forEach(t => t.oninput = () => { c[t.dataset.c] = t.value; });
  el.querySelectorAll('[data-pn]').forEach(t => t.oninput = () => { c.personas[+t.dataset.pn][t.dataset.k] = t.value; });
  el.querySelectorAll('[data-jn]').forEach(t => t.oninput = () => { c.jornada[+t.dataset.jn][t.dataset.k] = t.value; });
  $('#pnAdd').onclick = () => { c.personas.push({ nome: 'Nova persona', quem: '', quer: '', dor: '' }); desenho(el); };
  el.querySelectorAll('[data-pndel]').forEach(b => b.onclick = async e => {
    const p = c.personas[+b.dataset.pndel];
    if (!await confirmInline(e.target, { text: `Remover a persona "${esc(p.nome)}"? Vale quando você salvar.`, yes: 'Sim, remover', danger: true })) return;
    c.personas.splice(+b.dataset.pndel, 1); desenho(el);
  });
  $('#cSave').onclick = async e => {
    if (!await confirmInline(e.target, { text: 'Salvar o canvas, as personas e a jornada?', yes: 'Sim, salvar' })) return;
    await save('canvas', 'Desenho do produto salvo.');
  };
}
