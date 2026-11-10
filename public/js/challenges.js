// Desafios do mês, the weekly streak and "em família" on screen. The rules are in lib/challenges.js.
// The active challenge: households.settings.challenge; the finished ones: households.settings.challenges.
import { S, settings, txsOf, calcMonth, latestClosed, monthKeys } from './state.js';
import * as db from './db.js';
import { toast, confirmInline } from './ui.js';
import { track } from './usage.js';
import { notifyFamily } from './push.js';
import { esc, brl0, todayISO, isoToBr } from './lib/format.js';
import { byCategory } from './lib/calc.js';
import { findRecurring } from './lib/recurring.js';
import { suggestChallenges, challengeProgress, weekStreak } from './lib/challenges.js';
import { familyForecast } from './forecast.js';
import { cashPending } from './cash.js';
import { firstName } from './lib/news.js';

const addM = (k, n) => { const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export function challengeFacts() {
  const today = todayISO(), cur = today.slice(0, 7), months = [addM(cur, -3), addM(cur, -2), addM(cur, -1), cur];
  const has = (k, s) => S.txs.some(t => t.month === k && t.source === s && !t.manual);
  const cats = {}, done = {}, result = {};
  for (const k of [...new Set([...months, ...(settings().challenges || []).map(c => c.month), settings().challenge?.month].filter(Boolean))]) {
    cats[k] = byCategory(txsOf(k), S.catIdx); done[k] = has(k, 'conta') && has(k, 'cartao'); result[k] = calcMonth(k).res;
  }
  const L = latestClosed(), pending = L ? S.txs.filter(t => t.month === L && !t.virtual && (t.pending || !t.category || t.category === 'A classificar')).length : 0;
  let fc = null; try { const f = familyForecast(); if (f) fc = { res: f.res, meta: f.meta, perDay: f.perDay }; } catch (e) { fc = null; }
  const subsUp = findRecurring(S.txs, monthKeys(), { idx: S.catIdx }).filter(x => x.current && x.rise > 0).map(x => ({ name: x.name, prev: x.prev, last: x.last }));
  return { today, cats, done, result, pending, cash: cashPending().length, checkins: settings().checkins || [], forecast: fc, subsUp,
    fixed: S.categories.filter(c => c.recurring || c.financing).map(c => c.name) };
}
export const activeChallenge = () => { const c = settings().challenge; return c && ['ativo', 'aguardando'].includes(c.status) ? c : null; };
export const challengeSuggestions = () => suggestChallenges(challengeFacts(), settings().challenges || []);

// The weekly streak: weeks in a row with something done in the app.
export function familyStreak() {
  const st = settings(), dates = [...(st.checkins || []).map(c => c?.date), ...(S.imports || []).map(i => i.created_at), ...S.txs.filter(t => t.manual).map(t => t.created_at),
    ...Object.values(st.missionsDone || {}), ...(st.challenges || []).map(c => c.accepted), st.challenge?.accepted];
  return weekStreak(dates.filter(Boolean).map(d => String(d).slice(0, 10)), todayISO());
}

async function saveSt(next) { await db.saveSettings(S.hh.id, next); S.hh.settings = next; }

// A finished challenge moves to the history once (celebrated, and the rest of the family is told).
let closing = false;
async function settle(ch, p) {
  if (closing) return; closing = true;
  try {
    const cur = settings(), done = { ...ch, status: p.status, result: p.text, at: todayISO() };
    if (p.status === 'aguardando') { if (ch.status !== 'aguardando') await saveSt({ ...cur, challenge: { ...ch, status: 'aguardando' } }); return; }
    await saveSt({ ...cur, challenge: null, challenges: [...(cur.challenges || []), done].slice(-30) });
    track(p.status === 'cumprido' ? 'desafio.cumpriu' : 'desafio.nao_deu');
    if (p.status === 'cumprido') { toast(`Desafio cumprido: ${ch.title}! Vocês ganharam o selo "Desafio cumprido".`); notifyFamily('conquista', { key: 'desafio:' + ch.kind }); }
    else toast(`O desafio "${ch.title}" não deu desta vez. ${p.text} No próximo mês tem outro.`);
  } catch (e) { /* try again next time */ } finally { closing = false; }
}

// Início, under the strip: the active challenge with its progress.
export function renderChallengeHome(box) {
  if (!box) return;
  const ch = activeChallenge(); if (!ch) { box.hidden = true; box.innerHTML = ''; return; }
  const p = challengeProgress(ch, challengeFacts());
  if (p.status !== 'ativo' && p.status !== ch.status) settle(ch, p);
  box.hidden = false;
  box.innerHTML = `<button type="button" class="ch-home"><span class="tiny eyebrow">Desafio de vocês · até ${isoToBr(ch.end).slice(0, 5)}</span><strong class="small">${esc(ch.title)}</strong>
    <span class="ch-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, p.pct) * 100)}%"></i></span><span class="tiny muted">${esc(p.text)}</span></button>`;
  box.querySelector('button').onclick = () => { track('inicio.desafio'); S.go('ajustes', null, 'conquistas'); };
}

// Menu → Missões e conquistas: the challenge (or the suggestions), the history and the family.
export function renderChallengeSection(box, { onChange } = {}) {
  if (!box) return;
  const f = challengeFacts(), ch = activeChallenge(), hist = settings().challenges || [], redraw = () => (onChange ? onChange() : renderChallengeSection(box));
  let html = '<h3>Desafio do mês</h3>';
  if (ch) {
    const p = challengeProgress(ch, f);
    if (p.status !== 'ativo' && p.status !== ch.status) settle(ch, p);
    html += `<div class="panel stack ch-on"><p class="small"><strong>${esc(ch.title)}</strong></p><p class="tiny muted">${esc(ch.why || '')} Até ${isoToBr(ch.end)}.</p>
      <span class="ch-bar" aria-hidden="true"><i style="width:${Math.round(Math.min(1, p.pct) * 100)}%"></i></span><p class="small">${esc(p.text)}</p>
      <div class="rowbtn">${ch.kind === 'assinatura' && !ch.reviewed ? '<button class="btn primary" type="button" data-rev>Revi</button>' : ''}<button class="linkbtn small" type="button" data-quit>Desistir deste desafio</button></div></div>`;
  } else {
    const sug = suggestChallenges(f, hist);
    html += sug.length ? `<p class="tiny muted">Escolham um. O app acompanha pelos números de vocês e conta o resultado.</p>${sug.map((s, i) => `<div class="panel stack ch-sug"><p class="small"><strong>${esc(s.title)}</strong></p><p class="tiny muted">${esc(s.why)} Até ${isoToBr(s.end)}.</p><div class="rowbtn"><button class="btn primary" type="button" data-acc="${i}">Aceitar o desafio</button></div></div>`).join('')}`
      : '<p class="small muted">Sem desafio para sugerir agora. Ele aparece quando os números de vocês mostrarem onde dá para melhorar.</p>';
    box._sug = sug;
  }
  if (hist.length) html += `<details class="ch-hist"><summary class="small">Desafios anteriores (${hist.filter(h => h.status === 'cumprido').length} cumpridos de ${hist.length})</summary><ul class="small">${[...hist].reverse().slice(0, 10).map(h => `<li>${h.status === 'cumprido' ? '★' : h.status === 'desistiu' ? '–' : '○'} ${esc(h.title)} <span class="tiny muted">${esc(h.result || '')}</span></li>`).join('')}</ul></details>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-acc]').forEach(b => b.onclick = async () => {
    const s = box._sug[+b.dataset.acc];
    if (!await confirmInline(b, { title: 'Aceitar o desafio?', text: `${esc(s.title)}, até ${isoToBr(s.end)}. O app acompanha e conta o resultado.`, yes: 'Sim, aceitar' })) return;
    try { await saveSt({ ...settings(), challenge: { ...s, status: 'ativo', accepted: todayISO(), by: S.user?.id || null } }); track('desafio.aceitou'); toast('Desafio aceito! O progresso aparece no Início.'); redraw(); }
    catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  const rev = box.querySelector('[data-rev]'); if (rev) rev.onclick = async () => { try { await saveSt({ ...settings(), challenge: { ...ch, reviewed: true } }); redraw(); } catch (e) { toast('Não foi possível salvar agora.'); } };
  const quit = box.querySelector('[data-quit]'); if (quit) quit.onclick = async () => {
    if (!await confirmInline(quit, { text: 'Desistir deste desafio? Ele fica no histórico e vocês podem escolher outro.', yes: 'Desistir', danger: true })) return;
    try { const cur = settings(); await saveSt({ ...cur, challenge: null, challenges: [...(cur.challenges || []), { ...ch, status: 'desistiu', result: 'Desistiram.', at: todayISO() }].slice(-30) }); track('desafio.desistiu'); redraw(); }
    catch (e) { toast('Não foi possível salvar agora.'); }
  };
}

// Em família: what each person did this month (bills, entries, open bill) and the weekly streak.
export function familyHTML() {
  const cur = todayISO().slice(0, 7), sk = familyStreak();
  const rows = S.members.map(m => ({ name: firstName(m.display_name) || 'Alguém', docs: (S.imports || []).filter(i => i.created_by === m.user_id && String(i.created_at || '').startsWith(cur)).length,
    typed: S.txs.filter(t => t.manual && t.created_by === m.user_id && String(t.created_at || '').startsWith(cur)).length, open: (settings().checkins || []).filter(c => c?.by === m.user_id && String(c.date).startsWith(cur)).length }));
  const part = r => [r.docs ? `${r.docs} ${r.docs > 1 ? 'faturas ou extratos' : 'fatura ou extrato'}` : '', r.typed ? `${r.typed} ${r.typed > 1 ? 'lançamentos' : 'lançamento'}` : '', r.open ? `${r.open}× a fatura aberta` : ''].filter(Boolean).join(', ') || 'nada ainda';
  return `<h3 style="margin-top:14px">Em família</h3>
    <p class="small"><strong>${sk.current >= 1 ? `🔥 ${sk.current} ${sk.current > 1 ? 'semanas seguidas' : 'semana'} com o app em dia` : 'Comecem a sequência: usem o app esta semana'}</strong>${sk.best > sk.current ? ` <span class="tiny muted">(recorde: ${sk.best})</span>` : ''}</p>
    ${S.members.length > 1 ? `<ul class="small">${rows.map(r => `<li><strong>${esc(r.name)}</strong> neste mês: ${esc(part(r))}</li>`).join('')}</ul>` : '<p class="tiny muted">Convide quem divide as contas: aqui aparece o que cada um fez no mês.</p>'}`;
}
