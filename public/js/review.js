// Caixa "a revisar": the line on Início and the full-screen review, one item at a time, until it reaches zero.
// The queue comes from lib/review.js (same count as the Sunday push). Items that change the numbers use the
// screens the app already had for them (repeats, cash, financing, money that paid a payoff); categories get one card.
import { S, settings, reindex } from './state.js';
import * as db from './db.js';
import { track } from './usage.js';
import { $, toast, catPicker, invalid, clearInvalid } from './ui.js';
import { esc, brl, todayISO, isoToBr, norm } from './lib/format.js';
import { checkNumber } from './lib/validate.js';
import { reviewQueue, reviewLine } from './lib/review.js';
import { askRule } from './learnask.js';
import { renderDups, renderFunding } from './dupfix.js';
import { renderCash } from './cash.js';
import { renderPendingPayments } from './debtpay.js';
import { familyStreak } from './challenges.js';
import { saveCheckin, checkedInRecently, checkinNow } from './forecast.js';

const later = new Set(); // "Ver depois": skipped in this opening of the app, still counted on Início
export const reviewNow = () => reviewQueue({ txs: S.txs, idx: S.catIdx, settings: settings(), today: todayISO() });
const firstName = () => String(S.members.find(m => m.user_id === S.user?.id)?.display_name || '').trim().split(/\s+/)[0];
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const CHECK = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const LABEL = { categoria: 'Categoria sugerida', repetido: 'Pode estar repetido', saque: 'Saque sem destino', amortizacao: 'Abate um financiamento?', entrada: 'Esse dinheiro pagou a amortização?' };

// Início: one line at the top while something waits; gone at zero.
export function renderReviewLine(box) {
  if (!box) return;
  const q = reviewNow();
  box.hidden = !q.total; if (!q.total) { box.innerHTML = ''; return; }
  box.innerHTML = `<button type="button" class="rv-line" id="rvOpen"><span class="rv-n num">${q.total}</span><span class="rv-t"><strong>${q.total} para revisar</strong><span class="small">${esc(reviewLine(q.counts, q.total, firstName()))}</span></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;
  box.querySelector('#rvOpen').onclick = () => openReview('inicio');
}

let start = 0, done = 0, from = 'inicio';
export function openReview(origin = 'inicio') {
  document.getElementById('caixa')?.remove();
  later.clear(); from = origin; done = 0; start = reviewNow().total;
  const el = document.createElement('div'); el.id = 'caixa'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rvTitle');
  document.body.append(el); document.body.classList.add('noscroll');
  track(origin === 'aviso' ? 'revisao.abriu_aviso' : 'revisao.abriu');
  draw();
}
function close() { document.getElementById('caixa')?.remove(); document.body.classList.remove('noscroll'); S.render(); }

function draw() {
  const el = document.getElementById('caixa'); if (!el) return;
  const q = reviewNow(), items = q.items.filter(i => !later.has(i.key)), it = items[0];
  const total = Math.max(start, done + q.total), pos = Math.min(total, done + 1);
  if (!it) return drawDone(el, q.total);
  const head = `<header class="rv-head"><button type="button" class="rv-x" id="rvBack" aria-label="Voltar">${BACK}</button><h2 id="rvTitle">Para revisar</h2><span class="small muted">${pos} de ${total}</span></header>
    <div class="rv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${Math.round(100 * done / Math.max(1, total))}%"></span></div>`;
  const tag = `<span class="rv-tag ${it.kind === 'categoria' ? '' : 'warn'}">${LABEL[it.kind]}</span>`;
  if (it.kind === 'categoria') {
    const t = it.tx, src = t.source === 'cartao' ? 'cartão' : 'conta';
    el.innerHTML = `${head}<main class="rv-main">${tag}
      <section class="rv-card"><div class="rv-row"><strong>${esc(t.description)}</strong><span class="num rv-v">${brl(Math.abs(+t.amount))}</span></div>
        <p class="small muted">${esc(t.date ? isoToBr(t.date) : t.day || '')} · ${src}${t.note ? ' · ' + esc(t.note) : ''}</p>
        <div class="rv-sug"><span class="small muted">${it.suggestion ? 'O app acha que é' : 'Qual é a categoria?'}</span>${it.suggestion ? `<span class="rv-cat">${esc(it.suggestion)}</span>` : ''}</div></section>
      <div class="rv-acts">${it.suggestion ? '<button type="button" class="btn primary" id="rvOk">Ok, é isso</button>' : ''}<span id="rvPick"></span>
        <button type="button" class="linkbtn" id="rvLater">Ver depois</button></div>
      <p class="tiny muted rv-foot">Ao trocar, o app pergunta se vale para as próximas compras com esse nome.</p></main>`;
    const setCat = async c => {
      await db.updateTransaction(t.id, { category: c, pending: false }); t.category = c; t.pending = false;
      if (!t.manual) { await db.learnRule(S.hh.id, t.source, norm(t.description), c).catch(() => {}); S.rules.push({ source: t.source, kind: 'exact', pattern: norm(t.description), category: c }); }
      reindex(); done++;
    };
    const pick = catPicker(S.categories, it.suggestion ? 'Trocar a categoria' : 'Escolher a categoria', false, async c => {
      try { await setCat(c); track('revisao.trocou'); await askRule(t, c); draw(); } catch (err) { toast('Não foi possível salvar. ' + db.errorText(err)); }
    }, { description: t.description, amount: t.amount });
    pick.className = 'btn' + (it.suggestion ? '' : ' primary'); el.querySelector('#rvPick').replaceWith(pick);
    const ok = el.querySelector('#rvOk');
    if (ok) ok.onclick = async () => { ok.disabled = true; try { await setCat(it.suggestion); track('revisao.ok'); draw(); } catch (err) { ok.disabled = false; toast('Não foi possível salvar. ' + db.errorText(err)); } };
  } else {
    // Repeats, cash, financing and the money that paid a payoff: the app's own screens for them, inside the card.
    el.innerHTML = `${head}<main class="rv-main">${tag}<section class="rv-card rv-host" id="rvHost"></section>
      <div class="rv-acts"><button type="button" class="linkbtn" id="rvLater">Ver depois</button></div></main>`;
    const host = el.querySelector('#rvHost'), before = q.total;
    const onDone = () => { const now = reviewNow().total; done += Math.max(1, before - now); track('revisao.' + it.kind); draw(); };
    if (it.kind === 'repetido') renderDups(host, { onDone });
    else if (it.kind === 'saque') renderCash(host, { onDone });
    else if (it.kind === 'amortizacao') renderPendingPayments(host, { onDone });
    else renderFunding(host, { onDone });
  }
  el.querySelector('#rvBack').onclick = close;
  el.querySelector('#rvLater').onclick = () => { (it.kind === 'categoria' ? [it] : items.filter(i => i.kind === it.kind)).forEach(i => later.add(i.key)); track('revisao.depois'); draw(); };
  el.querySelector('h2').focus?.();
}

// Zero: "Tudo em dia", the open card bill (if not given in the last 2 days) and the weeks in a row.
async function drawDone(el, left) {
  const name = firstName(), ask = !checkedInRecently(), tg = checkinNow();
  if (!left && done > 0) {
    const cur = settings(), list = cur.reviews || [], today = todayISO();
    if (!list.some(r => r.date === today && r.by === S.user?.id)) {
      const next = { ...cur, reviews: [...list, { date: today, n: done, by: S.user?.id || null }].slice(-60) };
      try { await db.saveSettings(S.hh.id, next); S.hh.settings = next; } catch (e) { /* the streak waits for the next time */ }
    }
    track('revisao.zerou');
  }
  const sk = familyStreak().current;
  el.innerHTML = `<header class="rv-head"><button type="button" class="rv-x" id="rvBack" aria-label="Fechar">${BACK}</button><h2 id="rvTitle">${new Date(todayISO() + 'T12:00:00Z').getUTCDay() === 0 ? 'Revisão de domingo' : 'Para revisar'}</h2></header>
    <main class="rv-main">
      <section class="rv-done"><span class="rv-ok">${CHECK}</span><h3 class="num">${left ? `Por agora é isso${name ? ', ' + esc(name) : ''}` : `Tudo em dia${name ? ', ' + esc(name) : ''}`}</h3>
        <p class="small">${left ? `${left} ${left > 1 ? 'ficaram' : 'ficou'} para depois: continuam na linha do Início.` : done ? `${done} ${done > 1 ? 'revisados' : 'revisado'}. Os números do Início estão certos.` : 'Nada para revisar. Os números do Início estão certos.'}</p></section>
      ${ask ? `<section class="rv-card"><strong>${tg.closed ? 'Último passo: quanto veio a fatura que fechou?' : 'Último passo: quanto está a fatura aberta?'}</strong>
        <p class="small muted">Olhe no app do banco. Com esse número, a previsão do mês fica exata.</p>
        <label class="f">Valor (R$)<input type="number" inputmode="decimal" step="0.01" min="0" id="rvBill" placeholder="Ex.: 7240"></label>
        <button type="button" class="btn primary" id="rvBillSave">Salvar e ver a previsão</button></section>` : ''}
      ${sk ? `<section class="rv-card rv-run"><strong>${sk} ${sk > 1 ? 'semanas seguidas' : 'semana'} cuidando das contas</strong><span class="small muted">Revisar tudo conta para a sequência. Mais 1 semana e ela cresce.</span></section>` : ''}
      <button type="button" class="btn" id="rvClose">Voltar ao Início</button>
    </main>`;
  el.querySelector('#rvBack').onclick = close; el.querySelector('#rvClose').onclick = close;
  const save = el.querySelector('#rvBillSave');
  if (save) save.onclick = async () => {
    const inp = el.querySelector('#rvBill'); clearInvalid(el);
    const v = +String(inp.value).replace(',', '.'), e = checkNumber(inp.value === '' ? NaN : v, { min: 0, max: 1e7, label: 'O valor da fatura' });
    if (e) return invalid(inp, e);
    save.disabled = true;
    try { toast(await saveCheckin(v, 'revisao')); S.openForecast = true; close(); S.go('resumo', '#sum_previsao'); } catch (err) { save.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  };
}
