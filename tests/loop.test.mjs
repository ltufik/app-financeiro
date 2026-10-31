// Automatic message to testers when what they asked for is done, and the release manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoReply, newlyDone } from '../public/js/lib/news.js';
import { rest, closeLoop, applyReleases } from '../api/_loop.js';

test('autoReply: nome, pedido, o que foi feito e onde encontrar', () => {
  assert.equal(autoReply({ kind: 'ideia', name: 'Luana Souza', text: 'ver gasto por semana' }, { title: 'Gráfico por semana', where: 'Gráficos → por semana' }),
    'Oi, Luana! Você sugeriu "ver gasto por semana". Ficou pronto: Gráfico por semana. Onde encontrar: Gráficos → por semana. Obrigado por ajudar a melhorar o app!');
  assert.equal(autoReply({ kind: 'erro', name: '', text: 'botão não salva' }, { title: 'botão não salva' }), 'Oi, tudo bem! Você avisou que "botão não salva". Corrigimos. Obrigado por ajudar a melhorar o app!');
});

test('newlyDone: só itens que viraram feito e vieram de opiniões', () => {
  const prev = [{ id: 'a', status: 'ideia', from: [1] }, { id: 'b', status: 'feito', from: [2] }, { id: 'c', status: 'agora', notes: 'Opinião #7' }, { id: 'd', status: 'agora' }];
  const next = [{ id: 'a', status: 'feito', from: [1, 3] }, { id: 'b', status: 'feito', from: [2] }, { id: 'c', status: 'feito', notes: 'Opinião #7' }, { id: 'd', status: 'feito' }];
  assert.deepEqual(newlyDone(prev, next).map(x => [x.item.id, x.ids]), [['a', [1, 3]], ['c', [7]]]);
});

// Tiny fake of the Supabase REST API with the tables used here.
function fakeDb() {
  const T = { feedback: [{ id: 1, user_id: 'u1', kind: 'ideia', text: 'ver por semana', reply: null }, { id: 2, user_id: 'u2', kind: 'erro', text: 'trava', reply: 'já respondido' }],
    members: [{ user_id: 'u1', display_name: 'Luana Souza' }], push_subscriptions: [], product_board: [{ key: 'backlog', data: { items: [{ id: 'semana', title: 'Gráfico por semana', status: 'agora', from: [1, 2] }] } }] };
  const calls = [];
  const fetchImpl = async (url, o = {}) => {
    const u = new URL(url), table = u.pathname.split('/').pop(), q = Object.fromEntries(u.searchParams), method = o.method || 'GET';
    calls.push(method + ' ' + table);
    const match = r => Object.entries(q).every(([k, v]) => ['select', 'limit', 'on_conflict'].includes(k) || (v.startsWith('eq.') ? String(r[k]) === v.slice(3) : v.startsWith('in.(') ? v.slice(4, -1).split(',').includes(String(r[k])) : v === 'is.null' ? r[k] == null : true));
    const json = d => ({ ok: true, status: 200, json: async () => d });
    if (method === 'GET') return json(T[table].filter(match));
    if (method === 'PATCH') { T[table].filter(match).forEach(r => Object.assign(r, JSON.parse(o.body))); return json([]); }
    if (method === 'POST') { const b = JSON.parse(o.body), i = T[table].findIndex(r => r.key === b.key); if (i >= 0) T[table][i] = b; else T[table].push(b); return json([b]); }
    return json([]);
  };
  return { T, calls, db: rest('https://x.supabase.co', 'sb_secret_x', fetchImpl), fetchImpl };
}

test('closeLoop: manda o recado só para quem ainda não recebeu', async () => {
  const { T, db } = fakeDb();
  const out = await closeLoop(db, [{ id: 'semana', status: 'agora', from: [1, 2] }], [{ id: 'semana', title: 'Gráfico por semana', where: 'Gráficos', status: 'feito', from: [1, 2] }], null);
  assert.equal(out.replied, 1);
  assert.match(T.feedback[0].reply, /^Oi, Luana! Você sugeriu "ver por semana"\. Ficou pronto: Gráfico por semana\. Onde encontrar: Gráficos\./);
  assert.equal(T.feedback[0].status, 'resolvido'); assert.equal(T.feedback[0].reply_seen, false);
  assert.equal(T.feedback[1].reply, 'já respondido');
});

test('applyReleases: publica a novidade, conclui o item e avisa, uma vez só', async () => {
  const { T, db } = fakeDb();
  const releases = [{ id: 'r1', at: '2026-11-01T12:00:00Z', backlog: [{ id: 'semana', where: 'Gráficos → por semana' }], news: { id: 'n1', title: 'Gasto por semana', items: ['Em Gráficos'] } }];
  const first = await applyReleases(db, null, { releases });
  assert.deepEqual(first, { applied: 1, replied: 1 });
  const board = k => T.product_board.find(r => r.key === k).data;
  assert.equal(board('news').items[0].title, 'Gasto por semana');
  assert.equal(board('backlog').items[0].status, 'feito');
  assert.match(T.feedback[0].reply, /Onde encontrar: Gráficos → por semana/);
  const again = await applyReleases(db, null, { releases });
  assert.equal(again.applied, 0);
  assert.equal(board('news').items.length, 1);
});

import fs from 'fs';
import { SCREENS, FLOWS, flowFunnel } from '../public/js/admin/flows.js';
test('fluxos: toda tela citada existe e tem imagem', () => {
  const used = new Set(FLOWS.flatMap(f => f.steps ? f.steps.map(s => s.s) : f.map.flatMap(g => g.screens)));
  for (const id of used) { assert.ok(SCREENS[id], 'sem definição: ' + id); assert.ok(fs.existsSync(new URL(`../public/flows/${id}.jpg`, import.meta.url)), 'sem imagem: ' + id); }
  assert.equal(new Set(FLOWS.map(f => f.id)).size, FLOWS.length);
});
test('fluxos: pessoas por etapa e queda desde a anterior', () => {
  const f = flowFunnel([{ s: 'lancar' }, { s: 'lancar_pdf' }, { s: 'alpha' }, { s: 'lancar_revisao' }], { 'aba.lancar': { users: 10 }, 'lancar.pdf': { users: 6 }, 'lancar.pdf_ok': { users: 3 } });
  assert.deepEqual(f.map(x => [x.users, x.drop]), [[10, null], [6, 40], [null, null], [3, 50]]);
});

import { buildSummary } from '../public/js/admin/summary.js';
test('resumo para o Claude: números, uso, opiniões e backlog, sem e-mails', () => {
  const t = buildSummary({
    metrics: { users: 5, users_7d: 2, families: 3, families_shared: 1, wau: 3, mau: 4, in_family: 5, families_1_month: 2, families_2_months: 1, families_closed: 0, d7_retained: 1, d7_eligible: 2, d30_retained: 0, d30_eligible: 0, imports_30d: 4, manual_30d: 9, receipts_30d: 1, push_devices: 2 },
    usage: { days: 30, people: [{ name: 'Mari Souza', email: 'mari@x.com', family: 'Família Souza', last_day: '2026-10-30', days: 4, feedbacks: 1, features: { 'aba.inicio': 9, 'lancar.salvar': 3 } }], features: { 'aba.lancar': { users: 3, n: 9 }, 'lancar.pdf': { users: 2, n: 2 }, 'lancar.pdf_ok': { users: 1, n: 1 } }, hours: [[1, 21, 5]] },
    feedback: [{ id: 7, kind: 'duvida', name: 'Mari Souza', email: 'mari@x.com', text: 'o que é a régua?', answer: 'É o preenchimento.', helpful: false, status: 'novo', screen: 'resumo', created_at: '2026-10-30T10:00:00Z' }],
    backlog: [{ id: 'semana', title: 'Gasto por semana', status: 'agora', from: [7, 8], effort: 'M' }], today: '2026-10-30',
  });
  assert.match(t, /Pessoas: 5/); assert.match(t, /Mari \(família Família Souza\)/); assert.match(t, /Lançamento|Salvou lançamento falado ou escrito 3×/);
  assert.match(t, /Importar fatura ou extrato: .*Abre Lançar 3 → .* 2 \(−33%\) → .* 1 \(−50%\)/);
  assert.match(t, /\[#7 Dúvida · Mari · 30\/10\/2026 · tela resumo/); assert.match(t, /NÃO resolveu/);
  assert.match(t, /semana: Gasto por semana · pedido por 2/); assert.match(t, /Horários de mais uso: 21h/);
  assert.ok(!t.includes('mari@x.com'));
});
test('fluxos: etapa sem medida própria não conta quem só abriu a tela', () => {
  const fat = FLOWS.find(f => f.id === 'fatura');
  const f = flowFunnel(fat.steps, { 'aba.inicio': { users: 2 }, 'aba.lancar': { users: 0 } });
  assert.equal(f.at(-1).users, null);
});
test('resumo para o Claude: navegação e erros', () => {
  const t = buildSummary({ nav: { screens: [{ s: 'inicio', views: 10, users: 2, seconds: 300 }, { s: 'menu.metas', views: 2, users: 1, seconds: 90 }], flows: [{ f: 'inicio', t: 'lancar', n: 4 }], targets: { inicio: [{ t: 'Enviar PDF', n: 5, users: 2 }] },
    errors: [{ kind: 'tela', message: 'Não foi possível salvar.', name: 'Mari Souza', email: 'm@x.com', screen: 'lancar', device: 'Android', version: 'v31', at: '2026-10-30T20:00:00Z' }] }, today: '2026-10-30' });
  assert.match(t, /Início: 10 visitas, 2 pessoas, 30s/); assert.match(t, /Menu: Metas: 2 visitas, 1 pessoas, 45s/);
  assert.match(t, /Início → Lançar: 4×/); assert.match(t, /Início → "Enviar PDF": 5×/);
  assert.match(t, /tela \| Não foi possível salvar\. → 1×, 1 pessoas \(Mari\); telas: Lançar; celulares: Android; versões: v31/);
  assert.ok(!t.includes('m@x.com'));
});
test('versão publicada pode trazer itens novos para o backlog, uma vez só', async () => {
  const T = { product_board: [{ key: 'backlog', data: { items: [{ id: 'x', title: 'X', status: 'ideia' }] } }], feedback: [], members: [], push_subscriptions: [] };
  const fetchImpl = async (url, o = {}) => { const u = new URL(url), table = u.pathname.split('/').pop(), q = Object.fromEntries(u.searchParams), m = o.method || 'GET';
    const json = d => ({ ok: true, status: 200, json: async () => d });
    if (m === 'GET') return json(T[table].filter(r => !q.key || 'eq.' + r.key === q.key));
    if (m === 'POST') { const b = JSON.parse(o.body), i = T[table].findIndex(r => r.key === b.key); if (i >= 0) T[table][i] = b; else T[table].push(b); return json([b]); } return json([]); };
  const db = rest('https://x.supabase.co', 'sb_secret_x', fetchImpl);
  const rel = [{ id: 'rz', at: '2026-10-30T00:00:00Z', backlog: [], addBacklog: [{ id: 'novo', title: 'Novo', status: 'proximo' }, { id: 'x', title: 'X repetido' }] }];
  await applyReleases(db, null, { releases: rel });
  const items = T.product_board.find(r => r.key === 'backlog').data.items;
  assert.deepEqual(items.map(i => i.id), ['novo', 'x']);
});
import quick from '../api/quick.js';
import crypto from 'crypto';
test('atalho do iPhone: o servidor confere o código, classifica e lança', async () => {
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_x';
  const code = 'abcdefghijklmnopqrstuvwxyz012345', hash = crypto.createHash('sha256').update(code).digest('hex'), inserted = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url), t = u.pathname.split('/').pop(), json = d => ({ ok: true, status: 200, json: async () => d });
    if (t === 'quick_tokens' && (o.method || 'GET') === 'GET') return json(u.searchParams.get('token_hash') === 'eq.' + hash ? [{ user_id: 'u1', household_id: 'h1', uses: 2 }] : []);
    if (t === 'households') return json([{ settings: { cardCloseDay: 24 } }]);
    if (t === 'rules') return json([{ source: 'cartao', kind: 'regex', pattern: 'padaria', category: 'Mercado', priority: 1 }]);
    if (t === 'transactions') { inserted.push(JSON.parse(o.body)); return json([]); }
    return json([]);
  };
  const call = async (auth, body) => { let status, out; await quick({ method: 'POST', headers: { authorization: auth }, body }, { setHeader() {}, status(s) { status = s; return this; }, json(j) { out = j; } }); return { status, out }; };
  try {
    let r = await call('Bearer ' + code, { valor: 'R$ 45,90', loja: 'PADARIA PAO QUENTE', cartao: 'Nubank' });
    assert.equal(r.status, 200); assert.match(r.out.mensagem, /Lançado no Pra Onde Foi: PADARIA PAO QUENTE, R\$\s?45,90 \(Mercado\)/);
    assert.equal(inserted[0].category, 'Mercado'); assert.equal(inserted[0].created_by, 'u1'); assert.equal(inserted[0].household_id, 'h1');
    r = await call('Bearer outrocodigoqualquer123456', { valor: '10' }); assert.equal(r.status, 401);
    r = await call('Bearer ' + code, { valor: 'abc' }); assert.equal(r.status, 400);
  } finally { globalThis.fetch = realFetch; }
});
test('Siri: frase falada vira lançamento, com o sinal certo e resposta em texto', async () => {
  process.env.ANTHROPIC_API_KEY = 'k';
  const code = 'abcdefghijklmnopqrstuvwxyz012345', hash = crypto.createHash('sha256').update(code).digest('hex'), inserted = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => {
    const json = d => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('anthropic')) return json({ content: [{ type: 'text', text: '{"itens":[{"descricao":"Padaria","valor":45,"sentido":"saida","data":"2026-10-30","meio":"conta","categoria":"Mercado"},{"descricao":"Uber","valor":"23,50","sentido":"saida","meio":"cartao","categoria":"Inexistente"}]}' }] });
    const u = new URL(url), t = u.pathname.split('/').pop();
    if (t === 'quick_tokens' && (o.method || 'GET') === 'GET') return json([{ user_id: 'u1', household_id: 'h1', uses: 0 }]);
    if (t === 'households') return json([{ name: 'Família Souza', settings: { cardCloseDay: 24 } }]);
    if (t === 'categories') return json([{ name: 'Mercado', grp: 'dia' }, { name: 'A classificar', grp: 'dia' }]);
    if (t === 'rules') return json([]);
    if (t === 'transactions') { inserted.push(...JSON.parse(o.body)); return json([]); }
    return json([]);
  };
  let status, text;
  try {
    await quick({ method: 'POST', url: '/api/quick?formato=texto', query: { formato: 'texto' }, headers: { authorization: 'Bearer ' + code }, body: { texto: '45 na padaria no pix e 23,50 de uber no cartão' } },
      { setHeader() {}, status(s) { status = s; return this; }, json() {}, send(t) { text = t; } });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(status, 200); assert.match(text, /^Lançado: Padaria, R\$\s?45,00; Uber, R\$\s?23,50 no cartão\.$/);
  assert.equal(inserted.length, 2); assert.equal(inserted[0].amount, -45); assert.equal(inserted[0].source, 'conta'); assert.equal(inserted[0].category, 'Mercado');
  assert.equal(inserted[1].amount, 23.5); assert.equal(inserted[1].source, 'cartao'); assert.equal(inserted[1].category, 'A classificar'); assert.equal(inserted[1].created_by, 'u1');
});

test('Compartilhar no iPhone: comprovante vira lançamento; fatura manda abrir o app; nada é guardado', async () => {
  process.env.ANTHROPIC_API_KEY = 'k';
  const code = 'abcdefghijklmnopqrstuvwxyz012345', inserted = [], sent = [];
  let answer = '';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, o = {}) => {
    const json = d => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('anthropic')) { sent.push(JSON.parse(o.body)); return json({ content: [{ type: 'text', text: answer }] }); }
    const t = new URL(url).pathname.split('/').pop();
    if (t === 'quick_tokens' && (o.method || 'GET') === 'GET') return json([{ user_id: 'u1', household_id: 'h1', uses: 0 }]);
    if (t === 'households') return json([{ name: 'Família Souza', settings: { cardCloseDay: 24 } }]);
    if (t === 'categories') return json([{ name: 'Casa', grp: 'dia' }]);
    if (t === 'transactions') { inserted.push(...JSON.parse(o.body)); return json([]); }
    return json([]);
  };
  const call = async body => { let status, text; await quick({ method: 'POST', url: '/api/quick?formato=texto', query: { formato: 'texto' }, headers: { authorization: 'Bearer ' + code }, body },
    { setHeader() {}, status(s) { status = s; return this; }, json() {}, send(t) { text = t; } }); return { status, text }; };
  const pdf = Buffer.from('%PDF-1.4 comprovante ficticio').toString('base64');
  try {
    answer = '{"tipo":"comprovante","itens":[{"descricao":"Pix para João Encanador","valor":180,"sentido":"saida","data":"2026-10-29","meio":"conta","categoria":"Casa"}]}';
    let r = await call({ arquivo: pdf });
    assert.equal(r.status, 200); assert.match(r.text, /^Lançado no Pra Onde Foi: Pix para João Encanador, R\$\s?180,00 \(Casa\)\.$/);
    assert.equal(inserted.length, 1); assert.equal(inserted[0].amount, -180); assert.equal(inserted[0].source, 'conta');
    assert.equal(sent[0].messages[0].content[0].type, 'document'); assert.equal(sent[0].messages[0].content[0].source.media_type, 'application/pdf');
    answer = '{"tipo":"fatura","itens":[]}';
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10, 0, 0]).toString('base64');
    r = await call({ arquivo: png });
    assert.match(r.text, /fatura do cartão\. Abra o app/); assert.equal(inserted.length, 1);
    assert.equal(sent[1].messages[0].content[0].type, 'image');
    r = await call({ arquivo: Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]).toString('base64') });
    assert.equal(r.status, 400); assert.match(r.text, /HEIC/); assert.equal(sent.length, 2);
  } finally { globalThis.fetch = realFetch; }
});
