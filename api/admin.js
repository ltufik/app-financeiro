// Product console data (/admin): backlog, pricing and product design, for ADMIN_EMAILS only.
// GET /api/admin?key=backlog  ->  {key, data, updated_at}     PUT /api/admin {key, data}
// GET /api/admin?view=usage|feedback  ->  usage per person/feature, testers' feedback
// PATCH /api/admin {feedback: id, status?, note?, reply?}  (reply: personal message to who sent it, also as a push)
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS.
import { cleanUrl } from './config.js';
import { sendPush } from './_webpush.js';
import { vapidFromEnv } from './push-cron.js';
import { replyTitle } from '../public/js/lib/news.js';
import { rest, closeLoop } from './_loop.js';

const KEYS = ['backlog', 'pricing', 'canvas', 'notes', 'faq', 'services', 'docs', 'news'];
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
            const out = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, { title: replyTitle(row.kind, m?.display_name), body: patch.reply.slice(0, 200), url: '/', tag: 'reply-' + id }, vapid).catch(() => ({ ok: false }));
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
      if (!KEYS.includes(b.key) || typeof b.data !== 'object' || b.data === null) return res.status(400).json({ error: 'bad_request' });
      if (JSON.stringify(b.data).length > MAX) return res.status(413).json({ error: 'too_large' });
      const db = rest(URL_, SERVICE);
      const prev = b.key === 'backlog' ? await db.board('backlog') : null;
      const r = await fetch(`${URL_}/rest/v1/product_board?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ key: b.key, data: b.data, updated_at: new Date().toISOString(), updated_by: user.email }) });
      if (!r.ok) return res.status(502).json({ error: 'db' });
      const [row] = await r.json();
      // An item that came from someone's opinion was marked as done: the message goes out by itself.
      const loop = b.key === 'backlog' ? await closeLoop(db, prev?.items || [], b.data.items || [], vapidFromEnv()).catch(() => ({ replied: 0, pushed: 0 })) : null;
      return res.status(200).json({ ...row, loop });
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { res.status(500).json({ error: 'failed' }); }
}
