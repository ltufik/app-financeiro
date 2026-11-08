// Lets the repository's own GitHub robot (.github/workflows/backlog.yml) read and change the backlog, with no secret
// to copy anywhere: GitHub signs a short-lived token (OIDC) saying which repository, branch and workflow is calling,
// and the server checks GitHub's signature and those fields. Anything else is refused.
import crypto from 'crypto';

export const OIDC = { iss: 'https://token.actions.githubusercontent.com', aud: 'praondefoi-backlog', repo: 'ltufik/app-financeiro', workflow: 'ltufik/app-financeiro/.github/workflows/backlog.yml@refs/heads/main' };
const b64 = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
let cache = { at: 0, keys: [] };

export const looksLikeGithubToken = t => { try { const p = JSON.parse(b64(String(t).split('.')[1] || '').toString('utf8')); return p.iss === OIDC.iss; } catch (e) { return false; } };

export async function verifyGithubOidc(token, { fetchImpl = fetch, now = Date.now(), expect = OIDC } = {}) {
  const [h, p, s] = String(token || '').split('.'); if (!h || !p || !s) throw new Error('token');
  const head = JSON.parse(b64(h).toString('utf8')), claims = JSON.parse(b64(p).toString('utf8'));
  if (head.alg !== 'RS256') throw new Error('alg');
  if (!cache.keys.length || now - cache.at > 3600e3 || !cache.keys.some(k => k.kid === head.kid)) {
    const r = await fetchImpl(`${expect.iss}/.well-known/jwks`); if (!r.ok) throw new Error('jwks');
    cache = { at: now, keys: (await r.json()).keys || [] };
  }
  const jwk = cache.keys.find(k => k.kid === head.kid); if (!jwk) throw new Error('kid');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(s));
  if (!ok) throw new Error('signature');
  const t = Math.floor(now / 1000);
  if (claims.iss !== expect.iss || claims.aud !== expect.aud || claims.repository !== expect.repo || claims.job_workflow_ref !== expect.workflow || claims.ref !== 'refs/heads/main') throw new Error('claims');
  if (!(claims.exp > t) || (claims.nbf && claims.nbf > t + 60)) throw new Error('expired');
  return claims;
}
export const _resetJwks = () => { cache = { at: 0, keys: [] }; };

// Backlog changes the robot may make: add an item, change fields, change status, discard. Only known fields.
const FIELDS = ['title', 'status', 'tipo', 'effort', 'problem', 'notes', 'where', 'origin', 'ordem', 'cost'];
const STATUS = ['agora', 'proximo', 'ideia', 'depois', 'feito', 'descartado'];
const clean = o => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => FIELDS.includes(k) && (k !== 'status' || STATUS.includes(v)) && (typeof v !== 'string' || v.length <= 2000)));
export function applyOps(items = [], ops = []) {
  const out = items.map(x => ({ ...x })), done = [];
  for (const o of ops) {
    if (!o || typeof o !== 'object') continue;
    const i = out.findIndex(x => x.id === o.id);
    if (o.op === 'add' && o.item?.id && /^[a-z0-9_]{3,60}$/.test(o.item.id) && i < 0 && o.item.title) { out.unshift({ from: [], cost: false, ...clean(o.item), id: o.item.id, status: STATUS.includes(o.item.status) ? o.item.status : 'ideia' }); done.push(`add ${o.item.id}`); }
    else if (o.op === 'update' && i >= 0) { Object.assign(out[i], clean(o.set)); done.push(`update ${o.id}`); }
    else if (o.op === 'status' && i >= 0 && STATUS.includes(o.status)) { out[i].status = o.status; done.push(`status ${o.id} ${o.status}`); }
    else if (o.op === 'move' && i >= 0 && Number.isInteger(o.to)) { const [it] = out.splice(i, 1); out.splice(Math.max(0, Math.min(out.length, o.to)), 0, it); done.push(`move ${o.id}`); }
  }
  return { items: out, done };
}
