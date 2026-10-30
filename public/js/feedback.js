// Test phase: "Dar opinião" (erro, ideia, crítica) and "Dúvidas" (FAQ with search and the assistant).
// Voice becomes text with the same mic as Lançar; no audio is stored.
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './lib/format.js';
import { $, toast, confirmInline, invalid, clearInvalid, md } from './ui.js';
import { attachMic } from './speech.js';
import { chat, aiErrorText } from './ai.js';
import { FAQ, FAQ_TOPICS, searchFaq, answerPrompt } from './lib/faq.js';
import { track, APP_VERSION } from './usage.js';

export const TEST_PHASE = true;
export const KINDS = [
  { key: 'erro', label: 'Erro', hint: 'Algo não funcionou ou deu mensagem de erro', ph: 'Ex.: toquei em Salvar na nota fiscal e nada aconteceu.' },
  { key: 'ideia', label: 'Ideia', hint: 'Algo que seria bom ter', ph: 'Ex.: seria bom ver quanto gastei por semana.' },
  { key: 'critica', label: 'Crítica', hint: 'Algo confuso, chato ou difícil', ph: 'Ex.: não entendi o que é a régua do Início.' },
];
const STATUS = { novo: 'Recebida', visto: 'Lida pela equipe', backlog: 'Vai entrar no app', resolvido: 'Resolvida' };
const device = () => { const u = navigator.userAgent; return (/iphone|ipad/i.test(u) ? 'iPhone' : /android/i.test(u) ? 'Android' : /mac/i.test(u) ? 'Mac' : /windows/i.test(u) ? 'Windows' : 'Outro') + (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone ? ' · app instalado' : ' · navegador'); };
const screen = () => S.tab === 'ajustes' ? 'menu.' + (S.sec || '') : (S.tab || '');
const send = (kind, text, answer = null) => db.sb.rpc('send_feedback', { p_household: S.hh?.id || null, p_kind: kind, p_text: text, p_answer: answer, p_screen: screen(), p_device: device(), p_version: APP_VERSION });

// ---------- Dar opinião ----------
export function renderFeedback(box, kind = 'erro') {
  const k = KINDS.find(x => x.key === kind) || KINDS[0];
  box.innerHTML = `<p class="small muted">Estamos em fase de teste e a sua opinião decide o que muda. Escolha o tipo, fale ou escreva e envie. Dá para mandar quantas quiser.</p>
    <div class="chips" role="radiogroup" aria-label="Tipo">${KINDS.map(x => `<button type="button" class="chip" role="radio" data-kind="${x.key}" aria-pressed="${x.key === k.key}" aria-checked="${x.key === k.key}">${x.label}</button>`).join('')}</div>
    <p class="tiny muted" id="fbHint">${k.hint}. Se for uma dúvida, veja <button class="linkbtn tiny" type="button" id="fbToFaq">Dúvidas</button>.</p>
    <div class="inwrap"><textarea id="fbText" maxlength="4000" placeholder="${esc(k.ph)}" aria-label="Sua opinião"></textarea><button id="fbMic"></button></div>
    <p class="tiny muted">Toque no microfone e fale à vontade: vira texto e você confere antes de enviar. Junto vai só a tela em que você está e o tipo de celular.</p>
    <div><button class="btn primary" type="button" id="fbSend">Enviar opinião</button></div>
    <h3 style="margin-top:8px">O que você já mandou</h3><div id="fbMine" class="stack"><p class="tiny muted">Carregando...</p></div>`;
  attachMic($('#fbMic', box), $('#fbText', box));
  box.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { const t = $('#fbText', box).value; renderFeedback(box, b.dataset.kind); $('#fbText', box).value = t; });
  $('#fbToFaq', box).onclick = () => S.go('ajustes', null, 'duvidas');
  $('#fbSend', box).onclick = async e => {
    clearInvalid(box);
    const t = $('#fbText', box).value.trim();
    if (t.length < 3) return invalid($('#fbText', box), 'Conte um pouco mais: o que aconteceu, o que esperava ou o que sugere.');
    if (!await confirmInline(e.target, { text: `Enviar esta ${k.label.toLowerCase()} para a equipe?`, yes: 'Sim, enviar' })) return;
    const { error } = await send(k.key, t);
    if (error) return toast(/rate_limited/.test(error.message) ? 'Não foi possível enviar: muitas opiniões hoje. Tente amanhã.' : 'Não foi possível enviar. Verifique a internet e tente de novo.');
    track('opiniao.' + k.key);
    toast('Obrigado! Sua opinião chegou para a equipe.');
    renderFeedback(box, k.key);
  };
  renderMine($('#fbMine', box));
}
async function renderMine(el) {
  const { data, error } = await db.sb.from('feedback').select('id,kind,text,status,created_at').order('created_at', { ascending: false }).limit(20);
  if (error) { el.innerHTML = '<p class="tiny muted">Não foi possível carregar agora.</p>'; return; }
  const list = (data || []).filter(x => x.kind !== 'duvida');
  el.innerHTML = list.length ? `<ul class="list small">${list.map(x => `<li><span><span class="tiny muted">${esc((KINDS.find(k => k.key === x.kind) || {}).label || '')} · ${new Date(x.created_at).toLocaleDateString('pt-BR')}</span><br>${esc(x.text.length > 140 ? x.text.slice(0, 140) + '…' : x.text)}</span><span class="tiny ${x.status === 'novo' ? 'muted' : 'fbst'}">${STATUS[x.status] || ''}</span></li>`).join('')}</ul>` : '<p class="tiny muted">Nada ainda. A primeira opinião é a mais valiosa.</p>';
}

// ---------- Dúvidas ----------
let faqCache = null;
export async function loadFaq() {
  if (faqCache) return faqCache;
  try { const r = await fetch('/api/faq'); const j = r.ok ? await r.json() : {}; faqCache = Array.isArray(j.items) && j.items.length ? j.items : FAQ; } catch (e) { faqCache = FAQ; }
  return faqCache;
}
export async function renderDuvidas(box) {
  box.innerHTML = '<p class="small muted">Carregando...</p>';
  const items = await loadFaq(); let topic = '';
  box.innerHTML = `<p class="small muted">Procure a sua dúvida. Se não achar, pergunte: o assistente responde na hora e a equipe melhora a resposta.</p>
    <div class="inwrap"><input type="search" id="fqQ" placeholder="Ex.: o que é a meta?" aria-label="Procurar dúvida" autocomplete="off"><button id="fqMic"></button></div>
    <div class="chips" id="fqTopics">${[['', 'Todas'], ...Object.entries(FAQ_TOPICS)].map(([k, l]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${k === topic}">${l}</button>`).join('')}</div>
    <div id="fqList" class="stack"></div>
    <div class="panel stack" id="fqAsk" style="background:var(--sunk)"><strong>Não achou?</strong><p class="tiny muted">Escreva ou fale a sua dúvida do seu jeito no campo de cima e toque em Perguntar.</p>
      <div><button class="btn primary" type="button" id="fqSend">Perguntar</button></div><div id="fqAns" class="stack"></div></div>`;
  const q = $('#fqQ', box);
  attachMic($('#fqMic', box), q);
  const draw = () => {
    const found = searchFaq(items.filter(x => !topic || x.t === topic), q.value);
    $('#fqList', box).innerHTML = found.length ? found.map(x => `<details class="help faq" data-id="${esc(x.id)}"><summary>${esc(x.q)}</summary><div class="small">${md(x.a)}</div></details>`).join('')
      : `<p class="small muted">Nenhuma resposta pronta para "${esc(q.value.trim())}". Toque em Perguntar.</p>`;
    $('#fqList', box).querySelectorAll('details').forEach(d => d.ontoggle = () => { if (d.open) track('duvida.ler'); });
  };
  let t; q.oninput = () => { clearTimeout(t); t = setTimeout(draw, 150); };
  box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { topic = b.dataset.t; box.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
  $('#fqSend', box).onclick = () => ask(box, items);
  draw();
}
async function ask(box, items) {
  clearInvalid(box);
  const q = $('#fqQ', box), text = q.value.trim(), out = $('#fqAns', box);
  if (text.length < 5) return invalid(q, 'Escreva a sua dúvida no campo de busca acima, com pelo menos algumas palavras.');
  $('#fqSend', box).disabled = true;
  out.innerHTML = '<p class="small muted">Pensando...</p>';
  let answer = '';
  try { answer = await chat({ system: answerPrompt(items), messages: [{ role: 'user', content: text.slice(0, 1000) }], tier: 'quick' }); }
  catch (e) { answer = ''; out.innerHTML = `<p class="small">${esc(aiErrorText(e))} Sua dúvida foi enviada para a equipe mesmo assim.</p>`; }
  const { data: id } = await send('duvida', text, answer || null);
  track('duvida.perguntar');
  $('#fqSend', box).disabled = false;
  if (!answer) return;
  out.innerHTML = `<div class="small">${md(answer)}</div><p class="tiny muted">Isso resolveu?</p>
    <div class="rowbtn"><button class="chip" type="button" data-h="1">Sim, resolveu</button><button class="chip" type="button" data-h="0">Não resolveu</button></div>`;
  out.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => {
    const yes = b.dataset.h === '1';
    if (id) await db.sb.rpc('feedback_helpful', { p_id: id, p_helpful: yes });
    out.querySelector('.rowbtn').outerHTML = `<p class="status ok">${yes ? 'Que bom! Obrigado por avisar.' : 'Obrigado. A equipe vai ver a sua dúvida e melhorar a resposta.'}</p>`;
  });
}
