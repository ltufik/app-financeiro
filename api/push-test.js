// Sends a test notification to the device that asked for it (signed-in users only).
// Body: { subscription: PushSubscription JSON }. Env: SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_*.
import { cleanUrl } from './config.js';
import { sendPush } from './_webpush.js';
import { vapidFromEnv } from './push-cron.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const SUPABASE_URL = cleanUrl(process.env.SUPABASE_URL), ANON = String(process.env.SUPABASE_ANON_KEY || '').trim(), vapid = vapidFromEnv();
  if (!SUPABASE_URL || !ANON || !vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'not_configured' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const u = token && await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } });
  if (!u || !u.ok) return res.status(401).json({ error: 'not_signed_in' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const s = body.subscription;
  if (!s || !/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) return res.status(400).json({ error: 'bad_request' });
  try {
    const r = await sendPush(s, { title: 'Avisos ligados', body: 'Pronto! É assim que o Pra Onde Foi vai te avisar quando algo importante acontecer com o dinheiro da família.', url: '/?tab=resumo', tag: 'teste' }, vapid);
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status });
  } catch (e) { res.status(500).json({ error: 'send_failed' }); }
}
