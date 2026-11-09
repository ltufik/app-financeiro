// "Meu, seu, nosso" on screen: the "Só meu" switch on an entry (Extrato), on what is typed (Lançar) and on a whole
// card or account (import review). The database enforces it (only the owner sees the details; lib/privacy.js).
import { S, settings, isMine } from './state.js';
import * as db from './db.js';
import { toast, confirmInline } from './ui.js';
import { track } from './usage.js';
import { esc } from './lib/format.js';
import { firstName } from './lib/news.js';

const others = () => S.members.filter(m => m.user_id !== S.user?.id).map(m => firstName(m.display_name) || 'a família');
const famWho = () => { const o = others(); return o.length === 1 ? o[0] : 'o resto da família'; };

// Extrato: one entry becomes "só meu" (or goes back to the family).
export function privateButton(t) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
  const mine = isMine(t); b.textContent = mine ? 'Voltar para a família' : 'Só meu'; b.setAttribute('aria-label', mine ? 'Mostrar este lançamento para a família' : 'Deixar este lançamento só para mim');
  b.onclick = async () => {
    const text = mine ? `"${esc(t.description)}" volta a aparecer para ${esc(famWho())}, com o detalhe.` : `${esc(famWho())} deixa de ver "${esc(t.description)}" e vê só o total, como "Pessoal de ${esc(firstName(S.members.find(m => m.user_id === S.user?.id)?.display_name) || 'você')}". A sobra do mês continua igual.`;
    if (!await confirmInline(b, { title: mine ? 'Mostrar para a família?' : 'Deixar só para você?', text, yes: mine ? 'Sim, mostrar' : 'Sim, só meu' })) return;
    try { const v = mine ? null : S.user.id; await db.updateTransaction(t.id, { private_to: v }); t.private_to = v; track(mine ? 'extrato.privado_desfez' : 'extrato.privado'); toast(mine ? 'Pronto! A família volta a ver.' : 'Pronto! Só você vê o detalhe.'); S.render(); }
    catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  };
  return b;
}

// Lançar (typed or spoken) and import review: the "Só meu" box, only in families with 2 people or more.
export const privateBox = (id, checked = false, what = 'este lançamento') => S.members.length < 2 ? '' :
  `<label class="chk priv-box"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}> <span><strong>Só meu</strong> <span class="tiny muted">${esc(famWho())} vê só o total de ${esc(what)}, sem o detalhe</span></span></label>`;
export const privateValue = (root, id) => (root.querySelector('#' + id)?.checked ? S.user?.id || null : null);

// Import review: whether this card (or account) was marked "só meu" before, and remembering the choice.
export const cardIsMine = (source, cards = []) => (settings().privateCards || []).some(p => p.source === source && p.user === S.user?.id && cards.includes(p.card));
export async function rememberCards(source, cards = [], mine) {
  if (!cards.length) return;
  const cur = settings(), list = (cur.privateCards || []).filter(p => !(p.source === source && cards.includes(p.card)));
  const next = { ...cur, privateCards: mine ? [...list, ...cards.map(card => ({ source, card, user: S.user.id }))] : list };
  if (JSON.stringify(next.privateCards) === JSON.stringify(cur.privateCards || [])) return;
  try { await db.saveSettings(S.hh.id, next); S.hh.settings = next; } catch (e) { /* only the memory of the choice missed */ }
}
