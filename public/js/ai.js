// Client for the /api/ai function, which calls Claude with the server-side API key.
import { sb } from './db.js';

export class AIError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

async function call(body, signal) {
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new AIError('not_signed_in');
  let r;
  try { r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name === 'AbortError') throw new AIError('cancelled'); throw new AIError('network'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AIError(j.error || ('http_' + r.status), j.message);
  return j;
}

const textOf = msg => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

function parseJSON(t) {
  const s = t.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const a = s.indexOf('{'), b = s.indexOf('['), start = a < 0 ? b : b < 0 ? a : Math.min(a, b);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start >= 0 && end > start) { try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { /* fall through */ } }
  // A long list cut off at the token limit: keep the complete items.
  if (start >= 0 && s[start] === '[') { const lc = s.lastIndexOf('}'); if (lc > start) { try { return JSON.parse(s.slice(start, lc + 1) + ']'); } catch (e) { /* fall through */ } } }
  throw new AIError('bad_json');
}

const blobToB64 = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(b); });

// One request that must come back as JSON. images: Blob[] (JPEG/PNG).
export async function askJSON(prompt, { tier = 'default', images = [], maxTokens = 8000, signal } = {}) {
  const content = [];
  for (const im of images) content.push({ type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: await blobToB64(im) } });
  content.push({ type: 'text', text: prompt });
  const msg = await call({ tier, max_tokens: maxTokens, messages: [{ role: 'user', content }] }, signal);
  return parseJSON(textOf(msg));
}

// Conversation with tools that run in the page. tools: [{name, description, input_schema, execute(input)}]
export async function chat({ system, messages, tools = [], tier = 'default', signal, onStep }) {
  const defs = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const conv = messages.map(m => ({ role: m.role, content: m.content }));
  for (let turn = 0; turn < 8; turn++) {
    const msg = await call({ tier, system, max_tokens: 4000, messages: conv, tools: defs }, signal);
    conv.push({ role: 'assistant', content: msg.content });
    const uses = (msg.content || []).filter(b => b.type === 'tool_use');
    if (msg.stop_reason !== 'tool_use' || !uses.length) return textOf(msg);
    onStep && onStep(uses.map(u => u.name));
    const results = [];
    for (const u of uses) {
      const t = tools.find(x => x.name === u.name);
      let out, isErr = false;
      try { out = t ? await t.execute(u.input || {}) : { erro: 'ferramenta desconhecida' }; } catch (e) { out = { erro: String(e.message || e) }; isErr = true; }
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 60000), is_error: isErr });
    }
    conv.push({ role: 'user', content: results });
  }
  return 'Não consegui terminar a análise. Tente uma pergunta mais específica.';
}

export function aiErrorText(e) {
  return ({
    not_signed_in: 'Entre de novo na sua conta.',
    not_configured: 'A leitura inteligente ainda não foi configurada no servidor.',
    not_allowed: 'Seu e-mail não está liberado para a leitura inteligente neste app.',
    rate_limited: 'Muitas perguntas seguidas. Espere um minuto e tente de novo.',
    cancelled: 'Interrompido.',
    network: 'Sem conexão. Verifique a internet.',
    bad_json: 'A resposta veio incompleta. Tente de novo.',
  })[e && e.code] || 'Não deu para responder agora. Tente de novo.';
}
