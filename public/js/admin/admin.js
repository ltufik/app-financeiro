// Product console (/admin): dashboard, feedback, usage, FAQ, backlog, service matrix, docs, benchmarking, pricing and product design.
// Only for ADMIN_EMAILS: the data comes from /api/admin and /api/metrics, which check the login.
import * as db from '../db.js';
import { esc } from '../lib/format.js';
import { $, toast, confirmInline, invalid, clearInvalid, md } from '../ui.js';
import { checkName, checkNumber } from '../lib/validate.js';
import { renderMetrics } from '../metrics.js';
import { BACKLOG, BENCH, PRICING, CANVAS } from './seed.js';
import { pricingCalc } from '../lib/pricing.js';
import { FAQ, FAQ_TOPICS } from '../lib/faq.js';
import { NEWS, replyTemplate, replyTitle } from '../lib/news.js';
import { SCREENS, FLOWS, flowFunnel } from './flows.js';
import { SERVICES, SV_STATUS, SV_PLAN, SV_AI, DOCS, FEATURE_LABELS, AREA_LABELS } from './content.js';

const STATUS = { agora: 'Agora', proximo: 'Próximo', ideia: 'Ideia', depois: 'Depois', feito: 'Feito', descartado: 'Descartado' };
const EFFORT = { P: 'Pequeno', M: 'Médio', G: 'Grande' };
const D = { backlog: null, pricing: null, canvas: null, faq: null, services: null, docs: null, news: null };
const TABS = ['painel', 'opinioes', 'uso', 'duvidas', 'novidades', 'fluxos', 'backlog', 'servicos', 'docs', 'bench', 'preco', 'desenho'];
let FB = null, USE = null, useDays = 30;
let token = '', tab = 'painel', view = 'quadro', filter = '';
const money = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const uid = () => Math.random().toString(36).slice(2, 10);

async function api(method, key, data) {
  const r = await fetch('/api/admin' + (method === 'GET' ? '?key=' + key : ''), { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: method === 'PUT' ? JSON.stringify({ key, data }) : undefined });
  if (!r.ok) { const e = new Error(String(r.status)); e.status = r.status; throw e; }
  return r.json();
}
async function save(key, msg) {
  try {
    const res = await api('PUT', key, D[key]);
    const n = res?.loop?.replied || 0;
    if (n) { toast(`Pronto! Recado automático enviado para ${n} ${n > 1 ? 'pessoas que pediram' : 'pessoa que pediu'}.`); FB = null; }
    else if (msg) toast(msg);
    return res;
  } catch (e) { toast('Não foi possível salvar. Verifique a internet e tente de novo.'); return null; }
}

(async function boot() {
  try { await db.init(); } catch (e) { $('#aMain').innerHTML = '<div class="panel"><p>O app ainda não foi configurado.</p></div>'; return; }
  const { data } = await db.sb.auth.getSession();
  token = data?.session?.access_token || '';
  if (!token) { $('#aMain').innerHTML = '<div class="panel stack"><h2>Entre primeiro</h2><p class="small">Abra o app, entre com o seu e-mail e senha e volte para esta página.</p><div><a class="btn primary" href="/">Abrir o app</a></div></div>'; return; }
  $('#aWho').textContent = data.session.user.email;
  try {
    const [b, p, c, f, sv, dc, nw] = await Promise.all(['backlog', 'pricing', 'canvas', 'faq', 'services', 'docs', 'news'].map(k => api('GET', k)));
    D.news = nw.data || { items: JSON.parse(JSON.stringify(NEWS)) };
    D.backlog = b.data || { items: BACKLOG }; D.pricing = p.data || { ...PRICING }; D.canvas = c.data || JSON.parse(JSON.stringify(CANVAS));
    D.faq = f.data || { items: JSON.parse(JSON.stringify(FAQ)) }; D.services = sv.data || { items: JSON.parse(JSON.stringify(SERVICES)) }; D.docs = dc.data || { items: JSON.parse(JSON.stringify(DOCS)) };
  } catch (e) {
    $('#aMain').innerHTML = e.status === 403 ? '<div class="panel"><h2>Só para o dono do produto</h2><p class="small">Esta página aparece só para os e-mails cadastrados em ADMIN_EMAILS.</p></div>'
      : '<div class="panel"><h2>Não foi possível carregar</h2><p class="small">Confira se o schema.sql foi rodado de novo e se as variáveis do servidor estão certas.</p></div>';
    return;
  }
  $('#aNav').hidden = false;
  document.querySelectorAll('#aNav [data-t]').forEach(b => b.onclick = () => go(b.dataset.t));
  const h = location.hash.slice(1); go(TABS.includes(h) ? h : 'painel');
})();

function go(t) {
  tab = t; history.replaceState(null, '', '#' + t);
  document.querySelectorAll('#aNav [data-t]').forEach(b => b.toggleAttribute('aria-current', b.dataset.t === t));
  ({ painel, opinioes, uso, duvidas, novidades, fluxos, backlog, servicos, docs, bench, preco, desenho })[t]($('#aMain'));
  window.scrollTo(0, 0);
}

// ---------- Painel ----------
async function painel(el) {
  const items = D.backlog.items, count = s => items.filter(i => i.status === s).length;
  el.innerHTML = `<div class="ahead"><h1>Painel</h1><span class="tiny muted">Visão geral do produto</span></div>
    <div class="mgrid" id="pTop"></div>
    <div class="mgrid">${[['No backlog agora', count('agora')], ['Próximos', count('proximo')], ['Ideias', count('ideia')], ['Feitos', count('feito')]].map(([k, v]) => `<div class="mcard"><span class="tiny muted">${k}</span><span class="num">${v}</span></div>`).join('')}</div>
    <div class="panel stack" id="mBox"></div>`;
  renderMetrics(el.querySelector('#mBox'));
  try {
    const [fb, us] = await Promise.all([loadFb(), loadUse()]);
    const week = new Date(Date.now() - 7 * 864e5 - 3 * 3600e3).toISOString().slice(0, 10);
    const active = us.people.filter(p => p.last_day >= week).length, fresh = fb.filter(f => f.status === 'novo').length, unans = fb.filter(f => f.kind === 'duvida' && f.helpful === false).length;
    const top = Object.entries(us.features).filter(([k]) => !k.startsWith('aba.') && !k.startsWith('menu.')).sort((a, b) => b[1].users - a[1].users)[0];
    $('#pTop').innerHTML = [['Opiniões novas', fresh, 'abrir', 'opinioes'], ['Dúvidas sem resposta boa', unans, 'abrir', 'duvidas'], ['Usaram nos últimos 7 dias', active, `de ${us.people.length} pessoas`, 'uso'], ['Mais usado', top ? esc(FEATURE_LABELS[top[0]] || top[0]) : '—', top ? `${top[1].users} pessoas` : '', 'uso']]
      .map(([k, v, s, t]) => `<button type="button" class="mcard mlink" data-go="${t}"><span class="tiny muted">${k}</span><span class="num" style="${typeof v === 'string' ? 'font-size:17px' : ''}">${v}</span><span class="tiny muted">${s}</span></button>`).join('');
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  } catch (e) { $('#pTop').innerHTML = '<p class="small muted">Opiniões e uso aparecem depois de rodar o schema.sql novo no Supabase.</p>'; }
}

// ---------- Backlog ----------
function backlog(el) {
  const items = D.backlog.items, shown = items.filter(i => !filter || i.status === filter);
  el.innerHTML = `<div class="ahead"><h1>Backlog</h1><div class="rowbtn"><button class="chip" type="button" data-v="quadro" aria-pressed="${view === 'quadro'}">Quadro</button><button class="chip" type="button" data-v="lista" aria-pressed="${view === 'lista'}">Lista</button></div></div>
    <details class="panel" id="bNew"><summary><strong>Nova ideia</strong></summary>
      <div class="stack" style="margin-top:10px"><label class="f">Ideia<input type="text" id="nTitle" maxlength="120" placeholder="Ex.: Revisão de domingo"></label>
      <label class="f">Problema que resolve<input type="text" id="nProb" maxlength="240"></label>
      <div class="grid2"><label class="f">De onde veio<input type="text" id="nOrig" maxlength="60" placeholder="Ex.: Testador, Equipe, Benchmarking"></label>
      <label class="f">Esforço<select id="nEff">${Object.entries(EFFORT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="f">Status<select id="nStat">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === 'ideia' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="nCost" style="width:auto"> Tem custo de infraestrutura</label></div>
      <div><button class="btn primary" type="button" id="nAdd">Adicionar</button></div></div></details>
    ${view === 'lista' ? `<div class="chips">${[['', 'Todos'], ...Object.entries(STATUS)].map(([k, v]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${v} <span class="tiny muted">${k ? items.filter(i => i.status === k).length : items.length}</span></button>`).join('')}</div>
      <div class="blist">${shown.map(rowHTML).join('') || '<p class="small muted">Nada aqui.</p>'}</div>`
    : `<div class="kanban">${['agora', 'proximo', 'ideia', 'depois', 'feito'].map(s => `<section class="kcol"><h3>${STATUS[s]} <span class="tiny muted">${items.filter(i => i.status === s).length}</span></h3>${items.filter(i => i.status === s).map(cardHTML).join('')}</section>`).join('')}</div>`}`;
  el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; backlog(el); });
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; backlog(el); });
  el.querySelectorAll('[data-st]').forEach(s => s.onchange = async e => {
    const i = items.find(x => x.id === s.dataset.st); i.status = s.value; await save('backlog', `"${i.title}" foi para ${STATUS[i.status]}.`);
    void e; backlog(el);
  });
  el.querySelectorAll('[data-where]').forEach(t => t.onchange = async () => { items.find(x => x.id === t.dataset.where).where = t.value.trim(); await save('backlog', 'Salvo.'); });
  el.querySelectorAll('[data-claude]').forEach(b => b.onclick = async () => {
    const i = items.find(x => x.id === b.dataset.claude);
    const t = `Pedido do backlog do Pra Onde Foi\nItem: ${i.id}\nO que fazer: ${i.title}${i.problem ? '\nProblema: ' + i.problem : ''}${i.where ? '\nOnde fica: ' + i.where : ''}\nPedido por: ${askers(i)} pessoa(s)\nQuando publicar, inclua o item ${i.id} na versão, para o recado automático sair para quem pediu.`;
    try { await navigator.clipboard.writeText(t); toast('Pedido copiado. Cole na conversa com o Claude.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = t; b.after(ta); ta.select(); toast('Selecionei o texto: copie e cole na conversa com o Claude.', 'info'); }
  });
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
    items.unshift({ id: uid(), title, problem: $('#nProb').value.trim(), origin: $('#nOrig').value.trim() || 'Equipe', effort: $('#nEff').value, status: $('#nStat').value, cost: $('#nCost').checked, notes: '' });
    await save('backlog', 'Ideia adicionada.'); backlog(el);
  };
}
const statusSel = i => `<select data-st="${i.id}" aria-label="Status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === i.status ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
const askers = i => [...new Set([...(i.from || []), ...[...String(i.notes || '').matchAll(/Opinião #(\d+)/g)].map(m => +m[1])])].length;
const askTag = i => askers(i) ? `<span class="tag ask" title="Recebem um recado automático quando ficar pronto">pedido por ${askers(i)}</span>` : '';
const cardHTML = i => `<article class="kcard"><strong>${esc(i.title)}</strong>${i.problem ? `<span class="tiny">${esc(i.problem)}</span>` : ''}${askTag(i) ? `<span>${askTag(i)}</span>` : ''}
  <span><span class="tag">${EFFORT[i.effort] || ''}</span> ${i.cost ? '<span class="tag cost">custo</span>' : ''} <span class="tiny">${esc(i.origin || '')}</span></span>${statusSel(i)}</article>`;
const rowHTML = i => `<div class="brow3"><span><strong>${esc(i.title)}</strong>${i.problem ? `<br><span class="tiny muted">${esc(i.problem)}</span>` : ''}<br><span class="tiny muted">${esc(i.origin || '')}</span> ${i.cost ? '<span class="tag cost">custo</span>' : ''} ${askTag(i)}
    ${i.status !== 'feito' ? `<span class="bmore"><input type="text" data-where="${esc(i.id)}" value="${esc(i.where || '')}" placeholder="Onde vai ficar no app (vai no recado)" maxlength="80"><button class="chip" type="button" data-claude="${esc(i.id)}">Pedir ao Claude</button></span>` : ''}</span>
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

// ---------- shared loaders ----------
async function getView(name, q = '') {
  const r = await fetch('/api/admin?view=' + name + q, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error(String(r.status)); return r.json();
}
async function loadFb(force) { if (!FB || force) FB = await getView('feedback'); return FB; }
async function loadUse(force) { if (!USE || force) USE = await getView('usage', '&days=' + useDays); return USE; }
async function patchFb(id, patch) {
  const r = await fetch('/api/admin', { method: 'PATCH', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ feedback: id, ...patch }) });
  if (!r.ok) throw new Error(String(r.status));
}
const dt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const ago = d => { if (!d) return 'nunca'; const n = Math.round((Date.parse(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)) - Date.parse(d)) / 864e5); return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`; };
const who = f => esc(f.name || f.email || 'Pessoa que saiu do app');
const fail = (el, title) => { el.innerHTML = `<div class="ahead"><h1>${title}</h1></div><div class="panel"><p class="small">Não foi possível carregar. Confira se o schema.sql novo foi rodado no Supabase.</p></div>`; };

// ---------- Opiniões ----------
const FB_KIND = { erro: 'Erro', ideia: 'Ideia', critica: 'Crítica', duvida: 'Dúvida' };
const FB_STATUS = { novo: 'Nova', visto: 'Lida', backlog: 'No backlog', resolvido: 'Resolvida' };
let fbKind = '', fbStatus = 'aberto', replyOpen = null;
async function opinioes(el) {
  el.innerHTML = '<div class="ahead"><h1>Opiniões</h1></div><p class="small muted">Carregando...</p>';
  let list; try { list = await loadFb(true); } catch (e) { return fail(el, 'Opiniões'); }
  const shown = list.filter(f => (!fbKind || f.kind === fbKind) && (fbStatus === '' || (fbStatus === 'aberto' ? ['novo', 'visto'].includes(f.status) : f.status === fbStatus)));
  el.innerHTML = `<div class="ahead"><h1>Opiniões</h1><span class="tiny muted">${list.length} recebidas · ${list.filter(f => f.status === 'novo').length} novas</span></div>
    <div class="chips">${[['', 'Todos os tipos'], ...Object.entries(FB_KIND)].map(([k, l]) => `<button class="chip" type="button" data-k="${k}" aria-pressed="${fbKind === k}">${l} <span class="tiny muted">${list.filter(f => !k || f.kind === k).length}</span></button>`).join('')}</div>
    <div class="chips">${[['aberto', 'Em aberto'], ...Object.entries(FB_STATUS), ['', 'Todas']].map(([k, l]) => `<button class="chip" type="button" data-s="${k}" aria-pressed="${fbStatus === k}">${l}</button>`).join('')}</div>
    <div class="stack">${shown.map(f => `<article class="panel stack fbcard" data-id="${f.id}">
      <div class="fbmeta"><span class="tag k-${f.kind}">${FB_KIND[f.kind]}</span><strong>${who(f)}</strong><span class="tiny muted">${esc(f.family || '')} · ${dt(f.created_at)} · tela ${esc(f.screen || '—')} · ${esc(f.device || '')} · ${esc(f.version || '')}</span></div>
      <p class="small" style="white-space:pre-wrap;margin:0">${esc(f.text)}</p>
      ${f.kind === 'duvida' ? `<div class="tiny muted" style="border-left:3px solid var(--line);padding-left:10px">${f.answer ? 'Resposta do assistente: ' + esc(f.answer) : 'Sem resposta do assistente.'}<br><strong>${f.helpful === true ? 'Resolveu' : f.helpful === false ? 'Não resolveu' : 'Não respondeu se resolveu'}</strong></div>` : ''}
      <div class="fbact"><select data-st aria-label="Situação">${Object.entries(FB_STATUS).map(([k, l]) => `<option value="${k}"${k === f.status ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <input type="text" data-note placeholder="Nota interna (só você vê)" value="${esc(f.note || '')}" maxlength="2000">
        ${f.kind === 'duvida' ? '<button class="chip" type="button" data-faq>Responder nas Dúvidas</button>' : `<button class="chip" type="button" data-bl${f.status === 'backlog' ? ' disabled' : ''}>Virar item do backlog</button>`}
        ${f.kind !== 'duvida' && f.status !== 'backlog' ? `<select data-join aria-label="Juntar a um item do backlog"><option value="">Já está no backlog? Juntar a…</option>${D.backlog.items.filter(i => !['feito', 'descartado'].includes(i.status)).map(i => `<option value="${esc(i.id)}">${esc(i.title.length > 60 ? i.title.slice(0, 60) + '…' : i.title)}</option>`).join('')}</select>` : ''}
        <button class="chip" type="button" data-rp>${f.reply ? 'Mandar outro recado' : 'Escrever recado agora'}</button></div>
      ${!f.reply && f.status === 'backlog' ? `<p class="tiny muted" style="margin:0">Quando o item do backlog for para Feito, ${esc(f.name ? f.name.split(' ')[0] : 'a pessoa')} recebe um recado automático.</p>` : ''}
      ${f.reply ? `<p class="tiny replied">Recado enviado em ${dt(f.replied_at)} · ${f.reply_seen ? 'a pessoa já viu' : 'ainda não viu'}: "${esc(f.reply)}"</p>` : ''}
      <div class="rpbox stack" hidden><p class="tiny muted">A pessoa vê este recado ao abrir o app, com o título "${esc(replyTitle(f.kind, f.name))}", e recebe no celular se tiver os avisos ligados.</p>
        <textarea data-rptext maxlength="1000" aria-label="Recado para ${who(f)}" style="min-height:80px"></textarea>
        <div class="rowbtn"><button class="btn primary" type="button" data-rpsend>Enviar recado</button><button class="btn" type="button" data-rpcancel>Cancelar</button></div></div>
    </article>`).join('') || '<p class="small muted">Nada aqui.</p>'}</div>`;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { fbKind = b.dataset.k; opinioes(el); });
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { fbStatus = b.dataset.s; opinioes(el); });
  el.querySelectorAll('.fbcard').forEach(card => {
    const f = list.find(x => x.id === +card.dataset.id);
    card.querySelector('[data-st]').onchange = async e => { try { await patchFb(f.id, { status: e.target.value }); f.status = e.target.value; toast('Situação atualizada.'); } catch (x) { toast('Não foi possível salvar.'); } };
    card.querySelector('[data-note]').onchange = async e => { try { await patchFb(f.id, { note: e.target.value }); f.note = e.target.value; toast('Nota salva.'); } catch (x) { toast('Não foi possível salvar.'); } };
    const bl = card.querySelector('[data-bl]');
    if (bl) bl.onclick = async e => {
      const title = f.text.length > 90 ? f.text.slice(0, 90) + '…' : f.text;
      if (!await confirmInline(e.target, { text: `Adicionar ao backlog como Ideia: "${esc(title)}"?`, yes: 'Sim, adicionar' })) return;
      D.backlog.items.unshift({ id: uid(), title, problem: f.text, origin: `${FB_KIND[f.kind]} de ${f.name || 'testador'}`, effort: 'M', status: 'ideia', cost: false, notes: '', from: [f.id], where: '' });
      await save('backlog');
      try { await patchFb(f.id, { status: 'backlog' }); f.status = 'backlog'; } catch (x) { /* backlog already saved */ }
      toast('Foi para o backlog.'); opinioes(el);
    };
    const join = card.querySelector('[data-join]');
    if (join) join.onchange = async e => {
      const it = D.backlog.items.find(i => i.id === e.target.value); if (!it) return;
      if (!await confirmInline(e.target, { text: `Juntar esta opinião ao item "${esc(it.title)}"? Quando ele ficar pronto, ${esc(f.name || 'a pessoa')} recebe o recado automático.`, yes: 'Sim, juntar' })) { e.target.value = ''; return; }
      it.from = [...new Set([...(it.from || []), f.id])]; await save('backlog');
      try { await patchFb(f.id, { status: 'backlog' }); f.status = 'backlog'; } catch (x) { /* saved in backlog anyway */ }
      toast('Opinião juntada ao item do backlog.'); opinioes(el);
    };
    const fq = card.querySelector('[data-faq]');
    if (fq) fq.onclick = () => { faqDraft = { q: f.text, a: f.answer || '', from: f.id }; go('duvidas'); };
    const box = card.querySelector('.rpbox'), ta = card.querySelector('[data-rptext]');
    const openReply = () => { box.hidden = false; if (!ta.value) ta.value = replyTemplate(f.kind, f.name, f.text); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); };
    card.querySelector('[data-rp]').onclick = openReply;
    card.querySelector('[data-rpcancel]').onclick = () => { box.hidden = true; };
    card.querySelector('[data-rpsend]').onclick = async e => {
      clearInvalid(card);
      const t = ta.value.trim(); if (t.length < 20) return invalid(ta, 'Escreva o recado: o que foi feito e onde a pessoa encontra.');
      if (!await confirmInline(e.target, { text: `Enviar este recado para ${who(f)}?`, yes: 'Sim, enviar' })) return;
      try {
        const r = await fetch('/api/admin', { method: 'PATCH', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ feedback: f.id, reply: t }) });
        if (!r.ok) throw new Error(String(r.status)); const j = await r.json();
        Object.assign(f, { reply: t, replied_at: new Date().toISOString(), reply_seen: false, status: 'resolvido' });
        toast(j.pushed ? `Recado enviado e notificação entregue no celular de ${f.name || 'quem mandou'}.` : `Recado enviado. ${f.name || 'A pessoa'} vê ao abrir o app.`);
        opinioes(el);
      } catch (x) { toast('Não foi possível enviar o recado. Tente de novo.'); }
    };
    if (replyOpen === f.id) { replyOpen = null; openReply(); card.scrollIntoView({ block: 'center' }); }
  });
}

// ---------- Uso ----------
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const heat = (v, mx) => v ? `background:color-mix(in srgb,var(--accent) ${Math.round(15 + 85 * v / mx)}%,var(--card))` : '';
async function uso(el) {
  el.innerHTML = '<div class="ahead"><h1>Uso</h1></div><p class="small muted">Carregando...</p>';
  let u; try { u = await loadUse(true); } catch (e) { return fail(el, 'Uso'); }
  const feats = Object.entries(u.features).sort((a, b) => b[1].users - a[1].users || b[1].n - a[1].n), mxU = Math.max(1, ...feats.map(f => f[1].users));
  const hm = Array.from({ length: 7 }, () => Array(24).fill(0)); u.hours.forEach(([d, h, n]) => { hm[d][h] += n; }); const mxH = Math.max(1, ...hm.flat());
  const days = Array.from({ length: 28 }, (_, i) => new Date(Date.now() - 3 * 3600e3 - (27 - i) * 864e5).toISOString().slice(0, 10));
  const areas = [...new Set(u.by_day.map(r => r[0]))].sort(), byd = {}; u.by_day.forEach(([a, d, n]) => { byd[a + d] = n; }); const mxD = Math.max(1, ...u.by_day.map(r => r[2]));
  const people = u.people;
  el.innerHTML = `<div class="ahead"><h1>Uso</h1><label class="tiny muted">Período <select id="uDays">${[7, 30, 90].map(d => `<option value="${d}"${d === useDays ? ' selected' : ''}>${d} dias</option>`).join('')}</select></label></div>
    <p class="small muted">Só o nome de cada parte usada, por pessoa, dia e hora. Nenhum valor nem texto das famílias.</p>
    <div class="panel stack"><h2>Quem está usando</h2><div class="tw"><table class="atable"><thead><tr><th>Pessoa</th><th>Família</th><th>Última vez</th><th>Dias ativos</th><th>O que mais usa</th><th>Opiniões</th></tr></thead><tbody>
    ${people.map((p, i) => { const top = Object.entries(p.features || {}).filter(([k]) => !k.startsWith('aba.')).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `<tr class="prow" data-i="${i}" tabindex="0"><td><strong>${esc(p.name || '—')}</strong><br><span class="tiny muted">${esc(p.email || '')}</span></td><td>${esc(p.family || 'Sem família')}</td><td><span class="${p.last_day && ago(p.last_day).match(/há (\d+)/)?.[1] > 7 ? 'neg' : ''}">${ago(p.last_day)}</span></td><td>${p.days}</td><td class="tiny">${top.map(([k, n]) => `${esc(FEATURE_LABELS[k] || k)} (${n})`).join('<br>') || '—'}</td><td>${p.feedbacks || ''}</td></tr>`; }).join('') || '<tr><td colspan="6">Ninguém ainda.</td></tr>'}</tbody></table></div><p class="tiny muted">Toque numa pessoa para ver tudo o que ela usou. Em coral: sem abrir o app há mais de 7 dias.</p><div id="uPerson"></div></div>
    <div class="panel stack"><h2>O que mais usam</h2><p class="tiny muted">Pessoas diferentes que usaram cada parte no período (e quantas vezes no total).</p>
      <div class="frank">${feats.map(([k, v]) => `<div class="frow"><span class="small">${esc(FEATURE_LABELS[k] || k)}</span><span class="fbar"><span style="width:${v.users / mxU * 100}%"></span></span><span class="small num">${v.users} <span class="tiny muted">${v.n}×</span></span></div>`).join('') || '<p class="small muted">Sem uso registrado ainda.</p>'}</div></div>
    <div class="panel stack"><h2>Mapa de calor: dia e hora</h2><p class="tiny muted">Quando o app é usado (horário de Brasília). Mais escuro = mais uso.</p>
      <div class="tw"><table class="heat"><thead><tr><th></th>${Array.from({ length: 24 }, (_, h) => `<th>${h % 3 === 0 ? h + 'h' : ''}</th>`).join('')}</tr></thead><tbody>${hm.map((row, d) => `<tr><th>${DOW[d]}</th>${row.map((v, h) => `<td style="${heat(v, mxH)}" title="${DOW[d]} ${h}h: ${v}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
    <div class="panel stack"><h2>Mapa de calor: parte do app por dia</h2><p class="tiny muted">Pessoas que usaram cada área em cada um dos últimos 28 dias.</p>
      <div class="tw"><table class="heat"><thead><tr><th></th>${days.map((d, i) => `<th>${i % 7 === 0 ? d.slice(8) + '/' + d.slice(5, 7) : ''}</th>`).join('')}</tr></thead><tbody>${areas.map(a => `<tr><th>${esc(AREA_LABELS[a] || a)}</th>${days.map(d => `<td style="${heat(byd[a + d] || 0, mxD)}" title="${d.split('-').reverse().join('/')}: ${byd[a + d] || 0}"></td>`).join('')}</tr>`).join('') || `<tr><td colspan="29" class="small muted">Sem uso registrado ainda.</td></tr>`}</tbody></table></div></div>`;
  $('#uDays').onchange = e => { useDays = +e.target.value; uso(el); };
  el.querySelectorAll('.prow').forEach(tr => tr.onclick = tr.onkeydown = ev => {
    if (ev.type === 'keydown' && ev.key !== 'Enter') return;
    const p = people[+tr.dataset.i], all = Object.entries(p.features || {}).sort((a, b) => b[1] - a[1]);
    $('#uPerson').innerHTML = `<div class="cbox"><h3>${esc(p.name || p.email || '')}</h3><p class="tiny muted">Conta criada em ${dt(p.created_at)} · ${p.days} dias ativos no período</p><ul class="list small">${all.map(([k, n]) => `<li><span>${esc(FEATURE_LABELS[k] || k)}</span><span class="amt">${n}</span></li>`).join('') || '<li>Sem uso no período.</li>'}</ul></div>`;
  });
}

// ---------- Dúvidas (FAQ) ----------
let faqDraft = null;
async function duvidas(el) {
  const items = D.faq.items;
  let asked = []; try { asked = (await loadFb()).filter(f => f.kind === 'duvida'); } catch (e) { /* schema not updated yet */ }
  if (faqDraft) { items.unshift({ id: uid(), t: 'comeco', q: faqDraft.q, a: faqDraft.a }); faqDraft = null; }
  el.innerHTML = `<div class="ahead"><h1>Dúvidas</h1><div class="rowbtn"><button class="chip" type="button" id="fqAdd">Nova pergunta</button><button class="btn primary" type="button" id="fqPub">Publicar no app</button></div></div>
    <p class="small muted">É o que aparece no app em menu ☰ → Dúvidas, e o que o assistente usa para responder perguntas novas. Edite aqui e toque em Publicar.</p>
    ${asked.length ? `<details class="panel"><summary><strong>Perguntas que chegaram</strong> <span class="tiny muted">${asked.length} · ${asked.filter(a => a.helpful === false).length} não resolvidas</span></summary>
      <ul class="list small" style="margin-top:10px">${asked.slice(0, 50).map(a => `<li><span>${esc(a.text)}<br><span class="tiny muted">${who(a)} · ${dt(a.created_at)} · ${a.helpful === true ? 'resolveu' : a.helpful === false ? '<span class="neg">não resolveu</span>' : 'sem retorno'}</span></span><button class="chip" type="button" data-use="${a.id}">Usar</button></li>`).join('')}</ul></details>` : ''}
    <div class="stack" id="fqItems">${items.map((x, i) => `<div class="panel stack fqitem"><div class="fbact"><input type="text" data-i="${i}" data-k="q" value="${esc(x.q)}" aria-label="Pergunta" style="font-weight:700;flex:1">
      <select data-i="${i}" data-k="t" aria-label="Assunto">${Object.entries(FAQ_TOPICS).map(([k, l]) => `<option value="${k}"${k === x.t ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <button class="chip" type="button" data-up="${i}" aria-label="Subir"${i ? '' : ' disabled'}>↑</button><button class="chip" type="button" data-del="${i}" aria-label="Apagar">×</button></div>
      <textarea data-i="${i}" data-k="a" aria-label="Resposta" style="min-height:70px">${esc(x.a)}</textarea></div>`).join('')}</div>`;
  el.querySelectorAll('[data-k]').forEach(t => t.oninput = t.onchange = () => { items[+t.dataset.i][t.dataset.k] = t.value; });
  el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; duvidas(el); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => { const i = +b.dataset.del; if (!await confirmInline(e.target, { text: `Apagar a pergunta "${esc(items[i].q)}"? Vale quando você publicar.`, yes: 'Sim, apagar', danger: true })) return; items.splice(i, 1); duvidas(el); });
  el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { const a = asked.find(x => x.id === +b.dataset.use); faqDraft = { q: a.text, a: a.answer || '' }; duvidas(el); });
  $('#fqAdd').onclick = () => { items.unshift({ id: uid(), t: 'comeco', q: '', a: '' }); duvidas(el); el.querySelector('[data-k="q"]').focus(); };
  $('#fqPub').onclick = async e => {
    clearInvalid(el);
    for (const [i, x] of items.entries()) {
      if ((x.q || '').trim().length < 5) return invalid(el.querySelector(`[data-i="${i}"][data-k="q"]`), 'Escreva a pergunta (pelo menos 5 letras).');
      if ((x.a || '').trim().length < 10) return invalid(el.querySelector(`[data-i="${i}"][data-k="a"]`), 'Escreva a resposta (pelo menos 10 letras).');
    }
    if (!await confirmInline(e.target, { text: `Publicar ${items.length} perguntas no app? Todos os usuários passam a ver esta versão.`, yes: 'Sim, publicar' })) return;
    await save('faq', 'Dúvidas publicadas no app.');
  };
}

// ---------- Matriz de serviços ----------
async function servicos(el) {
  const items = D.services.items;
  let feats = {}; try { feats = (await loadUse()).features; } catch (e) { /* no usage yet */ }
  const useOf = keys => { let users = 0, n = 0; (keys || []).forEach(k => { const f = feats[k]; if (f) { users = Math.max(users, f.users); n += f.n; } }); return { users, n }; };
  const sel = (i, k, map) => `<select data-i="${i}" data-k="${k}" aria-label="${k}">${Object.entries(map).map(([v, l]) => `<option value="${v}"${v === items[i][k] ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const c = k => items.filter(x => x.status === k).length;
  el.innerHTML = `<div class="ahead"><h1>Matriz de serviços</h1><button class="btn primary" type="button" id="svSave">Salvar</button></div>
    <p class="small muted">Tudo o que o app oferece, onde fica, se usa IA (custo por uso), em que plano deve ficar quando houver cobrança e quanto foi usado nos últimos ${useDays} dias.</p>
    <div class="mgrid">${[['No ar', c('no_ar')], ['Em teste', c('teste')], ['Planejados', c('planejado')], ['Usam IA', items.filter(x => x.ai !== 'nao').length]].map(([k, v]) => `<div class="mcard"><span class="tiny muted">${k}</span><span class="num">${v}</span></div>`).join('')}</div>
    <div class="panel"><div class="tw"><table class="atable svt"><thead><tr><th>Serviço</th><th>Onde fica</th><th>Situação</th><th>Plano</th><th>IA</th><th>Depende de</th><th>Uso</th></tr></thead><tbody>
    ${items.map((x, i) => { const u = useOf(x.keys); return `<tr><td><strong>${esc(x.name)}</strong><br><span class="tiny muted">${esc(x.what)}</span></td><td class="tiny">${esc(x.where)}</td><td>${sel(i, 'status', SV_STATUS)}</td><td>${sel(i, 'plan', SV_PLAN)}</td><td>${sel(i, 'ai', SV_AI)}</td><td class="tiny">${esc(x.deps)}</td><td class="num">${(x.keys || []).length ? `${u.users} <span class="tiny muted">pessoas<br>${u.n}×</span>` : '<span class="tiny muted">não medido</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  el.querySelectorAll('select[data-k]').forEach(s => s.onchange = () => { items[+s.dataset.i][s.dataset.k] = s.value; });
  $('#svSave').onclick = async e => { if (!await confirmInline(e.target, { text: 'Salvar a matriz de serviços?', yes: 'Sim, salvar' })) return; await save('services', 'Matriz salva.'); };
}

// ---------- Documentação ----------
let docEdit = null;
function docs(el) {
  const items = D.docs.items;
  el.innerHTML = `<div class="ahead"><h1>Documentação</h1><button class="chip" type="button" id="dcAdd">Nova seção</button></div>
    <div class="dgrid"><nav class="dtoc" aria-label="Seções">${items.map(x => `<a href="#d-${esc(x.id)}" data-jump="${esc(x.id)}">${esc(x.title)}</a>`).join('')}</nav>
    <div class="stack">${items.map((x, i) => docEdit === i ? `<section class="panel stack" id="d-${esc(x.id)}"><input type="text" id="dcTitle" value="${esc(x.title)}" aria-label="Título" style="font-weight:700">
        <textarea id="dcBody" style="min-height:280px;font-family:ui-monospace,monospace;font-size:13px" aria-label="Texto">${esc(x.body)}</textarea>
        <p class="tiny muted">Use ## para subtítulo, - para lista, **negrito** e | para tabela.</p>
        <div class="rowbtn"><button class="btn primary" type="button" id="dcSave">Salvar seção</button><button class="btn" type="button" id="dcCancel">Cancelar</button><button class="btn danger" type="button" id="dcDel">Apagar seção</button></div></section>`
      : `<section class="panel stack docsec" id="d-${esc(x.id)}"><div class="ahead"><h2>${esc(x.title)}</h2><button class="chip" type="button" data-ed="${i}">Editar</button></div><div class="small">${md(x.body)}</div></section>`).join('')}</div></div>`;
  el.querySelectorAll('[data-jump]').forEach(a => a.onclick = ev => { ev.preventDefault(); document.getElementById('d-' + a.dataset.jump)?.scrollIntoView({ behavior: 'smooth' }); });
  el.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { docEdit = +b.dataset.ed; docs(el); $('#dcBody').focus(); });
  $('#dcAdd').onclick = () => { items.push({ id: uid(), title: 'Nova seção', body: '' }); docEdit = items.length - 1; docs(el); $('#dcTitle').select(); };
  if (docEdit == null) return;
  $('#dcCancel').onclick = () => { docEdit = null; docs(el); };
  $('#dcSave').onclick = async e => {
    clearInvalid(el);
    const title = $('#dcTitle').value.trim(), m = checkName(title, 'o título', 2, 80); if (m) return invalid($('#dcTitle'), m);
    if (!await confirmInline(e.target, { text: `Salvar a seção "${esc(title)}"?`, yes: 'Sim, salvar' })) return;
    Object.assign(items[docEdit], { title, body: $('#dcBody').value }); docEdit = null;
    await save('docs', 'Documentação salva.'); docs(el);
  };
  $('#dcDel').onclick = async e => {
    if (!await confirmInline(e.target, { text: `Apagar a seção "${esc(items[docEdit].title)}"?`, yes: 'Sim, apagar', danger: true })) return;
    items.splice(docEdit, 1); docEdit = null; await save('docs', 'Seção apagada.'); docs(el);
  };
}

// ---------- Novidades ("O que mudou") ----------
let newsEdit = null;
function novidades(el) {
  const items = D.news.items.slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); D.news.items = items;
  el.innerHTML = `<div class="ahead"><h1>Novidades</h1><button class="btn primary" type="button" id="nwAdd">Nova novidade</button></div>
    <p class="small muted">Cada novidade aparece uma vez para quem já usava o app, num pop-up com o nome da pessoa ("Mari, olha o que tem de novo"). Quem cria a conta depois não vê as antigas. Todas ficam em menu ☰ → Ajuda → Ver o que mudou.</p>
    ${newsEdit != null ? `<div class="panel stack"><h2>${newsEdit === -1 ? 'Nova novidade' : 'Editar novidade'}</h2>
      <label class="f">Título<input type="text" id="nwTitle" maxlength="80" placeholder="Ex.: Agora dá para ver o gasto por semana" value="${esc(newsEdit >= 0 ? items[newsEdit].title : '')}"></label>
      <label class="f">O que mudou (uma linha por item, em palavras simples)<textarea id="nwItems" style="min-height:120px">${esc(newsEdit >= 0 ? (items[newsEdit].items || []).join('\n') : '')}</textarea></label>
      <div class="cbox"><h3>Prévia</h3><div id="nwPrev" class="small"></div></div>
      <div class="rowbtn"><button class="btn primary" type="button" id="nwPub">${newsEdit === -1 ? 'Publicar para todos' : 'Salvar'}</button><button class="btn" type="button" id="nwCancel">Cancelar</button></div></div>` : ''}
    <div class="stack">${items.map((n, i) => `<article class="panel stack"><div class="ahead"><div><span class="tiny muted">${dt(n.at)}</span><h2 style="margin:0">${esc(n.title)}</h2></div>
      <div class="rowbtn"><button class="chip" type="button" data-ned="${i}">Editar</button><button class="chip" type="button" data-ndel="${i}" aria-label="Apagar">×</button></div></div>
      <ul class="small" style="margin:0">${(n.items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></article>`).join('') || '<p class="small muted">Nenhuma novidade publicada.</p>'}</div>`;
  $('#nwAdd').onclick = () => { newsEdit = -1; novidades(el); $('#nwTitle').focus(); };
  el.querySelectorAll('[data-ned]').forEach(b => b.onclick = () => { newsEdit = +b.dataset.ned; novidades(el); });
  el.querySelectorAll('[data-ndel]').forEach(b => b.onclick = async e => {
    const i = +b.dataset.ndel;
    if (!await confirmInline(e.target, { text: `Apagar "${esc(items[i].title)}"? Quem ainda não viu não vai ver.`, yes: 'Sim, apagar', danger: true })) return;
    items.splice(i, 1); await save('news', 'Novidade apagada.'); novidades(el);
  });
  if (newsEdit == null) return;
  const lines = () => $('#nwItems').value.split('\n').map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const prev = () => { $('#nwPrev').innerHTML = `<p class="tiny muted">O QUE MUDOU</p><p><strong>Mari, olha o que tem de novo</strong></p><p><strong>${esc($('#nwTitle').value || 'Título')}</strong></p><ul>${lines().map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; };
  $('#nwTitle').oninput = $('#nwItems').oninput = prev; prev();
  $('#nwCancel').onclick = () => { newsEdit = null; novidades(el); };
  $('#nwPub').onclick = async e => {
    clearInvalid(el);
    const title = $('#nwTitle').value.trim(), m = checkName(title, 'o título', 5, 80); if (m) return invalid($('#nwTitle'), m);
    if (!lines().length) return invalid($('#nwItems'), 'Escreva pelo menos uma linha com o que mudou.');
    const isNew = newsEdit === -1;
    if (!await confirmInline(e.target, { text: isNew ? `Publicar "${esc(title)}"? Todos que já usam o app vão ver na próxima vez que abrirem.` : `Salvar as mudanças em "${esc(title)}"?`, yes: isNew ? 'Sim, publicar' : 'Sim, salvar' })) return;
    if (isNew) items.unshift({ id: 'n' + Date.now(), at: new Date().toISOString(), title, items: lines() });
    else Object.assign(items[newsEdit], { title, items: lines() });
    newsEdit = null; await save('news', isNew ? 'Novidade publicada.' : 'Novidade salva.'); novidades(el);
  };
}

// ---------- Fluxos (telas) ----------
let flowId = 'geral';
const shot = id => `/flows/${id}.jpg`;
async function fluxos(el) {
  let feats = {}; try { feats = (await loadUse()).features; } catch (e) { /* usage appears after the schema update */ }
  const f = FLOWS.find(x => x.id === flowId) || FLOWS[0];
  const phone = (id, extra = '') => `<button type="button" class="phone" data-scr="${id}" aria-label="Ampliar ${esc(SCREENS[id]?.title || id)}"><img src="${shot(id)}" alt="" loading="lazy" width="390" height="844"></button>${extra}`;
  el.innerHTML = `<div class="ahead"><h1>Fluxos</h1><span class="tiny muted">Telas do app de verdade, com uma família fictícia. Toque numa tela para ampliar.</span></div>
    <div class="chips" id="flList">${FLOWS.map(x => `<button class="chip" type="button" data-fl="${x.id}" aria-pressed="${x.id === f.id}">${esc(x.title)}</button>`).join('')}</div>
    <p class="small muted" style="margin:0">${esc(f.desc)}</p>
    ${f.map ? f.map.map(g => `<section class="panel stack"><h2>${esc(g.title)} <span class="tiny muted">${g.screens.length} telas</span></h2>
        <div class="fmap">${g.screens.map(id => `<figure>${phone(id)}<figcaption><strong>${esc(SCREENS[id].title)}</strong><span class="tiny muted">${esc(SCREENS[id].where)}</span></figcaption></figure>`).join('')}</div></section>`).join('')
      : `<section class="panel"><div class="fflow">${flowFunnel(f.steps, feats).map((x, i) => `${i ? '<span class="farrow" aria-hidden="true">→</span>' : ''}<figure class="fstep">
          <span class="fnum">${i + 1}</span>${phone(x.s)}<figcaption><strong>${esc(SCREENS[x.s].title)}</strong><span class="small">${esc(x.action)}</span>
          ${x.users != null ? `<span class="tiny fuse">${x.users} ${x.users === 1 ? 'pessoa' : 'pessoas'}${x.drop > 0 ? ` <span class="neg">−${x.drop}%</span>` : ''}</span>` : '<span class="tiny muted">não medido</span>'}</figcaption></figure>`).join('')}</div>
        <p class="tiny muted" style="margin-top:10px">Pessoas que chegaram em cada tela nos últimos ${useDays} dias. Em coral, quantos ficaram pelo caminho desde a tela anterior medida.</p></section>`}
    <dialog id="flBox" class="flbox"></dialog>`;
  el.querySelectorAll('[data-fl]').forEach(b => b.onclick = () => { flowId = b.dataset.fl; fluxos(el); });
  el.querySelectorAll('[data-scr]').forEach(b => b.onclick = () => {
    const id = b.dataset.scr, sc = SCREENS[id], inFlows = FLOWS.filter(x => x.steps?.some(y => y.s === id)), d = $('#flBox');
    d.innerHTML = `<div class="flbig"><img src="${shot(id)}" alt="${esc(sc.title)}"><div class="stack"><div class="ahead"><h2 style="margin:0">${esc(sc.title)}</h2><button class="chip" type="button" data-x aria-label="Fechar">×</button></div>
      <p class="small"><strong>Onde fica:</strong> ${esc(sc.where)}</p>
      ${inFlows.length ? `<p class="small"><strong>Aparece nos fluxos:</strong></p><div class="chips">${inFlows.map(x => `<button class="chip" type="button" data-go-fl="${x.id}">${esc(x.title)}</button>`).join('')}</div>` : ''}</div></div>`;
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelectorAll('[data-go-fl]').forEach(x => x.onclick = () => { d.close(); flowId = x.dataset.goFl; fluxos(el); });
    d.onclick = e => { if (e.target === d) d.close(); };
    d.showModal();
  });
}
