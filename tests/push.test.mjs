// Web Push: encryption/signature round trip (as a browser would decrypt) and the daily run with a fake backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encrypt, vapidAuth, generateVapidKeys, b64u, unb64u, sendPush } from '../api/_webpush.js';
import { runDaily, pick, weekly, brToday } from '../api/_daily.js';
import { catIndex } from '../public/js/lib/calc.js';

const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
// A browser-side subscription (keys) and its decryption, per RFC 8291.
function browser() {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
  return {
    sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } },
    decrypt(body) {
      const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
      const ikm = hkdf(auth, ua.computeSecret(asPub), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub]), 32);
      const d = crypto.createDecipheriv('aes-128-gcm', hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
      d.setAuthTag(ct.subarray(ct.length - 16));
      const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
      assert.equal(rs, 4096); assert.equal(pt[pt.length - 1], 2);
      return JSON.parse(pt.subarray(0, pt.length - 1).toString());
    },
  };
}
const vapid = { ...generateVapidKeys(), subject: 'https://app-praondefoi.vercel.app' };
function verifyVapid(header, endpoint) {
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  const [h, c, s] = t.split('.'), pub = unb64u(k);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), { key, dsaEncoding: 'ieee-p1363' }, unb64u(s)));
  const claims = JSON.parse(unb64u(c)); assert.equal(claims.aud, new URL(endpoint).origin); assert.ok(claims.exp > Date.now() / 1000);
  assert.equal(k, vapid.publicKey);
}

test('web push: mensagem criptografada abre no navegador e a assinatura VAPID confere', () => {
  const b = browser();
  assert.deepEqual(b.decrypt(encrypt(JSON.stringify({ title: 'Oi', body: 'ç ã 🎉' }), b.sub.keys)), { title: 'Oi', body: 'ç ã 🎉' });
  verifyVapid(vapidAuth(b.sub.endpoint, vapid), b.sub.endpoint);
  assert.equal(unb64u(vapid.publicKey).length, 65); assert.equal(unb64u(vapid.privateKey).length, 32);
});

test('web push: envio usa os cabeçalhos certos e detecta aparelho que saiu', async () => {
  const b = browser(); let req;
  const r = await sendPush(b.sub, { title: 'x' }, vapid, async (url, o) => { req = { url, ...o }; return { status: 201 }; });
  assert.ok(r.ok); assert.equal(req.headers['content-encoding'], 'aes128gcm'); assert.equal(req.headers.ttl, '86400');
  assert.equal((await sendPush(b.sub, { title: 'x' }, vapid, async () => ({ status: 410 }))).gone, true);
});

test('avisos do dia: escolhe um por aparelho, respeita preferências e não repete', async () => {
  const today = '2026-11-15';
  const list = [{ id: 'red', tone: 'bad', title: 'a', text: 'a' }, { id: 'saved', tone: 'good', title: 'b', text: 'b' }];
  const week = { id: 'semanal', title: 's', text: 's' };
  assert.equal(pick(list, week, {}, today, 3).id, 'red');
  assert.equal(pick(list, week, { prefs: { gastos: false } }, today, 3).id, 'saved');
  assert.equal(pick(list, week, { prefs: { gastos: false } }, today, 0).id, 'semanal');
  assert.equal(pick(list, week, { last_sent: { red: '2026-11-01' } }, today, 3).id, 'saved');
  assert.equal(pick(list, week, { last_sent: { red: '2026-10-01' } }, today, 3).id, 'red');
  assert.equal(pick([], week, { prefs: { semanal: false } }, today, 0), null);
  assert.deepEqual(brToday(Date.parse('2026-11-16T02:00:00Z')), { iso: '2026-11-15', dow: 0 });
  const w = weekly([{ source: 'cartao', date: '2026-11-14', amount: 120, category: 'Mercado' }, { source: 'conta', date: '2026-11-13', amount: -80, category: 'Lazer' }, { source: 'conta', date: '2026-11-01', amount: -999, category: 'Lazer' }], catIndex([{ name: 'Mercado', grp: 'dia' }, { name: 'Lazer', grp: 'dia' }]), today);
  assert.match(w.text, /R\$ 200 em despesas\. Maiores: Mercado R\$ 120, Lazer R\$ 80/);
});

test('rotina diária: lê o banco, manda o aviso certo, marca o envio e remove aparelho que saiu', async () => {
  const b1 = browser(), b2 = browser(), pushes = [], patches = [], deletes = [];
  const db = {
    push_subscriptions: [
      { id: 's1', user_id: 'u1', household_id: 'h1', endpoint: b1.sub.endpoint, p256dh: b1.sub.keys.p256dh, auth: b1.sub.keys.auth, prefs: {}, last_sent: {} },
      { id: 's2', user_id: 'u1', household_id: 'h1', endpoint: 'https://web.push.apple.com/gone', p256dh: b2.sub.keys.p256dh, auth: b2.sub.keys.auth, prefs: {}, last_sent: {} },
      { id: 's3', user_id: 'u9', household_id: 'h1', endpoint: 'https://fcm.googleapis.com/fcm/send/left', p256dh: b1.sub.keys.p256dh, auth: b1.sub.keys.auth, prefs: {}, last_sent: {} },
    ],
    members: [{ user_id: 'u1' }],
    households: [{ id: 'h1', name: 'Família Teste', settings: { goals: { savings: 0.2 } } }],
    categories: [{ name: 'Salário', grp: 'renda' }, { name: 'Mercado', grp: 'dia' }],
    transactions: [
      { source: 'conta', month: '2026-10', date: '2026-10-05', amount: '5000', category: 'Salário', manual: false },
      { source: 'conta', month: '2026-10', date: '2026-10-06', amount: '-6200', category: 'Mercado', manual: false },
    ],
  };
  const fake = async (url, o = {}) => {
    const u = new URL(url);
    if (u.hostname.endsWith('push.apple.com')) return { status: 410 };
    if (u.hostname === 'fcm.googleapis.com') { pushes.push(b1.decrypt(o.body)); verifyVapid(o.headers.authorization, url); return { status: 201 }; }
    assert.equal(o.headers.apikey, 'sb_secret_x'); assert.equal(o.headers.authorization, undefined);
    const table = u.pathname.split('/').pop();
    if (o.method === 'PATCH') { patches.push([u.search, JSON.parse(o.body)]); return { ok: true, status: 204 }; }
    if (o.method === 'DELETE') { deletes.push(u.search); return { ok: true, status: 204 }; }
    const off = +(u.searchParams.get('offset') || 0);
    return { ok: true, status: 200, json: async () => table === 'transactions' ? db.transactions.slice(off, off + 1000) : db[table] };
  };
  const out = await runDaily({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'sb_secret_x', vapid, fetchImpl: fake, now: Date.parse('2026-11-15T15:00:00Z') });
  assert.deepEqual(out, { families: 1, sent: 1, skipped: 0, removed: 2, errors: 0 });
  assert.equal(pushes.length, 1); assert.match(pushes[0].title, /vermelho/); assert.equal(pushes[0].url, '/?tab=perguntar');
  assert.deepEqual(patches, [['?id=eq.s1', { last_sent: { red: '2026-11-15' } }]]);
  assert.deepEqual(deletes.sort(), ['?id=eq.s2', '?id=eq.s3']);
});

test('avisos da família: textos de entrou, importou e fechou', async () => {
  const { message } = await import('../api/notify.js');
  assert.equal(message({ type: 'joined', name: 'Luana', family: 'Família Elias' }).title, 'Luana entrou na família');
  assert.equal(message({ type: 'imported', name: 'Luana', source: 'cartao', month: '2026-10' }).title, 'Luana importou a fatura de outubro');
  assert.equal(message({ type: 'imported', name: 'Luiz', source: 'conta', month: '2026-09' }).title, 'Luiz importou o extrato de setembro');
  assert.equal(message({ type: 'closed', name: 'Luiz', month: '2026-09' }).url, '/?tab=fechar');
  assert.equal(message({ type: 'x' }), null);
});

import { runReminder, reminderMessage } from '../api/_daily.js';
test('lembrete das 21h: só para quem não lançou nada hoje, uma vez por dia', async () => {
  const sent = [], patched = [], k = browser().sub.keys;
  const subs = [{ id: 1, user_id: 'a', household_id: 'h', endpoint: 'https://push.example/a', p256dh: k.p256dh, auth: k.auth, prefs: {}, last_sent: {} },
    { id: 2, user_id: 'b', household_id: 'h', endpoint: 'https://push.example/b', p256dh: 'x', auth: 'y', prefs: {}, last_sent: {} },
    { id: 3, user_id: 'c', household_id: 'h', endpoint: 'https://push.example/c', p256dh: 'x', auth: 'y', prefs: { lembrete: false }, last_sent: {} },
    { id: 4, user_id: 'd', household_id: 'h', endpoint: 'https://push.example/d', p256dh: 'x', auth: 'y', prefs: {}, last_sent: { lembrete: '2026-10-30' } }];
  const fetchImpl = async (url, o = {}) => {
    const u = new URL(url), t = u.pathname.split('/').pop(), json = d => ({ ok: true, status: 201, json: async () => d });
    if (u.hostname === 'push.example') { sent.push(u.pathname); return { ok: true, status: 201 }; }
    if (t === 'push_subscriptions' && (o.method || 'GET') === 'GET') return json(subs);
    if (t === 'push_subscriptions') { patched.push(JSON.parse(o.body)); return json([]); }
    if (t === 'transactions') return json(u.searchParams.get('created_by') === 'eq.b' ? [{ id: 9 }] : []);
    if (t === 'members') return json([{ display_name: 'Mari Souza' }]);
    return json([]);
  };
  const { publicKey, privateKey } = generateVapidKeys();
  const out = await runReminder({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'sb_secret_x', vapid: { publicKey, privateKey, subject: 'https://paraondefoi.app.br' }, fetchImpl, now: Date.parse('2026-10-31T00:05:00Z') });
  assert.deepEqual(out, { sent: 1, skipped: 1, removed: 0, errors: 0 });
  assert.deepEqual(sent, ['/a']); assert.equal(patched[0].last_sent.lembrete, '2026-10-30');
  assert.equal(reminderMessage('Mari Souza').title, 'Mari, gastou algo hoje no pix ou em dinheiro?');
  assert.equal(reminderMessage('').title, 'Gastou algo hoje no pix ou em dinheiro?');
});
