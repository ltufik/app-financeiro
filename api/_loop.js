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
  const out = { replied: 0, pushed: 0 };
  for (const { item, ids } of newlyDone(prevItems, nextItems)) {
    const rows = await db.get(`feedback?id=in.(${ids.join(',')})&reply=is.null&select=id,user_id,kind,text`);
    for (const f of rows) {
      const [m] = f.user_id ? await db.get(`members?user_id=eq.${f.user_id}&select=display_name&limit=1`) : [];
      const reply = autoReply({ kind: f.kind, name: m?.display_name, text: f.text }, item);
      const r = await db.send(`feedback?id=eq.${f.id}&reply=is.null`, 'PATCH', { reply, replied_at: new Date().toISOString(), reply_seen: false, status: 'resolvido' });
      if (!r.ok) continue;
      out.replied++;
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
  let replied = 0;
  const news = (await db.board('news')) || { items: [] };
  for (const r of todo) if (r.news && !news.items.some(n => n.id === r.news.id)) news.items.unshift({ ...r.news, at: r.at });
  await db.setBoard('news', news);
  const backlog = await db.board('backlog');
  // New items written in the release (e.g. ideas from a conversation), added once, if not there yet.
  const added = backlog?.items ? todo.flatMap(r => r.addBacklog || []).filter(x => !backlog.items.some(i => i.id === x.id)) : [];
  if (added.length) { backlog.items.unshift(...added); if (!todo.some(r => (r.backlog || []).length)) await db.setBoard('backlog', backlog); }
  if (backlog?.items && todo.some(r => (r.backlog || []).length)) {
    const prev = JSON.parse(JSON.stringify(backlog.items));
    for (const r of todo) for (const b of r.backlog || []) { const it = backlog.items.find(i => i.id === (b.id || b)); if (it) Object.assign(it, { status: 'feito' }, b.where ? { where: b.where } : {}); }
    await db.setBoard('backlog', backlog);
    replied = (await closeLoop(db, prev, backlog.items, vapid, fetchImpl)).replied;
  }
  return { applied: todo.length, replied };
}
