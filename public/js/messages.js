// Messages for the people testing the app, shown after the tour: the alpha welcome (once),
// personal replies to what they sent, and "O que mudou" after each update. One at a time, with their name.
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './lib/format.js';
import { announce } from './ui.js';
import { NEWS, unseenNews, firstName, replyTitle } from './lib/news.js';
import { TEST_PHASE } from './feedback.js';

const BAL = '<svg class="ann-bal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const meta = () => S.user?.user_metadata || {};
// Saved in the account too, so it holds on another phone and in the installed app.
const remember = data => { db.sb.auth.updateUser({ data }).then(r => { if (r?.data?.user) S.user = r.data.user; }).catch(() => {}); };
const name = () => firstName(meta().display_name);

export async function welcomeAlpha({ force = false } = {}) {
  if (!TEST_PHASE) return false;
  if (!force && (meta().alpha_seen || lsGet('fin.alpha.' + S.user.id) === '1')) return false;
  lsSet('fin.alpha.' + S.user.id, '1'); if (!force) remember({ alpha_seen: true });
  const r = await announce({
    eyebrow: 'Teste alpha · família e amigos', title: name() ? `Oi, ${name()}! Que bom ter você aqui` : 'Que bom ter você aqui',
    html: `<p>Esta é a primeira versão do Pra Onde Foi, aberta só para família e amigos. Pode aparecer um erro aqui e ali, e tudo bem: o teste existe para isso.</p>
      <p><strong>A sua opinião decide o que muda.</strong> Viu algo estranho, ficou com dúvida ou teve uma ideia? Toque no balão ${BAL} no topo, fale e envie. Leva 10 segundos.</p>
      <p>Quando algo que você pedir ficar pronto, a gente te avisa aqui, com o seu nome.</p>`,
    primary: 'Combinado!', secondary: 'Mandar uma opinião agora',
  });
  if (r === 'secondary') S.go('ajustes', null, 'opiniao');
  return true;
}

async function replies() {
  const { data } = await db.sb.from('feedback').select('id,kind,text,reply,reply_seen').order('created_at', { ascending: false }).limit(30);
  const todo = (data || []).filter(f => f.reply && !f.reply_seen).slice(0, 2);
  for (const f of todo) {
    await db.sb.rpc('feedback_reply_seen', { p_id: f.id });
    const short = f.text.length > 120 ? f.text.slice(0, 120) + '…' : f.text;
    await announce({
      eyebrow: 'Feito por sua causa', tone: 'gold', title: replyTitle(f.kind, meta().display_name),
      html: `<p class="ann-quote">Você ${f.kind === 'erro' ? 'avisou' : f.kind === 'duvida' ? 'perguntou' : 'escreveu'}: "${esc(short)}"</p><p>${esc(f.reply)}</p><p class="tiny muted">Obrigado por ajudar a fazer o app melhor.</p>`,
      primary: 'Que demais!',
    });
  }
}

let newsCache = null;
export async function loadNews() {
  if (newsCache) return newsCache;
  try { const r = await fetch('/api/news'); const j = r.ok ? await r.json() : {}; newsCache = Array.isArray(j.items) && j.items.length ? j.items : NEWS; } catch (e) { newsCache = NEWS; }
  return newsCache;
}
async function news(silent) {
  const items = await loadNews();
  const list = unseenNews(items, { seenAt: meta().news_seen_at || lsGet('fin.news.' + S.user.id), createdAt: S.user.created_at });
  if (!list.length) return;
  const at = list[0].at; lsSet('fin.news.' + S.user.id, at); remember({ news_seen_at: at });
  if (silent) return; // the welcome already told them what matters
  await newsPopup(list);
}
// All notes, newest first (menu ☰ → Ajuda).
export async function showAllNews() {
  const items = (await loadNews()).slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
  if (items.length) await newsPopup(items);
}
async function newsPopup(list) {
  await announce({
    eyebrow: 'O que mudou', title: name() ? `${name()}, olha o que tem de novo` : 'Olha o que tem de novo',
    html: list.map(n => `<div class="ann-news"><h4>${esc(n.title)}</h4><ul>${(n.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('') + `<p class="tiny muted">Achou algo estranho? O balão ${BAL} no topo continua aqui.</p>`,
    primary: 'Legal!',
  });
}

// Runs once per app opening, after the tour and the guided walkthrough.
let ran = false;
export async function showMessages() {
  if (ran || !S.user || window.__noMsgs) return; ran = true;
  try { const welcomed = await welcomeAlpha(); await replies(); await news(welcomed); } catch (e) { /* messages never block the app */ }
}
