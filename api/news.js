// Published "O que mudou" notes for the app (written in the product console, key "news"). Public read.
// The first opening after a deploy also applies the release manifest (api/_releases.js).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; VAPID_* for the automatic messages as push.
import { cleanUrl } from './config.js';
import { rest, applyReleases } from './_loop.js';
import { vapidFromEnv } from './push-cron.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const URL_ = cleanUrl(process.env.SUPABASE_URL), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!URL_ || !SERVICE) return res.status(200).json({ items: null });
  try {
    const db = rest(URL_, SERVICE);
    await applyReleases(db, vapidFromEnv()).catch(() => {});
    const data = await db.board('news');
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ items: Array.isArray(data?.items) ? data.items : null });
  } catch (e) { res.status(200).json({ items: null }); }
}
