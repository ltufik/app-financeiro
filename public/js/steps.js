// Home checklist ("régua de preenchimento") and install help.
import { S, settings, latestClosed, closedKeys, calcMonth, goals } from './state.js';
import { toast } from './ui.js';
import { track } from './usage.js';
import { todayISO } from './lib/format.js';
import { missionList, missionProgress, syncMissions, badges } from './lib/missions.js';
import { sundayHabit } from './lib/closing.js';
import { notifyFamily } from './push.js';
import { renderChallengeSection, familyHTML, familyStreak } from './challenges.js';
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

// Missões (lib/missions.js): the next one on Início, all of them and the selos on Menu → Conquistas.
function facts() {
  const t = S.txs.filter(x => !x.virtual), st = settings(), g = st.goals || {};
  const L = latestClosed(), pend = L ? t.filter(x => x.month === L && (x.pending || !x.category || x.category === 'A classificar')).length : 1;
  return { hasCard: t.some(x => x.source === 'cartao' && !x.manual), hasConta: t.some(x => x.source === 'conta' && !x.manual), hasClosedMonth: !!L, pending: pend,
    goalsSet: !!(+g.cardMonthly || st.goalsSet), pushOn: lsGet('fin.push.on') === '1', closedCount: Object.keys(st.closed || {}).length,
    dream: !!(+g.patrimonio && g.ageGoal), invest: !!(+st.invest?.total || (st.assets || []).length), debts: !!(st.debts || []).length, fixas: !!(st.recurring || []).length,
    members: S.members.length, manualAny: t.some(x => x.manual), installed: isStandalone() || lsGet('fin.installed') === '1', skips: st.skips || {} };
}
export const missions = () => missionList(facts());
export function familyBadges() {
  const list = missions(), p = missionProgress(list), today = todayISO(), cur = today.slice(0, 7);
  const finished = closedKeys('conta').filter(k => k < cur).map(k => { const c = calcMonth(k); return { month: k, res: c.res, tx: c.tx }; });
  return badges({ starterComplete: p.starterComplete, hasCard: list[0].done, closedCount: Object.keys(settings().closed || {}).length, finished, goal: goals().savings,
    taught: S.rules.filter(r => +r.priority <= 20).length, members: S.members.length, sundays: sundayHabit(settings().checkins || [], today).done,
    challenges: (settings().challenges || []).filter(c => c.status === 'cumprido').length, ...(s => ({ streak: s.current, bestStreak: s.best }))(familyStreak()) });
}

// Done missions are recorded once (households.settings.missionsDone) so each one is celebrated a single time.
let syncing = false;
async function celebrate(list) {
  if (syncing || !S.hh) return; const cur = settings(), { next, newly } = syncMissions(cur.missionsDone, list, todayISO());
  if (next === cur.missionsDone) return;
  syncing = true;
  try { const st = { ...cur, missionsDone: next }; await db.saveSettings(S.hh.id, st); S.hh.settings = st; } catch (e) { /* celebrate next time */ } finally { syncing = false; }
  if (!newly.length) return;
  for (const k of newly) track('missao.' + k);
  for (const k of newly.filter(k => list.find(x => x.key === k)?.starter)) notifyFamily('conquista', { key: 'missao:' + k });
  const p = missionProgress(list), m = list.find(x => x.key === newly[newly.length - 1]);
  toast(p.starterComplete && newly.some(k => list.find(x => x.key === k)?.starter) ? 'Missões de começo completas! Vocês ganharam o selo "Família organizada".' : `Missão cumprida: ${m.title.toLowerCase()}!${p.next ? ` Próxima: ${p.next.title.toLowerCase()}.` : ''}`);
}

const DOT = ok => `<span class="mis-dot${ok ? ' on' : ''}" aria-hidden="true"></span>`;
export function renderSteps(box) {
  if (!box) return;
  const list = missions(), p = missionProgress(list), ok = m => m.done || m.skipped;
  celebrate(list);
  // Starter missions done: the big card leaves; the strip under the greeting (renderStrip) keeps them in sight.
  if (p.starterComplete) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false; box.classList.remove('regua-mini');
  const m = p.next, st = list.filter(x => x.starter);
  box.innerHTML = `<div class="mis"><p class="eyebrow">Missões de começo · ${p.starterDone} de ${p.starterTotal}</p>
    <div class="mis-dots" role="img" aria-label="${p.starterDone} de ${p.starterTotal} missões cumpridas">${st.map(x => DOT(ok(x))).join('')}</div>
    <h3>${esc(m.title)}</h3><p class="small">${esc(m.hint)} <span class="muted">Destrava: ${esc(m.unlocks)}.</span></p>
    <div class="rowbtn"><button class="btn primary" type="button" data-go>${esc(m.btn)}</button>${m.skip ? `<button class="btn" type="button" data-skip>${esc(m.skip)}</button>` : ''}<button class="linkbtn small" type="button" data-all>Ver todas</button></div></div>`;
  box.querySelector('[data-go]').onclick = () => { track('inicio.missao_abriu'); S.go(m.go[0], m.go[1], m.go[2]); };
  box.querySelector('[data-all]').onclick = () => S.go('ajustes', null, 'conquistas');
  const sk = box.querySelector('[data-skip]'); if (sk) sk.onclick = () => setSkip(m.key, true, () => renderSteps(box));
}
async function setSkip(key, v, then) {
  const st = { ...settings(), skips: { ...(settings().skips || {}), [key]: v } };
  try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; then && then(); } catch (e) { toast('Não foi possível salvar agora.'); }
}

// Menu → Conquistas: every mission (starter and extra) and the selos.
export function renderConquistas(box) {
  if (!box) return;
  const list = missions(), p = missionProgress(list), b = familyBadges(), ok = m => m.done || m.skipped;
  const item = m => { const k = list.indexOf(m); return `<li class="${ok(m) ? 'done' : ''}${m.skipped ? ' skipped' : ''}"><span class="ck" aria-hidden="true">${ok(m) ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span>
    <span class="st"><span class="small" style="font-weight:600">${esc(m.title)}</span><br><span class="tiny muted">${m.done ? 'Feito.' : m.skipped ? 'Marcado: ' + esc(m.skip.toLowerCase()) + '.' : esc(m.hint) + ' Destrava: ' + esc(m.unlocks) + '.'}</span>
    ${m.skipped ? `<br><button class="linkbtn tiny" type="button" data-unskip="${k}">Desfazer</button>` : !m.done && m.skip ? `<br><button class="linkbtn tiny" type="button" data-skip="${k}">${esc(m.skip)}</button>` : ''}</span>
    ${ok(m) ? '' : `<button class="chip" type="button" data-k="${k}">${esc(m.btn)}</button>`}</li>${m.install && !m.done ? `<li hidden id="installHelp" class="help" style="display:block">${installHelpHTML()}<button class="chip" type="button" data-mark style="margin-top:8px">Já instalei</button></li>` : ''}`; };
  const won = b.filter(x => x.earned).length;
  box.innerHTML = `<div id="chBox" class="stack"></div>
    <h3 style="margin-top:14px">Missões de começo <span class="tiny muted">${p.starterDone} de ${p.starterTotal}</span></h3>
    <div class="mis-dots">${list.filter(m => m.starter).map(m => DOT(ok(m))).join('')}</div>
    <ul class="steps">${list.filter(m => m.starter).map(item).join('')}</ul>
    <h3 style="margin-top:14px">Missões extras <span class="tiny muted">${p.extraDone} de ${p.extraTotal}</span></h3>
    <ul class="steps">${list.filter(m => !m.starter).map(item).join('')}</ul>
    <h3 style="margin-top:14px">Selos <span class="tiny muted">${won} de ${b.length}</span></h3>
    <div class="selos">${b.map(x => `<div class="selo${x.earned ? ' on' : ''}"><span class="selo-i" aria-hidden="true">${x.earned ? '★' : '☆'}</span><strong class="small">${esc(x.title)}</strong><span class="tiny muted">${x.earned ? 'Conquistado.' : esc(x.how) + (x.progress ? ` (${esc(x.progress)})` : '')}</span></div>`).join('')}</div>
    ${familyHTML()}`;
  renderChallengeSection(box.querySelector('#chBox'), { onChange: () => renderConquistas(box) });
  box.querySelectorAll('[data-k]').forEach(btn => btn.onclick = () => { const m = list[+btn.dataset.k]; if (m.install) { const h = box.querySelector('#installHelp'); if (h) h.hidden = !h.hidden; return; } track('conquistas.missao_abriu'); S.go(m.go[0], m.go[1], m.go[2]); });
  box.querySelectorAll('[data-skip]').forEach(btn => btn.onclick = () => setSkip(list[+btn.dataset.skip].key, true, () => renderConquistas(box)));
  box.querySelectorAll('[data-unskip]').forEach(btn => btn.onclick = () => setSkip(list[+btn.dataset.unskip].key, false, () => renderConquistas(box)));
  const mark = box.querySelector('[data-mark]'); if (mark) mark.onclick = () => { lsSet('fin.installed', '1'); renderConquistas(box); };
  wireInstall(box);
}

// Início, under "Olá": always in sight once the starter missions are done (outside the "Seu próximo passo" queue).
export function renderStrip(box) {
  if (!box) return;
  const p = missionProgress(missions());
  if (!p.starterComplete) { box.hidden = true; box.innerHTML = ''; return; }
  const b = familyBadges(), won = b.filter(x => x.earned).length;
  box.hidden = false;
  const sk = familyStreak();
  box.innerHTML = `<button type="button" class="mis-strip"><span class="mis-star" aria-hidden="true">★</span><span class="small"><strong>${won} de ${b.length} selos</strong>${sk.current >= 2 ? ` · 🔥 ${sk.current} semanas seguidas` : ''}${p.next ? ` · Próxima missão: ${esc(p.next.title)}` : ' · Todas as missões cumpridas'}</span><span class="mis-go" aria-hidden="true">›</span></button>`;
  box.querySelector('button').onclick = () => { track('inicio.conquistas'); S.go('ajustes', null, 'conquistas'); };
}
