// In-memory stand-in for @supabase/supabase-js, used only by the browser tests.
// It mimics the calls the app makes; access rules are tested separately against Postgres (tests/db).
const T = { households: [], members: [], invites: [], categories: [], transactions: [], rules: [], imports: [], studies: [] };
window.__db = T;
let session = null; const listeners = [];
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
  then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
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

const DEFAULT_CATS = [['Salário', 'renda'], ['Reembolsos', 'entrada'], ['Outras entradas', 'entrada'], ['Mercado', 'dia'], ['Restaurantes e delivery', 'dia'], ['Saúde', 'dia'], ['A classificar', 'dia'], ['Financiamento imobiliário', 'dia', true], ['Pagamento da fatura do cartão', 'neutro']];
const rpcs = {
  create_household({ p_name, p_display_name }) {
    const h = { id: uid(), name: p_name, settings: { goals: { cardMonthly: 0, savings: 0.2, savingsNoFin: 0.3, patrimonio: 0 }, cardCloseDay: 24 }, created_by: session.user.id, created_at: now() };
    T.households.push(h); T.members.push({ household_id: h.id, user_id: session.user.id, role: 'owner', display_name: p_display_name, created_at: now() });
    DEFAULT_CATS.forEach(([name, grp, fin]) => T.categories.push({ id: uid(), household_id: h.id, name, grp, financing: !!fin, created_at: now() }));
    return h.id;
  },
  create_invite({ p_household }) { const c = 'ABC12345'; T.invites.push({ code: c, household_id: p_household }); return c; },
  accept_invite({ p_code }) { const i = T.invites.find(x => x.code === p_code); if (!i) throw new Error('invite_not_found'); T.members.push({ household_id: i.household_id, user_id: session.user.id, role: 'member' }); return i.household_id; },
  replace_month({ p_household, p_source, p_month, p_rows, p_reconcile, p_label, p_file, p_info }) {
    const imp = uid(); T.imports.push({ id: imp, household_id: p_household, source: p_source, month: p_month, label: p_label, file_name: p_file, info: p_info, created_at: now() });
    T.transactions = T.transactions.filter(t => !(t.household_id === p_household && t.source === p_source && t.month === p_month && !t.manual) && !(t.manual && (p_reconcile || []).includes(t.id)));
    p_rows.forEach(r => T.transactions.push({ id: uid(), household_id: p_household, source: p_source, month: p_month, date: r.date || null, day: r.day, description: r.description, amount: r.amount, category: r.category, installment: r.installment, card: r.card, manual: false, pending: !!r.pending, import_id: imp, created_at: now() }));
    window.__lastReplace = { p_source, p_month, n: p_rows.length, reconcile: p_reconcile }; return imp;
  },
  learn_rule({ p_household, p_source, p_pattern, p_category }) { const r = T.rules.find(x => x.household_id === p_household && x.kind === 'exact' && x.source === p_source && x.pattern === p_pattern); if (r) r.category = p_category; else T.rules.push({ id: uid(), household_id: p_household, source: p_source, kind: 'exact', pattern: p_pattern, category: p_category, priority: 10 }); window.__learned = (window.__learned || 0) + 1; return null; },
};

export function createClient() {
  const emit = ev => listeners.forEach(f => f(ev, session));
  return {
    from: t => new Q(t),
    rpc: async (name, args) => { try { return { data: rpcs[name](args), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; } },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
      signUp: async ({ email, options }) => { session = { access_token: 'tok', user: { id: uid(), email, user_metadata: options?.data || {} } }; setTimeout(() => emit('SIGNED_IN')); return { data: { session }, error: null }; },
      signInWithPassword: async ({ email }) => { session = { access_token: 'tok', user: { id: uid(), email, user_metadata: {} } }; setTimeout(() => emit('SIGNED_IN')); return { data: { session }, error: null }; },
      signOut: async () => { session = null; emit('SIGNED_OUT'); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
  };
}
