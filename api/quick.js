// iPhone shortcuts, checked by the hash of the person's code ("Authorization: Bearer <code>"):
// - Apple Pay (Atalhos → Automação → Transação): POST {valor, loja, cartao}
// - Siri ("E aí Siri, gastei"): POST {texto} with what was said; the assistant turns it into entries.
// ?formato=texto answers with plain text, for Siri to read out loud.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; ANTHROPIC_API_KEY (and CLAUDE_MODEL_QUICK) for phrases.
import crypto from 'crypto';
import { cleanUrl } from './config.js';
import { quickRow, phrasePrompt, phraseRows } from '../public/js/lib/quick.js';
import { prepareRules, classify } from '../public/js/lib/categorize.js';

const hits = new Map();
// Asks the assistant to read a phrase; returns the items or [].
async function readPhrase(prompt, fetchImpl = fetch) {
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim(); if (!key) return [];
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL_QUICK || 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) return [];
  const t = ((await r.json()).content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).itens || []; } catch (e) { return []; }
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  const plain = String(req.query?.formato || '') === 'texto' || /formato=texto/.test(String(req.url || ''));
  if (plain) { const json = res.json.bind(res); res.json = o => { if (typeof res.send === 'function') { res.setHeader('content-type', 'text/plain; charset=utf-8'); return res.send(o.mensagem); } return json(o); }; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, mensagem: 'Use POST.' });
  const URL_ = cleanUrl(process.env.SUPABASE_URL), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!URL_ || !SERVICE) return res.status(503).json({ ok: false, mensagem: 'App ainda não configurado.' });
  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } })() : (req.body || {});
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(b.codigo || '').trim();
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return res.status(401).json({ ok: false, mensagem: 'Código do atalho ausente ou errado. Gere um novo no app.' });
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now(), list = (hits.get(hash) || []).filter(t => now - t < 60_000);
  if (list.length >= 20) return res.status(429).json({ ok: false, mensagem: 'Muitas compras seguidas. Tente de novo em um minuto.' });
  list.push(now); hits.set(hash, list);
  const H = { apikey: SERVICE, 'content-type': 'application/json', ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) };
  const get = async p => { const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error('db'); return r.json(); };
  try {
    const [tok] = await get(`quick_tokens?token_hash=eq.${hash}&select=user_id,household_id,uses`);
    if (!tok) return res.status(401).json({ ok: false, mensagem: 'Código do atalho não reconhecido. Gere um novo no app (menu ☰ → Compras com Apple Pay).' });
    const [hh] = await get(`households?id=eq.${tok.household_id}&select=settings`);
    const rules = await get(`rules?household_id=eq.${tok.household_id}&source=eq.cartao&select=source,kind,pattern,category,min_abs,max_abs,priority`);
    const today = new Date(now - 3 * 3600e3).toISOString().slice(0, 10);
    const brl = v => Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (b.texto != null && b.valor == null) {
      const text = String(b.texto).trim();
      if (text.length < 3) return res.status(400).json({ ok: false, mensagem: 'Não ouvi nada. Tente de novo, dizendo quanto foi e o que foi.' });
      const [fam] = await get(`households?id=eq.${tok.household_id}&select=name`);
      const categories = await get(`categories?household_id=eq.${tok.household_id}&select=name,grp`);
      const items = await readPhrase(phrasePrompt({ family: fam?.name || 'família', today, categories, text }));
      const rows = phraseRows(items, { household: tok.household_id, user: tok.user_id, today, closeDay: +hh?.settings?.cardCloseDay || 24, categories });
      if (!rows.length) return res.status(400).json({ ok: false, mensagem: 'Não achei um valor. Tente de novo, por exemplo: 45 na padaria no pix.' });
      const ins = await fetch(`${URL_}/rest/v1/transactions`, { method: 'POST', headers: { ...H, prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      if (!ins.ok) throw new Error('insert');
      await fetch(`${URL_}/rest/v1/quick_tokens?token_hash=eq.${hash}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_used: new Date().toISOString(), uses: (tok.uses || 0) + rows.length }) });
      return res.status(200).json({ ok: true, mensagem: 'Lançado: ' + rows.map(x => `${x.description}, ${brl(x.amount)}${x.source === 'cartao' ? ' no cartão' : ''}`).join('; ') + '.' });
    }
    const draft = quickRow(b, { household: tok.household_id, user: tok.user_id, today, closeDay: +hh?.settings?.cardCloseDay || 24 });
    if (draft.error) return res.status(400).json({ ok: false, mensagem: 'Não entendi o valor da compra. Confira o campo "valor" no atalho.' });
    const hit = classify({ source: 'cartao', description: draft.description, amount: draft.amount }, prepareRules(rules));
    const row = { ...draft, category: hit?.category || 'A classificar' };
    const r = await fetch(`${URL_}/rest/v1/transactions`, { method: 'POST', headers: { ...H, prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) throw new Error('insert');
    await fetch(`${URL_}/rest/v1/quick_tokens?token_hash=eq.${hash}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_used: new Date().toISOString(), uses: (tok.uses || 0) + 1 }) });
    return res.status(200).json({ ok: true, mensagem: `Lançado no Pra Onde Foi: ${row.description}, ${brl(row.amount)}${row.category !== 'A classificar' ? ' (' + row.category + ')' : ''}.` });
  } catch (e) { return res.status(500).json({ ok: false, mensagem: 'Não foi possível lançar agora. A compra vai aparecer quando você mandar a fatura.' }); }
}
