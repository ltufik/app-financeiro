// Published "O que mudou" notes for the app (written in the product console, key "news"). Public read.
// The app also POSTs here once per opening to apply the release manifest (api/_releases.js), without waiting.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; VAPID_* for the automatic messages as push.
import { cleanUrl } from './config.js';
import { rest, applyReleases } from './_loop.js';
import { vapidFromEnv } from './push-cron.js';
import { RELEASES } from './_releases.js';

// GET answers right away: the notes saved in the console plus the ones of the releases in the code (a new
// version's note shows at the first opening, without waiting). POST applies the releases (backlog, personal
// replies, push to everyone): the app fires it without waiting, so opening the app is never slowed by it.
export function mergeNews(saved, releases = RELEASES) {
  const items = Array.isArray(saved) ? [...saved] : [];
  for (const r of releases) if (r.news && !items.some(n => n.id === r.news.id)) items.push({ ...r.news, at: r.at });
  return items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}
export default async function handler(req, res) {
  const URL_ = cleanUrl(process.env.SUPABASE_URL), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  res.setHeader('cache-control', 'no-store');
  if (req.method === 'POST') {
    if (!URL_ || !SERVICE) return res.status(200).json({ applied: 0 });
    const out = await applyReleases(rest(URL_, SERVICE), vapidFromEnv()).catch(e => ({ error: String(e?.message || e).slice(0, 120) }));
    return res.status(200).json(out);
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!URL_ || !SERVICE) return res.status(200).json({ items: mergeNews(null) });
  try {
    const data = await rest(URL_, SERVICE).board('news');
    res.status(200).json({ items: mergeNews(data?.items) });
  } catch (e) { res.status(200).json({ items: mergeNews(null) }); }
}
