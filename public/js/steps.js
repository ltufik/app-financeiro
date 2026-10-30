// "Primeiros passos": a guided checklist on the summary screen for new families.
import { S, goals } from './state.js';
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

function items() {
  const t = S.txs, g = goals();
  return [
    { key: 'fatura', done: t.some(x => x.source === 'cartao' && !x.manual), title: 'Envie a última fatura do cartão', hint: 'Em PDF, baixado no app do banco.', go: ['lancar', '#drop'], btn: 'Enviar' },
    { key: 'extrato', done: t.some(x => x.source === 'conta' && !x.manual), title: 'Envie o extrato da conta do mesmo mês', hint: 'O mês inteiro, do dia 1 ao último dia.', go: ['lancar', '#drop'], btn: 'Enviar' },
    { key: 'falar', done: t.some(x => x.manual), title: 'Lance um gasto falando', hint: 'Ex.: "gastei 45 na padaria no cartão".', go: ['lancar', '#qText'], btn: 'Lançar' },
    { key: 'metas', done: !!(g.cardMonthly || g.patrimonio), title: 'Defina suas metas', hint: 'Quanto quer gastar no cartão e quanto quer juntar.', go: ['ajustes', '#gCard', 'metas'], btn: 'Definir' },
    { key: 'convite', done: S.members.length > 1, title: 'Convide quem divide as contas', hint: 'Mande um link pelo WhatsApp: a pessoa toca e já entra na família.', go: ['ajustes', '#ivName', 'familia'], btn: 'Convidar' },
    { key: 'instalar', done: isStandalone() || lsGet('fin.installed') === '1', title: 'Instale o app no celular', hint: 'Fica com ícone na tela, como os outros apps.', install: true, btn: 'Como?' },
  ];
}

export function stepsComplete() { return items().every(i => i.done); }
export const stepsHidden = () => lsGet('fin.steps.hide.' + S.hh.id) === '1';

export function renderSteps(box) {
  const list = items(), done = list.filter(i => i.done).length;
  if (stepsHidden() || done === list.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><h3>Primeiros passos</h3><span class="tiny muted">${done} de ${list.length}</span></div>
    <div class="progress"><span style="width:${done / list.length * 100}%"></span></div>
    <ul class="steps">${list.map((it, k) => `<li class="${it.done ? 'done' : ''}"><span class="ck" aria-hidden="true">${it.done ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span>
      <span class="st"><span class="small" style="font-weight:600">${esc(it.title)}</span><br><span class="tiny muted">${esc(it.hint)}</span></span>
      ${it.done ? '<span class="tiny muted">feito</span>' : `<button class="chip" type="button" data-k="${k}">${it.btn}</button>`}</li>
      ${it.install && !it.done ? `<li hidden id="installHelp" class="help" style="display:block">${installHelpHTML()}<button class="chip" type="button" data-mark style="margin-top:8px">Já instalei</button></li>` : ''}`).join('')}</ul>
    <button class="tour-skip" type="button" data-hide style="margin-top:6px">Esconder primeiros passos</button>`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const it = list[+b.dataset.k];
    if (it.install) { const h = box.querySelector('#installHelp'); h.hidden = !h.hidden; return; }
    S.go(it.go[0], it.go[1], it.go[2]);
  });
  box.querySelector('[data-hide]').onclick = () => { lsSet('fin.steps.hide.' + S.hh.id, '1'); box.hidden = true; };
  const mark = box.querySelector('[data-mark]'); if (mark) mark.onclick = () => { lsSet('fin.installed', '1'); renderSteps(box); };
  wireInstall(box);
}
