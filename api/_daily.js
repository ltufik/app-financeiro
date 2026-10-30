// Daily push run: for each family with notifications on, compute the home insights and send at most
// one notification per device per day. Pure enough to test with a fake fetch (tests/push.test.mjs).
import { catIndex, monthCalc, byCategory, expandSplits, schedule, project } from '../public/js/lib/calc.js';
import { insights } from '../public/js/lib/insights.js';
import { addM } from '../public/js/lib/format.js';
import { sendPush } from './_webpush.js';

// Which preference turns each message on, and how many days before the same message can repeat.
export const TYPES = { missing: 'dados', ending: 'dados', pending: 'dados', red: 'gastos', high: 'gastos', card: 'gastos', fixed: 'gastos', below: 'gastos', saved: 'conquistas', low: 'conquistas', semanal: 'semanal' };
const REPEAT = { missing: 7, pending: 7, semanal: 6 };
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

// Today in Brazil (UTC-3), as AAAA-MM-DD, plus weekday (0 = Sunday).
export function brToday(now = Date.now()) { const d = new Date(now - 3 * 3600e3); return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() }; }

export function weekly(txs, idx, today) {
  const recent = expandSplits(txs).filter(t => t.date && days(today, t.date) >= 0 && days(today, t.date) < 7);
  const by = {};
  for (const t of recent) { const c = idx.get(t.category); if (c && c.grp !== 'dia') continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v > 0) by[t.category || 'A classificar'] = (by[t.category || 'A classificar'] || 0) + v; }
  const total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (!total) return { id: 'semanal', title: 'Resumo da semana', text: 'Nenhuma despesa lançada nos últimos 7 dias. Lembre de lançar os gastos do pix e do dinheiro.', url: '/?tab=lancar' };
  return { id: 'semanal', title: 'Resumo da semana', text: `Nos últimos 7 dias saíram ${R(total)} em despesas. Maiores: ${top.map(e => `${e[0]} ${R(e[1])}`).join(', ')}.`, url: '/?tab=resumo' };
}

// Family's insights, built the same way as the home screen.
export function familyInsights({ household, categories, txs }, today) {
  const idx = catIndex(categories), st = household.settings || {}, g = { cardMonthly: 0, savings: 0.2, patrimonio: 0, ret: 0.05, ...(st.goals || {}) };
  const of = k => txs.filter(t => t.month === k), months = [...new Set(txs.map(t => t.month))].sort();
  const cards = [...new Set(txs.filter(t => t.source === 'cartao' && !t.manual).map(t => t.month))].sort(), L = cards[cards.length - 1];
  const rec = (st.recurring || []).reduce((a, r) => a + (+r[1] || 0), 0);
  const nf = L ? (() => { const open = addM(L, 1); const man = txs.filter(t => t.manual && t.month === open && t.source === 'cartao').reduce((a, t) => a + +t.amount, 0); return { month: open, total: schedule(of(L).filter(t => t.source === 'cartao'), 12)[0] + rec + man }; })() : null;
  return insights({
    today, months, calc: k => monthCalc(of(k), idx), cats: k => byCategory(of(k), idx),
    fixed: k => expandSplits(of(k)).reduce((a, t) => { const c = idx.get(t.category); return c && c.grp === 'dia' && c.recurring ? a + (t.source === 'conta' ? -t.amount : +t.amount) : a; }, 0),
    has: (k, src) => txs.some(t => t.month === k && t.source === src && !t.manual),
    manualCount: k => txs.filter(t => t.month === k && t.manual).length,
    pending: k => txs.filter(t => t.month === k && (t.pending || !t.category || t.category === 'A classificar')).length,
    goals: g, nextFatura: nf,
    etaYears: pmt => { if (!(pmt > 0) || !g.patrimonio) return null; const pts = project({ start: +st.invest?.total || 0, pmt, ret: g.ret ?? 0.05, years: 40 }); const i = pts.findIndex(v => v >= g.patrimonio); return i < 0 ? null : i; },
  }).map(x => ({ ...x, url: x.action ? '/?tab=' + x.action.go[0] : '/?tab=resumo' }));
}

// Pick the one message for a device today, or null.
export function pick(list, week, sub, today, dow) {
  const prefs = { dados: true, gastos: true, conquistas: true, semanal: true, ...(sub.prefs || {}) }, sent = sub.last_sent || {};
  const ok = x => prefs[TYPES[x.id]] !== false && !(sent[x.id] && days(today, sent[x.id]) < (REPEAT[x.id] || 25));
  const urgent = list.find(x => (x.tone === 'bad' || x.tone === 'warn') && ok(x));
  if (urgent) return urgent;
  if (dow === 0 && week && ok(week)) return week;
  return list.find(x => ok(x)) || null;
}

export async function runDaily({ supabaseUrl, serviceKey, vapid, fetchImpl = fetch, now = Date.now() }) {
  const H = { apikey: serviceKey, 'content-type': 'application/json', ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const get = async path => { const r = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`supabase ${r.status} ${path.split('?')[0]}`); return r.json(); };
  const { iso: today, dow } = brToday(now), from = addM(today.slice(0, 7), -13);
  const subs = await get('push_subscriptions?select=*');
  const byHh = {}; for (const s of subs) (byHh[s.household_id] ||= []).push(s);
  const out = { families: 0, sent: 0, skipped: 0, removed: 0, errors: 0 };
  for (const [hh, list] of Object.entries(byHh)) {
    try {
      const [household] = await get(`households?id=eq.${hh}&select=id,name,settings`);
      if (!household) continue;
      // Someone who left the family stops getting its notices.
      const members = new Set((await get(`members?household_id=eq.${hh}&select=user_id`)).map(m => m.user_id));
      for (const s of list.filter(s => !members.has(s.user_id))) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: H }); out.removed++; }
      list.splice(0, list.length, ...list.filter(s => members.has(s.user_id)));
      if (!list.length) continue;
      const categories = await get(`categories?household_id=eq.${hh}&select=name,grp,financing,recurring`);
      let txs = [];
      for (let off = 0; ; off += 1000) {
        const page = await get(`transactions?household_id=eq.${hh}&month=gte.${from}&select=source,month,date,day,description,amount,category,installment,manual,pending,splits&order=id&limit=1000&offset=${off}`);
        txs = txs.concat(page.map(t => ({ ...t, amount: +t.amount }))); if (page.length < 1000) break;
      }
      out.families++;
      const ins = familyInsights({ household, categories, txs }, today), week = weekly(txs, catIndex(categories), today);
      for (const sub of list) {
        const msg = pick(ins, week, sub, today, dow);
        if (!msg) { out.skipped++; continue; }
        const r = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, { title: msg.title, body: msg.text.slice(0, 220), url: msg.url, tag: msg.id }, vapid, fetchImpl).catch(() => ({ ok: false }));
        if (r.gone) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers: H }); out.removed++; continue; }
        if (!r.ok) { out.errors++; continue; }
        out.sent++;
        await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_sent: { ...(sub.last_sent || {}), [msg.id]: today } }) });
      }
    } catch (e) { out.errors++; }
  }
  return out;
}
