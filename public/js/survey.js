// Pesquisa de satisfação on Início: a card (never a pop-up) with the survey of this person's moment, chosen in
// lib/survey.js; "Responder" opens one question at a time. Answers go to the surveys table (Central → Pesquisas).
import { S, settings } from './state.js';
import * as db from './db.js';
import { toast } from './ui.js';
import { track, APP_VERSION } from './usage.js';
import { esc } from './lib/format.js';
import { firstName } from './lib/news.js';
import { pickSurvey, surveyDone, SURVEYS } from './lib/survey.js';

let ctx = null, loading = null; const seen = new Set();
const myName = () => firstName(S.members.find(m => m.user_id === S.user?.id)?.display_name);
const loadCtx = () => loading ||= db.surveyContext().then(c => { ctx = c || {}; }, () => { ctx = null; loading = null; });
export const resetSurvey = () => { ctx = null; loading = null; seen.clear(); };
export function currentSurvey() {
  if (!ctx || !S.user) return null;
  const months = new Set(S.txs.filter(t => !t.manual).map(t => t.month)).size, closed = Object.keys(settings().closed || {}).length;
  return pickSurvey({ now: new Date().toISOString(), joined: ctx.joined, activeDays: +ctx.active_days || 0, months, closed, owner: S.role === 'owner', history: ctx.history || [] });
}
const log = (id, kind, extra = {}) => { (ctx.history ||= []).unshift({ survey: id, kind, at: new Date().toISOString() }); return db.surveyEvent(S.hh.id, id, kind, extra.score ?? null, extra.answers ?? null, APP_VERSION); };

export function renderSurvey(box) {
  if (!box) return;
  if (!ctx) { box.hidden = true; loadCtx().then(() => { if (box.isConnected && ctx) renderSurvey(box); }); return; }
  const id = currentSurvey(), s = id && SURVEYS[id]; box.hidden = !s; if (!s) { box.innerHTML = ''; return; }
  if (!seen.has(id)) { seen.add(id); log(id, 'mostrou').catch(() => {}); track('inicio.pesquisa_viu'); }
  const n = myName();
  box.innerHTML = `<p class="eyebrow">Sua opinião · 1 minuto</p><h3>${esc(n ? `${n}, ${s.title[0].toLowerCase()}${s.title.slice(1)}` : s.title)}</h3><p class="small">${esc(s.intro)}</p>
    <div class="rowbtn"><button class="btn primary" type="button" id="svGo">Responder</button><button class="btn" type="button" id="svLater">Agora não</button></div>`;
  box.querySelector('#svLater').onclick = () => { log(id, 'adiou').catch(() => {}); track('inicio.pesquisa_agora_nao'); box.hidden = true; toast('Combinado. Perguntamos em outro momento.'); };
  box.querySelector('#svGo').onclick = () => { track('inicio.pesquisa_abriu'); openSurvey(id, () => { box.hidden = true; }); };
}

function openSurvey(id, onDone) {
  const s = SURVEYS[id], answers = {}; let i = 0;
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove());
  const wrap = document.createElement('div'); wrap.className = 'cfm-wrap';
  wrap.innerHTML = `<div class="cfm surv" role="dialog" aria-modal="true" aria-labelledby="svQ"><p class="eyebrow" id="svStep"></p><h3 id="svQ"></h3><div id="svA" class="stack"></div>
    <div class="rowbtn"><button class="btn primary" type="button" id="svNext"></button><button class="btn" type="button" id="svBack">Voltar</button></div></div>`;
  document.body.append(wrap); document.body.classList.add('cfm-open');
  const $ = q => wrap.querySelector(q), close = () => { wrap.remove(); document.body.classList.remove('cfm-open'); };
  wrap.onclick = e => { if (e.target === wrap) close(); }; wrap.onkeydown = e => { if (e.key === 'Escape') close(); };
  const ready = q => q.optional || (q.type === 'many' ? (answers[q.id] || []).length : answers[q.id] != null && answers[q.id] !== '');
  const draw = () => {
    const q = s.questions[i], last = i === s.questions.length - 1;
    $('#svStep').textContent = `Pergunta ${i + 1} de ${s.questions.length}`; $('#svQ').textContent = q.q;
    $('#svBack').textContent = i ? 'Voltar' : 'Fechar'; $('#svNext').textContent = last ? 'Enviar' : 'Próxima';
    const A = $('#svA');
    if (q.type === 'scale') A.innerHTML = `<div class="sv-scale">${Array.from({ length: 11 }, (_, k) => `<button type="button" class="chip" data-v="${k}" aria-pressed="${answers[q.id] === k}">${k}</button>`).join('')}</div><p class="tiny muted sv-ends"><span>Nada provável</span><span>Muito provável</span></p>`;
    else if (q.type === 'text') A.innerHTML = `<textarea id="svT" rows="3" maxlength="500" placeholder="Escreva aqui">${esc(answers[q.id] || '')}</textarea>`;
    else A.innerHTML = `${q.type === 'many' ? '<p class="tiny muted">Pode marcar mais de uma.</p>' : ''}${q.options.map(([k, l]) => `<button type="button" class="sv-opt" data-v="${k}" aria-pressed="${q.type === 'many' ? (answers[q.id] || []).includes(k) : answers[q.id] === k}">${esc(l)}</button>`).join('')}`;
    A.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
      const v = q.type === 'scale' ? +b.dataset.v : b.dataset.v;
      if (q.type === 'many') { const cur = new Set(answers[q.id] || []); cur.has(v) ? cur.delete(v) : cur.add(v); answers[q.id] = [...cur]; } else answers[q.id] = v;
      draw();
    });
    const t = A.querySelector('#svT'); if (t) t.oninput = () => { answers[q.id] = t.value.trim().slice(0, 500); };
    $('#svNext').disabled = !ready(q);
    if (t) t.focus();
  };
  $('#svBack').onclick = () => { if (!i) return close(); i--; draw(); };
  $('#svNext').onclick = async () => {
    if (i < s.questions.length - 1) { i++; return draw(); }
    if (!surveyDone(id, answers)) return;
    const btn = $('#svNext'); btn.disabled = true; btn.textContent = 'Enviando…';
    const score = s.questions.find(q => q.type === 'scale'); 
    try { await log(id, 'respondeu', { answers, score: score ? answers[score.id] : null }); track('inicio.pesquisa_respondeu'); close(); onDone && onDone(); const n = myName(); toast(`Obrigado${n ? ', ' + n : ''}! Sua resposta já chegou e vai guiar o que fazemos.`); }
    catch (e) { btn.disabled = false; btn.textContent = 'Enviar'; toast('Não foi possível enviar agora. ' + db.errorText(e)); }
  };
  draw();
}
