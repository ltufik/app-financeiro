// Published FAQ ("Dúvidas") for the app. Public read: questions and answers about how the app works,
// nothing about any family. Written only from the product console (/api/admin, key "faq").
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { cleanUrl } from './config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const URL_ = cleanUrl(process.env.SUPABASE_URL), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!URL_ || !SERVICE) return res.status(200).json({ items: null });
  try {
    const r = await fetch(`${URL_}/rest/v1/product_board?key=eq.faq&select=data`, { headers: { apikey: SERVICE, ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) } });
    const [row] = r.ok ? await r.json() : [];
    res.setHeader('cache-control', 'public, max-age=60');
    res.status(200).json({ items: Array.isArray(row?.data?.items) ? row.data.items : null });
  } catch (e) { res.status(200).json({ items: null }); }
}
