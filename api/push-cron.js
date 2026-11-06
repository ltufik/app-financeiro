// Daily notifications. Vercel Cron calls this once a day (see vercel.json) with Authorization: Bearer CRON_SECRET.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET; optional VAPID_SUBJECT.
import { cleanUrl } from './config.js';
import { runDaily, runReminder, runForecastAsk } from './_daily.js';
import { rest, applyReleases } from './_loop.js';
import { withRecorder } from './_pushlog.js';
import { sendPush } from './_webpush.js';
import { pushHealth, healthAlertMessage } from '../public/js/lib/pushhealth.js';
import { linkFor } from '../public/js/lib/links.js';

// After the 9h robots: if a robot is late, failed or delivers badly, one push to the owner's devices (ADMIN_EMAILS),
// opening the Central on "Avisos no celular". Best effort.
export async function healthCheck({ supabaseUrl, serviceKey, vapid, admins = [], fetchImpl = fetch, now = new Date().toISOString() }) {
  const H = { apikey: serviceKey, ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const get = async p => { const r = await fetchImpl(`${supabaseUrl}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`supabase ${r.status} ${p.split('?')[0]}`); return r.json(); };
  const since7 = new Date(Date.parse(now) - 7 * 864e5).toISOString(), since30 = new Date(Date.parse(now) - 30 * 864e5).toISOString();
  const [logs, runs] = await Promise.all([get(`push_log?at=gte.${since7}&select=at,job,ok,status,error&limit=5000`), get(`job_runs?at=gte.${since30}&select=at,job,ok&limit=500`)]);
  const msg = healthAlertMessage(pushHealth(logs, runs, now).alerts);
  if (!msg || !admins.length) return { alerts: msg ? 1 : 0, sent: 0 };
  const r = await fetchImpl(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: H }); if (!r.ok) return { alerts: 1, sent: 0, error: 'users' };
  const ids = ((await r.json()).users || []).filter(u => admins.includes(String(u.email || '').toLowerCase())).map(u => u.id);
  let sent = 0;
  for (const id of ids) for (const s of await get(`push_subscriptions?user_id=eq.${id}&select=endpoint,p256dh,auth`)) {
    const x = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { ...msg, url: linkFor('central', { sec: 'avisos' }) }, vapid, fetchImpl).catch(() => ({ ok: false }));
    if (x.ok) sent++;
  }
  return { alerts: 1, sent };
}

export const vapidFromEnv = () => ({ publicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim(), privateKey: String(process.env.VAPID_PRIVATE_KEY || '').trim(), subject: String(process.env.VAPID_SUBJECT || 'https://praondefoi.app.br').trim() });

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  const supabaseUrl = cleanUrl(process.env.SUPABASE_URL), serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(), vapid = vapidFromEnv();
  if (!supabaseUrl || !serviceKey || !vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'not_configured' });
  if (String(req.query?.tipo || '') === 'previsao' || /tipo=previsao/.test(String(req.url || ''))) {
    try { return res.status(200).json(await withRecorder({ supabaseUrl, serviceKey, job: 'previsao' }, () => runForecastAsk({ supabaseUrl, serviceKey, vapid }))); } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }
  if (String(req.query?.tipo || '') === 'lembrete' || /tipo=lembrete/.test(String(req.url || ''))) {
    try { return res.status(200).json(await withRecorder({ supabaseUrl, serviceKey, job: 'lembrete' }, () => runReminder({ supabaseUrl, serviceKey, vapid }))); } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }
  try {
    const releases = await withRecorder({ supabaseUrl, serviceKey, job: 'versao' }, () => applyReleases(rest(supabaseUrl, serviceKey), vapid)).catch(e => ({ error: String(e.message || e) }));
    const daily = await withRecorder({ supabaseUrl, serviceKey, job: 'diario' }, () => runDaily({ supabaseUrl, serviceKey, vapid }));
    const admins = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const health = await withRecorder({ supabaseUrl, serviceKey, job: 'saude', run: false }, () => healthCheck({ supabaseUrl, serviceKey, vapid, admins })).catch(e => ({ error: String(e.message || e) }));
    res.status(200).json({ ...daily, releases, health });
  }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
