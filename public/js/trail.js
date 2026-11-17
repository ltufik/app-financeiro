// The trail on screen (3.0): the "Agora" card on Início, the "Liberado" screen when a step is done, the first-access
// screen (in place of the 7-slide presentation and the 9-balloon walkthrough) and one tip the first time on a screen.
// Rules: lib/trail.js.
import { S, settings, calcMonth, closedKeys } from './state.js';
import { toast } from './ui.js';
import { track } from './usage.js';
import { esc, brl0, todayISO, mLong } from './lib/format.js';
import { byCategory } from './lib/calc.js';
import { trailState, newlyDone, unlockScreen, isLegacy, TOOLS } from './lib/trail.js';
import * as db from './db.js';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const MES = m => mLong(m).split(' ')[0];

export function trailFacts() {
  const t = S.txs.filter(x => !x.virtual && !x.manual), st = settings();
  return { hasCard: t.some(x => x.source === 'cartao'), hasConta: t.some(x => x.source === 'conta'), closedCount: Object.keys(st.closed || {}).length,
    reviews: (st.reviews || []).length, months: new Set(t.map(x => x.month)).size };
}
export const legacyFamily = () => isLegacy(S.hh?.created_at, trailFacts().months) || !!settings().trail?.legacy;
export const trailNow = () => trailState(trailFacts(), { legacy: legacyFamily() });
// A tool the family can use now (always true for families from before 3.0).
export const toolOpen = id => trailNow().open.has(id);

// Where each tool lives today (3.1 brings the Ferramentas tab).
export function openTool(id) {
  track('trilha.ferramenta_' + id);
  const go = {
    gastos: () => S.go('extrato'), perguntar: () => S.go('perguntar'), sobra: () => S.go('resumo', '#sum_sobra'), previsao: () => S.go('resumo', '#sum_previsao'),
    fechar: () => S.go('fechar'), metas: () => S.go('ajustes', null, 'metas'), contas_casa: () => import('./costs.js').then(m => m.openCosts('lista')),
    semana: () => import('./review.js').then(m => m.openReview('trilha')), contas_ano: () => S.go('ajustes', null, 'gastos_ano'), divisao: () => S.go('ajustes', null, 'divisao'),
    patrimonio: () => S.go('ajustes', null, 'patrimonio'), retro: () => S.go('resumo', '#sum_nivel'),
  }[id];
  (go || (() => S.go('resumo')))();
}
function doStep(go) {
  track('trilha.passo_' + go);
  if (go === 'pdf') return S.runAcao ? S.runAcao('pdf') : S.go('lancar');
  if (go === 'fechar') return S.go('fechar');
  if (go === 'revisar') return import('./review.js').then(m => m.openReview('trilha'));
}

// Início: the one thing to do now. Families that finished the trail (or came before 3.0) get null: the old card stays.
export function renderTrail(box) {
  const st = trailNow();
  if (st.finished || !st.current) return false;
  const s = st.current, opens = s.opens.map(k => TOOLS[k].name);
  const dots = st.steps.map(x => `<span class="tr-dot${x.done ? ' on' : x === s ? ' cur' : ''}" aria-hidden="true"></span>`).join('');
  box.hidden = false; box.classList.add('tr-box');
  box.innerHTML = `<section class="trail" aria-label="Próximo passo">
    <div class="tr-top"><span class="tr-eb">Agora · etapa ${s.n} de ${st.steps.length}</span><span class="tr-min">${s.minutes} minutos</span></div>
    <div class="tr-dots" role="img" aria-label="${st.doneCount} de ${st.steps.length} etapas feitas">${dots}</div>
    <h3 class="tr-title">${esc(s.title)}</h3><p class="tr-why">${esc(s.why)}</p>
    <button class="btn tr-go" type="button" id="trGo">${esc(s.go === 'pdf' ? 'Mandar agora' : s.go === 'fechar' ? 'Fechar o mês' : 'Conferir agora')}</button>
    ${opens.length ? `<p class="tr-opens">Libera: ${esc(opens.join(' e '))}</p>` : ''}</section>`;
  box.querySelector('#trGo').onclick = () => doStep(s.go);
  celebrate(st);
  return true;
}

// ---------- "Liberado": once per step, for the whole family ----------
let showing = false;
async function celebrate(st) {
  const seen = settings().trail?.seen || {}, fresh = newlyDone(st, seen, legacyFamily());
  if (!fresh.length || showing || !S.hh) return;
  showing = true;
  const today = todayISO(), cur = settings(), next = { ...cur, trail: { ...(cur.trail || {}), seen: { ...seen, ...Object.fromEntries(fresh.map(n => [n, today])) } } };
  try { await db.saveSettings(S.hh.id, next); S.hh.settings = next; } catch (e) { showing = false; return; }
  showUnlock(st, fresh[fresh.length - 1]);
}
function headline(n) {
  const t = S.txs.filter(x => !x.virtual && !x.manual), last = closedKeys().pop();
  if (n === 1 && last) {
    const m = t.filter(x => x.month === last), cats = Object.entries(byCategory(m, S.catIdx)).sort((a, b) => b[1] - a[1]);
    return { title: `Pronto: ${m.length} gastos de ${MES(last)} já estão separados`, text: cats[0] ? `${cats[0][0]} foi o que mais pesou: ${brl0(cats[0][1])}.` : '' };
  }
  if (n === 2 && last) { const c = calcMonth(last); return { title: c.res >= 0 ? `Em ${MES(last)} sobraram ${brl0(c.res)}` : `Em ${MES(last)} faltaram ${brl0(-c.res)}`, text: 'Agora o app junta o cartão e a conta.' }; }
  const closed = Object.keys(settings().closed || {}).sort();
  if (n === 3 && closed.length) return { title: `${MES(closed[closed.length - 1])[0].toUpperCase() + MES(closed[closed.length - 1]).slice(1)} fechado`, text: 'O mês ficou guardado do jeito que vocês conferiram.' };
  if (n === 1) return { title: 'Primeiro mês no app', text: 'Os gastos já estão separados por categoria.' };
  if (n === 2) return { title: 'Cartão e conta juntos', text: 'Agora o app mostra quanto sobrou no mês.' };
  if (n === 3) return { title: 'Mês fechado', text: 'O mês ficou guardado do jeito que vocês conferiram.' };
  if (n === 4) return { title: 'Semana conferida', text: 'O que entrou na semana está certo.' };
  return { title: 'Dois meses fechados', text: 'Agora o app compara um mês com o outro.' };
}
// Central → Fluxos (robot screens): the "Liberado" of step 1 as a family that just sent the first bill sees it.
export const previewUnlock = () => showUnlock(trailState({ hasCard: true }), 1);
function showUnlock(st, n) {
  const u = unlockScreen(st, n), h = headline(n);
  if (!u) { showing = false; return; }
  track('trilha.liberou_' + n);
  const el = document.createElement('div');
  el.className = 'unlock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Etapa ${n} feita`);
  el.innerHTML = `<div class="ul-card">
    <span class="ul-eb">Etapa ${n} de ${u.total} feita</span>
    <h2 class="ul-title">${esc(h.title)}</h2>${h.text ? `<p class="ul-text">${esc(h.text)}</p>` : ''}
    ${u.tools.length ? `<section class="ul-tools"><span class="ul-eb2">Liberado</span>${u.tools.map(x => `<div class="ul-tool"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span></div>`).join('')}</section>` : ''}
    ${u.next ? `<section class="ul-next"><span class="ul-eb">Próxima etapa · ${u.next.minutes} minutos</span><strong>${esc(u.next.title)}</strong><span>${esc(u.next.why)}</span></section>` : '<section class="ul-next"><strong>Trilha completa</strong><span>Todas as ferramentas estão abertas.</span></section>'}
    <div class="ul-acts">${u.tools[0] ? `<button class="btn ul-main" type="button" data-tool="${u.tools[0].id}">Ver ${esc(u.tools[0].name.toLowerCase())}</button>` : ''}
      ${u.next ? `<button class="btn ul-sec" type="button" data-step="${u.next.go}">${esc(u.next.go === 'pdf' ? 'Fazer a próxima agora' : 'Fazer a próxima agora')}</button>` : '<button class="btn ul-sec" type="button" data-close>Fechar</button>'}</div></div>`;
  const close = () => { el.remove(); document.body.style.overflow = ''; showing = false; S.popupAt = Date.now(); };
  document.body.append(el); document.body.style.overflow = 'hidden';
  el.querySelector('[data-tool]')?.addEventListener('click', e => { close(); openTool(e.currentTarget.dataset.tool); });
  el.querySelector('[data-step]')?.addEventListener('click', e => { close(); doStep(e.currentTarget.dataset.step); });
  el.querySelector('[data-close]')?.addEventListener('click', close);
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  el.querySelector('button')?.focus();
}

// Início sections that wait for a step (hidden, not removed: the code that fills them still finds them).
export const SECTION_TOOL = { sobra: 'sobra', previsao: 'previsao', nivel: 'retro', patrimonio: 'patrimonio', sonho: 'metas', fixos: 'contas_casa', divisao: 'divisao' };

// ---------- First access: one screen and straight to the first statement ----------
export const BANKS = ['Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa', 'Inter', 'C6', 'Outro'];
export function showStart({ name, onPdf, onVoice, onExample }) {
  const el = document.createElement('div');
  el.className = 'start'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Começar');
  let bank = settings().bank || '';
  const draw = step => {
    if (step === 1) {
      el.innerHTML = `<div class="st-card">
        <span class="tr-eb2">Etapa 1 de 5</span>
        <h2 class="st-title">${name ? esc(name) + ', em' : 'Em'} 2 minutos vocês já veem para onde foi o dinheiro</h2>
        <ol class="st-list"><li>Vocês mandam o PDF da fatura do cartão (ou do extrato da conta).</li><li>O app lê e separa tudo por categoria. A senha do banco nunca é pedida.</li><li>Vocês veem para onde foi cada real, e o app libera a próxima ferramenta.</li></ol>
        <div class="st-acts"><button class="btn primary" type="button" id="stPdf">Mandar a primeira fatura</button>
          <button class="btn" type="button" id="stVoice">Ainda não tenho: lançar um gasto falando</button>
          <button class="linkbtn" type="button" id="stExample">Ver primeiro um mês de exemplo</button></div></div>`;
      el.querySelector('#stPdf').onclick = () => { track('comecar.fatura'); draw(2); };
      el.querySelector('#stVoice').onclick = () => { track('comecar.falar'); close(); onVoice(); };
      el.querySelector('#stExample').onclick = () => { track('comecar.exemplo'); close(); onExample(); };
    } else {
      el.innerHTML = `<div class="st-card">
        <button class="linkbtn st-back" type="button" id="stBack">‹ Voltar</button>
        <h2 class="st-title">De qual banco é o cartão?</h2>
        <div class="st-banks" role="group" aria-label="Banco">${BANKS.map(b => `<button type="button" class="chip" data-bank="${esc(b)}" aria-pressed="${b === bank}">${esc(b)}</button>`).join('')}</div>
        <section class="st-how" id="stHow"${bank ? '' : ' hidden'}></section>
        <div class="st-acts"><button class="btn primary" type="button" id="stGo">Escolher o PDF</button>
          <p class="small muted">Também vale um print ou uma foto da fatura.</p></div></div>`;
      const how = () => {
        const b = bank && bank !== 'Outro' ? bank : 'do seu banco', box = el.querySelector('#stHow');
        box.hidden = !bank;
        box.innerHTML = `<strong>No app ${bank && bank !== 'Outro' ? 'do ' + esc(bank) : esc(b)}</strong><ol><li>Abra o cartão de crédito e a fatura que já fechou.</li><li>Procure "Baixar PDF", "Compartilhar" ou "Enviar por e-mail".</li><li>Volte aqui e toque em "Escolher o PDF".</li></ol>
          <p class="small muted">O app do banco não deixa? No computador, abra o internet banking, a fatura (vale a aberta também) e use Imprimir → Salvar como PDF.</p>`;
      };
      how();
      el.querySelectorAll('[data-bank]').forEach(c => c.onclick = () => {
        bank = c.dataset.bank; el.querySelectorAll('[data-bank]').forEach(o => o.setAttribute('aria-pressed', String(o === c))); how(); track('comecar.banco');
        const cur = settings(); if (S.hh && cur.bank !== bank) db.saveSettings(S.hh.id, { ...cur, bank }).then(() => { S.hh.settings = { ...settings(), bank }; }).catch(() => {});
      });
      el.querySelector('#stBack').onclick = () => draw(1);
      el.querySelector('#stGo').onclick = () => { track('comecar.escolher_pdf'); close(); onPdf(); };
    }
    el.querySelector('button')?.focus();
  };
  const close = () => { el.remove(); document.body.style.overflow = ''; };
  document.body.append(el); document.body.style.overflow = 'hidden';
  draw(1);
}

// ---------- One tip, the first time on a screen (per person, on this phone) ----------
export function firstTip(key, target, title, text) {
  if (!target || lsGet('fin.tip.' + key) === '1' || document.querySelector('.tip1, .unlock, .start, .tour, .coach')) return;
  lsSet('fin.tip.' + key, '1'); track('dica.' + key);
  const el = document.createElement('div');
  el.className = 'tip1'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Dica');
  el.innerHTML = `<strong>${esc(title)}</strong><span>${esc(text)}</span><button class="btn" type="button">Entendi</button>`;
  target.insertAdjacentElement('afterend', el);
  el.querySelector('button').onclick = () => el.remove();
}
