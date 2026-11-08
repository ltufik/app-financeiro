// Backlog robot (runs on GitHub, .github/workflows/backlog.yml). Applies the change files in backlog/ops/ (written by
// Claude: add, update, status, move) to the backlog in the Central, then writes the current backlog to
// backlog/backlog.json and backlog/BACKLOG.md, so Claude can read what Luiz changed in the Central.
// The call is signed by GitHub (OIDC); the server checks repository, branch and workflow. No secret involved.
import fs from 'fs';
import path from 'path';

const API = process.env.BACKLOG_API || 'https://praondefoi.app.br/api/admin';
const STATUS = { agora: 'Agora', proximo: 'Próximo', ideia: 'Ideia', depois: 'Depois', feito: 'Feito', descartado: 'Descartado' };

async function githubToken() {
  const u = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, t = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!u || !t) throw new Error('sem token do GitHub (permissions: id-token: write)');
  const r = await fetch(`${u}&audience=praondefoi-backlog`, { headers: { authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`token do GitHub: ${r.status}`);
  return (await r.json()).value;
}

const token = await githubToken();
const call = async (opts = {}, q = '') => {
  const r = await fetch(API + q, { ...opts, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Central respondeu ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};

// 1. Pending changes, oldest first; each file is applied once and moved to backlog/ops/aplicados/.
const dir = 'backlog/ops', doneDir = path.join(dir, 'aplicados');
fs.mkdirSync(doneDir, { recursive: true });
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const ops = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = await call({ method: 'POST', body: JSON.stringify({ action: 'agent_backlog', ops: Array.isArray(ops) ? ops : ops.ops || [] }) });
  console.log(`${f}: ${r.done.length} mudanças aplicadas (${r.done.join('; ')})`);
  fs.renameSync(path.join(dir, f), path.join(doneDir, f));
}

// 2. The backlog as it is now in the Central.
const { items } = await call({}, '?view=agent_backlog');
fs.writeFileSync('backlog/backlog.json', JSON.stringify(items, null, 1) + '\n');
const line = i => `| ${i.ordem ?? ''} | ${i.tipo ? `[${i.tipo}] ` : ''}${String(i.title || '').replace(/\|/g, '/')} | \`${i.id}\` | ${i.effort || ''} | ${String(i.origin || '').replace(/\|/g, '/')} |`;
const md = ['# Backlog (cópia da Central, atualizada pelo robô)', '', 'Não edite aqui: mude na Central ou peça ao Claude (arquivos em backlog/ops/).', ''];
for (const [k, label] of Object.entries(STATUS)) {
  const list = items.filter(i => i.status === k); if (!list.length || k === 'feito' || k === 'descartado') { if (list.length) md.push(`## ${label}: ${list.length} itens`, ''); continue; }
  md.push(`## ${label} (${list.length})`, '', '| Ordem | Item | id | Esforço | Origem |', '|---|---|---|---|---|', ...list.map(line), '');
}
fs.writeFileSync('backlog/BACKLOG.md', md.join('\n') + '\n');
console.log(`backlog: ${items.length} itens`);
