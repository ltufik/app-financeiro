// Messages for the people testing the app, shown after the tour: the alpha welcome (once), personal
// replies and "O que mudou" — one pop-up per opening, with their name — and the bell with the last 30 days.
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './lib/format.js';
import { announce } from './ui.js';
import { NEWS, unseenNews, firstName, replyTitle } from './lib/news.js';
import { buildFeed, unread } from './lib/feed.js';
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

// Personal replies not seen yet; returns how many are left after showing one.
let feedCache = null;
async function myReplies() { const { data } = await db.sb.from('feedback').select('id,kind,text,reply,reply_seen,replied_at').order('created_at', { ascending: false }).limit(50); return data || []; }
async function replyPopup(f) {
  await db.sb.rpc('feedback_reply_seen', { p_id: f.id }); markShown('r:' + f.id);
  const short = f.text.length > 120 ? f.text.slice(0, 120) + '…' : f.text;
  await announce({
    eyebrow: 'Feito por sua causa', tone: 'gold', title: replyTitle(f.kind, meta().display_name),
    html: `<p class="ann-quote">Você ${f.kind === 'erro' ? 'avisou' : f.kind === 'duvida' ? 'perguntou' : 'escreveu'}: "${esc(short)}"</p><p>${esc(f.reply)}</p><p class="tiny muted">Obrigado por ajudar a fazer o app melhor.</p>${moreHint()}`,
    primary: 'Que demais!',
  });
}

let newsCache = null;
export async function loadNews() {
  if (newsCache) return newsCache;
  try { const r = await fetch('/api/news'); const j = r.ok ? await r.json() : {}; newsCache = Array.isArray(j.items) && j.items.length ? j.items : NEWS; } catch (e) { newsCache = NEWS; }
  return newsCache;
}
const unseenNotes = async () => unseenNews(await loadNews(), { seenAt: meta().news_seen_at || lsGet('fin.news.' + S.user.id), createdAt: S.user.created_at });
const markNewsSeen = list => { if (!list.length) return; const at = new Date(Math.min(Date.parse(list[0].at), Date.now())).toISOString(); lsSet('fin.news.' + S.user.id, at); remember({ news_seen_at: at }); list.forEach(n => markShown('n:' + n.id)); };
// All notes, newest first (menu ☰ → Ajuda).
export async function showAllNews() { openBell(); }
// One pop-up for all the new notes: the newest in full, the others by title.
async function newsPopup(list) {
  const [top, ...rest] = list;
  await announce({
    eyebrow: 'O que mudou', title: name() ? `${name()}, olha o que tem de novo` : 'Olha o que tem de novo',
    html: `<div class="ann-news"><h4>${esc(top.title)}</h4><ul>${(top.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`
      + (rest.length ? `<div class="ann-news"><h4>E também</h4><ul>${rest.map(n => `<li>${esc(n.title)}</li>`).join('')}</ul></div>` : '')
      + `<p class="tiny muted">Tudo fica guardado no sininho ${BELL} no topo, por 30 dias.</p>`,
    primary: 'Legal!', secondary: rest.length ? 'Ver tudo no sininho' : '',
  }).then(r => { if (r === 'secondary') openBell(); });
}

// ---------- the bell (🔔): last 30 days, with the count of what was not seen ----------
const BELL = '<svg class="ann-bal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
const shownKey = () => 'fin.bell.shown.' + S.user.id, seenKey = () => 'fin.bell.seen.' + S.user.id;
const shownList = () => { try { return JSON.parse(lsGet(shownKey()) || '[]'); } catch (e) { return []; } };
function markShown(id) { const l = shownList(); if (!l.includes(id)) { l.push(id); lsSet(shownKey(), JSON.stringify(l.slice(-200))); } }
const moreHint = () => `<p class="tiny muted">Novidades e recados ficam no sininho ${BELL} no topo.</p>`;
export async function loadFeed() {
  const [news, replies] = await Promise.all([loadNews(), myReplies().catch(() => [])]);
  feedCache = buildFeed({ news, replies, imports: S.imports || [], closed: S.hh?.settings?.closed || {}, members: S.members || [], me: S.user.id, myName: meta().display_name || '' });
  return feedCache;
}
export async function refreshBell() {
  const b = document.getElementById('bellBtn'); if (!b || !S.user) return;
  const feed = feedCache || await loadFeed().catch(() => []);
  const n = unread(feed, { seenAt: meta().bell_seen_at || lsGet(seenKey()), shown: shownList() }).length;
  const badge = b.querySelector('.bdg'); badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n;
  b.setAttribute('aria-label', n ? `Novidades: ${n} sem ver` : 'Novidades');
}
const ICON = { novidade: '✨', recado: '💛', familia: '👪' };
export async function openBell() {
  const feed = await loadFeed().catch(() => []);
  const seen = Date.parse(meta().bell_seen_at || lsGet(seenKey()) || 0) || 0, shown = shownList();
  const now = new Date().toISOString(); lsSet(seenKey(), now); remember({ bell_seen_at: now });
  document.querySelectorAll('.cfm-wrap').forEach(x => x.remove());
  const wrap = document.createElement('div'); wrap.className = 'cfm-wrap bellwrap';
  wrap.innerHTML = `<div class="cfm bellbox" role="dialog" aria-modal="true" aria-labelledby="bellT"><div class="ann-top"><h3 id="bellT" style="margin:0">Novidades</h3><button type="button" class="tx" aria-label="Fechar">×</button></div>
    <p class="tiny muted" style="margin:0">O que mudou no app, recados para você e o que a família fez, nos últimos 30 dias.</p>
    <div class="bell-list">${feed.map(x => { const isNew = Date.parse(x.at) > seen && !shown.includes(x.id);
      return `<article class="bell-item${isNew ? ' new' : ''}"><span class="bi" aria-hidden="true">${ICON[x.kind]}</span><div><div class="tiny muted">${new Date(x.at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}${isNew ? ' · <strong class="bnew">novo</strong>' : ''}</div>
        <strong>${esc(x.title)}</strong>${x.quote ? `<p class="tiny muted" style="margin:2px 0">Você escreveu: "${esc(x.quote.length > 90 ? x.quote.slice(0, 90) + '…' : x.quote)}"</p>` : ''}${x.text ? `<p class="small" style="margin:2px 0 0">${esc(x.text)}</p>` : ''}
        ${x.items?.length ? `<ul class="small">${x.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}</div></article>`; }).join('') || '<p class="small muted">Nada nos últimos 30 dias.</p>'}</div></div>`;
  document.body.append(wrap); document.body.classList.add('cfm-open');
  const close = () => { wrap.remove(); document.body.classList.remove('cfm-open'); refreshBell(); };
  wrap.querySelector('.tx').onclick = close; wrap.onclick = e => { if (e.target === wrap) close(); }; wrap.onkeydown = e => { if (e.key === 'Escape') close(); };
  wrap.querySelector('.tx').focus();
}

// Runs once per app opening, after the tour: at most ONE pop-up (welcome, else a personal reply,
// else the new notes together). Everything else waits in the bell, with its count.
let ran = false;
export async function showMessages() {
  if (ran || !S.user) return; ran = true;
  if (window.__noMsgs) { refreshBell(); return; }
  try {
    if (await welcomeAlpha()) { markNewsSeen(await unseenNotes()); return; }
    const reply = (await myReplies()).find(f => f.reply && !f.reply_seen);
    if (reply) { await replyPopup(reply); return; }
    const list = await unseenNotes();
    if (list.length) { markNewsSeen(list); await newsPopup(list); }
  } catch (e) { /* messages never block the app */ }
  finally { feedCache = null; refreshBell(); }
}
