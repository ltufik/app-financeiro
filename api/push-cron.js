// Daily notifications. Vercel Cron calls this once a day (see vercel.json) with Authorization: Bearer CRON_SECRET.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET; optional VAPID_SUBJECT.
import { cleanUrl } from './config.js';
import { runDaily, runReminder } from './_daily.js';
import { rest, applyReleases } from './_loop.js';

export const vapidFromEnv = () => ({ publicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim(), privateKey: String(process.env.VAPID_PRIVATE_KEY || '').trim(), subject: String(process.env.VAPID_SUBJECT || 'https://praondefoi.app.br').trim() });

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  const supabaseUrl = cleanUrl(process.env.SUPABASE_URL), serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(), vapid = vapidFromEnv();
  if (!supabaseUrl || !serviceKey || !vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'not_configured' });
  if (String(req.query?.tipo || '') === 'lembrete' || /tipo=lembrete/.test(String(req.url || ''))) {
    try { return res.status(200).json(await runReminder({ supabaseUrl, serviceKey, vapid })); } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }
  try {
    const releases = await applyReleases(rest(supabaseUrl, serviceKey), vapid).catch(e => ({ error: String(e.message || e) }));
    res.status(200).json({ ...(await runDaily({ supabaseUrl, serviceKey, vapid })), releases });
  }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
