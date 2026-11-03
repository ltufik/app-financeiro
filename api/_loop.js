// Closing the loop with testers: when a backlog item that came from someone's opinion is done,
// that person gets a personal message (in the app and as a push). Also applies the release manifest.
import { sendPush } from './_webpush.js';
import { autoReply, newlyDone, replyTitle } from '../public/js/lib/news.js';
import { RELEASES } from './_releases.js';

export function rest(URL_, SERVICE, fetchImpl = fetch) {
  const H = { apikey: SERVICE, 'content-type': 'application/json', ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) };
  const get = async p => { const r = await fetchImpl(`${URL_}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error('db ' + r.status); return r.json(); };
  const send = (p, method, body, prefer) => fetchImpl(`${URL_}/rest/v1/${p}`, { method, headers: { ...H, ...(prefer ? { prefer } : {}) }, body: JSON.stringify(body) });
  const board = async key => (await get(`product_board?key=eq.${key}&select=data`))[0]?.data || null;
  const setBoard = (key, data, by = 'automático') => send('product_board?on_conflict=key', 'POST', { key, data, updated_at: new Date().toISOString(), updated_by: by }, 'resolution=merge-duplicates');
  return { H, get, send, board, setBoard };
}

// Sends the automatic message for items that just became "feito". Returns {replied, pushed}.
export async function closeLoop(db, prevItems, nextItems, vapid, fetchImpl = fetch) {
  const out = { replied: 0, pushed: 0, users: [] };
  for (const { item, ids } of newlyDone(prevItems, nextItems)) {
    const rows = await db.get(`feedback?id=in.(${ids.join(',')})&reply=is.null&select=id,user_id,kind,text`);
    for (const f of rows) {
      const [m] = f.user_id ? await db.get(`members?user_id=eq.${f.user_id}&select=display_name&limit=1`) : [];
      const reply = autoReply({ kind: f.kind, name: m?.display_name, text: f.text }, item);
      const r = await db.send(`feedback?id=eq.${f.id}&reply=is.null`, 'PATCH', { reply, replied_at: new Date().toISOString(), reply_seen: false, status: 'resolvido' });
      if (!r.ok) continue;
      out.replied++; if (f.user_id) out.users.push(f.user_id);
      if (!f.user_id || !vapid?.publicKey || !vapid?.privateKey) continue;
      const subs = await db.get(`push_subscriptions?user_id=eq.${f.user_id}&select=endpoint,p256dh,auth`).catch(() => []);
      for (const s of subs) {
        const p = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: replyTitle(f.kind, m?.display_name), body: reply.slice(0, 200), url: '/', tag: 'reply-' + f.id }, vapid, fetchImpl).catch(() => ({ ok: false }));
        if (p.ok) out.pushed++;
      }
    }
  }
  return out;
}

// Applies release entries not applied yet: publishes the note, marks items done, messages who asked.
let appliedCache = null;
export async function applyReleases(db, vapid, { releases = RELEASES, fetchImpl = fetch } = {}) {
  if (appliedCache && releases.every(r => appliedCache.has(r.id))) return { applied: 0 };
  const state = (await db.board('releases')) || { applied: [] };
  const todo = releases.filter(r => !state.applied.includes(r.id));
  appliedCache = new Set(state.applied);
  if (!todo.length) return { applied: 0 };
  // Mark first, so two app openings at the same time do not send twice.
  const res = await db.setBoard('releases', { applied: [...state.applied, ...todo.map(r => r.id)] });
  if (!res.ok) return { applied: 0 };
  todo.forEach(r => appliedCache.add(r.id));
  let replied = 0, pushed = 0; const personal = new Set();
  // Every release is checked again, not only the new ones: if the product console saved an old copy of a
  // board over a release's changes, the next release puts them back (news, new items, items done, bug marks).
  const news = (await db.board('news')) || { items: [] };
  let newsChanged = false;
  for (const r of releases) if (r.news && !news.items.some(n => n.id === r.news.id)) { news.items.unshift({ ...r.news, at: r.at }); newsChanged = true; }
  if (newsChanged) news.items.sort((x, y) => String(y.at || '').localeCompare(String(x.at || '')));
  if (newsChanged) await db.setBoard('news', news);
  const backlog = await db.board('backlog');
  if (backlog?.items) {
    const items = backlog.items, prev = JSON.parse(JSON.stringify(items)), find = id => items.find(i => i.id === id);
    for (const r of releases) for (const x of r.addBacklog || []) if (!find(x.id)) items.unshift({ ...x });
    for (const r of releases) for (const u of r.updateBacklog || []) { const it = find(u.id); if (it) Object.assign(it, u.set || {}); }
    for (const r of releases) for (const b of r.backlog || []) { const it = find(b.id || b); if (it && (it.status !== 'feito' || (b.where && it.where !== b.where))) Object.assign(it, { status: 'feito' }, b.where ? { where: b.where } : {}); }
    if (JSON.stringify(prev) !== JSON.stringify(items)) {
      await db.setBoard('backlog', backlog);
      const cl = await closeLoop(db, prev, items, vapid, fetchImpl);
      replied = cl.replied; cl.users.forEach(u => personal.add(u));
    }
  }
  // Everyone with notifications on hears about what is new; who got a personal message for this release
  // already heard it with their name, so they are skipped.
  const fresh = todo.filter(r => r.news).map(r => r.news);
  if (fresh.length && vapid?.publicKey && vapid?.privateKey) pushed = await pushNews(db, fresh, personal, vapid, fetchImpl).catch(() => 0);
  return { applied: todo.length, replied, pushed };
}

// One push per person (on each of their devices) about the newest note, unless they turned "Novidades" off.
export const newsPush = list => {
  const [top, ...rest] = list;
  return { title: 'Novidade no Pra Onde Foi: ' + top.title, body: (top.items?.[0] || '') + (rest.length ? ` E mais ${rest.length} ${rest.length > 1 ? 'novidades' : 'novidade'} no sininho.` : ''), url: '/', tag: 'news-' + top.id };
};
async function pushNews(db, list, skipUsers, vapid, fetchImpl) {
  const subs = await db.get('push_subscriptions?select=id,user_id,endpoint,p256dh,auth,prefs').catch(() => []);
  const msg = newsPush(list); let n = 0;
  for (const s of subs) {
    if (skipUsers.has(s.user_id) || s.prefs?.novidades === false) continue;
    const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { ...msg, body: msg.body.slice(0, 200) }, vapid, fetchImpl).catch(() => ({ ok: false }));
    if (r.ok) n++;
  }
  return n;
}
