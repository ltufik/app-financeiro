// Product console data (/admin): backlog, pricing and product design, for ADMIN_EMAILS only.
// GET /api/admin?key=backlog  ->  {key, data, updated_at}     PUT /api/admin {key, data}
// GET /api/admin?view=usage|feedback|nav  ->  usage per person/feature, testers' feedback
// GET /api/admin?view=push -> who can receive notifications (yours first)   POST /api/admin {action:'test_push'} -> test to your devices; {action:'news_push', id} -> a note as push to everyone
// PATCH /api/admin {feedback: id, status?, note?, reply?}  (reply: personal message to who sent it, also as a push)
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS.
import { cleanUrl } from './config.js';
import { sendPush } from './_webpush.js';
import { vapidFromEnv } from './push-cron.js';
import { replyTitle } from '../public/js/lib/news.js';
import { rest, closeLoop, pushNews } from './_loop.js';
import { pushPeople, deviceKind } from '../public/js/lib/pushinfo.js';
import { linkFor } from '../public/js/lib/links.js';

const KEYS = ['backlog', 'pricing', 'canvas', 'notes', 'faq', 'services', 'docs', 'news', 'releases'];
const READ_ONLY = ['releases'];
const STATUS = ['novo', 'visto', 'backlog', 'resolvido'];
const MAX = 400_000;

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  const URL_ = cleanUrl(process.env.SUPABASE_URL), ANON = String(process.env.SUPABASE_ANON_KEY || '').trim(), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const admins = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!URL_ || !ANON || !SERVICE) return res.status(503).json({ error: 'not_configured' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const u = token && await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } });
  if (!u || !u.ok) return res.status(401).json({ error: 'not_signed_in' });
  const user = await u.json();
  if (!admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'not_admin' });
  const H = { apikey: SERVICE, 'content-type': 'application/json', ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) };
  try {
    const rpc = async (fn, args = {}) => { const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) }); if (!r.ok) throw new Error('db'); return r.json(); };
    if (req.method === 'GET' && req.query?.view === 'usage') return res.status(200).json(await rpc('product_usage', { p_days: Math.min(365, Math.max(1, +req.query.days || 30)) }));
    if (req.method === 'GET' && req.query?.view === 'feedback') return res.status(200).json(await rpc('product_feedback'));
    if (req.method === 'GET' && req.query?.view === 'nav') return res.status(200).json(await rpc('product_nav', { p_days: Math.min(365, Math.max(1, +req.query.days || 30)) }));
    // A failed read says which table and why (shown to the owner in the console), never just "db".
    const q = async path => { const x = await fetch(`${URL_}/rest/v1/${path}`, { headers: H }); if (!x.ok) { let m = ''; try { m = (await x.json()).message || ''; } catch (e) { /* no body */ } throw new Error(`banco ${x.status} em ${path.split('?')[0]}${m ? ' (' + m + ')' : ''}`); } return x.json(); };
    // Notifications: devices and people, never the push keys.
    if (req.method === 'GET' && req.query?.view === 'push') {
      const [subs, members, fams] = await Promise.all([q('push_subscriptions?select=user_id,endpoint,prefs,created_at'), q('members?select=user_id,display_name,household_id'), q('households?select=id,name')]);
      const vapid = vapidFromEnv();
      return res.status(200).json({
        configured: !!(vapid.publicKey && vapid.privateKey),
        mine: subs.filter(s => s.user_id === user.id).map(s => ({ kind: deviceKind(s.endpoint), since: s.created_at, prefs: s.prefs || {} })),
        people: pushPeople(subs, members, Object.fromEntries(fams.map(f => [f.id, f.name]))).map(({ user_id, ...p }) => ({ ...p, me: user_id === user.id })),
        users: new Set(members.map(m => m.user_id)).size,
      });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const vapid = vapidFromEnv();
      if (!vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'not_configured' });
      // A note published in the console also goes as a push to everyone with "Novidades" on. Once per note.
      if (b.action === 'news_push') {
        const db = rest(URL_, SERVICE), news = (await db.board('news')) || { items: [] };
        const item = (news.items || []).find(n => n.id === String(b.id || ''));
        if (!item) return res.status(404).json({ error: 'not_found' });
        if (item.pushed_at) return res.status(409).json({ error: 'already_sent', pushed_at: item.pushed_at });
        item.pushed_at = new Date().toISOString(); await db.setBoard('news', news, user.email);
        const pushed = await pushNews(db, [item], new Set(), vapid, fetch).catch(() => 0);
        return res.status(200).json({ pushed });
      }
      if (b.action !== 'test_push') return res.status(400).json({ error: 'bad_request' });
      const subs = await q(`push_subscriptions?user_id=eq.${user.id}&select=id,endpoint,p256dh,auth`);
      const name = String(user.user_metadata?.display_name || '').trim().split(/\s+/)[0];
      const results = [];
      for (const s of subs) {
        const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title: name ? `${name}, o teste chegou` : 'O teste chegou', body: 'As notificações do Pra Onde Foi estão funcionando neste aparelho.', url: linkFor('avisos'), tag: 'teste-central' }, vapid).catch(() => ({ ok: false }));
        // A device that no longer exists (app removed, notifications reset) leaves the list.
        if (r.gone) await fetch(`${URL_}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: H }).catch(() => {});
        results.push({ kind: deviceKind(s.endpoint), ok: !!r.ok, gone: !!r.gone });
      }
      return res.status(200).json({ results });
    }
    if (req.method === 'PATCH') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = Number(b.feedback), patch = {};
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'bad_request' });
      if (b.status != null) { if (!STATUS.includes(b.status)) return res.status(400).json({ error: 'bad_status' }); patch.status = b.status; }
      if (b.note != null) patch.note = String(b.note).slice(0, 2000);
      if (b.reply != null) {
        const reply = String(b.reply).trim().slice(0, 1000);
        if (reply.length < 5) return res.status(400).json({ error: 'bad_reply' });
        Object.assign(patch, { reply, replied_at: new Date().toISOString(), reply_seen: false, status: patch.status || 'resolvido' });
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'bad_request' });
      const r = await fetch(`${URL_}/rest/v1/feedback?id=eq.${id}`, { method: 'PATCH', headers: { ...H, prefer: 'return=representation' }, body: JSON.stringify(patch) });
      if (!r.ok) return res.status(502).json({ error: 'db' });
      const [row] = await r.json();
      let pushed = 0;
      // The person also gets it on the phone, if notifications are on.
      const vapid = vapidFromEnv();
      if (patch.reply && row?.user_id && vapid.publicKey && vapid.privateKey) {
        try {
          const q = async path => { const x = await fetch(`${URL_}/rest/v1/${path}`, { headers: H }); return x.ok ? x.json() : []; };
          const [m] = await q(`members?user_id=eq.${row.user_id}&select=display_name&limit=1`);
          const subs = await q(`push_subscriptions?user_id=eq.${row.user_id}&select=endpoint,p256dh,auth`);
          for (const sub of subs) {
            const out = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, { title: replyTitle(row.kind, m?.display_name), body: patch.reply.slice(0, 200), url: linkFor('recado', { id }), tag: 'reply-' + id }, vapid).catch(() => ({ ok: false }));
            if (out.ok) pushed++;
          }
        } catch (e) { /* the in-app message still shows */ }
      }
      return res.status(200).json({ ok: true, pushed });
    }
    if (req.method === 'GET') {
      const key = String(req.query?.key || '');
      if (!KEYS.includes(key)) return res.status(400).json({ error: 'bad_key' });
      const r = await fetch(`${URL_}/rest/v1/product_board?key=eq.${key}&select=key,data,updated_at,updated_by`, { headers: H });
      if (!r.ok) return res.status(502).json({ error: 'db' });
      const [row] = await r.json();
      return res.status(200).json(row || { key, data: null });
    }
    if (req.method === 'PUT') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const db = rest(URL_, SERVICE);
      const prev = b.key === 'backlog' ? await db.board('backlog') : null;
      // A patch (only what changed in the console) is applied over the current board, so changes made
      // meanwhile by a release or another device are not lost.
      if (b.patch && typeof b.patch === 'object' && KEYS.includes(b.key) && !READ_ONLY.includes(b.key)) {
        const cur = (await db.board(b.key)) || (prev || { items: [] });
        const items = Array.isArray(cur.items) ? [...cur.items] : [];
        const del = new Set(Array.isArray(b.patch.delete) ? b.patch.delete : []);
        for (const it of Array.isArray(b.patch.upsert) ? b.patch.upsert : []) { if (!it || !it.id) continue; const i = items.findIndex(x => x.id === it.id); if (i >= 0) items[i] = it; else items.unshift(it); }
        const order = Array.isArray(b.patch.order) ? b.patch.order : [], pos = new Map(order.map((id, i) => [id, i]));
        const kept = items.filter(x => !del.has(x.id));
        // Keep the console's order for the items it knows; items it did not know stay at the top.
        kept.sort((x, y) => (pos.has(x.id) ? pos.get(x.id) : -1) - (pos.has(y.id) ? pos.get(y.id) : -1));
        b.data = { ...cur, items: kept };
      }
      if (!KEYS.includes(b.key) || READ_ONLY.includes(b.key) || typeof b.data !== 'object' || b.data === null) return res.status(400).json({ error: 'bad_request' });
      if (JSON.stringify(b.data).length > MAX) return res.status(413).json({ error: 'too_large' });
      const r = await fetch(`${URL_}/rest/v1/product_board?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ key: b.key, data: b.data, updated_at: new Date().toISOString(), updated_by: user.email }) });
      if (!r.ok) return res.status(502).json({ error: 'db' });
      const [row] = await r.json();
      // An item that came from someone's opinion was marked as done: the message goes out by itself.
      const loop = b.key === 'backlog' ? await closeLoop(db, prev?.items || [], b.data.items || [], vapidFromEnv()).catch(() => ({ replied: 0, pushed: 0 })) : null;
      return res.status(200).json({ ...row, loop });
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { res.status(500).json({ error: 'failed', detail: String(e?.message || e).slice(0, 160) }); }
}
