// Limit of use per person (or per shortcut code) and per time window, shared by every server instance: the database
// counts (rate_hit). If the database cannot answer (e.g. the SQL was not run yet), it falls back to a per-instance
// count, so the app keeps working and still has a limit. Keys never carry e-mails or tokens: an id or a hash.
const local = new Map();
function localHit(key, limit, windowSec, now = Date.now()) {
  const w = Math.floor(now / 1000 / windowSec), k = `${key}|${windowSec}|${w}`, n = (local.get(k) || 0) + 1;
  local.set(k, n);
  if (local.size > 5000) for (const x of local.keys()) { if (!x.endsWith(`|${w}`)) local.delete(x); if (local.size < 2500) break; }
  return n <= limit;
}

// rules: [{ limit, window }] (window in seconds). Returns true when every rule allows.
export async function allowed(key, rules, { supabaseUrl, serviceKey, fetchImpl = fetch } = {}) {
  const k = String(key).slice(0, 120);
  for (const { limit, window } of rules) {
    let ok = null;
    if (supabaseUrl && serviceKey) {
      try {
        const r = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/rate_hit`, { method: 'POST', headers: { apikey: serviceKey, 'content-type': 'application/json', ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) }, body: JSON.stringify({ p_key: k, p_limit: limit, p_window: window }) });
        if (r.ok) { const j = await r.json(); ok = j === true ? true : j === false ? false : null; }
      } catch (e) { /* fall back */ }
    }
    if (ok === null) ok = localHit(k, limit, window);
    if (!ok) return false;
  }
  return true;
}

// Push services the server may post to (a subscription with any other address is refused: the server never
// posts to an address someone made up).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function pushEndpointOk(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.some(r => r.test(u.hostname)); } catch (e) { return false; }
}
