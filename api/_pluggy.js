// Open Finance test through Pluggy (Central → Teste Open Finance, owner only). Reads one or more connections
// (item ids made in the Pluggy dashboard with MeuPluggy) and returns a summary. Nothing is stored here or in the database.
// Env: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (Vercel). The keys never reach the browser.
import { ofSummary } from '../public/js/lib/openfinance.js';

const API = 'https://api.pluggy.ai';
export const pluggyReady = () => !!(String(process.env.PLUGGY_CLIENT_ID || '').trim() && String(process.env.PLUGGY_CLIENT_SECRET || '').trim());

async function j(f, url, opts) {
  const r = await f(url, opts);
  let d = {}; try { d = await r.json(); } catch (e) { /* no body */ }
  if (!r.ok) { const e = new Error(d.message || d.error || `Pluggy respondeu ${r.status}`); e.status = r.status; throw e; }
  return d;
}

export async function pluggyTest({ items = [], days = 90, today = new Date().toISOString().slice(0, 10), f = fetch } = {}) {
  if (!pluggyReady()) return { error: 'not_configured' };
  const ids = [...new Set(items.map(s => String(s || '').trim()).filter(s => /^[0-9a-f-]{20,60}$/i.test(s)))].slice(0, 6);
  if (!ids.length) return { error: 'no_items' };
  const { apiKey } = await j(f, API + '/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID.trim(), clientSecret: process.env.PLUGGY_CLIENT_SECRET.trim() }) });
  const H = { 'X-API-KEY': apiKey, accept: 'application/json' }, get = p => j(f, API + p, { headers: H });
  const from = new Date(Date.parse(today) - days * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const id of ids) {
    try {
      const item = await get('/items/' + encodeURIComponent(id));
      const accounts = (await get('/accounts?itemId=' + encodeURIComponent(id))).results || [];
      const full = [];
      for (const account of accounts) {
        const txs = [];
        for (let page = 1; page <= 4; page++) {
          const d = await get(`/transactions?accountId=${encodeURIComponent(account.id)}&from=${from}&to=${today}&pageSize=500&page=${page}`);
          txs.push(...(d.results || [])); if (page >= (+d.totalPages || 1)) break;
        }
        let bills = [];
        if (account.type === 'CREDIT') bills = (await get('/bills?accountId=' + encodeURIComponent(account.id)).catch(() => ({}))).results || [];
        full.push({ account, txs, bills });
      }
      out.push({ id, ...ofSummary({ item, accounts: full }, today) });
    } catch (e) { out.push({ id, error: String(e.message || e), status: e.status || 0 }); }
  }
  return { results: out, from, today };
}
