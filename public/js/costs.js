// Revisão de custos: the Início card and the full-screen review (list, one item, savings, insurance).
// The numbers come from lib/costs.js (costsReview, insuranceSummary); what the family decides is kept in
// settings.costs.items[name] ({status, at, value}) and settings.insurance ({financing, used, types, seenAt}).
import { S, settings } from './state.js';
import * as db from './db.js';
import { track } from './usage.js';
import { toast, invalid, clearInvalid } from './ui.js';
import { esc, brl, brl0, todayISO, mLong } from './lib/format.js';
import { checkNumber } from './lib/validate.js';
import { costsReview, costsNotice, insuranceSummary, insuranceNotice, INSURANCE_TYPES, SERVICES, houseList, houseName, servicesText,
  comboChance, houseChance, offerPrompt, cleanOffers, offerSavings, typedSavings, OPERATOR_SITES, COMPARE_SITE, cleanCep, fmtCep, OFFER_DAYS } from './lib/costs.js';
import { searchJSON, aiErrorText } from './ai.js';

export const familyCosts = () => costsReview({ txs: S.txs, idx: S.catIdx, settings: settings(), today: todayISO() });
export const familyInsurance = () => insuranceSummary({ txs: S.txs, settings: settings(), today: todayISO(), debts: settings().debts || [] });
const firstName = () => String(S.members.find(m => m.user_id === S.user?.id)?.display_name || '').trim().split(/\s+/)[0];
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const CHECK = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const GOOD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8l6 6 4-4 6 7"/><path d="M15 17h5v-5"/></svg>';
const UP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16l6-6 4 4 6-7"/><path d="M15 7h5v5"/></svg>';
const SHIELD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/></svg>';
const TIPS = {
  telefone: 'Ligar e pedir para rever o plano, ou comparar com o plano que vocês usam de verdade (internet e minutos).',
  streaming: 'Vocês usam todos? Dá para assinar um por vez e trocar a cada mês.',
  apps: 'Confiram se ainda usam e se não tem outra conta pagando a mesma coisa.',
};
const MES = m => mLong(m).split(' ')[0];
async function saveSt(next) { await db.saveSettings(S.hh.id, next); S.hh.settings = next; }

// Início: one card, only when there is something worth a look (cost first, then the yearly insurance notice).
export function renderCostCard(box) {
  if (!box) return;
  const name = firstName(), c = familyCosts(), cn = costsNotice(c, name), s = cn ? null : familyInsurance(), sn = s && insuranceNotice(s, name, todayISO());
  const n = cn || sn;
  box.hidden = !n; if (!n) { box.innerHTML = ''; return; }
  box.innerHTML = `<article class="insight ${cn?.good ? 'good' : 'warn'} cost-card"><span class="ii" aria-hidden="true">${cn ? (cn.good ? GOOD : UP) : SHIELD}</span><div><h3>${esc(n.title)}</h3><p class="small">${esc(n.text)}</p><button class="btn small act" type="button" id="costOpen">${esc(n.action)}</button></div></article>`;
  box.querySelector('#costOpen').onclick = () => { track(cn ? 'custos.abriu_inicio' : 'seguros.abriu_inicio'); openCosts(cn ? (cn.kind === 'contexto' ? 'perguntas' : c.due.length ? 'item:' + c.due[0].key : 'lista') : 'seguros'); };
}

let view = 'lista', asked = 0, qTotal = 0;
export function openCosts(start = 'lista') {
  document.getElementById('custos')?.remove();
  const el = document.createElement('div'); el.id = 'custos'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'csTitle');
  document.body.append(el); document.body.classList.add('noscroll');
  view = start; asked = 0; qTotal = 0; track('custos.abriu'); draw();
}
function close() { document.getElementById('custos')?.remove(); document.body.classList.remove('noscroll'); S.render(); }
const go = v => { view = v; draw(); document.getElementById('custos')?.scrollTo?.(0, 0); };
const head = (title, back, tag = '') => `<header class="rv-head"><button type="button" class="rv-x" id="csBack" aria-label="Voltar">${BACK}</button><h2 id="csTitle">${esc(title)}</h2>${tag}</header>`;

function draw() {
  const el = document.getElementById('custos'); if (!el) return;
  if (view === 'seguros') return drawInsurance(el);
  if (view === 'economia') return drawSavings(el);
  if (view.startsWith('item:')) return drawItem(el, view.slice(5));
  if (view === 'perguntas' || view.startsWith('perguntar:')) return drawQuestion(el, view.startsWith('perguntar:') ? view.slice(10) : null);
  if (view === 'casas') return drawHouses(el);
  if (view === 'combo' || view === 'cep') return drawCombo(el);
  offerHouse = view === 'casas' || view === 'lista' ? null : offerHouse;
  drawList(el);
}

function drawList(el) {
  const c = familyCosts(), s = familyInsurance(), status = x => x.status === 'rever' ? '<span class="rv-tag warn">A rever</span>' : x.risePct ? `<span class="rv-tag warn">Subiu ${x.risePct}%</span>` : x.status === 'manter' ? '<span class="rv-tag">Mantido</span>' : '';
  el.innerHTML = `${head('Revisão de custos')}<main class="rv-main">
    <section class="rv-done cs-hero"><span class="small">Contas e assinaturas que voltam todo mês</span><span class="num cs-big">${brl0(c.total)} por mês</span>
      <span class="small">${brl0(c.year)} no ano${c.risen.length ? ` · ${c.risen.length} ${c.risen.length > 1 ? 'subiram' : 'subiu'}` : ''}${c.stopped.length ? ` · ${c.stopped.length} ${c.stopped.length > 1 ? 'pararam' : 'parou'} de cobrar` : ''}</span></section>
    ${c.savings.year ? `<button type="button" class="rv-card cs-save" id="csSavings"><strong>Com o que cancelaram: ${brl0(c.savings.year)} a menos no ano</strong><span class="small muted">Ver o que foi cancelado e o que está a rever</span></button>` : ''}
    ${c.stopped.map(x => `<div class="status ok cs-stop" data-key="${esc(x.key)}"><span>${esc(x.name)} não veio no último mês. Se cancelaram, são ${brl0(x.last * 12)} a menos no ano.</span><span class="rowbtn"><button type="button" class="chip" data-cancel="${esc(x.key)}">Cancelamos</button><button type="button" class="chip" data-keep="${esc(x.key)}">Ainda pago</button></span></div>`).join('')}
    ${c.questions.length ? `<button type="button" class="rv-card cs-save" id="csAsk"><strong>${c.questions.length === 1 ? 'Uma pergunta' : c.questions.length + ' perguntas'} sobre as contas de casa</strong><span class="small muted">Para não confundir conta nova (outra casa, outro celular) com conta que subiu.</span></button>` : ''}
    ${c.groups.map(g => `<p class="eyebrow">${esc(g.label)}${g.id === 'telefone' ? ' · <button type="button" class="linkbtn small" id="csHouses">ver por casa</button>' : ''}</p><div class="rv-card cs-list">${g.items.map(x => `<button type="button" class="cs-row" data-item="${esc(x.key)}"><span class="cs-name"><span>${esc(x.title || x.name)}</span><span class="tiny muted">${x.house ? esc(houseName(x.house)) + ' · ' : ''}${brl0(x.year)} no ano</span></span><span class="cs-val"><strong>${brl(x.last)}</strong>${status(x)}</span></button>`).join('')}</div>`).join('')}
    ${!c.groups.length ? '<p class="small muted">Nenhuma conta de celular, internet, streaming ou app voltou em 3 dos últimos 4 meses. Elas aparecem aqui quando a mesma cobrança vier todo mês.</p>' : ''}
    ${s.items.length ? `<button type="button" class="rv-card cs-save" id="csIns"><strong>Seguros: uns ${brl0(s.yearWithFinancing)} no ano</strong><span class="small muted">${s.items.length} ${s.items.length > 1 ? 'seguros' : 'seguro'} no extrato e na fatura. Já usaram algum?</span></button>` : ''}
  </main>`;
  el.querySelector('#csBack').onclick = close;
  el.querySelectorAll('[data-item]').forEach(b => b.onclick = () => go('item:' + b.dataset.item));
  el.querySelector('#csSavings')?.addEventListener('click', () => go('economia'));
  el.querySelector('#csAsk')?.addEventListener('click', () => go('perguntas'));
  el.querySelector('#csHouses')?.addEventListener('click', () => go('casas'));
  el.querySelector('#csIns')?.addEventListener('click', () => go('seguros'));
  el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => decide(b.dataset.cancel, 'cancelei', b));
  el.querySelectorAll('[data-keep]').forEach(b => b.onclick = () => decide(b.dataset.keep, 'manter', b));
}

async function decide(key, status, btn) {
  const c = familyCosts(), x = c.items.find(i => i.key === key); if (!x) return;
  btn && (btn.disabled = true);
  try {
    const cur = settings(), items = { ...((cur.costs || {}).items || {}) };
    if (status) items[key] = { status, at: todayISO(), value: x.last, by: S.user?.id || null }; else delete items[key];
    await saveSt({ ...cur, costs: { ...(cur.costs || {}), items } });
    track('custos.' + (status || 'desfez'));
    if (view === 'perguntas') { asked++; toast(status === 'cancelei' ? `Pronto: ${brl0(x.last * 12)} a menos no ano` : 'Combinado'); draw(); return; }
    if (status === 'cancelei') { toast(`Pronto: ${brl0(x.last * 12)} a menos no ano`); go('economia'); }
    else if (status === 'rever') { toast('Combinado: em 7 dias o app pergunta como foi'); go('lista'); }
    else { toast(status === 'manter' ? 'Combinado' : 'Voltou a ser acompanhado'); go('lista'); }
  } catch (e) { btn && (btn.disabled = false); toast('Não foi possível salvar agora. ' + db.errorText(e)); }
}

function drawItem(el, key) {
  const c = familyCosts(), x = c.items.find(i => i.key === key); if (!x) return go('lista');
  const name = firstName(), h = x.history?.length ? x.history : [{ month: x.lastMonth, value: x.last }], max = Math.max(...h.map(p => p.value), 1);
  const story = x.risePct
    ? `${name ? name + ', a' : 'A'} conta ${x.group === 'telefone' ? 'da' : 'do'} ${esc(x.name)} de vocês era ${brl0(x.first)} em ${MES(x.firstMonth)}. Agora são ${brl0(x.rise)} a mais por mês, ${brl0(x.rise * 12)} a mais no ano.`
    : `${name ? name + ', ' : ''}${x.group === 'telefone' ? (name ? 'a' : 'A') + ' conta da' : (name ? 'o' : 'O')} ${esc(x.name)}${x.line && x.services?.length ? ' (' + esc(servicesText(x.services)) + ')' : ''} vem ${brl(x.last)} por mês desde ${MES(x.firstMonth)}: ${brl0(x.year)} no ano de vocês.`;
  const more = [x.payChange ? `Passou ${x.payChange.from === 'conta' ? 'do débito para o cartão' : 'do cartão para o débito'} em ${MES(x.payChange.month)}: é a mesma conta.` : '',
    x.extras?.length ? `${x.extras.map(e => `Em ${MES(e.month)} veio também ${brl(e.value)} avulso`).join('; ')} (fora da conta do mês).` : '',
    x.manual ? 'Informado por vocês: não aparece no extrato nem na fatura.' : ''].filter(Boolean);
  el.innerHTML = `${head(x.name, true, x.risePct ? `<span class="rv-tag warn">Subiu ${x.risePct}%</span>` : '')}<main class="rv-main">
    <section class="rv-card"><div class="rv-row"><span class="small muted">${esc(mLong(x.lastMonth))}</span><span class="num rv-v">${brl0(x.last)}</span></div>
      <p class="small">${story}</p>${more.map(t => `<p class="small muted">${esc(t)}</p>`).join('')}
      <div class="cs-bars" role="img" aria-label="${esc(x.name)} por mês">${h.map(p => `<span class="cs-bar${p.month === x.lastMonth ? ' now' : ''}" style="height:${Math.max(6, Math.round(p.value / max * 120))}px" title="${esc(MES(p.month))}: ${brl(p.value)}"></span>`).join('')}</div>
      <div class="cs-months tiny muted">${h.map(p => `<span>${esc(MES(p.month).slice(0, 3))}</span>`).join('')}</div></section>
    ${x.line ? `<section class="rv-card"><div class="rv-row"><strong>${esc(x.house ? houseName(x.house) : 'Casa ainda não informada')}</strong><button type="button" class="linkbtn small" id="csCtx">Mudar</button></div><span class="small muted">${x.services?.length ? esc(servicesText(x.services)[0].toUpperCase() + servicesText(x.services).slice(1)) : 'Serviço ainda não informado'}</span></section>` : ''}
    <section class="rv-card"><strong>O que costuma funcionar</strong><span class="small muted">${TIPS[x.group]}</span></section>
    <div class="rv-acts">
      <button type="button" class="btn primary" data-s="rever">Vou rever</button>
      <button type="button" class="btn" data-s="cancelei">Cancelei</button>
      <button type="button" class="linkbtn" data-s="manter">Manter assim</button>
      ${x.status ? '<button type="button" class="linkbtn" data-s="">Voltar a acompanhar</button>' : ''}
    </div>
    <p class="tiny muted rv-foot">"Vou rever": em 7 dias o app pergunta no Início como foi, e confere na próxima conta se o valor caiu.</p></main>`;
  el.querySelector('#csBack').onclick = () => go('lista');
  el.querySelector('#csCtx')?.addEventListener('click', () => go(x.manual ? 'perguntar:celular' : 'perguntar:' + x.key));
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => decide(x.key, b.dataset.s || null, b));
}

function drawSavings(el) {
  const c = familyCosts(), name = firstName(), sv = c.savings, rev = c.items.filter(x => x.status === 'rever');
  const remind = d => { const t = new Date(Date.parse(d + 'T12:00:00Z') + 7 * 864e5); return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}`; };
  el.innerHTML = `${head('Revisão de custos')}<main class="rv-main">
    <section class="rv-done"><span class="rv-ok">${CHECK}</span><span class="small">${name ? esc(name) + ', c' : 'C'}om o que vocês cancelaram</span><h3 class="num">${brl0(sv.year)} a menos no ano</h3><p class="small">${brl0(sv.year / 12)} por mês que agora sobram</p></section>
    <div class="rv-card cs-list">${sv.items.map(x => `<div class="cs-row"><span class="cs-name"><span>${esc(x.name)}</span><span class="tiny muted">Cancelado · ${x.confirmed ? 'não veio mais' : 'o app confere na próxima conta'}</span></span><strong>${brl0(x.perYear)}/ano</strong></div>`).join('')}
      ${rev.map(x => `<div class="cs-row"><span class="cs-name"><span>${esc(x.name)}</span><span class="tiny muted">Vocês vão rever · o app pergunta em ${remind(x.statusAt)}</span></span><span class="rv-tag warn">A rever</span></div>`).join('')}</div>
    <section class="rv-card"><strong>Para onde vai essa economia?</strong><span class="small muted">Somem os ${brl0(sv.year / 12)} por mês ao que guardam: o card do sonho no Início mostra quantos meses isso adianta.</span></section>
    <button type="button" class="btn" id="csHome">Voltar ao Início</button></main>`;
  el.querySelector('#csBack').onclick = () => go('lista');
  el.querySelector('#csHome').onclick = close;
}

async function drawInsurance(el) {
  const s = familyInsurance(), name = firstName(), debts = settings().debts || [], fin = (settings().insurance || {}).financing || {};
  const houses = s.items.filter(x => x.type === 'casa').length + Object.values(fin).filter(v => +v > 0).length;
  el.innerHTML = `${head('Seguros')}<main class="rv-main">
    <section class="rv-done cs-hero"><span class="small">${name ? esc(name) + ', e' : 'E'}m seguros vocês pagam</span><span class="num cs-big">uns ${brl0(s.yearWithFinancing)} no ano</span>
      <span class="small">${brl0(s.paid)} ${s.from ? `de ${MES(s.from)} a ${MES(s.to)}` : ''}${s.inFinancing ? `, mais ${brl0(s.inFinancing)} por mês dentro do financiamento` : ', sem contar o seguro dentro do financiamento'}</span></section>
    <p class="eyebrow">Pago ${s.from ? `de ${MES(s.from)} a ${MES(s.to)}` : 'nos últimos 12 meses'}</p>
    <div class="rv-card cs-list">${s.items.map(x => `<div class="cs-row"><span class="cs-name"><span>${esc(x.name)}</span><span class="tiny muted">${x.months === 1 ? `em ${MES(x.firstMonth)}` : `em ${x.months} meses, de ${MES(x.firstMonth)} a ${MES(x.lastMonth)}`}</span>
      <label class="cs-type"><select aria-label="Tipo do seguro ${esc(x.name)}" data-type="${esc(x.key)}">${Object.entries(INSURANCE_TYPES).map(([k, v]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></span><strong>${brl0(x.paid)}</strong></div>`).join('')}</div>
    ${debts.length ? `<section class="rv-card"><strong>E o seguro dentro do financiamento?</strong><span class="small muted">Vem junto na parcela (no extrato do financiamento aparece como MIP e DFI).</span>
      ${debts.map(d => `<label class="f">Seguro na parcela de ${esc(d.name)} (R$ por mês)<input type="number" inputmode="decimal" step="0.01" min="0" data-fin="${esc(d.id)}" value="${fin[d.id] ?? ''}" placeholder="Ex.: 85"></label>`).join('')}
      <button type="button" class="btn" id="csFinSave">Salvar</button></section>` : ''}
    <section class="rv-card cs-use"><strong>Vocês já usaram algum desses seguros?</strong>
      <span class="small">${houses >= 2 ? 'Mais de uma casa tem seguro. ' : ''}Muitos seguros de casa e de carro têm assistência que já está paga, como chaveiro, encanador, eletricista e guincho. Vale ler a apólice para usar${houses >= 2 ? ' e para ver se os seguros cobrem a mesma coisa' : ''}.</span>
      ${s.used ? `<p class="small"><strong>${s.used === 'nunca' ? 'Vocês disseram que nunca usaram: revejam as apólices antes de renovar.' : 'Vocês já usaram. Ótimo: o seguro está fazendo o papel dele.'}</strong></p>` : ''}
      <div class="rowbtn"><button type="button" class="btn" data-used="sim">Já usamos</button><button type="button" class="btn primary" data-used="nunca">Nunca usamos</button></div></section>
    <p class="tiny muted">O aviso dos seguros volta uma vez por ano.</p></main>`;
  el.querySelector('#csBack').onclick = () => go('lista');
  const cur = settings();
  if (!(cur.insurance || {}).seenAt || Date.parse(todayISO()) - Date.parse(cur.insurance.seenAt) > 864e5) saveSt({ ...cur, insurance: { ...(cur.insurance || {}), seenAt: todayISO() } }).catch(() => {});
  track('seguros.abriu');
  el.querySelectorAll('[data-type]').forEach(sel => sel.onchange = async () => {
    try { const c2 = settings(); await saveSt({ ...c2, insurance: { ...(c2.insurance || {}), types: { ...((c2.insurance || {}).types || {}), [sel.dataset.type]: sel.value } } }); track('seguros.tipo'); toast('Tipo salvo'); } catch (e) { toast('Não foi possível salvar agora.'); }
  });
  el.querySelectorAll('[data-used]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const c2 = settings(); await saveSt({ ...c2, insurance: { ...(c2.insurance || {}), used: b.dataset.used, usedAt: todayISO() } }); track('seguros.' + (b.dataset.used === 'sim' ? 'usou' : 'nunca_usou')); toast(b.dataset.used === 'nunca' ? 'Combinado: revejam as apólices antes de renovar' : 'Combinado'); draw(); } catch (e) { b.disabled = false; toast('Não foi possível salvar agora.'); }
  });
  const fs = el.querySelector('#csFinSave');
  if (fs) fs.onclick = async () => {
    clearInvalid(el); const vals = {};
    for (const inp of el.querySelectorAll('[data-fin]')) {
      if (inp.value === '') continue;
      const v = +String(inp.value).replace(',', '.'), e = checkNumber(v, { min: 0, max: 100000, label: 'O seguro na parcela' });
      if (e) return invalid(inp, e);
      vals[inp.dataset.fin] = Math.round(v * 100) / 100;
    }
    try { const c2 = settings(); await saveSt({ ...c2, insurance: { ...(c2.insurance || {}), financing: vals } }); track('seguros.financiamento'); toast('Seguro do financiamento salvo'); draw(); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  };
}

// ---------- Contas de casa: the questions (one per screen) and the view by house ----------
const OPERATORS = ['Vivo', 'Claro', 'TIM', 'Oi', 'Outra'];
async function saveCosts(patch) { const cur = settings(), costs = { ...(cur.costs || {}) }; patch(costs); await saveSt({ ...cur, costs }); }
const chipsHTML = (name, opts, sel, multi) => `<div class="rowbtn cs-chips" role="group" data-group="${name}">${opts.map(([v, l]) => `<button type="button" class="chip" data-${name}="${esc(v)}" aria-pressed="${(multi ? sel.includes(v) : sel === v) ? 'true' : 'false'}">${esc(l)}</button>`).join('')}</div>`;
function wireChips(el, name, multi) {
  el.querySelectorAll(`[data-${name}]`).forEach(b => b.onclick = () => {
    if (!multi) el.querySelectorAll(`[data-${name}]`).forEach(o => o.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', multi && b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    if (name === 'house') { const n = el.querySelector('#csNewHouse'); if (n) n.hidden = b.dataset.house !== '+'; }
  });
}
const picked = (el, name) => [...el.querySelectorAll(`[data-${name}][aria-pressed="true"]`)].map(b => b.dataset[name]);

function drawQuestion(el, only) {
  const c = familyCosts(), name = firstName();
  let q = only ? c.questions.find(x => x.key === only) : c.questions[0];
  if (only && !q) {
    // Changing an answer: build the question for this line from the item (or the informed mobile line).
    if (only === 'celular') q = { kind: 'celular', key: 'celular', edit: true };
    else { const x = c.items.find(i => i.key === only); if (!x) return go('lista'); q = { kind: 'linha', key: x.key, brand: x.name, value: x.last, startMonth: x.startMonth, second: false, payChange: x.payChange, askHouse: true, services: x.services || [], house: x.house, edit: true }; }
  }
  if (!q) { if (asked) toast('Pronto: as contas de casa estão certas'); return go('casas'); }
  if (!only) qTotal = Math.max(qTotal, asked + c.questions.length);
  const count = only ? '' : `<span class="small muted" id="csQCount">${asked + 1} de ${qTotal}</span>`;
  const houses = houseList(settings()), hopts = [...(houses.length ? houses : ['principal']).map(h => [h, houseName(h)]), ['+', '+ Outra casa']];
  const back = () => only ? go(only === 'celular' ? 'casas' : 'item:' + only) : close();
  let body = '';
  if (q.kind === 'linha') {
    const since = q.payChange ? `No cartão desde ${MES(q.payChange.month)}, antes no débito` : `Desde ${MES(q.startMonth)}`;
    body = `<section class="rv-card"><span class="small muted">${esc(since)}</span>
      <h3 class="cs-q">${q.second ? `Apareceu uma segunda conta da ${esc(q.brand)}, de ${brl0(q.value)}. De onde ela é?` : `${name && !q.edit ? esc(name) + ', a' : 'A'} conta da ${esc(q.brand)} de ${brl0(q.value)} é de onde?`}</h3>
      ${q.payChange ? `<p class="small">Ela passou ${q.payChange.from === 'conta' ? 'do débito para o cartão' : 'do cartão para o débito'} em ${MES(q.payChange.month)}. O app já entendeu que é a mesma conta.</p>` : ''}
      ${q.askHouse ? `<fieldset class="cs-fs"><legend>Casa</legend>${chipsHTML('house', hopts, q.house || (houses.length === 1 ? houses[0] : houses.length ? '' : 'principal'), false)}
        <label class="f" id="csNewHouse" hidden>Nome da casa<input id="csHouseName" maxlength="40" placeholder="Ex.: Casa da praia"></label></fieldset>` : ''}
      <fieldset class="cs-fs"><legend>O que tem nela</legend>${chipsHTML('svc', Object.entries(SERVICES), q.services || [], true)}</fieldset></section>
      <div class="rv-acts"><button type="button" class="btn primary" id="csQSave">${only ? 'Salvar' : 'Continuar'}</button></div>`;
  } else if (q.kind === 'parou') {
    body = `<section class="rv-card"><span class="small muted">Não veio mais desde ${MES(q.since)}</span>
      <h3 class="cs-q">A ${esc(q.brand)} (${q.min === q.max ? brl0(q.max) : `${brl0(q.min)} a ${brl0(q.max)}`} por mês) parou de aparecer. ${name ? esc(name) + ', v' : 'V'}ocês cancelaram ou trocaram?</h3>
      <p class="small muted">Se trocaram, o app não conta como economia: a conta nova já está no total.</p></section>
      <div class="rv-acts"><button type="button" class="btn" data-stop="cancelei">Cancelamos</button><button type="button" class="btn" data-stop="trocou">${q.swapTo ? `Trocamos pela ${esc(q.swapTo)}` : 'Trocamos de operadora'}</button><button type="button" class="linkbtn" data-stop="fora">Ainda pagamos, de outro jeito</button></div>`;
  } else if (q.kind === 'desconhecido') {
    body = `<section class="rv-card"><span class="small muted">Vem todo mês</span>
      <h3 class="cs-q">"${esc(q.name)}" vem uns ${brl0(q.value)} por mês. É internet, TV ou celular?</h3>
      <p class="small muted">Provedores do bairro têm nomes que o app não conhece. Contando, a conta entra nas contas de casa.</p></section>
      <div class="rv-acts">${Object.entries(SERVICES).map(([k, l]) => `<button type="button" class="btn" data-unk="${k}">${esc(l)}</button>`).join('')}<button type="button" class="linkbtn" data-unk="">Não é</button></div>`;
  } else {
    const cel = (settings().costs || {}).celular || {};
    body = `<section class="rv-card"><h3 class="cs-q">E os celulares de vocês?</h3>
      <p class="small">Não achamos conta de celular no extrato nem na fatura. Se pagam em outro lugar (outro cartão, a empresa), contem a operadora e o valor para a conta de casa ficar completa.</p>
      <fieldset class="cs-fs"><legend>Operadora</legend>${chipsHTML('op', OPERATORS.map(o => [o, o]), OPERATORS.includes(cel.brand) ? cel.brand : (cel.brand ? 'Outra' : ''), false)}</fieldset>
      <label class="f">Quanto por mês, todos os celulares (R$)<input id="csCelValue" type="number" inputmode="decimal" step="0.01" min="0" value="${cel.value ?? ''}" placeholder="Ex.: 110"></label></section>
      <div class="rv-acts"><button type="button" class="btn primary" id="csCelSave">Salvar</button><button type="button" class="linkbtn" id="csCelNo">Não temos ou a empresa paga</button></div>`;
  }
  el.innerHTML = `${head(only ? 'Contas de casa' : 'Perguntas rápidas', true, count)}<main class="rv-main">${body}
    <p class="tiny muted rv-foot">Dá para mudar depois: Revisão de custos → ver por casa → a conta → Mudar.</p></main>`;
  el.querySelector('#csBack').onclick = back;
  wireChips(el, 'house', false); wireChips(el, 'svc', true); wireChips(el, 'op', false);
  const after = () => { if (only) return go(only === 'celular' ? 'casas' : 'item:' + only); asked++; draw(); };
  el.querySelector('#csQSave')?.addEventListener('click', async e => {
    clearInvalid(el); const sv = picked(el, 'svc'); let house = q.askHouse ? picked(el, 'house')[0] : (q.house || houses[0] || 'principal');
    if (q.askHouse && !house) return invalid(el.querySelector('[data-group="house"]'), 'De qual casa é esta conta?');
    if (house === '+') { const inp = el.querySelector('#csHouseName'), v = inp.value.trim(); if (v.length < 2) return invalid(inp, 'Dê um nome para a casa (ex.: Casa da praia).'); house = v; }
    if (!sv.length) return invalid(el.querySelector('[data-group="svc"]'), 'O que vem nesta conta? Escolha pelo menos um.');
    e.target.disabled = true;
    try {
      await saveCosts(cs => { cs.lines = { ...(cs.lines || {}), [q.key]: { house, services: sv, at: todayISO() } }; if (!houses.includes(house) && house !== 'principal') cs.houses = [...(cs.houses || []), house]; });
      track('custos.contexto'); after();
    } catch (err) { e.target.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  });
  el.querySelectorAll('[data-stop]').forEach(b => b.onclick = () => decide(q.key, b.dataset.stop, b));
  el.querySelectorAll('[data-unk]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await saveCosts(cs => { if (b.dataset.unk) cs.providers = { ...(cs.providers || {}), [q.key]: { name: q.name, services: [b.dataset.unk] } }; else cs.notTelecom = { ...(cs.notTelecom || {}), [q.key]: true }; }); track(b.dataset.unk ? 'custos.provedor' : 'custos.nao_provedor'); after(); }
    catch (err) { b.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  });
  el.querySelector('#csCelSave')?.addEventListener('click', async e => {
    clearInvalid(el); const op = picked(el, 'op')[0], inp = el.querySelector('#csCelValue'), v = +String(inp.value).replace(',', '.');
    if (!op) return invalid(el.querySelector('[data-group="op"]'), 'Qual é a operadora dos celulares?');
    const er = checkNumber(v, { min: 1, max: 5000, label: 'O valor dos celulares' }); if (er) return invalid(inp, er);
    e.target.disabled = true;
    try { await saveCosts(cs => { cs.celular = { status: 'informado', brand: op === 'Outra' ? 'Outra operadora' : op, value: Math.round(v * 100) / 100, at: todayISO() }; }); track('custos.celular'); after(); }
    catch (err) { e.target.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  });
  el.querySelector('#csCelNo')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { await saveCosts(cs => { cs.celular = { status: 'nao', at: todayISO() }; }); track('custos.sem_celular'); after(); }
    catch (err) { e.target.disabled = false; toast('Não foi possível salvar agora.'); }
  });
}

function drawHouses(el) {
  const c = familyCosts(), t = c.telecom, name = firstName(), mo = t.thenMonth ? MES(t.thenMonth) : '', ch = comboChance(c);
  const cmp = t.diff >= 30 ? `${brl0(t.diff)} a menos por mês do que em ${mo} (${brl0(t.then)}): uns ${brl0(t.diff * 12)} a menos no ano.`
    : t.diff <= -30 ? `${brl0(-t.diff)} a mais por mês do que em ${mo} (${brl0(t.then)}).` : t.thenMonth && t.thenMonth < t.lastMonth ? `Quase igual a ${mo} (${brl0(t.then)}).` : '';
  const gone = x => ['cancelei', 'trocou'].includes(x.status) || !x.current;
  const row = x => `<button type="button" class="cs-row" data-item="${esc(x.key)}"><span class="cs-name"><span>${esc(x.name)}${x.services?.length ? ' · ' + esc(servicesText(x.services)) : ''}</span><span class="tiny muted">${gone(x)
    ? (x.status === 'trocou' ? 'Trocada' : x.status === 'cancelei' ? 'Cancelada' : 'Parou') + ` em ${MES(x.lastMonth)}`
    : x.manual ? 'Informado por vocês' : x.elsewhere ? 'Pagam de outro jeito' : x.payChange ? `${x.payChange.to === 'cartao' ? 'Cartão' : 'Débito'}, desde ${MES(x.payChange.month)}` : `Desde ${MES(x.startMonth)}`}</span></span><strong class="${gone(x) ? 'muted' : ''}">${brl(x.last)}</strong></button>`;
  el.innerHTML = `${head('Telefone, internet e TV')}<main class="rv-main">
    <section class="rv-done cs-hero"><span class="small">${name ? esc(name) + ', p' : 'P'}or mês, hoje</span><span class="num cs-big" id="csTelNow">${brl0(t.now)}</span>${cmp ? `<span class="small" id="csTelCmp">${cmp}</span>` : ''}</section>
    ${c.questions.length ? `<button type="button" class="rv-card cs-save" id="csAsk"><strong>${c.questions.length === 1 ? 'Falta uma pergunta' : `Faltam ${c.questions.length} perguntas`}</strong><span class="small muted">Para separar as contas por casa e por serviço.</span></button>` : ''}
    ${t.houses.map(h => { const hc = h.house && houseChance(c, h.house); return `<div class="rv-row cs-house"><strong>${esc(h.name)}</strong><span class="num">${brl0(h.total)}</span></div><div class="rv-card cs-list">${h.items.map(row).join('')}</div>
      ${hc ? `<div class="cs-offers-cta"><span class="small muted">Com o CEP desta casa, o app procura ${esc(servicesText(hc.services))} mais barato${hc.services.length > 1 ? 's' : ''} que chegue${hc.services.length > 1 ? 'm' : ''} nessa rua, inclusive provedores do bairro.</span><button type="button" class="linkbtn" data-offers="${esc(h.house)}">Ver ofertas para esta casa</button></div>` : ''}`; }).join('')}
    ${!t.houses.length ? '<p class="small muted">Nenhuma conta de celular, internet ou TV nos últimos meses.</p>' : ''}
    ${ch ? `<section class="rv-done cs-hero cs-combo"><span class="eyebrow cs-eb">Pode sair mais barato</span><strong>${esc(cap(servicesText([...new Set(ch.fixed.flatMap(x => x.services).filter(k => k !== 'celular'))])))} na ${esc([...new Set(ch.fixed.map(x => x.name))].join(' e '))}, celular na ${esc([...new Set(ch.mobile.map(x => x.name))].join(' e '))}. Juntar tudo numa operadora costuma ter desconto.</strong><button type="button" class="btn" id="csCombo">Ver opções para ${esc(ch.name)}</button></section>` : ''}
    <p class="tiny muted">Duas contas da mesma operadora são separadas pelo valor; mudar do débito para o cartão continua sendo a mesma conta. Toque numa conta para mudar a casa ou o serviço.</p>
  </main>`;
  el.querySelector('#csBack').onclick = () => go('lista');
  el.querySelector('#csAsk')?.addEventListener('click', () => go('perguntas'));
  el.querySelector('#csCombo')?.addEventListener('click', () => { track('combo.abriu'); offerHouse = ch.house; go('combo'); });
  el.querySelectorAll('[data-offers]').forEach(b => b.onclick = () => { track('ofertas.abriu'); offerHouse = b.dataset.offers; go('combo'); });
  el.querySelectorAll('[data-item]').forEach(b => b.onclick = () => go('item:' + b.dataset.item));
  track('custos.casas');
}

// ---------- Combo: the CEP first (and why), a search on the operators' sites, real offers or an honest "we could not" ----------
let searching = null, lastResult = null, offerHouse = null;
const fresh = at => at && Date.now() - Date.parse(at) < OFFER_DAYS * 864e5;
const ddmm = iso => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const EXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';

function drawCombo(el) {
  const c = familyCosts(), ch = offerHouse ? houseChance(c, offerHouse) : comboChance(c); if (!ch) return go('casas');
  const cs = settings().costs || {}, cep = (cs.ceps || {})[ch.house] || '', cache = (cs.offers || {})[ch.house];
  if (searching) return drawSearching(el, ch, cep);
  const res = lastResult && lastResult.house === ch.house && lastResult.cep === cep ? lastResult : (cache && cache.cep === cep && fresh(cache.at) ? cache : null);
  if (view === 'combo' && cep && res) return drawOffers(el, ch, res);
  drawCep(el, ch, cep);
}

function drawCep(el, ch, cep) {
  const PIN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const HOME = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6"/></svg>';
  const LOCK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  el.innerHTML = `${head('Opções para ' + ch.name)}<main class="rv-main">
    <h3 class="cs-q">Primeiro, o CEP de ${esc(ch.name)}</h3>
    <p class="small">Para procurar ${ch.combo ? 'um combo' : 'planos mais baratos'} que chegue${ch.combo ? '' : 'm'} de verdade nessa casa, o app precisa do CEP. Sem ele, mostraria preços de outra cidade ou ofertas que não atendem a rua de vocês.</p>
    <section class="rv-card cs-why"><strong>Por que precisamos dele</strong>
      <div class="cs-why-i">${PIN}<span class="small">O preço e a fibra mudam de rua para rua. Sem o CEP, o app mostraria ofertas que talvez nem cheguem aí.</span></div>
      <div class="cs-why-i">${HOME}<span class="small">Com ele dá para achar também provedores do bairro, que muitas vezes custam menos que as grandes.</span></div>
      <div class="cs-why-i">${LOCK}<span class="small">Guardamos só o CEP, ligado a ${esc(ch.name)}, para as próximas buscas. Vocês podem apagar quando quiserem.</span></div></section>
    <label class="f">CEP<input id="csCep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" value="${esc(fmtCep(cep))}"></label>
    <div class="rv-acts"><button type="button" class="btn primary" id="csSearch">Buscar opções</button>${cep ? '<button type="button" class="linkbtn" id="csCepDel">Apagar o CEP</button>' : ''}</div>
    <p class="tiny muted rv-foot">A busca olha os sites das operadoras e de provedores da região e pode levar até um minuto. Hoje vocês pagam ${brl(ch.pay)} por mês nessas contas.</p></main>`;
  el.querySelector('#csBack').onclick = () => go('casas');
  const inp = el.querySelector('#csCep');
  inp.oninput = () => { const d = cleanCep(inp.value).slice(0, 8); inp.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  el.querySelector('#csSearch').onclick = async e => {
    clearInvalid(el); const d = cleanCep(inp.value);
    if (d.length !== 8) return invalid(inp, 'O CEP tem 8 números (ex.: 01310-100).');
    e.target.disabled = true;
    try { if (d !== cep) await saveCosts(cs => { cs.ceps = { ...(cs.ceps || {}), [ch.house]: d }; }); }
    catch (err) { e.target.disabled = false; return toast('Não foi possível salvar agora. ' + db.errorText(err)); }
    runSearch(ch, d);
  };
  el.querySelector('#csCepDel')?.addEventListener('click', async e => {
    e.target.disabled = true;
    try { await saveCosts(cs => { const c2 = { ...(cs.ceps || {}) }, o2 = { ...(cs.offers || {}) }; delete c2[ch.house]; delete o2[ch.house]; cs.ceps = c2; cs.offers = o2; }); lastResult = null; track('combo.apagou_cep'); toast('CEP apagado'); draw(); }
    catch (err) { e.target.disabled = false; toast('Não foi possível apagar agora.'); }
  });
}

function drawSearching(el, ch, cep) {
  el.innerHTML = `${head('Opções para ' + ch.name)}<main class="rv-main"><section class="rv-card cs-wait" aria-live="polite"><span class="cs-spin" aria-hidden="true"></span>
    <strong>Procurando ofertas para o CEP ${esc(fmtCep(cep))}</strong><span class="small muted">Olhando os sites das operadoras e dos provedores da região. Pode levar até um minuto.</span></section>
    <div class="rv-acts"><button type="button" class="linkbtn" id="csStop">Cancelar</button></div></main>`;
  el.querySelector('#csBack').onclick = () => { searching?.abort(); };
  el.querySelector('#csStop').onclick = () => { searching?.abort(); };
}

async function runSearch(ch, cep) {
  const ctrl = new AbortController(); searching = ctrl; view = 'combo'; draw();
  let res;
  try { res = { ...cleanOffers(await searchJSON(offerPrompt(ch, cep), { signal: ctrl.signal })), err: null }; }
  catch (e) { res = { place: '', offers: [], tried: [], err: e.code || 'erro' }; }
  searching = null;
  if (res.err === 'cancelled') { track('combo.cancelou'); return go('cep'); }
  lastResult = { ...res, house: ch.house, cep, at: new Date().toISOString() };
  // Only a search that found offers is kept (7 days): a failed one is tried again next time.
  if (res.offers.length) saveCosts(cs => { cs.offers = { ...(cs.offers || {}), [ch.house]: { cep, at: lastResult.at, place: res.place, offers: res.offers, tried: res.tried } }; }).catch(() => {});
  const good = res.offers.some(o => (offerSavings(o, ch)?.month || 0) > 0);
  track('combo.buscou'); track(good ? 'combo.achou' : 'combo.nao_achou');
  if (document.getElementById('custos')) { view = 'combo'; draw(); }
}

function drawOffers(el, ch, res) {
  const name = firstName(), rows = res.offers.map(o => ({ o, s: offerSavings(o, ch) })).filter(x => x.s && x.s.month > 0).sort((a, b) => b.s.year1 - a.s.year1);
  if (!rows.length) return drawNoOffers(el, ch, res);
  const what = x => `${x.name} (${servicesText(x.services)})`;
  el.innerHTML = `${head(rows.length === 1 ? '1 opção para o ' + fmtCep(res.cep) : rows.length + ' opções para o ' + fmtCep(res.cep))}<main class="rv-main">
    <p class="small">${name ? esc(name) + ', h' : 'H'}oje vocês pagam <strong>${brl(ch.pay)} por mês</strong>: ${esc(ch.items.map(x => `${x.name} ${servicesText(x.services)} (${brl0(x.last)})`).join(', '))}.</p>
    ${rows.map(({ o, s }) => { const all = ch.services.every(k => o.services.includes(k)); return `<section class="rv-card cs-offer${all ? ' all' : ''}">
      <div class="rv-row"><strong>${esc(o.operator)}${o.plan ? ' · ' + esc(o.plan) : ''}</strong>${all ? '<span class="rv-tag">Tudo junto</span>' : o.local ? '<span class="rv-tag warn">Local</span>' : ''}</div>
      <div class="cs-price"><span class="num cs-big">${brl(o.price)}</span><span class="small muted">por mês${o.promoMonths ? ` nos ${o.promoMonths} primeiros meses` : ''}</span></div>
      <span class="small muted">${[o.promoMonths ? `Depois, ${brl(o.priceAfter)}.` : '', cap(servicesText(o.services)) + (o.speed ? `, ${o.speed} Mega` : '') + (o.mobileLines ? `, ${o.mobileLines} ${o.mobileLines > 1 ? 'linhas' : 'linha'} de celular` : '') + '.', `No lugar de ${s.replaces.map(what).join(' e ')}.`].filter(Boolean).join(' ')}</span>
      <div class="cs-gain"><strong>${brl0(s.year1)} a menos no primeiro ano</strong>${o.promoMonths ? `<span class="small muted">${s.after > 0 ? `Depois da promoção, ${brl0(s.after)} a menos por ano.` : 'Depois da promoção, fica mais caro que hoje: vale negociar antes de acabar.'}</span>` : `<span class="small muted">${brl0(s.month)} a menos por mês.</span>`}</div>
      <a class="btn primary cs-site" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer" data-op="${esc(o.operator)}">Ver no site ${o.local ? 'do provedor' : 'da ' + esc(o.operator)} ${EXT}</a></section>`; }).join('')}
    <p class="tiny muted">Preços vistos nos sites em ${ddmm(res.at)}, para o CEP ${esc(fmtCep(res.cep))}${res.place ? ` (${esc(res.place)})` : ''}. Podem mudar: confirmem no site antes de contratar, e vejam quantas linhas de celular vêm no plano. O app não recebe nada das operadoras.</p>
    <div class="rv-acts"><button type="button" class="btn" id="csAgain">Buscar de novo</button><button type="button" class="linkbtn" id="csCepEdit">Mudar o CEP</button></div></main>`;
  wireResult(el, ch);
}

function drawNoOffers(el, ch, res) {
  const name = firstName(), failed = res.tried.filter(t => !t.ok).map(t => t.site), some = res.offers.length;
  const why = res.err ? `A busca não terminou: ${aiErrorText({ code: res.err }).toLowerCase().replace(/\.$/, '')}.`
    : some ? `Achamos ${some === 1 ? 'uma oferta' : some + ' ofertas'}, mas nenhuma sai mais barata que os ${brl(ch.pay)} que vocês pagam hoje nessas contas.`
    : failed.length ? `${failed.length === 1 ? 'O site' : 'Os sites'} ${failed.join(', ').replace(/, ([^,]*)$/, ' e $1')} não ${failed.length === 1 ? 'deixou' : 'deixaram'} consultar agora, e não achamos provedor do bairro com preço publicado.`
    : 'Não achamos preço publicado para esse CEP.';
  const sites = [...new Set([...ch.brands, 'Vivo', 'Claro', 'TIM'])].filter(b => OPERATOR_SITES[b]).map(b => [b + (b === 'Claro' ? ' Multi' : ''), OPERATOR_SITES[b]]);
  el.innerHTML = `${head('Opções para o ' + fmtCep(res.cep))}<main class="rv-main">
    <section class="rv-card"><h3 class="cs-q" id="csNoTitle">${name ? esc(name) + ', ' : ''}${some && !res.err ? 'as ofertas que achamos não saem mais baratas' : 'não conseguimos ver os preços de hoje'}</h3>
      <span class="small">${esc(why)} Preferimos não chutar um valor.</span></section>
    <section class="rv-card cs-list cs-links"><strong class="cs-lt">Onde procurar com o CEP de vocês</strong>
      ${sites.map(([n, u]) => `<a class="cs-row" href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-op="${esc(n)}"><span>${esc(n)}</span>${EXT}</a>`).join('')}
      <a class="cs-row" href="${esc(COMPARE_SITE.url)}" target="_blank" rel="noopener noreferrer" data-op="comparador"><span>${esc(COMPARE_SITE.name)}</span>${EXT}</a></section>
    <section class="rv-card"><strong>Achou uma oferta? O app faz a conta</strong>
      <label class="f">Preço por mês da oferta, com ${esc(servicesText(ch.services))} (R$)<input id="csTyped" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ex.: 249,90"></label>
      <button type="button" class="btn" id="csCalc">Calcular</button><p class="small" id="csTypedOut" aria-live="polite"></p>
      <span class="small muted">Comparamos com os ${brl(ch.pay)} que vocês pagam hoje e mostramos a diferença no ano.</span></section>
    <div class="rv-acts"><button type="button" class="btn primary" id="csAgain">Tentar de novo</button><button type="button" class="linkbtn" id="csCepEdit">Mudar o CEP</button></div></main>`;
  wireResult(el, ch);
  el.querySelector('#csCalc').onclick = () => {
    clearInvalid(el); const inp = el.querySelector('#csTyped'), v = +String(inp.value).replace(',', '.'), er = checkNumber(v, { min: 1, max: 5000, label: 'O preço da oferta' });
    if (er) return invalid(inp, er);
    const s = typedSavings(v, ch), out = el.querySelector('#csTypedOut');
    out.textContent = s.month > 0 ? `${brl0(s.month)} a menos por mês: ${brl0(s.year1)} a menos no ano.` : s.month < 0 ? `Sai ${brl0(-s.month)} mais caro por mês do que hoje.` : 'Sai o mesmo que hoje.';
    track('combo.digitou');
  };
}
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
function wireResult(el, ch) {
  el.querySelector('#csBack').onclick = () => go('casas');
  el.querySelector('#csAgain').onclick = () => { const cep = ((settings().costs || {}).ceps || {})[ch.house]; if (cep) runSearch(ch, cep); else go('cep'); };
  el.querySelector('#csCepEdit').onclick = () => go('cep');
  el.querySelectorAll('[data-op]').forEach(a => a.addEventListener('click', () => track('combo.site')));
}
