// Server health: database, login, the libraries the phone downloads (PDF reader and database client) and whether the
// push and assistant keys are set. GET is public and says only ok/not ok per check (no details, no secrets), so a
// scheduled GitHub Action can ping it every hour and fail (GitHub e-mails the owner) when it is red.
import { healthColor } from '../public/js/lib/health.js';
import { cleanUrl } from './config.js';

const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm'];

// Each check answers ok and, when not ok, why: the HTTP status, "timeout" or "rede" (no secret, no detail).
async function timed(fn) {
  const t0 = Date.now();
  try { const r = await fn(); const ok = r === true || !!r?.ok; return { ok, ms: Date.now() - t0, ...(ok ? {} : { why: r?.status ? String(r.status) : 'falhou' }) }; }
  catch (e) { return { ok: false, ms: Date.now() - t0, why: /timeout/.test(String(e?.message)) ? 'timeout' : 'rede' }; }
}
const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function runHealth({ supabaseUrl = cleanUrl(process.env.SUPABASE_URL), serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(), anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim(), env = process.env, fetchImpl = fetch } = {}) {
  const H = { apikey: serviceKey, ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const [banco, login, bibliotecas] = await Promise.all([
    timed(() => withTimeout(fetchImpl(`${supabaseUrl}/rest/v1/households?select=id&limit=1`, { headers: H }))),
    timed(() => withTimeout(fetchImpl(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey || serviceKey } }))),
    timed(() => withTimeout(Promise.all(LIBS.map(u => fetchImpl(u, { method: 'HEAD' }).then(r => r.ok))).then(a => a.every(Boolean)))),
  ]);
  const checks = [
    { id: 'banco', ...banco }, { id: 'login', ...login }, { id: 'bibliotecas', ...bibliotecas },
    { id: 'avisos', ok: !!(String(env.VAPID_PUBLIC_KEY || '').trim() && String(env.VAPID_PRIVATE_KEY || '').trim()), ms: 0 },
    { id: 'assistente', ok: !!String(env.ANTHROPIC_API_KEY || '').trim(), ms: 0 },
  ];
  return { at: new Date().toISOString(), checks, ...healthColor(checks) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  res.setHeader('cache-control', 'no-store');
  const h = await runHealth();
  // Public answer: ok per check only.
  res.status(h.color === 'vermelho' ? 503 : 200).json({ color: h.color, ok: h.ok, checks: h.checks.map(c => ({ id: c.id, ok: c.ok, ...(c.why ? { why: c.why } : {}) })) });
}
