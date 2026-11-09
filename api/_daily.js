// Daily push run: for each family with notifications on, compute the home insights and send at most
// one notification per device per day. Pure enough to test with a fake fetch (tests/push.test.mjs).
import { linkFor } from '../public/js/lib/links.js';
import { catIndex, monthCalc, byCategory, expandSplits, schedule, project } from '../public/js/lib/calc.js';
import { insights } from '../public/js/lib/insights.js';
import { budgetsOf } from '../public/js/lib/budget.js';
import { findRecurring } from '../public/js/lib/recurring.js';
import { addM } from '../public/js/lib/format.js';
import { feesOf } from '../public/js/lib/bankfees.js';
import { sendPush } from './_webpush.js';
import { forecast, sundayAsk } from '../public/js/lib/monthend.js';
import { pendingCash } from '../public/js/lib/cash.js';
import { findDups } from '../public/js/lib/dups.js';
import { privatize } from '../public/js/lib/privacy.js';
import { fundingPairs } from '../public/js/lib/funding.js';
import { weekly, reminderMessage } from '../public/js/lib/pushtexts.js';
export { weekly, reminderMessage };

// Which preference turns each message on, and how many days before the same message can repeat.
export const TYPES = { entrada_amortizacao: 'dados', repetidos: 'dados', saques: 'dados', juros: 'gastos', tarifas: 'gastos', fatura: 'dados', subs_up: 'gastos', budget: 'gastos', close: 'dados', missing: 'dados', ending: 'dados', pending: 'dados', red: 'gastos', high: 'gastos', card: 'gastos', fixed: 'gastos', below: 'gastos', saved: 'conquistas', low: 'conquistas', semanal: 'semanal' };
const REPEAT = { tarifas: 60, fatura: 20, missing: 7, pending: 7, close: 5, budget: 7, semanal: 6 };
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

// Today in Brazil (UTC-3), as AAAA-MM-DD, plus weekday (0 = Sunday).
export function brToday(now = Date.now()) { const d = new Date(now - 3 * 3600e3); return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() }; }


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
    fees: k => feesOf(of(k)), feesYear: () => feesOf(txs.filter(t => t.month > addM(today.slice(0, 7), -12))),
    manualCount: k => txs.filter(t => t.month === k && t.manual).length,
    pending: k => txs.filter(t => t.month === k && (t.pending || !t.category || t.category === 'A classificar')).length,
    fixedCats: [...idx.values()].filter(c => c.grp === 'dia' && c.recurring).map(c => c.name), closeDay: +st.cardCloseDay || 24,
    goals: g, nextFatura: nf, checkins: st.checkins || [], cashPending: pendingCash(txs, { today, skip: st.cashSkip || [] }), dups: (d => d.pairs.length + d.orphans.length)(findDups(txs, st.debts || [], st.dupSkip || [])), funding: fundingPairs(txs, idx, { skip: st.fundSkip || [] }), budgets: budgetsOf(st), recurring: findRecurring(txs, months, { idx }), toClose: (() => { const cur = today.slice(0, 7), cl = st.closed || {}; return months.filter(k => k < cur && !cl[k]).pop() || null; })(),
    etaYears: pmt => { if (!(pmt > 0) || !g.patrimonio) return null; const pts = project({ start: +st.invest?.total || 0, pmt, ret: g.ret ?? 0.05, years: 40 }); const i = pts.findIndex(v => v >= g.patrimonio); return i < 0 ? null : i; },
  }).map(x => ({ ...x, url: x.action ? linkFor('tela', { tab: x.action.go[0], sec: x.action.go[0] === 'lancar' && x.action.go[1] === '#drop' ? 'pdf' : x.action.go[2] }) : linkFor('tela', { tab: 'resumo' }) }));
}

// Pick the one message for a device today, or null.
export function pick(list, week, sub, today, dow) {
  const prefs = { dados: true, gastos: true, conquistas: true, semanal: true, ...(sub.prefs || {}) }, sent = sub.last_sent || {};
  const ok = x => prefs[TYPES[x.id]] !== false && !(sent[x.id] && days(today, sent[x.id]) < (REPEAT[x.id] || 25));
  const bill = list.find(x => x.id === 'fatura' && ok(x)); if (bill) return bill; // the monthly habit comes first
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
      const mrows = await get(`members?household_id=eq.${hh}&select=user_id,display_name`), members = new Set(mrows.map(m => m.user_id));
      const firstOf = uid => String(mrows.find(m => m.user_id === uid)?.display_name || '').trim().split(/\s+/)[0];
      for (const s of list.filter(s => !members.has(s.user_id))) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: H }); out.removed++; }
      list.splice(0, list.length, ...list.filter(s => members.has(s.user_id)));
      if (!list.length) continue;
      const categories = await get(`categories?household_id=eq.${hh}&select=name,grp,financing,recurring`);
      let txs = [];
      for (let off = 0; ; off += 1000) {
        const page = await get(`transactions?household_id=eq.${hh}&month=gte.${from}&select=id,source,month,date,day,description,note,amount,category,installment,manual,pending,splits,private_to&order=id&limit=1000&offset=${off}`);
        txs = txs.concat(page.map(t => ({ ...t, amount: +t.amount }))); if (page.length < 1000) break;
      }
      txs = privatize(txs, catIndex(categories), []); // "só meu" entries count as totals; their details never go into a push
      out.families++;
      const ins = familyInsights({ household, categories, txs }, today), week = weekly(txs, catIndex(categories), today);
      for (const sub of list) {
        const msg = pick(ins, week, sub, today, dow);
        if (!msg) { out.skipped++; continue; }
        const nm = firstOf(sub.user_id), title = msg.id === 'fatura' && nm ? `${nm}, a fatura do cartão fechou` : msg.title;
        const r = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, { title, body: msg.text.slice(0, 220), url: msg.url, tag: msg.id }, vapid, fetchImpl).catch(() => ({ ok: false }));
        if (r.gone) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers: H }); out.removed++; continue; }
        if (!r.ok) { out.errors++; continue; }
        out.sent++;
        await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_sent: { ...(sub.last_sent || {}), [msg.id]: today } }) });
      }
    } catch (e) { out.errors++; }
  }
  return out;
}

export async function runReminder({ supabaseUrl, serviceKey, vapid, fetchImpl = fetch, now = Date.now() }) {
  const H = { apikey: serviceKey, 'content-type': 'application/json', ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const get = async path => { const r = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`supabase ${r.status} ${path.split('?')[0]}`); return r.json(); };
  const { iso: today } = brToday(now), start = new Date(Date.parse(today + 'T03:00:00Z')).toISOString();
  const subs = (await get('push_subscriptions?select=*')).filter(s => s.prefs?.lembrete !== false && (s.last_sent || {}).lembrete !== today);
  const out = { sent: 0, skipped: 0, removed: 0, errors: 0 };
  const did = new Map(), names = new Map(), empties = new Map();
  for (const s of subs) {
    try {
      const k = s.user_id + '|' + s.household_id;
      if (!did.has(k)) did.set(k, (await get(`transactions?household_id=eq.${s.household_id}&created_by=eq.${s.user_id}&created_at=gte.${encodeURIComponent(start)}&select=id&limit=1`)).length > 0);
      if (did.get(k)) { out.skipped++; continue; }
      // A family with nothing yet gets the first step instead: send the card statement.
      if (!empties.has(s.household_id)) empties.set(s.household_id, (await get(`transactions?household_id=eq.${s.household_id}&select=id&limit=1`)).length === 0);
      if (!names.has(s.user_id)) names.set(s.user_id, (await get(`members?user_id=eq.${s.user_id}&select=display_name&limit=1`))[0]?.display_name || '');
      const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, reminderMessage(names.get(s.user_id), { empty: empties.get(s.household_id) }), vapid, fetchImpl).catch(() => ({ ok: false }));
      if (r.gone) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: H }); out.removed++; continue; }
      if (!r.ok) { out.errors++; continue; }
      out.sent++;
      await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_sent: { ...(s.last_sent || {}), lembrete: today } }) });
    } catch (e) { out.errors++; }
  }
  return out;
}

// Sunday 19h in Brazil: the month forecast and the ask for the open card bill (one number from the bank app).
// At most once a week per device; after two asks in a row with no answer, every other week (sundayAsk).
export async function runForecastAsk({ supabaseUrl, serviceKey, vapid, fetchImpl = fetch, now = Date.now() }) {
  const H = { apikey: serviceKey, 'content-type': 'application/json', ...(serviceKey.startsWith('sb_') ? {} : { authorization: `Bearer ${serviceKey}` }) };
  const get = async path => { const r = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`supabase ${r.status} ${path.split('?')[0]}`); return r.json(); };
  const { iso: today } = brToday(now), from = addM(today.slice(0, 7), -5);
  const subs = (await get('push_subscriptions?select=*')).filter(s => s.prefs?.previsao !== false);
  const byHh = {}; for (const s of subs) (byHh[s.household_id] ||= []).push(s);
  const out = { families: 0, sent: 0, skipped: 0, removed: 0, errors: 0 };
  for (const [hh, list] of Object.entries(byHh)) {
    try {
      const [household] = await get(`households?id=eq.${hh}&select=id,name,settings`);
      if (!household) continue;
      const mrows = await get(`members?household_id=eq.${hh}&select=user_id,display_name`);
      const categories = await get(`categories?household_id=eq.${hh}&select=name,grp,financing,recurring`);
      let txs = [];
      for (let off = 0; ; off += 1000) {
        const page = await get(`transactions?household_id=eq.${hh}&month=gte.${from}&select=id,source,month,date,day,description,note,amount,category,installment,manual,pending,splits,private_to&order=id&limit=1000&offset=${off}`);
        txs = txs.concat(page.map(t => ({ ...t, amount: +t.amount }))); if (page.length < 1000) break;
      }
      txs = privatize(txs, catIndex(categories), mrows);
      const st = household.settings || {}, f = forecast({ txs, categories, settings: st, today });
      if (!f) { out.skipped += list.length; continue; }
      out.families++;
      for (const sub of list) {
        if (!mrows.some(m => m.user_id === sub.user_id)) { out.skipped++; continue; }
        const ask = sundayAsk(f, { name: mrows.find(m => m.user_id === sub.user_id)?.display_name, sent: sub.last_sent || {}, checkins: st.checkins, today });
        if (!ask) { out.skipped++; continue; }
        const r = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, { ...ask.msg, url: linkFor('tela', { tab: 'resumo', sec: 'previsao' }) }, vapid, fetchImpl).catch(() => ({ ok: false }));
        if (r.gone) { await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers: H }); out.removed++; continue; }
        if (!r.ok) { out.errors++; continue; }
        out.sent++;
        await fetchImpl(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ last_sent: { ...(sub.last_sent || {}), previsao: today, previsao_miss: ask.miss } }) });
      }
    } catch (e) { out.errors++; }
  }
  return out;
}
