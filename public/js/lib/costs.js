// Revisão de custos: phone and internet, streaming and music, apps and services that come back every month (found
// by findRecurring), with how much each went up since the oldest month on record; and the insurance notice (what the
// family pays in insurance in a year and whether they ever used it). Pure; tested in tests/lib.test.mjs.
import { findRecurring, merchant } from './recurring.js';
import { expandSplits } from './calc.js';
import { guessAssetType } from './annual.js';

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
  const all = findRecurring(txs, ms, { idx }), cs = settings.costs || {}, providers = cs.providers || {};
  const found = all.map(r => ({ ...r, brand: brandOf(r.name), current: r.lastMonth >= (latest[srcOf.get(r.name)?.w] || ms[ms.length - 1]) })).filter(r => r.brand && r.brand.group !== 'telefone');
  const from = addM(today.slice(0, 7), -12), hist = new Map(), cnt = new Map();
  for (const t of expandSplits(txs)) {
    if (t.month < from || t.installment) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!(v > 0)) continue;
    // By brand, not by the exact text: banks change the description over the year ("VIVO FIXO" -> "CONTA VIVO").
    const c = idx.get(t.category); if (c && !['dia', 'fora'].includes(c.grp)) continue;
    const br = brandOf(merchant(t.description)); if (!br || !found.some(f => f.brand.label === br.label)) continue;
    const m = hist.get(br.label) || new Map(); m.set(t.month, (m.get(t.month) || 0) + v); hist.set(br.label, m);
    const n = cnt.get(br.label) || new Map(); n.set(t.month, (n.get(t.month) || 0) + 1); cnt.set(br.label, n);
  }
  // One line per brand (two cards paying Spotify are still Spotify). Phone, internet and TV are split into lines below.
  const byBrand = new Map();
  for (const f of found) {
    const h = hist.get(f.brand.label) || new Map(), ks = [...h.keys()].sort(), firstMonth = ks[0] || f.lastMonth, first = h.get(firstMonth) || f.last;
    const cur = byBrand.get(f.brand.label);
    if (cur) { cur.last = r2(cur.last + f.last); cur.current = cur.current || f.current; cur.keys.push(f.name); continue; }
    const counts = [...(cnt.get(f.brand.label) || new Map()).values()], oneLine = counts.length > 0 && counts.every(c => c === 1);
    byBrand.set(f.brand.label, { oneLine, key: f.brand.label, name: f.brand.label, title: f.brand.label, group: f.brand.group, last: f.last, first: r2(first), firstMonth, lastMonth: f.lastMonth, current: f.current, keys: [f.name], history: ks.map(k => ({ month: k, value: r2(h.get(k)) })) });
  }
  // Phone, internet and TV: one item per line (two Vivo bills are two lines; account -> card is the same line).
  const lines = telecomLines({ txs, idx, settings }), lastData = ms[ms.length - 1] || today.slice(0, 7), recent = addM(lastData, -6);
  const perBrand = lines.reduce((m, L) => m.set(L.brand, (m.get(L.brand) || 0) + 1), new Map());
  for (const L of lines) {
    if (L.lastMonth < recent) continue;
    const h = L.points.filter(p => p.month >= from), first = h[0] || L.points[0];
    byBrand.set(L.key, { oneLine: true, key: L.key, name: L.brand, title: lineTitle(L, perBrand.get(L.brand) > 1), group: 'telefone', line: true, last: L.last, first: first.value, firstMonth: first.month, lastMonth: L.lastMonth,
      startMonth: L.startMonth, current: L.current, keys: [L.key], history: h, house: L.house, services: L.services, payChange: L.payChange, extras: L.extras, min: L.min, max: L.max, brandKey: perBrand.get(L.brand) === 1 ? L.brand : null });
  }
  if (cs.celular?.status === 'informado' && +cs.celular.value > 0) {
    const v = r2(+cs.celular.value);
    byBrand.set('manual:celular', { oneLine: false, key: 'manual:celular', name: cs.celular.brand || 'Celular', title: `${cs.celular.brand || 'Celular'} · celular`, group: 'telefone', line: true, manual: true, last: v, first: v, firstMonth: lastData, lastMonth: lastData,
      startMonth: lastData, current: true, keys: [], history: [], house: cs.celular.house || null, services: ['celular'], payChange: null, extras: [] });
  }
  const items = [...byBrand.values()].map(x => {
    const risePct = !x.manual && x.oneLine && x.keys.length <= 1 && x.first > 0 && x.last > x.first * 1.05 && x.last - x.first >= 3 ? Math.round((x.last / x.first - 1) * 100) : 0;
    // A line decision is kept by its own key; the old one (by brand) still counts while the brand has a single line.
    const st = saved[x.key] || (x.brandKey && saved[x.brandKey]) || null;
    // "Pagamos de outro jeito": the bill left the statements but is still a cost.
    const elsewhere = st?.status === 'fora';
    return { ...x, current: x.current || elsewhere, elsewhere, year: r2(x.last * 12), risePct, rise: risePct ? r2(x.last - x.first) : 0, status: st?.status || null, statusAt: st?.at || null };
  }).sort((a, b) => b.last - a.last);
  const gone = s => s === 'cancelei' || s === 'trocou';
  const live = items.filter(x => x.current && !gone(x.status));
  const total = r2(live.reduce((a, x) => a + x.last, 0));
  const cancelled = items.filter(x => gone(x.status) || (!x.current && x.status !== 'manter'));
  const savingsItems = items.filter(x => x.status === 'cancelei').map(x => ({ ...x, confirmed: !x.current, perYear: r2((saved[x.key]?.value || x.last) * 12) }));
  const dueDay = new Date(Date.parse(today + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  const telecom = telecomSummary(items, settings);
  const out = {
    items, total, year: r2(total * 12), count: live.length,
    groups: COST_GROUPS.map(g => ({ ...g, items: items.filter(x => x.group === g.id && x.current && !gone(x.status)) })).filter(g => g.items.length),
    risen: live.filter(x => x.risePct > 0 && x.status !== 'manter'),
    // Phone and internet lines that stopped are asked about (contextQuestions), not listed here.
    stopped: items.filter(x => !x.current && !x.status && x.group !== 'telefone'),
    savings: { year: r2(savingsItems.reduce((a, x) => a + x.perYear, 0)), items: savingsItems },
    due: items.filter(x => x.status === 'rever' && x.statusAt && x.statusAt <= dueDay),
    cancelled, telecom,
  };
  out.questions = contextQuestions({ c: out, all, txs, settings });
  return out;
}

// ---------- Contas de casa: phone, internet and TV, split into lines, with the family's context ----------
export const SERVICES = { internet: 'Internet', tv: 'TV', celular: 'Celular', fixo: 'Fixo' };
const SERVICE_WORDS = { internet: 'internet', tv: 'TV', celular: 'celular', fixo: 'fixo' };
export const servicesText = sv => { const w = (sv || []).map(k => SERVICE_WORDS[k]).filter(Boolean); return w.length > 1 ? w.slice(0, -1).join(', ') + ' e ' + w[w.length - 1] : (w[0] || ''); };
// Words that say a monthly charge is not phone or internet (asked about only when it could be a small provider).
const NOT_TELECOM = /CONDOMIN|ALUGUEL|ESCOLA|COLEGIO|FACULD|CURSO|ENEL|SABESP|COMGAS|ENERGIA|\bLUZ\b|\bAGUA\b|SANEP|COPEL|CEMIG|LIGHT|CPFL|CELESC|\bGAS\b|IPTU|IPVA|SEGUR|ACADEMIA|SMART ?FIT|SAUDE|UNIMED|AMIL|ODONTO|PREVID|CONSORC|FINANC|EMPREST|PARCELA|DIARISTA|FAXINA|ESTACION|MENSALID|IGREJA|DIZIMO|DOAC|PIX|TRANSF|TED\b|DOC\b|SALARIO|FARMAC|DROGA|MERCADO|SUPERMERC|POSTO/;
const where = t => `${t.source}|${t.card || ''}`;
const pretty = k => String(k || '').split(' ').slice(0, 2).map(w => w ? w[0] + w.slice(1).toLowerCase() : '').join(' ').trim();
const telBrand = (desc, providers) => { const k = merchant(desc), p = providers[k]; if (p) return { label: p.name, group: 'telefone', services: p.services || [] }; const b = brandOf(k); return b && b.group === 'telefone' ? b : null; };

// The family's houses: the properties in Patrimônio plus the ones named in the questions (settings.costs.houses).
export function houseList(settings = {}) {
  const fromAssets = (settings.assets || []).filter(a => a?.name && (a.tipo || guessAssetType(a.name)) === 'imovel' && !/terreno|sala|loja/i.test(a.name)).map(a => String(a.name).trim());
  return [...new Set([...fromAssets, ...(((settings.costs || {}).houses) || [])])];
}
export const houseName = h => (!h || h === 'principal') ? 'Onde vocês moram' : h;
const lineTitle = (L, many) => { const sv = servicesText(L.services); return sv ? `${L.brand} · ${sv}` : many ? `${L.brand} · R$ ${Math.round(L.last)}` : L.brand; };

/*
  telecomLines({ txs, idx, settings }) -> [{ key, brand, points: [{month, value, source}], startMonth, lastMonth, first, last, min, max,
    current, payChange: {month, from, to} | null, extras: [{month, value}], house, services, fresh }]
  Every phone, internet and TV charge (by brand, also the small providers the family named), month by month: each charge goes
  to the line of the same brand with the closest value (up to 45% away; 20% for a line seen once), one charge per line per month.
  A line seen in a single month that is not the latest bill of its kind is an extra charge (a Pix to pay a late bill, a fee).
  The source can change (account -> card): it is still the same line. key = brand@first month, so the family's answers stick.
*/
export function telecomLines({ txs = [], idx = new Map(), settings = {} }) {
  const cs = settings.costs || {}, providers = cs.providers || {}, ctx = cs.lines || {}, latest = {}, byBrand = new Map();
  for (const t of txs) if (!t.manual) { const w = where(t); if (!latest[w] || t.month > latest[w]) latest[w] = t.month; }
  for (const t of expandSplits(txs)) {
    if (t.installment) continue;
    const v = t.source === 'conta' ? -t.amount : +t.amount; if (!(v > 0)) continue;
    const c = idx.get(t.category); if (c && !['dia', 'fora'].includes(c.grp)) continue;
    const b = telBrand(t.description, providers); if (!b) continue;
    const e = byBrand.get(b.label) || { brand: b.label, services: b.services || null, months: new Map() };
    const arr = e.months.get(t.month) || []; arr.push({ value: r2(v), w: where(t), source: t.source }); e.months.set(t.month, arr); byBrand.set(b.label, e);
  }
  const out = [];
  for (const { brand, services: provSv, months } of byBrand.values()) {
    const lines = [];
    let prevMo = null;
    for (const mo of [...months.keys()].sort()) {
      const used = new Set(), chs = months.get(mo).sort((a, b) => b.value - a.value), before = lines.filter(L => L.points.some(p => p.month === prevMo));
      for (const ch of chs) {
        let best = null, bd = Infinity;
        for (const L of lines) { if (used.has(L)) continue; const d = Math.abs(ch.value - L.ref) / L.ref, tol = L.points.length > 1 ? 0.45 : 0.2; if (d <= tol && d < bd) { best = L; bd = d; } }
        // Same number of bills as last month and one of them still free: it is that bill with a new price.
        if (!best && chs.length === before.length) best = before.find(L => !used.has(L)) || null;
        if (!best) { best = { points: [], ref: ch.value }; lines.push(best); }
        best.points.push({ month: mo, ...ch }); best.ref = ch.value; used.add(best);
      }
      prevMo = mo;
    }
    const extras = [];
    const real = lines.filter(L => { const p = L.points; if (p.length > 1 || p[0].month >= (latest[p[0].w] || p[0].month)) return true; extras.push({ month: p[0].month, value: p[0].value }); return false; });
    for (const L of real) {
      // Two lines that start in the same month: the second one also carries its first value, so the answers stay apart.
      const p = L.points, a = p[0], z = p[p.length - 1], k0 = `${brand}@${a.month}`, key = out.some(o => o.key === k0) ? `${k0}~${Math.round(a.value)}` : k0, cx = ctx[key] || {};
      const ch = p.findIndex((x, i) => i && x.source !== p[i - 1].source), vals = p.map(x => x.value);
      const ms = new Set(p.map(x => x.month));
      out.push({ key, brand, points: p.map(x => ({ month: x.month, value: x.value, source: x.source })), startMonth: a.month, lastMonth: z.month, first: a.value, last: z.value,
        min: Math.min(...vals), max: Math.max(...vals), current: z.month >= (latest[z.w] || z.month), fresh: p.length === 1,
        payChange: ch > 0 ? { month: p[ch].month, from: p[ch - 1].source, to: p[ch].source } : null,
        extras: extras.filter(x => ms.has(x.month)), house: cx.house || null, services: cx.services || provSv || null, asked: !!cx.services });
    }
    // Extras of months this brand has no line in go to the biggest line.
    const left = extras.filter(x => !out.some(L => L.brand === brand && L.extras.includes(x))), big = out.filter(L => L.brand === brand).sort((a, b) => b.last - a.last)[0];
    if (big) big.extras.push(...left);
  }
  return out;
}

/*
  telecomSummary(items, settings) -> { now (per month, current lines incl. informed ones), seen (only what is in the statements),
    then (the earliest month in the window), thenMonth, diff (then - seen; > 0: they pay less now), houses: [{ house, name, total, items }],
    count (lines) }
*/
export function telecomSummary(items = [], settings = {}) {
  const tel = items.filter(x => x.group === 'telefone' && x.line), gone = s => s === 'cancelei' || s === 'trocou';
  const cur = tel.filter(x => x.current && !gone(x.status)), seenItems = cur.filter(x => !x.manual && !x.elsewhere);
  const months = [...new Set(tel.flatMap(x => x.history.map(h => h.month)))].sort(), thenMonth = months[0] || null;
  const then = r2(tel.reduce((a, x) => a + (x.history.find(h => h.month === thenMonth)?.value || 0), 0));
  const seen = r2(seenItems.reduce((a, x) => a + x.last, 0)), now = r2(cur.reduce((a, x) => a + x.last, 0));
  const lastMonth = months[months.length - 1] || null;
  const hs = new Map();
  const hl = houseList(settings), many = hl.length > 1;
  for (const x of tel) { const off = !x.current || gone(x.status), h = x.house || (many || off ? null : (hl[0] || 'principal')), k = h || (off ? '-' : '?'); const e = hs.get(k) || { house: h, name: h ? houseName(h) : off ? 'Contas que pararam' : 'Sem casa ainda', total: 0, items: [] }; e.items.push(x); if (x.current && !gone(x.status)) e.total = r2(e.total + x.last); hs.set(k, e); }
  return { now, seen, then, thenMonth, lastMonth, diff: thenMonth && thenMonth < lastMonth ? r2(then - seen) : 0, count: cur.length, houses: [...hs.values()].sort((a, b) => (a.house ? 0 : 1) - (b.house ? 0 : 1) || b.total - a.total) };
}

/*
  contextQuestions -> [{ kind: 'linha' | 'parou' | 'desconhecido' | 'celular', key, ... }] in the order they are asked:
  - linha: a current line without its services (house too when the family has more than one line or house). New lines first.
  - parou: a line that stopped in the last 6 months, not answered: cancelaram, trocaram ou pagam de outro jeito?
  - desconhecido: a charge that comes back every month (R$ 60 to R$ 400), from no known brand, in a house or bills category.
  - celular: every line has its services and none is a mobile line, and the family did not say yet.
*/
export function contextQuestions({ c, all = [], txs = [], settings = {} }) {
  const cs = settings.costs || {}, tel = c.items.filter(x => x.group === 'telefone' && x.line && !x.manual), cur = tel.filter(x => x.current && !['cancelei', 'trocou'].includes(x.status));
  const houses = houseList(settings), askHouse = cur.length > 1 || houses.length > 1, qs = [];
  for (const x of [...cur].sort((a, b) => b.startMonth.localeCompare(a.startMonth))) {
    if (x.services?.length && (x.house || !askHouse)) continue;
    const older = tel.some(o => o.name === x.name && o.key !== x.key && o.startMonth < x.startMonth);
    // soft: worth asking (list, missions) but not worth the Início card on its own (one line, only the service is missing).
    qs.push({ kind: 'linha', key: x.key, brand: x.name, value: x.last, startMonth: x.startMonth, second: older, payChange: x.payChange, askHouse, soft: !askHouse, services: x.services || [], house: x.house || null });
  }
  const lastData = c.items.reduce((m, x) => x.lastMonth > m ? x.lastMonth : m, ''), recent = addM(lastData || '2000-01', -6);
  for (const x of tel.filter(x => !x.current && !x.status && x.lastMonth >= recent)) {
    const next = tel.find(o => o.name !== x.name && o.startMonth > x.lastMonth && o.startMonth <= addM(x.lastMonth, 3));
    qs.push({ kind: 'parou', key: x.key, brand: x.name, min: x.min ?? x.last, max: x.max ?? x.last, since: addM(x.lastMonth, 1), swapTo: next?.name || null });
  }
  const prov = cs.providers || {}, no = cs.notTelecom || {};
  for (const r of all) {
    if (!r.current || brandOf(r.name) || prov[r.name] || no[r.name] || r.last < 60 || r.last > 400 || NOT_TELECOM.test(r.name)) continue;
    const t = txs.find(t => t.month === r.lastMonth && merchant(t.description) === r.name);
    if (t && t.category && !/casa|moradia|conta|internet|telefon|servi|assinat|classificar/i.test(t.category)) continue;
    qs.push({ kind: 'desconhecido', key: r.name, name: pretty(r.name), value: r.last });
  }
  if (cur.length && cur.every(x => x.services?.length) && !cur.some(x => x.services.includes('celular')) && !cs.celular) qs.push({ kind: 'celular', key: 'celular', soft: true });
  return qs;
}

// The Início card: only when something is worth a look (a price went up, a charge stopped, a "Vou rever" is due).
// name: first name of whoever is looking. Returns {title, text, action} or null.
export function costsNotice(c, name = '') {
  if (!c || !c.items.length) return null;
  const n = String(name || '').trim().split(/\s+/)[0], hi = n ? n + ', ' : '';
  const R0 = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  const sum = c.count ? `Juntas, as ${c.count} contas e assinaturas de vocês custam ${R0(c.total)} por mês, ${R0(c.year)} no ano.` : '';
  if (c.questions?.some(x => !x.soft)) {
    const t = c.telecom || {}, q = c.questions.length, mo = t.thenMonth ? MONTHS[+t.thenMonth.slice(5, 7) - 1] : '';
    const ask = `${q === 1 ? 'Uma pergunta rápida deixa' : (q < 5 ? ['', '', 'Duas', 'Três', 'Quatro'][q] : q) + ' perguntas rápidas deixam'} a conta certa.`;
    if (t.diff >= 30) return { kind: 'contexto', good: true, title: `${hi}vocês pagam ${R0(t.diff)} a menos por mês do que em ${mo}`, text: `Em telefone, internet e TV: ${R0(t.then)} em ${mo}, ${R0(t.seen)} agora, uns ${R0(t.diff * 12)} a menos no ano de vocês. ${ask}`, action: 'Responder (1 minuto)' };
    return { kind: 'contexto', title: `${hi}${q === 1 ? 'uma pergunta' : q + ' perguntas'} sobre as contas de casa`, text: `Para o app não confundir conta nova (outra casa, outro celular) com conta que subiu. ${ask}`, action: 'Responder (1 minuto)' };
  }
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

// ---------- Combo: internet/TV in one operator and mobile in another, in the same house ----------
export const OPERATOR_SITES = { Vivo: 'https://www.vivo.com.br/para-voce/produtos-e-servicos/combos', Claro: 'https://www.claro.com.br/multi', TIM: 'https://www.tim.com.br', Oi: 'https://www.oi.com.br' };
export const COMPARE_SITE = { name: 'Minha Conexão (compara provedores pelo CEP)', url: 'https://www.minhaconexao.com.br' };
export const cleanCep = v => String(v || '').replace(/\D/g, '');
export const fmtCep = v => { const d = cleanCep(v); return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
export const OFFER_DAYS = 7;

/*
  comboChance(c, settings) -> { house, name, fixed: [items with internet or TV], mobile: [items with celular], pay, brands } | null
  The first house (by what it pays) where internet/TV and the mobile lines are with different operators. The mobile line the
  family informed (no house) goes with the house that has internet.
*/
export function comboChance(c, settings = {}) {
  if (!c?.telecom) return null;
  const gone = s => s === 'cancelei' || s === 'trocou', has = (x, k) => (x.services || []).includes(k);
  const manualCel = c.items.filter(x => x.manual && x.current && !gone(x.status));
  for (const h of c.telecom.houses.filter(h => h.house)) {
    const cur = h.items.filter(x => x.current && !gone(x.status));
    const fixed = cur.filter(x => has(x, 'internet') || has(x, 'tv'));
    if (!fixed.length) continue;
    const firstFixedHouse = c.telecom.houses.find(o => o.house && o.items.some(x => x.current && !gone(x.status) && (has(x, 'internet') || has(x, 'tv'))));
    const mobile = [...cur.filter(x => has(x, 'celular') && !fixed.includes(x)), ...(firstFixedHouse === h ? manualCel.filter(x => !x.house) : []), ...manualCel.filter(x => x.house === h.house)];
    if (!mobile.length) continue;
    const fb = new Set(fixed.map(x => x.name)), mb = new Set(mobile.map(x => x.name));
    if ([...fb].some(b => mb.has(b))) continue;
    const items = [...fixed, ...mobile];
    return { house: h.house, name: h.name, fixed, mobile, items, pay: r2(items.reduce((a, x) => a + x.last, 0)), brands: [...new Set(items.map(x => x.name))], services: [...new Set(items.flatMap(x => x.services || []))] };
  }
  return null;
}

// What the search is asked (the server searches the operators' sites and local providers for this CEP).
export function offerPrompt(chance, cep) {
  const lines = chance.items.map(x => `- ${x.name}: ${servicesText(x.services)}, R$ ${x.last.toFixed(2).replace('.', ',')} por mês`).join('\n');
  return `Pesquise ofertas atuais de planos para uma casa no CEP ${fmtCep(cep)} (Brasil).
Hoje a família paga:
${lines}
Total: R$ ${chance.pay.toFixed(2).replace('.', ',')} por mês.

Procure combos que juntem ${servicesText(chance.services)} numa só operadora (Vivo, Claro, TIM, Oi e outras que atendam esse CEP) e também provedores locais ou regionais que atendam esse CEP ou bairro.
Regras:
- Só preços que você viu numa página desta pesquisa, com o endereço (url) dessa página. Nunca estime nem invente.
- Preço mensal em reais. Se o preço é promocional por alguns meses, diga quantos meses e o preço depois.
- Se um site não abriu ou não mostrou preço, registre em "tentativas".
- No máximo 4 ofertas.
Responda só com JSON neste formato:
{"local":{"bairro":"","cidade":"","uf":""},"ofertas":[{"operadora":"","plano":"","servicos":["internet","tv","celular"],"linhasCelular":0,"velocidadeMega":0,"preco":0,"mesesPromo":0,"precoDepois":0,"url":"https://...","local":false}],"tentativas":[{"site":"","ok":true,"motivo":""}]}`;
}

// The search answer, checked: only offers with a price and the page they came from; nothing invented gets through.
export function cleanOffers(raw = {}) {
  const num = v => { const n = typeof v === 'string' ? +v.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.') : +v; return Number.isFinite(n) ? n : 0; };
  const okUrl = u => { try { const x = new URL(String(u)); return x.protocol === 'https:' && x.hostname.includes('.'); } catch (e) { return false; } };
  const svc = a => [...new Set((Array.isArray(a) ? a : []).map(s => String(s).toLowerCase()).map(s => s.startsWith('cel') || s.startsWith('móv') || s.startsWith('mov') ? 'celular' : s.startsWith('int') || s.includes('fibra') || s.includes('banda') ? 'internet' : s === 'tv' || s.startsWith('tv') ? 'tv' : s.startsWith('fix') || s.startsWith('tel') ? 'fixo' : '').filter(Boolean))];
  const offers = (Array.isArray(raw.ofertas) ? raw.ofertas : []).map(o => {
    const price = r2(num(o.preco)), months = Math.max(0, Math.min(36, Math.round(num(o.mesesPromo)))), after = r2(num(o.precoDepois));
    return { operator: String(o.operadora || '').trim().slice(0, 40), plan: String(o.plano || '').trim().slice(0, 80), services: svc(o.servicos), mobileLines: Math.round(num(o.linhasCelular)) || 0,
      speed: Math.round(num(o.velocidadeMega)) || 0, price, promoMonths: months && after > price ? months : 0, priceAfter: months && after > price ? after : price, url: String(o.url || ''), local: !!o.local };
  }).filter(o => o.operator && o.price >= 20 && o.price <= 3000 && okUrl(o.url) && o.services.length).slice(0, 4);
  const tried = (Array.isArray(raw.tentativas) ? raw.tentativas : []).map(t => ({ site: String(t.site || '').slice(0, 60), ok: !!t.ok, why: String(t.motivo || '').slice(0, 120) })).filter(t => t.site).slice(0, 8);
  const l = raw.local || {};
  return { place: [l.bairro, l.cidade && l.uf ? `${l.cidade} (${l.uf})` : l.cidade].filter(Boolean).map(s => String(s).slice(0, 60)).join(', '), offers, tried };
}

/*
  offerSavings(offer, chance) -> { replaces (items the offer covers), pay (what they pay for those), month (pay - price),
    year1 (first 12 months, with the promotional months), after (per year after the promotion) } | null when it covers nothing.
  An offer replaces the lines whose services it has all of (internet-only does not replace internet and TV).
*/
export function offerSavings(offer, chance) {
  if (!offer || !chance) return null;
  const replaces = chance.items.filter(x => (x.services || []).length && x.services.every(s => offer.services.includes(s)));
  if (!replaces.length) return null;
  const pay = r2(replaces.reduce((a, x) => a + x.last, 0)), pm = Math.min(12, offer.promoMonths || 0);
  const year1 = r2(pay * 12 - (offer.price * pm + offer.priceAfter * (12 - pm)));
  return { replaces, pay, month: r2(pay - offer.price), year1, after: r2((pay - offer.priceAfter) * 12) };
}

// The family typed a price they found: the same account for one offer that replaces everything in the combo.
export const typedSavings = (price, chance) => offerSavings({ services: chance?.services || [], price: +price || 0, priceAfter: +price || 0, promoMonths: 0 }, chance);
