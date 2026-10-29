// Calls Claude for signed-in users. The Anthropic API key stays on the server.
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY; optional CLAUDE_MODEL, CLAUDE_MODEL_QUICK, ALLOWED_EMAILS (comma-separated).
const MAX_BODY = 4_000_000;
const hits = new Map(); // best-effort per-instance rate limit: user -> [timestamps]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(503).json({ error: 'not_configured' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'not_signed_in' });
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } });
  if (!u.ok) return res.status(401).json({ error: 'not_signed_in' });
  const user = await u.json();
  const allow = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(String(user.email || '').toLowerCase())) return res.status(403).json({ error: 'not_allowed' });

  const now = Date.now(), list = (hits.get(user.id) || []).filter(t => now - t < 60_000);
  if (list.length >= 30) return res.status(429).json({ error: 'rate_limited' });
  list.push(now); hits.set(user.id, list);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'too_large' });
  if (!Array.isArray(body.messages) || !body.messages.length) return res.status(400).json({ error: 'bad_request' });

  const model = body.tier === 'quick' ? (process.env.CLAUDE_MODEL_QUICK || 'claude-haiku-5-5') : (process.env.CLAUDE_MODEL || 'claude-sonnet-5-5');
  const payload = { model, max_tokens: Math.min(+body.max_tokens || 4000, 16000), messages: body.messages };
  if (body.system) payload.system = String(body.system);
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('anthropic', r.status, j?.error?.type, j?.error?.message);
      return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? 'rate_limited' : 'upstream', message: j?.error?.message });
    }
    return res.status(200).json({ content: j.content, stop_reason: j.stop_reason, usage: j.usage });
  } catch (e) {
    console.error('anthropic fetch', e);
    return res.status(502).json({ error: 'upstream' });
  }
}

export const config = { maxDuration: 60 };
