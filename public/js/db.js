// Data access (Supabase). Row-level security in the database limits every query to the user's family.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export let sb = null;

export async function init() {
  const r = await fetch('/api/config');
  if (!r.ok) throw new Error('config');
  const cfg = await r.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('config_missing');
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return sb;
}

const must = ({ data, error }) => { if (error) throw error; return data; };

// Human message for a database or network error.
export function errorText(e) {
  const m = String(e?.message || e?.code || e || '');
  if (/could not find the function|does not exist|schema cache|PGRST20/i.test(m)) return 'O banco de dados precisa ser atualizado: rode de novo o arquivo schema.sql no Supabase.';
  if (/not_member/.test(m)) return 'Você não faz parte desta família.';
  if (/not_authenticated|JWT|jwt|401/.test(m)) return 'Sua sessão expirou. Saia e entre de novo.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com a internet. Tente de novo.';
  if (/duplicate|unique/i.test(m)) return 'Isso já existe.';
  return 'Algo deu errado (' + m.slice(0, 80) + '). Tente de novo.';
}

// Reads every row of a family's table, 1000 at a time.
async function all(table, hh, order = 'created_at') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await sb.from(table).select('*').eq('household_id', hh).order(order, { ascending: true }).range(from, from + 999));
    out.push(...rows); if (rows.length < 1000) break;
  }
  return out;
}

export async function myHouseholds(uid) {
  return must(await sb.from('members').select('household_id, role, display_name, households(id, name, settings)').eq('user_id', uid));
}
export const createHousehold = async (name, displayName) => must(await sb.rpc('create_household', { p_name: name, p_display_name: displayName || null }));
export const acceptInvite = async (code, displayName) => must(await sb.rpc('accept_invite', { p_code: code, p_display_name: displayName || null }));
export const createInvite = async (hh, name, relation, phone) => must(await sb.rpc('create_invite', { p_household: hh, p_name: name || null, p_relation: relation || null, p_phone: phone || null }));
export const listInvites = async hh => must(await sb.from('invites').select('code, invitee_name, relation, invitee_phone, created_at, expires_at, used_by').eq('household_id', hh).order('created_at', { ascending: false }));
export const updateMyMemberName = async (uid, name) => must(await sb.from('members').update({ display_name: name }).eq('user_id', uid));

export async function loadFamily(hh) {
  const [household, members, categories, rules, transactions, imports, studies] = await Promise.all([
    must(await sb.from('households').select('*').eq('id', hh).single()),
    must(await sb.from('members').select('user_id, role, display_name, relation, created_at').eq('household_id', hh)),
    all('categories', hh), all('rules', hh), all('transactions', hh), all('imports', hh), all('studies', hh),
  ]);
  return { household, members, categories, rules, transactions, imports, studies };
}
export const reloadTransactions = hh => all('transactions', hh);

export const saveSettings = async (hh, settings) => must(await sb.from('households').update({ settings }).eq('id', hh));
export const renameHousehold = async (hh, name) => must(await sb.from('households').update({ name }).eq('id', hh));

export const addTransactions = async rows => must(await sb.from('transactions').insert(rows).select());
export const updateTransaction = async (id, patch) => must(await sb.from('transactions').update(patch).eq('id', id));
export const deleteTransaction = async id => must(await sb.from('transactions').delete().eq('id', id));

export async function replaceMonth(hh, source, month, rows, reconcileIds, label, file, info) {
  return must(await sb.rpc('replace_month', { p_household: hh, p_source: source, p_month: month, p_rows: rows, p_reconcile: reconcileIds || [], p_label: label, p_file: file || null, p_info: info || {} }));
}
export const learnRule = async (hh, source, pattern, category) => must(await sb.rpc('learn_rule', { p_household: hh, p_source: source, p_pattern: pattern, p_category: category }));

export const addCategory = async (hh, c) => must(await sb.from('categories').insert({ household_id: hh, ...c }).select().single());
export const renameCategory = async (id, name) => must(await sb.rpc('rename_category', { p_id: id, p_name: name }));
export const updateCategory = async (id, patch) => must(await sb.from('categories').update(patch).eq('id', id));

export const addStudy = async (hh, question, answer) => must(await sb.from('studies').insert({ household_id: hh, question, answer }).select().single());
export const deleteStudy = async id => must(await sb.from('studies').delete().eq('id', id));

// Imports a backup made by exportBackup (or prepared by Claude). Existing data of the same months is kept;
// categories are merged by name, learned rules by pattern.
export async function importBackup(hh, b, onStep) {
  const cats = must(await sb.from('categories').select('name').eq('household_id', hh)).map(c => c.name);
  const newCats = (b.categories || []).filter(c => !cats.includes(c.name)).map(c => ({ household_id: hh, name: c.name, grp: c.grp, financing: !!c.financing }));
  if (newCats.length) must(await sb.from('categories').insert(newCats));
  onStep && onStep(`Categorias: ${newCats.length} novas`);
  const rules = (b.rules || []).map(r => ({ household_id: hh, source: r.source, kind: r.kind, pattern: r.pattern, category: r.category, min_abs: r.min_abs ?? null, max_abs: r.max_abs ?? null, priority: r.priority ?? 100 }));
  for (let i = 0; i < rules.length; i += 500) must(await sb.from('rules').upsert(rules.slice(i, i + 500), { onConflict: 'household_id,source,kind,pattern', ignoreDuplicates: false }));
  onStep && onStep(`Regras: ${rules.length}`);
  const tx = (b.transactions || []).map(t => ({ household_id: hh, source: t.source, month: t.month, date: t.date || null, day: t.day || null, description: t.description || '', amount: t.amount, category: t.category || null, installment: t.installment || null, card: t.card || null, manual: !!t.manual, pending: !!t.pending, splits: t.splits || null, receipt: t.receipt || null }));
  for (let i = 0; i < tx.length; i += 500) { must(await sb.from('transactions').insert(tx.slice(i, i + 500))); onStep && onStep(`Lançamentos: ${Math.min(i + 500, tx.length)} de ${tx.length}`); }
  if (b.household?.settings) must(await sb.from('households').update({ settings: b.household.settings }).eq('id', hh));
  must(await sb.from('imports').insert({ household_id: hh, source: 'backup', label: 'Importação de backup', info: { transactions: tx.length } }));
}

export async function exportBackup(hh, household) {
  const f = await loadFamily(hh);
  const strip = r => { const { id, household_id, created_by, created_at, import_id, ...rest } = r; return rest; };
  return { version: 1, exportedAt: new Date().toISOString(), household: { name: household.name, settings: household.settings }, categories: f.categories.map(strip), rules: f.rules.map(strip), transactions: f.transactions.map(strip), studies: f.studies.map(strip) };
}

// Deletes all of this family's data (owner only). The login account itself stays.
export const deleteHousehold = async hh => must(await sb.from('households').delete().eq('id', hh));
export const deleteMyAccount = async () => must(await sb.rpc('delete_my_account'));
export const leaveHousehold = async (hh, uid) => must(await sb.from('members').delete().eq('household_id', hh).eq('user_id', uid));
