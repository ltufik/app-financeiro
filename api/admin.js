// Product console data (/admin): backlog, pricing and product design, for ADMIN_EMAILS only.
// GET /api/admin?key=backlog  ->  {key, data, updated_at}     PUT /api/admin {key, data}
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS.
import { cleanUrl } from './config.js';

const KEYS = ['backlog', 'pricing', 'canvas', 'notes'];
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
      const r = await fetch(`${URL_}/rest/v1/product_board?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ key: b.key, data: b.data, updated_at: new Date().toISOString(), updated_by: user.email }) });
      if (!r.ok) return res.status(502).json({ error: 'db' });
      const [row] = await r.json();
      return res.status(200).json(row);
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { res.status(500).json({ error: 'failed' }); }
}
