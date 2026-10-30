// In-memory stand-in for @supabase/supabase-js, used only by the browser tests.
// It mimics the calls the app makes; access rules are tested separately against Postgres (tests/db).
// State survives page reloads (like a real backend) so invite links can be tested across sessions.
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const T = load('mock.db', { users: [], households: [], members: [], invites: [], categories: [], transactions: [], rules: [], imports: [], studies: [], push_subscriptions: [] });
T.push_subscriptions ||= [];
window.__db = T;
let session = load('mock.session', null); const listeners = [];
const persist = () => { localStorage.setItem('mock.db', JSON.stringify(T)); localStorage.setItem('mock.session', JSON.stringify(session)); };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const clone = x => JSON.parse(JSON.stringify(x));

class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.ret = false; this.one = false; this.rng = null; this.cols = '*'; }
  select(c) { if (this.op === 'select') this.cols = c || '*'; else this.ret = true; return this; }
  eq(k, v) { this.f.push(r => r[k] === v); return this; }
  order() { return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  single() { this.one = true; return this; }
  insert(rows) { this.op = 'insert'; this.p = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows) { this.op = 'upsert'; this.p = Array.isArray(rows) ? rows : [rows]; return this; }
  update(p) { this.op = 'update'; this.p = p; return this; }
  delete() { this.op = 'delete'; return this; }
  then(res, rej) { return Promise.resolve().then(() => { const r = this.run(); if (this.op !== 'select') persist(); return r; }).then(res, rej); }
  run() {
    const tb = T[this.t], match = r => this.f.every(f => f(r));
    const base = { created_at: now(), created_by: session?.user.id };
    if (this.op === 'insert') {
      const out = this.p.map(r => ({ id: uid(), ...base, ...clone(r) }));
      if (this.t === 'categories' && out.some(r => tb.some(x => x.household_id === r.household_id && x.name === r.name))) return { data: null, error: { message: 'duplicate' } };
      tb.push(...out); return { data: this.one ? out[0] : (this.ret ? out : null), error: null };
    }
    if (this.op === 'upsert') {
      for (const r of this.p) { const i = tb.findIndex(x => x.household_id === r.household_id && x.source === r.source && x.kind === r.kind && x.pattern === r.pattern); if (i >= 0) Object.assign(tb[i], r); else tb.push({ id: uid(), ...base, ...r }); }
      return { data: null, error: null };
    }
    if (this.op === 'update') { tb.filter(match).forEach(r => Object.assign(r, clone(this.p))); return { data: null, error: null }; }
    if (this.op === 'delete') {
      const keep = tb.filter(r => !match(r)); const removed = tb.length - keep.length; tb.length = 0; tb.push(...keep);
      if (this.t === 'households' && removed) for (const k of Object.keys(T)) if (k !== 'households') T[k] = T[k].filter(r => T.households.some(h => h.id === r.household_id));
      return { data: null, error: null };
    }
    let rows = tb.filter(match);
    if (this.t === 'members' && /households\(/.test(this.cols)) rows = rows.map(r => ({ ...r, households: T.households.find(h => h.id === r.household_id) }));
    rows = clone(rows);
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    return { data: this.one ? rows[0] : rows, error: null };
  }
}

const DEFAULT_CATS = [['Salário', 'renda'], ['Reembolsos', 'entrada'], ['Outras entradas', 'entrada'], ['Mercado', 'dia'], ['Restaurantes e delivery', 'dia'], ['Saúde', 'dia'], ['A classificar', 'dia'], ['Financiamento imobiliário', 'dia', true, true], ['Assinaturas', 'dia', false, true], ['Pagamento da fatura do cartão', 'neutro']];
const rpcs = {
  save_push({ p_household, p_endpoint, p_p256dh, p_auth, p_prefs }) {
    T.push_subscriptions = T.push_subscriptions.filter(s => s.endpoint !== p_endpoint);
    T.push_subscriptions.push({ id: uid(), household_id: p_household, user_id: session.user.id, endpoint: p_endpoint, p256dh: p_p256dh, auth: p_auth, prefs: p_prefs || {}, last_sent: {} }); return null;
  },
  delete_push({ p_endpoint }) { T.push_subscriptions = T.push_subscriptions.filter(s => s.endpoint !== p_endpoint); return null; },
  rename_category({ p_id, p_name }) {
    const c = T.categories.find(x => x.id === p_id); if (!c) throw new Error('not_member');
    if (T.categories.some(x => x.household_id === c.household_id && x.id !== p_id && x.name.toLowerCase() === p_name.toLowerCase())) throw new Error('duplicate');
    const old = c.name; c.name = p_name;
    T.transactions.forEach(t => { if (t.household_id !== c.household_id) return; if (t.category === old) t.category = p_name; (t.splits || []).forEach(x => { if (x.category === old) x.category = p_name; }); });
    T.rules.forEach(r => { if (r.household_id === c.household_id && r.category === old) r.category = p_name; });
    setTimeout(persist); return null;
  },
  create_household({ p_name, p_display_name }) {
    const h = { id: uid(), name: p_name, settings: { goals: { cardMonthly: 0, savings: 0.2, savingsNoFin: 0.3, patrimonio: 0 }, cardCloseDay: 24 }, created_by: session.user.id, created_at: now() };
    T.households.push(h); T.members.push({ household_id: h.id, user_id: session.user.id, role: 'owner', display_name: p_display_name, created_at: now() });
    DEFAULT_CATS.forEach(([name, grp, fin, rec]) => T.categories.push({ id: uid(), household_id: h.id, name, grp, financing: !!fin, recurring: !!rec, created_at: now() }));
    return h.id;
  },
  create_invite({ p_household, p_name, p_relation }) { const c = 'INV' + Math.random().toString(36).slice(2, 7).toUpperCase(); T.invites.push({ code: c, household_id: p_household, created_by: session.user.id, invitee_name: p_name, relation: p_relation, created_at: now(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used_by: null }); return c; },
  invite_info({ p_code }) { const i = T.invites.find(x => x.code === p_code); if (!i) return null; const h = T.households.find(x => x.id === i.household_id); return { family: h?.name, inviter: T.members.find(m => m.household_id === i.household_id && m.user_id === i.created_by)?.display_name, invitee: i.invitee_name, relation: i.relation, status: i.used_by ? 'used' : 'ok' }; },
  accept_invite({ p_code, p_display_name }) { const i = T.invites.find(x => x.code === p_code); if (!i) throw new Error('invite_not_found'); if (i.used_by) throw new Error('invite_used'); T.members.push({ household_id: i.household_id, user_id: session.user.id, role: 'member', display_name: p_display_name || i.invitee_name, relation: i.relation, created_at: now() }); i.used_by = session.user.id; return i.household_id; },
  replace_month({ p_household, p_source, p_month, p_rows, p_reconcile, p_label, p_file, p_info }) {
    const imp = uid(); T.imports.push({ id: imp, household_id: p_household, source: p_source, month: p_month, label: p_label, file_name: p_file, info: p_info, created_at: now() });
    T.transactions = T.transactions.filter(t => !(t.household_id === p_household && t.source === p_source && t.month === p_month && !t.manual) && !(t.manual && (p_reconcile || []).includes(t.id)));
    p_rows.forEach(r => T.transactions.push({ id: uid(), household_id: p_household, source: p_source, month: p_month, date: r.date || null, day: r.day, description: r.description, amount: r.amount, category: r.category, installment: r.installment, card: r.card, manual: false, pending: !!r.pending, import_id: imp, created_at: now() }));
    window.__lastReplace = { p_source, p_month, n: p_rows.length, reconcile: p_reconcile }; return imp;
  },
  delete_my_account() { setTimeout(persist);  const me = session.user.id; const mine = T.members.filter(m => m.user_id === me).map(m => m.household_id); for (const h of mine) if (!T.members.some(m => m.household_id === h && m.user_id !== me)) { T.households = T.households.filter(x => x.id !== h); for (const k of Object.keys(T)) if (k !== 'households') T[k] = T[k].filter(r => r.household_id !== h); } T.members = T.members.filter(m => m.user_id !== me); window.__deletedAccount = me; return null; },
  learn_rule({ p_household, p_source, p_pattern, p_category }) { const r = T.rules.find(x => x.household_id === p_household && x.kind === 'exact' && x.source === p_source && x.pattern === p_pattern); if (r) r.category = p_category; else T.rules.push({ id: uid(), household_id: p_household, source: p_source, kind: 'exact', pattern: p_pattern, category: p_category, priority: 10 }); window.__learned = (window.__learned || 0) + 1; return null; },
};

export function createClient() {
  const emit = ev => listeners.forEach(f => f(ev, session));
  return {
    from: t => new Q(t),
    rpc: async (name, args) => { try { const d = rpcs[name](args); persist(); return { data: d, error: null }; } catch (e) { return { data: null, error: { message: e.message } }; } },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
      signUp: async ({ email, options }) => { const u = { id: uid(), email, user_metadata: options?.data || {} }; T.users.push(u); session = { access_token: 'tok', user: u }; window.__redirect = options?.emailRedirectTo; persist(); setTimeout(() => emit('SIGNED_IN')); return { data: { session }, error: null }; },
      signInWithPassword: async ({ email }) => { const u = T.users.find(x => x.email === email); if (!u) return { data: {}, error: { message: 'Invalid login credentials' } }; session = { access_token: 'tok', user: u }; persist(); setTimeout(() => emit('SIGNED_IN')); return { data: { session }, error: null }; },
      signOut: async () => { session = null; persist(); emit('SIGNED_OUT'); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async ({ data } = {}) => { if (session && data) { session.user.user_metadata = { ...session.user.user_metadata, ...data }; const u = T.users.find(x => x.id === session.user.id); if (u) u.user_metadata = session.user.user_metadata; persist(); } return { data: { user: session?.user }, error: null }; },
    },
  };
}
