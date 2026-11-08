// Records every push and every robot run (tables push_log and job_runs), so the Central shows what was delivered
// and notices a robot that did not run. One recorder per run, carried with AsyncLocalStorage: sendPush reports to
// whatever run is in progress, with no changes at each call site. Best effort: recording never stops a send.
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
export const currentRecorder = () => als.getStore() || null;
const clean = v => String(v || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30) || null;
const KEEP_DAYS = 90;

// run: false for pushes on demand (a test, a reply, family news): only the sends are logged, not a robot run.
export function makeRecorder({ supabaseUrl, serviceKey, job, fetchImpl = fetch, run = true }) {
  const H = { apikey: serviceKey, 'content-type': 'application/json', prefer: 'return=minimal', ...(String(serviceKey).startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const rows = [], who = new Map(), okEnd = new Set(), failEnd = new Set(), t0 = Date.now();
  return {
    job, rows,
    // Who owns each device (to say which family and person got it); the push keys are never stored.
    async init() {
      try { const r = await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,user_id,household_id`, { headers: H }); if (r.ok) for (const s of await r.json()) who.set(s.endpoint, s); } catch (e) { /* recording only */ }
    },
    push(sub, data, r, err) {
      const w = who.get(sub?.endpoint) || {};
      if (sub?.endpoint && who.has(sub.endpoint)) { if (r?.ok) okEnd.add(sub.endpoint); else if (!r?.gone) failEnd.add(sub.endpoint); }
      rows.push({ job, kind: clean(data?.tag), household_id: w.household_id || null, user_id: w.user_id || null, ok: !!r?.ok, status: Number.isFinite(+r?.status) ? +r.status : null, error: err ? String(err.message || err).slice(0, 200) : r?.gone ? 'aparelho saiu (removido)' : null });
    },
    async finish(summary, ok) {
      const post = (table, body) => fetchImpl(`${supabaseUrl}/rest/v1/${table}`, { method: 'POST', headers: H, body: JSON.stringify(body) }).catch(() => null);
      for (let i = 0; i < rows.length; i += 500) await post('push_log', rows.slice(i, i + 500));
      // Devices: delivered resets the failures; 5 failures in a row and the device leaves the list (push_result).
      if (okEnd.size || failEnd.size) await post('rpc/push_result', { p_ok: [...okEnd], p_fail: [...failEnd].filter(e => !okEnd.has(e)) });
      if (run) await post('job_runs', { job, ok: !!ok, ms: Date.now() - t0, summary: summary && typeof summary === 'object' ? summary : { value: String(summary ?? '') } });
      if (job === 'diario') {
        const old = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
        for (const t of ['push_log', 'job_runs']) await fetchImpl(`${supabaseUrl}/rest/v1/${t}?at=lt.${old}`, { method: 'DELETE', headers: H }).catch(() => null);
      }
    },
  };
}

// Runs fn with a recorder for this job: every push inside is logged, and the run itself (ok or not) too.
export async function withRecorder(opts, fn) {
  const rec = makeRecorder(opts); await rec.init();
  let out;
  try { out = await als.run(rec, fn); }
  catch (e) { await rec.finish({ error: String(e.message || e) }, false); throw e; }
  await rec.finish(out, !(out && out.error));
  return out;
}
