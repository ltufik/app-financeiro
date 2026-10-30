// Public client configuration (the anon key is meant to be public; row-level security protects the data).
// Accepts the URL with or without a trailing path (e.g. .../rest/v1/ copied from the Data API page).
export const cleanUrl = u => String(u || '').trim().replace(/\/(rest|auth)\/v1\/?.*$/, '').replace(/\/+$/, '');

export default function handler(req, res) {
  res.setHeader('cache-control', 'public, max-age=300');
  res.status(200).json({ supabaseUrl: cleanUrl(process.env.SUPABASE_URL), supabaseAnonKey: String(process.env.SUPABASE_ANON_KEY || '').trim(), vapidPublicKey: String(process.env.VAPID_PUBLIC_KEY || '').trim() || null });
}
