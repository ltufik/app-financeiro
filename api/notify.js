// Real-time family notices: tells the OTHER members when someone joins, imports a statement or closes a month.
// Body: { household, type: 'joined'|'imported'|'closed', source?, month? }. Env: SUPABASE_*, VAPID_*.
import { cleanUrl } from './config.js';
import { sendPush } from './_webpush.js';
import { vapidFromEnv } from './push-cron.js';

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => /^\d{4}-\d{2}$/.test(k || '') ? MES[+k.slice(5) - 1] : 'mês';

export function message({ type, name, family, source, month }) {
  if (type === 'joined') return { title: `${name} entrou na família`, body: `Agora vocês veem os mesmos números da ${family}.`, url: '/?tab=resumo', tag: 'familia-joined' };
  if (type === 'imported') return { title: `${name} importou ${source === 'cartao' ? 'a fatura' : 'o extrato'} de ${mName(month)}`, body: 'A sobra do mês já está atualizada.', url: '/?tab=resumo', tag: 'familia-imported' };
  if (type === 'closed') return { title: `${name} fechou ${mName(month)}`, body: 'Veja a retrospectiva do mês.', url: '/?tab=fechar', tag: 'familia-closed' };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const URL_ = cleanUrl(process.env.SUPABASE_URL), ANON = String(process.env.SUPABASE_ANON_KEY || '').trim(), SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(), vapid = vapidFromEnv();
  if (!URL_ || !ANON || !SERVICE || !vapid.publicKey || !vapid.privateKey) return res.status(503).json({ error: 'not_configured' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const u = token && await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } });
  if (!u || !u.ok) return res.status(401).json({ error: 'not_signed_in' });
  const me = await u.json();
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!/^[0-9a-f-]{36}$/i.test(b.household || '') || !['joined', 'imported', 'closed'].includes(b.type)) return res.status(400).json({ error: 'bad_request' });
  const H = { apikey: SERVICE, ...(SERVICE.startsWith('sb_') ? {} : { authorization: `Bearer ${SERVICE}` }) };
  const get = async p => { const r = await fetch(`${URL_}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error('db'); return r.json(); };
  try {
    const members = await get(`members?household_id=eq.${b.household}&select=user_id,display_name`);
    const self = members.find(m => m.user_id === me.id); if (!self) return res.status(403).json({ error: 'not_member' });
    const [hh] = await get(`households?id=eq.${b.household}&select=name`);
    const msg = message({ type: b.type, name: (self.display_name || 'Alguém').split(' ')[0], family: hh?.name || 'família', source: b.source, month: b.month });
    const subs = (await get(`push_subscriptions?household_id=eq.${b.household}&user_id=neq.${me.id}&select=id,endpoint,p256dh,auth,prefs`)).filter(s => s.prefs?.familia !== false);
    let sent = 0;
    for (const s of subs) {
      const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg, vapid).catch(() => ({ ok: false }));
      if (r.gone) await fetch(`${URL_}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: H });
      if (r.ok) sent++;
    }
    res.status(200).json({ sent });
  } catch (e) { res.status(500).json({ error: 'failed' }); }
}
