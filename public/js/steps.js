// Home checklist ("régua de preenchimento") and install help.
import { S, settings, latestClosed } from './state.js';
import * as db from './db.js';
import { esc } from './lib/format.js';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const platform = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop';

export function installHelpHTML() {
  if (isStandalone()) return '<p class="small">O app já está instalado neste aparelho.</p>';
  const p = platform();
  const btn = S.installEvt ? '<button class="btn primary" type="button" data-install>Instalar agora</button>' : '';
  const how = p === 'ios'
    ? '<ol><li>Abra este endereço no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e depois <strong>Adicionar</strong>.</li></ol>'
    : p === 'android'
      ? '<ol><li>Abra este endereço no <strong>Chrome</strong>.</li><li>Toque no menu <strong>⋮</strong>, no canto de cima.</li><li>Escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</li></ol>'
      : '<ol><li>No Chrome ou no Edge, clique no ícone de instalar no fim da barra de endereço.</li><li>No celular, abra este mesmo endereço e siga o passo a passo que vai aparecer aqui.</li></ol>';
  return `${btn}${how}<p class="tiny muted">O ícone aparece na tela do celular e o app abre em tela cheia, como os outros.</p>`;
}

export function wireInstall(root) {
  root.querySelectorAll('[data-install]').forEach(b => b.onclick = async () => {
    const e = S.installEvt; if (!e) return;
    e.prompt(); const r = await e.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') { lsSet('fin.installed', '1'); S.installEvt = null; S.render(); }
  });
}

// "Régua": how complete the family's setup is. Each item has a weight and says what it unlocks.
// Items that don't apply to everyone can be skipped ("não tenho"), saved in the household settings.
function items() {
  const t = S.txs, st = settings(), g = st.goals || {}, sk = st.skips || {};
  const L = latestClosed(), pend = L ? t.filter(x => x.month === L && (x.pending || !x.category || x.category === 'A classificar')).length : 1;
  return [
    { key: 'fatura', w: 20, done: t.some(x => x.source === 'cartao' && !x.manual), title: 'Envie a última fatura do cartão', hint: 'PDF baixado no app do banco.', unlocks: 'a sobra do mês e o cartão', go: ['lancar', '#drop'], btn: 'Enviar' },
    { key: 'extrato', w: 20, done: t.some(x => x.source === 'conta' && !x.manual), title: 'Envie o extrato da conta', hint: 'O mês inteiro, do dia 1 ao último dia.', unlocks: 'receitas, pix e boletos na conta', go: ['lancar', '#drop'], btn: 'Enviar' },
    { key: 'metas', w: 10, done: !!(+g.cardMonthly || g.savings != null && st.goalsSet), title: 'Combine os limites do mês', hint: 'Até quanto gastar no cartão e quanto guardar da renda.', unlocks: 'avisos de gasto alto', go: ['ajustes', '#gCard', 'metas'], btn: 'Definir' },
    { key: 'meta', w: 10, done: !!(+g.patrimonio && g.ageGoal), title: 'Defina o sonho de vocês', hint: 'Quanto querem ter investido e com que idade.', unlocks: 'quando vocês chegam lá', go: ['ajustes', '#gPat', 'metas'], btn: 'Definir' },
    { key: 'invest', w: 5, done: !!(+st.invest?.total || (st.assets || []).length), skip: 'Ainda não tenho', title: 'Informe investimentos e bens', hint: 'Valor investido hoje, imóveis e veículos.', unlocks: 'o patrimônio da família', go: ['ajustes', '#iTotal', 'patrimonio'], btn: 'Informar' },
    { key: 'dividas', w: 5, done: !!(st.debts || []).length, skip: 'Não tenho', title: 'Cadastre financiamentos e dívidas', hint: 'Saldo, taxa e parcela.', unlocks: 'simulações de quitação', go: ['ajustes', '[data-add="debts"]', 'patrimonio'], btn: 'Cadastrar' },
    { key: 'fixas', w: 5, done: !!(st.recurring || []).length, skip: 'Não tenho', title: 'Liste as contas fixas do cartão', hint: 'Assinaturas, seguros, planos.', unlocks: 'a previsão da próxima fatura', go: ['ajustes', '[data-add="recurring"]', 'patrimonio'], btn: 'Listar' },
    { key: 'classificar', w: 5, done: !!L && !pend, title: 'Deixe tudo com categoria', hint: 'Nenhum lançamento "A classificar" no último mês.', unlocks: 'gráficos certos', go: ['extrato', '#lPend'], btn: 'Revisar' },
    { key: 'convite', w: 5, done: S.members.length > 1, skip: 'Uso sozinho', title: 'Convide quem divide as contas', hint: 'Um link pelo WhatsApp.', unlocks: 'a família toda no mesmo lugar', go: ['ajustes', '#ivName', 'familia'], btn: 'Convidar' },
    { key: 'falar', w: 5, done: t.some(x => x.manual), title: 'Lance um gasto falando', hint: 'Ex.: "gastei 45 na padaria no pix".', unlocks: 'o mês em dia antes do extrato', go: ['lancar', '#qText'], btn: 'Lançar' },
    { key: 'avisos', w: 5, done: lsGet('fin.push.on') === '1', skip: 'Não quero', title: 'Ligue os avisos no celular', hint: 'Fatura fechou, mês acabando, gasto alto.', unlocks: 'avisos sem precisar abrir o app', go: ['ajustes', '#pushBox', 'avisos'], btn: 'Ligar' },
    { key: 'instalar', w: 5, done: isStandalone() || lsGet('fin.installed') === '1', title: 'Instale o app no celular', hint: 'Ícone na tela, abre em tela cheia.', unlocks: 'acesso em um toque', install: true, btn: 'Como?' },
  ].map(i => ({ ...i, skipped: !i.done && !!sk[i.key] }));
}

export const completeness = () => { const l = items(); return Math.round(l.reduce((a, i) => a + (i.done || i.skipped ? i.w : 0), 0)); };
export function stepsComplete() { return completeness() >= 100; }

let showAll = false, expanded = false;
export const expandSteps = () => { expanded = true; };
export function renderSteps(box) {
  const list = items(), pctDone = completeness();
  if (pctDone >= 100) { box.hidden = true; return; }
  const todo = list.filter(i => !i.done && !i.skipped), shown = showAll ? list : todo.slice(0, 3);
  box.hidden = false;
  // Once the basics are in, the ruler shrinks to one line on the home screen.
  if (pctDone >= 40 && !expanded) {
    box.classList.add('regua-mini');
    box.innerHTML = `<div class="regua-h"><div><h3>Use o app por completo</h3><div class="progress regua" role="progressbar" aria-valuenow="${pctDone}" aria-valuemin="0" aria-valuemax="100" aria-label="Preenchimento"><span style="width:${pctDone}%"></span></div></div><span class="regua-n num">${pctDone}%</span></div>
      <button class="linkbtn small" type="button" data-open>Ver o que falta (${todo.length})</button>`;
    box.querySelector('[data-open]').onclick = () => { expanded = true; renderSteps(box); };
    return;
  }
  box.classList.remove('regua-mini');
  box.innerHTML = `<div class="regua-h"><div><h3>Use o app por completo</h3><p class="tiny muted">${todo.length} ${todo.length > 1 ? 'passos faltam' : 'passo falta'} para ver tudo o que o app pode mostrar.</p></div><span class="regua-n num">${pctDone}%</span></div>
    <div class="progress regua" role="progressbar" aria-valuenow="${pctDone}" aria-valuemin="0" aria-valuemax="100" aria-label="Preenchimento"><span style="width:${pctDone}%"></span></div>
    <ul class="steps">${shown.map(it => { const k = list.indexOf(it); return `<li class="${it.done ? 'done' : it.skipped ? 'done skipped' : ''}"><span class="ck" aria-hidden="true">${it.done || it.skipped ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span>
      <span class="st"><span class="small" style="font-weight:600">${esc(it.title)}</span> <span class="tiny muted">+${it.w}%</span><br><span class="tiny muted">${it.done ? 'Feito.' : it.skipped ? 'Marcado: ' + esc(it.skip.toLowerCase()) + '.' : esc(it.hint) + ' Libera ' + esc(it.unlocks) + '.'}</span>
      ${!it.done && !it.skipped && it.skip ? `<br><button class="linkbtn tiny" type="button" data-skip="${k}">${esc(it.skip)}</button>` : ''}${it.skipped ? `<br><button class="linkbtn tiny" type="button" data-unskip="${k}">Desfazer</button>` : ''}</span>
      ${it.done || it.skipped ? '' : `<button class="chip" type="button" data-k="${k}">${it.btn}</button>`}</li>
      ${it.install && !it.done ? `<li hidden id="installHelp" class="help" style="display:block">${installHelpHTML()}<button class="chip" type="button" data-mark style="margin-top:8px">Já instalei</button></li>` : ''}`; }).join('')}</ul>
    <div class="rowbtn"><button class="linkbtn small" type="button" data-all>${showAll ? 'Mostrar só o que falta' : 'Ver todos os ' + list.length + ' passos'}</button>${pctDone >= 40 ? '<button class="linkbtn small" type="button" data-close>Recolher</button>' : ''}</div>`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const it = list[+b.dataset.k];
    if (it.install) { const h = box.querySelector('#installHelp'); if (h) h.hidden = !h.hidden; return; }
    S.go(it.go[0], it.go[1], it.go[2]);
  });
  const setSkip = async (key, v) => {
    const st = { ...settings(), skips: { ...(settings().skips || {}), [key]: v } };
    try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; renderSteps(box); } catch (e) { /* keep as is */ }
  };
  box.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => setSkip(list[+b.dataset.skip].key, true));
  box.querySelectorAll('[data-unskip]').forEach(b => b.onclick = () => setSkip(list[+b.dataset.unskip].key, false));
  box.querySelector('[data-all]').onclick = () => { showAll = !showAll; renderSteps(box); };
  const cl = box.querySelector('[data-close]'); if (cl) cl.onclick = () => { expanded = false; showAll = false; renderSteps(box); };
  const mark = box.querySelector('[data-mark]'); if (mark) mark.onclick = () => { lsSet('fin.installed', '1'); renderSteps(box); };
  wireInstall(box);
}
