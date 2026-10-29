// Public client configuration (the anon key is meant to be public; row-level security protects the data).
export default function handler(req, res) {
  res.setHeader('cache-control', 'public, max-age=300');
  res.status(200).json({ supabaseUrl: process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '' });
}
