// The daily e-mail to the owner (ADMIN_EMAILS): the journey funnel and the alarms (lib/funnel.js), after the 9h robots.
// Sent with Resend (RESEND_API_KEY; MAIL_FROM optional, default onboarding@resend.dev, which only delivers to the
// Resend account's own e-mail). Without the key nothing is sent and the run says why (Central → Funil e alarmes).
import { healthAlarms, healthEmail } from '../public/js/lib/funnel.js';
import { pushHealth } from '../public/js/lib/pushhealth.js';
import { linkFor } from '../public/js/lib/links.js';

export async function healthData({ supabaseUrl, serviceKey, fetchImpl = fetch, now = new Date().toISOString() }) {
  const H = { apikey: serviceKey, 'content-type': 'application/json', ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const r = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/product_health`, { method: 'POST', headers: H, body: '{}' });
  if (!r.ok) throw new Error(`product_health ${r.status}`);
  const h = await r.json();
  const since7 = new Date(Date.parse(now) - 7 * 864e5).toISOString(), since30 = new Date(Date.parse(now) - 30 * 864e5).toISOString();
  const get = async p => { const x = await fetchImpl(`${supabaseUrl}/rest/v1/${p}`, { headers: H }); return x.ok ? x.json() : []; };
  const [logs, runs] = await Promise.all([get(`push_log?at=gte.${since7}&select=at,job,ok,status,error&limit=5000`), get(`job_runs?at=gte.${since30}&select=at,job,ok,summary&order=at.desc&limit=500`)]);
  const pushAlerts = pushHealth(logs, runs, now).alerts || [];
  const lastEmail = runs.find(x => x.job === 'email') || null;
  return { h, alarms: healthAlarms(h, { pushAlerts }), lastEmail };
}

export async function dailyEmail({ supabaseUrl, serviceKey, admins = [], fetchImpl = fetch, env = process.env }) {
  const { h, alarms } = await healthData({ supabaseUrl, serviceKey, fetchImpl });
  const base = String(env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/$/, '');
  const mail = healthEmail(h, alarms, { centralUrl: base ? base + linkFor('central', { sec: 'funil' }) : '' });
  const key = String(env.RESEND_API_KEY || '').trim();
  if (!key) return { alarms: alarms.length, sent: 0, reason: 'sem RESEND_API_KEY no Vercel' };
  if (!admins.length) return { alarms: alarms.length, sent: 0, reason: 'sem ADMIN_EMAILS' };
  const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: String(env.MAIL_FROM || 'Pra Onde Foi <onboarding@resend.dev>'), to: admins, subject: mail.subject, html: mail.html, text: mail.text }) });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* no body */ } throw new Error(`Resend ${r.status}${m ? ': ' + m.slice(0, 120) : ''}`); }
  return { alarms: alarms.length, sent: admins.length, subject: mail.subject };
}
