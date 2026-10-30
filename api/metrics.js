// Product metrics (aggregated numbers only), for the people listed in ADMIN_EMAILS.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS (comma-separated).
import { cleanUrl } from './config.js';

export default async function handler(req, res) {
  const URL_ = cleanUrl(process.env.SUPABASE_URL), ANON = String(process.env.SUPABASE_ANON_KEY || '').trim(), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const admins = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  res.setHeader('cache-control', 'no-store');
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!URL_ || !ANON || !token) return res.status(401).json({ error: 'not_signed_in' });
  const u = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } });
  if (!u.ok) return res.status(401).json({ error: 'not_signed_in' });
  const user = await u.json();
  if (!admins.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'not_admin' });
  if (req.query?.probe) return res.status(200).json({ admin: true });
  if (!SERVICE) return res.status(503).json({ error: 'not_configured' });
  const r = await fetch(`${URL_}/rest/v1/rpc/product_metrics`, { method: 'POST', headers: { apikey: SERVICE, 'content-type': 'application/json', ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) }, body: '{}' });
  if (!r.ok) return res.status(502).json({ error: 'metrics_failed', status: r.status });
  res.status(200).json(await r.json());
}
