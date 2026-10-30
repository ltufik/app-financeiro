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
