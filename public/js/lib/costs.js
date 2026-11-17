// Revisão de custos: phone and internet, streaming and music, apps and services that come back every month (found
// by findRecurring), with how much each went up since the oldest month on record; and the insurance notice (what the
// family pays in insurance in a year and whether they ever used it). Pure; tested in tests/lib.test.mjs.
import { findRecurring, merchant } from './recurring.js';
import { expandSplits } from './calc.js';

const plain = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const addM = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const r2 = v => Math.round(v * 100) / 100;

export const COST_GROUPS = [
  { id: 'telefone', label: 'Celular, internet e TV' },
  { id: 'streaming', label: 'Streaming e música' },
  { id: 'apps', label: 'Apps e serviços' },
];
// Brand -> [display name, group]. The first match wins, so the more specific names come first (LinkedIn before Google).
const BRANDS = [
  [/LINKED/, 'LinkedIn', 'apps'], [/SERASA/, 'Serasa', 'apps'], [/CHATGPT|OPENAI/, 'ChatGPT', 'apps'], [/CLAUDE|ANTHROPIC/, 'Claude', 'apps'],
  [/ICLOUD|APPLE ?COM ?BILL|APPLE ?SERVICES/, 'Apple (iCloud e apps)', 'apps'], [/MICROSOFT|OFFICE ?365|XBOX/, 'Microsoft', 'apps'], [/ADOBE/, 'Adobe', 'apps'],
  [/DROPBOX/, 'Dropbox', 'apps'], [/CANVA/, 'Canva', 'apps'], [/NOTION/, 'Notion', 'apps'], [/GAMMA/, 'Gamma App', 'apps'], [/UBER ?ONE/, 'Uber One', 'apps'],
  [/IFOOD ?CLUB|CLUBE ?IFOOD/, 'Clube iFood', 'apps'], [/YOUTUBE/, 'YouTube Premium', 'streaming'], [/GOOGLE ?ONE|GOOGLE/, 'Google', 'apps'],
  [/NETFLIX/, 'Netflix', 'streaming'], [/SPOTIFY/, 'Spotify', 'streaming'], [/DEEZER/, 'Deezer', 'streaming'], [/AMAZON ?PRIME|AMAZONPRIME|PRIME ?VIDEO/, 'Amazon Prime', 'streaming'],
  [/DISNEY/, 'Disney+', 'streaming'], [/HBO|\bMAX\b/, 'Max', 'streaming'], [/GLOBOPLAY|GLOBO ?PLAY/, 'Globoplay', 'streaming'], [/PARAMOUNT/, 'Paramount+', 'streaming'],
  [/MELIMAIS|MELI ?\+|MELI ?MAIS/, 'Meli+', 'streaming'], [/CRUNCHYROLL/, 'Crunchyroll', 'streaming'], [/APPLE ?TV/, 'Apple TV+', 'streaming'], [/TWITCH/, 'Twitch', 'streaming'],
  [/\bVIVO\b|TELEFONICA/, 'Vivo', 'telefone'], [/\bCLARO\b|\bNET ?SERV|\bNET ?COMBO/, 'Claro', 'telefone'], [/\bTIM\b/, 'TIM', 'telefone'], [/\bOI\b|OI ?FIBRA/, 'Oi', 'telefone'],
  [/\bSKY\b/, 'Sky', 'telefone'], [/NEXTEL/, 'Nextel', 'telefone'], [/ALGAR/, 'Algar', 'telefone'], [/DESKTOP ?SA|BRISANET|UNIFIQUE|LIGGA|VERO ?INTERNET/, 'Internet', 'telefone'],
];
export const brandOf = name => { const p = plain(name); for (const [re, label, group] of BRANDS) if (re.test(p)) return { label, group }; return null; };

/*
  costsReview({ txs, idx, months, settings, today }) -> {
    items: [{ key, name, group, last, year, first, firstMonth, risePct, rise, current, status }], groups: [{id,label,items}],
    total (per month, current ones), year, risen: [...], stopped: [...], savings: { year, items }, due: [...] }
  first/firstMonth: the oldest month in the last 12 with a charge from the same merchant; risePct: last/first - 1 (from 5%).
  status from settings.costs.items[key]: 'manter' | 'rever' | 'cancelei'. due: "Vou rever" 7 days ago or more.
*/
export function costsReview({ txs = [], idx = new Map(), months, settings = {}, today }) {
  // Months with a statement or bill (a month with only typed entries would make every subscription look stopped).
  const ms = months || [...new Set(txs.filter(t => !t.manual).map(t => t.month))].sort(), saved = (settings.costs || {}).items || {};
  // "Still charging" is judged against the latest bill of the same kind: a card subscription is not stopped because
  // the account statement of a newer month arrived first (and the other way around).
  const latest = {}, srcOf = new Map();
  // Each card (and the account) on its own: another bank's bill of a newer month says nothing about this card.
  const where = t => `${t.source}|${t.card || ''}`;
  for (const t of txs) if (!t.manual) { const w = where(t); if (!latest[w] || t.month > latest[w]) latest[w] = t.month; const k = merchant(t.description); if (!srcOf.has(k) || t.month > srcOf.get(k).month) srcOf.set(k, { w, month: t.month }); }
  const found = findRecurring(txs, ms, { idx }).map(r => ({ ...r, brand: brandOf(r.name), current: r.lastMonth >= (latest[srcOf.get(r.name)?.w] || ms[ms.length - 1]) })).filter(r => r.brand);
  const from = addM(today.slice(0, 7), -12), hist = new Map();
  for (const t of expandSplits(txs)) {
    if (t.month < from || t.installment) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!(v > 0)) continue;
    // By brand, not by the exact text: banks change the description over the year ("VIVO FIXO" -> "CONTA VIVO").
    const c = idx.get(t.category); if (c && !['dia', 'fora'].includes(c.grp)) continue;
    const br = brandOf(merchant(t.description)); if (!br || !found.some(f => f.brand.label === br.label)) continue;
    const m = hist.get(br.label) || new Map(); m.set(t.month, (m.get(t.month) || 0) + v); hist.set(br.label, m);
  }
  // One line per brand (two cards paying Spotify are still Spotify).
  const byBrand = new Map();
  for (const f of found) {
    const h = hist.get(f.brand.label) || new Map(), ks = [...h.keys()].sort(), firstMonth = ks[0] || f.lastMonth, first = h.get(firstMonth) || f.last;
    const cur = byBrand.get(f.brand.label);
    if (cur) { cur.last = r2(cur.last + f.last); cur.current = cur.current || f.current; cur.keys.push(f.name); continue; }
    byBrand.set(f.brand.label, { key: f.brand.label, name: f.brand.label, group: f.brand.group, last: f.last, first: r2(first), firstMonth, lastMonth: f.lastMonth, current: f.current, keys: [f.name], history: ks.map(k => ({ month: k, value: r2(h.get(k)) })) });
  }
  const items = [...byBrand.values()].map(x => {
    const risePct = x.first > 0 && x.last > x.first * 1.05 && x.last - x.first >= 3 ? Math.round((x.last / x.first - 1) * 100) : 0;
    const st = saved[x.key] || null;
    return { ...x, year: r2(x.last * 12), risePct, rise: risePct ? r2(x.last - x.first) : 0, status: st?.status || null, statusAt: st?.at || null };
  }).sort((a, b) => b.last - a.last);
  const live = items.filter(x => x.current && x.status !== 'cancelei');
  const total = r2(live.reduce((a, x) => a + x.last, 0));
  const cancelled = items.filter(x => x.status === 'cancelei' || (!x.current && x.status !== 'manter'));
  const savingsItems = items.filter(x => x.status === 'cancelei').map(x => ({ ...x, confirmed: !x.current, perYear: r2((saved[x.key]?.value || x.last) * 12) }));
  const dueDay = new Date(Date.parse(today + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  return {
    items, total, year: r2(total * 12), count: live.length,
    groups: COST_GROUPS.map(g => ({ ...g, items: items.filter(x => x.group === g.id && x.current && x.status !== 'cancelei') })).filter(g => g.items.length),
    risen: live.filter(x => x.risePct > 0 && x.status !== 'manter'),
    stopped: items.filter(x => !x.current && !x.status),
    savings: { year: r2(savingsItems.reduce((a, x) => a + x.perYear, 0)), items: savingsItems },
    due: items.filter(x => x.status === 'rever' && x.statusAt && x.statusAt <= dueDay),
    cancelled,
  };
}

// The Início card: only when something is worth a look (a price went up, a charge stopped, a "Vou rever" is due).
// name: first name of whoever is looking. Returns {title, text, action} or null.
export function costsNotice(c, name = '') {
  if (!c || !c.items.length) return null;
  const n = String(name || '').trim().split(/\s+/)[0], hi = n ? n + ', ' : '';
  const R0 = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  const sum = c.count ? `Juntas, as ${c.count} contas e assinaturas de vocês custam ${R0(c.total)} por mês, ${R0(c.year)} no ano.` : '';
  if (c.due.length) { const d = c.due[0]; return { title: `${hi}vocês iam rever ${d.name === 'Internet' ? 'a internet' : (d.group === 'telefone' ? 'a ' : 'o ') + d.name}`, text: `Faz uma semana. ${d.name} veio ${R0(d.last)} no último mês, ${R0(d.year)} no ano. Conseguiram baixar?`, action: 'Ver a revisão de custos' }; }
  if (c.risen.length) { const u = c.risen[0], mo = MONTHS[+u.firstMonth.slice(5, 7) - 1]; return { title: `${hi}${u.name === 'Internet' ? 'a internet' : 'a conta ' + (u.group === 'telefone' ? 'da ' : 'do ') + u.name} subiu ${u.risePct}%`, text: `Era ${R0(u.first)} em ${mo} e veio ${R0(u.last)} no último mês: ${R0(u.rise * 12)} a mais no ano. ${sum}`, action: 'Rever as assinaturas' }; }
  if (c.stopped.length) { const s = c.stopped[0]; return { title: `${hi}${s.name} não veio no último mês`, text: `Se vocês cancelaram, são ${R0(s.last * 12)} a menos no ano. ${sum}`.trim(), action: 'Rever as assinaturas' }; }
  return null;
}
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ---------- Insurance ----------
const INSURERS = [
  [/PRUDENT/, 'Prudential'], [/BRADESCO ?AUT/, 'Bradesco Auto'], [/BRADESCO ?SEG/, 'Bradesco Seguros'], [/PORTO ?SEG|PORTOSEG|PORTO ?SEGURO/, 'Porto Seguro'],
  [/SULAMERICA|SUL ?AMERICA/, 'SulAmérica'], [/ALLIANZ ?SEG/, 'Allianz'], [/MAPFRE/, 'Mapfre'], [/TOKIO/, 'Tokio Marine'], [/LIBERTY|YELUM/, 'Yelum (Liberty)'],
  [/\bHDI\b/, 'HDI'], [/AZUL ?SEG/, 'Azul Seguros'], [/SUHAI/, 'Suhai'], [/ZURICH/, 'Zurich'], [/ITAU ?SEG/, 'Itaú Seguros'], [/CAIXA ?SEG|CAIXA ?RESID/, 'Caixa Seguradora'],
  [/YOUSE/, 'Youse'], [/METLIFE/, 'MetLife'], [/ICATU/, 'Icatu'], [/MAG ?SEG|MONGERAL/, 'MAG Seguros'], [/ZS ?SEG/, 'ZS Seguros'], [/PIER/, 'Pier'], [/CIELO ?SEG|BB ?SEG|BRASILSEG/, 'Brasilseg'],
];
export const INSURANCE_TYPES = { vida: 'Vida', carro: 'Carro', moto: 'Moto', casa: 'Casa', saude: 'Saúde', outro: 'Outro' };
export function insuranceType(desc) {
  const p = plain(desc);
  if (/RESID|CASA|LAR\b|HABITAC/.test(p)) return 'casa';
  if (/MOTO|SUHAI/.test(p)) return 'moto';
  if (/AUTO|AUT\b|AUT ?\d|CARRO|VEIC|AZUL ?SEG|YOUSE/.test(p)) return 'carro';
  if (/VIDA|PRUDENT|METLIFE|ICATU|MAG ?SEG|MONGERAL|APOL/.test(p)) return 'vida';
  if (/SAUDE|DENTAL|ODONTO/.test(p)) return 'saude';
  return 'outro';
}
const insurerOf = desc => { const p = plain(desc); for (const [re, label] of INSURERS) if (re.test(p)) return label; const m = merchant(desc).split(' ').slice(0, 2).join(' '); return m ? m[0] + m.slice(1).toLowerCase() : 'Seguro'; };
export const isInsuranceCat = c => /segur/i.test(plain(c));

/*
  insuranceSummary({ txs, idx, settings, today }) -> { items: [{ key, name, type, paid, months, firstMonth, lastMonth, current }],
    paid (in the window), from, to, monthsCovered, year (estimate), inFinancing (per month, informed), yearWithFinancing, used }
  Window: the last 12 months. The yearly estimate divides what was paid by the months that have statements in the window.
*/
export function insuranceSummary({ txs = [], settings = {}, today, debts = [] }) {
  const from = addM(today.slice(0, 7), -12), ins = settings.insurance || {}, types = ins.types || {};
  const win = txs.filter(t => t.month >= from && t.month <= today.slice(0, 7));
  const covered = [...new Set(win.filter(t => !t.manual).map(t => t.month))].sort();
  const lastCovered = covered[covered.length - 1] || null, by = new Map();
  for (const t of expandSplits(win)) {
    if (!isInsuranceCat(t.category)) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!(v > 0)) continue;
    const name = insurerOf(t.description), key = name;
    const x = by.get(key) || { key, name, type: types[key] || insuranceType(t.description), paid: 0, ms: new Set(), policies: new Set() };
    x.paid += v; x.ms.add(t.month); x.policies.add(merchant(t.description)); by.set(key, x);
  }
  const items = [...by.values()].map(x => { const ms = [...x.ms].sort(); return { key: x.key, name: x.name, type: x.type, typeLabel: INSURANCE_TYPES[x.type], paid: r2(x.paid), months: ms.length, firstMonth: ms[0], lastMonth: ms[ms.length - 1], current: ms[ms.length - 1] === lastCovered, policies: x.policies.size }; }).sort((a, b) => b.paid - a.paid);
  const paid = r2(items.reduce((a, x) => a + x.paid, 0)), n = covered.length;
  const fin = Object.entries(ins.financing || {}).filter(([id]) => !debts.length || debts.some(d => d.id === id)).reduce((a, [, v]) => a + (+v || 0), 0);
  const year = n ? Math.round(paid / n * 12) : 0;
  return { items, paid, from: covered[0] || null, to: lastCovered, monthsCovered: n, year, inFinancing: r2(fin), yearWithFinancing: Math.round(year + fin * 12), used: ins.used || null, usedAt: ins.usedAt || null, seenAt: ins.seenAt || null };
}

// The yearly insurance notice on Início: once a year (seenAt), when there is insurance in the statements.
export function insuranceNotice(s, name = '', today) {
  if (!s || !s.items.length || s.year < 300) return null;
  if (s.seenAt && Date.parse(today) - Date.parse(s.seenAt) < 330 * 864e5) return null;
  const n = String(name || '').trim().split(/\s+/)[0], hi = n ? n + ', ' : '', R0 = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  return { title: `${hi}vocês pagam uns ${R0(s.yearWithFinancing)} por ano em seguros`, text: `São ${s.items.length} ${s.items.length > 1 ? 'seguros' : 'seguro'} no extrato e na fatura, ${R0(s.paid)} nos últimos ${s.monthsCovered} meses. Já usaram algum? Muitos têm assistência que já está paga.`, action: 'Ver os seguros' };
}
