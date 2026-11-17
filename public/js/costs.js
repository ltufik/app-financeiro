// Revisão de custos: the Início card and the full-screen review (list, one item, savings, insurance).
// The numbers come from lib/costs.js (costsReview, insuranceSummary); what the family decides is kept in
// settings.costs.items[name] ({status, at, value}) and settings.insurance ({financing, used, types, seenAt}).
import { S, settings } from './state.js';
import * as db from './db.js';
import { track } from './usage.js';
import { toast, invalid, clearInvalid } from './ui.js';
import { esc, brl, brl0, todayISO, mLong } from './lib/format.js';
import { checkNumber } from './lib/validate.js';
import { costsReview, costsNotice, insuranceSummary, insuranceNotice, INSURANCE_TYPES } from './lib/costs.js';

export const familyCosts = () => costsReview({ txs: S.txs, idx: S.catIdx, settings: settings(), today: todayISO() });
export const familyInsurance = () => insuranceSummary({ txs: S.txs, settings: settings(), today: todayISO(), debts: settings().debts || [] });
const firstName = () => String(S.members.find(m => m.user_id === S.user?.id)?.display_name || '').trim().split(/\s+/)[0];
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const CHECK = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
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
  box.innerHTML = `<article class="insight warn cost-card"><span class="ii" aria-hidden="true">${cn ? UP : SHIELD}</span><div><h3>${esc(n.title)}</h3><p class="small">${esc(n.text)}</p><button class="btn small act" type="button" id="costOpen">${esc(n.action)}</button></div></article>`;
  box.querySelector('#costOpen').onclick = () => { track(cn ? 'custos.abriu_inicio' : 'seguros.abriu_inicio'); openCosts(cn ? (c.due.length ? 'item:' + c.due[0].key : 'lista') : 'seguros'); };
}

let view = 'lista';
export function openCosts(start = 'lista') {
  document.getElementById('custos')?.remove();
  const el = document.createElement('div'); el.id = 'custos'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'csTitle');
  document.body.append(el); document.body.classList.add('noscroll');
  view = start; track('custos.abriu'); draw();
}
function close() { document.getElementById('custos')?.remove(); document.body.classList.remove('noscroll'); S.render(); }
const go = v => { view = v; draw(); document.getElementById('custos')?.scrollTo?.(0, 0); };
const head = (title, back, tag = '') => `<header class="rv-head"><button type="button" class="rv-x" id="csBack" aria-label="Voltar">${BACK}</button><h2 id="csTitle">${esc(title)}</h2>${tag}</header>`;

function draw() {
  const el = document.getElementById('custos'); if (!el) return;
  if (view === 'seguros') return drawInsurance(el);
  if (view === 'economia') return drawSavings(el);
  if (view.startsWith('item:')) return drawItem(el, view.slice(5));
  drawList(el);
}

function drawList(el) {
  const c = familyCosts(), s = familyInsurance(), status = x => x.status === 'rever' ? '<span class="rv-tag warn">A rever</span>' : x.risePct ? `<span class="rv-tag warn">Subiu ${x.risePct}%</span>` : x.status === 'manter' ? '<span class="rv-tag">Mantido</span>' : '';
  el.innerHTML = `${head('Revisão de custos')}<main class="rv-main">
    <section class="rv-done cs-hero"><span class="small">Contas e assinaturas que voltam todo mês</span><span class="num cs-big">${brl0(c.total)} por mês</span>
      <span class="small">${brl0(c.year)} no ano${c.risen.length ? ` · ${c.risen.length} ${c.risen.length > 1 ? 'subiram' : 'subiu'}` : ''}${c.stopped.length ? ` · ${c.stopped.length} ${c.stopped.length > 1 ? 'pararam' : 'parou'} de cobrar` : ''}</span></section>
    ${c.savings.year ? `<button type="button" class="rv-card cs-save" id="csSavings"><strong>Com o que cancelaram: ${brl0(c.savings.year)} a menos no ano</strong><span class="small muted">Ver o que foi cancelado e o que está a rever</span></button>` : ''}
    ${c.stopped.map(x => `<div class="status ok cs-stop" data-key="${esc(x.key)}"><span>${esc(x.name)} não veio no último mês. Se cancelaram, são ${brl0(x.last * 12)} a menos no ano.</span><span class="rowbtn"><button type="button" class="chip" data-cancel="${esc(x.key)}">Cancelamos</button><button type="button" class="chip" data-keep="${esc(x.key)}">Ainda pago</button></span></div>`).join('')}
    ${c.groups.map(g => `<p class="eyebrow">${esc(g.label)}</p><div class="rv-card cs-list">${g.items.map(x => `<button type="button" class="cs-row" data-item="${esc(x.key)}"><span class="cs-name"><span>${esc(x.name)}</span><span class="tiny muted">${brl0(x.year)} no ano</span></span><span class="cs-val"><strong>${brl(x.last)}</strong>${status(x)}</span></button>`).join('')}</div>`).join('')}
    ${!c.groups.length ? '<p class="small muted">Nenhuma conta de celular, internet, streaming ou app voltou em 3 dos últimos 4 meses. Elas aparecem aqui quando a mesma cobrança vier todo mês.</p>' : ''}
    ${s.items.length ? `<button type="button" class="rv-card cs-save" id="csIns"><strong>Seguros: uns ${brl0(s.yearWithFinancing)} no ano</strong><span class="small muted">${s.items.length} ${s.items.length > 1 ? 'seguros' : 'seguro'} no extrato e na fatura. Já usaram algum?</span></button>` : ''}
  </main>`;
  el.querySelector('#csBack').onclick = close;
  el.querySelectorAll('[data-item]').forEach(b => b.onclick = () => go('item:' + b.dataset.item));
  el.querySelector('#csSavings')?.addEventListener('click', () => go('economia'));
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
    if (status === 'cancelei') { toast(`Pronto: ${brl0(x.last * 12)} a menos no ano`); go('economia'); }
    else if (status === 'rever') { toast('Combinado: em 7 dias o app pergunta como foi'); go('lista'); }
    else { toast(status === 'manter' ? 'Combinado' : 'Voltou a ser acompanhado'); go('lista'); }
  } catch (e) { btn && (btn.disabled = false); toast('Não foi possível salvar agora. ' + db.errorText(e)); }
}

function drawItem(el, key) {
  const c = familyCosts(), x = c.items.find(i => i.key === key); if (!x) return go('lista');
  const name = firstName(), h = x.history.length ? x.history : [{ month: x.lastMonth, value: x.last }], max = Math.max(...h.map(p => p.value), 1);
  const story = x.risePct
    ? `${name ? name + ', a' : 'A'} conta ${x.group === 'telefone' ? 'da' : 'do'} ${esc(x.name)} de vocês era ${brl0(x.first)} em ${MES(x.firstMonth)}. Agora são ${brl0(x.rise)} a mais por mês, ${brl0(x.rise * 12)} a mais no ano.`
    : `${name ? name + ', o' : 'O'} ${esc(x.name)} vem ${brl(x.last)} por mês desde ${MES(x.firstMonth)}: ${brl0(x.year)} no ano de vocês.`;
  el.innerHTML = `${head(x.name, true, x.risePct ? `<span class="rv-tag warn">Subiu ${x.risePct}%</span>` : '')}<main class="rv-main">
    <section class="rv-card"><div class="rv-row"><span class="small muted">${esc(mLong(x.lastMonth))}</span><span class="num rv-v">${brl0(x.last)}</span></div>
      <p class="small">${story}</p>
      <div class="cs-bars" role="img" aria-label="${esc(x.name)} por mês">${h.map(p => `<span class="cs-bar${p.month === x.lastMonth ? ' now' : ''}" style="height:${Math.max(6, Math.round(p.value / max * 120))}px" title="${esc(MES(p.month))}: ${brl(p.value)}"></span>`).join('')}</div>
      <div class="cs-months tiny muted">${h.map(p => `<span>${esc(MES(p.month).slice(0, 3))}</span>`).join('')}</div></section>
    <section class="rv-card"><strong>O que costuma funcionar</strong><span class="small muted">${TIPS[x.group]}</span></section>
    <div class="rv-acts">
      <button type="button" class="btn primary" data-s="rever">Vou rever</button>
      <button type="button" class="btn" data-s="cancelei">Cancelei</button>
      <button type="button" class="linkbtn" data-s="manter">Manter assim</button>
      ${x.status ? '<button type="button" class="linkbtn" data-s="">Voltar a acompanhar</button>' : ''}
    </div>
    <p class="tiny muted rv-foot">"Vou rever": em 7 dias o app pergunta no Início como foi, e confere na próxima conta se o valor caiu.</p></main>`;
  el.querySelector('#csBack').onclick = () => go('lista');
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
