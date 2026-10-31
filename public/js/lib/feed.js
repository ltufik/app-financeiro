// The bell (🔔): everything new in the last 30 days in one list — what changed in the app, personal
// replies and what the family did. Pure functions, tested in tests/lib.test.mjs.
const DAYS = 30;
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => /^\d{4}-\d{2}$/.test(k || '') ? MES[+k.slice(5) - 1] : '';
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Alguém';

// news: [{id, at, title, items}]; replies: [{id, kind, text, reply, replied_at}];
// imports: [{id, source, month, created_by, created_at}]; closed: {AAAA-MM: {at, by}}; members: [{user_id, display_name}]
export function buildFeed({ news = [], replies = [], imports = [], closed = {}, members = [], me = '', myName = '', now = Date.now() }) {
  const since = now - DAYS * 864e5, out = [];
  const nameOf = id => members.find(m => m.user_id === id)?.display_name;
  for (const n of news) if (Date.parse(n.at) > since && Date.parse(n.at) <= now + 864e5) out.push({ id: 'n:' + n.id, kind: 'novidade', at: n.at, title: n.title, items: n.items || [] });
  for (const r of replies) if (r.reply && Date.parse(r.replied_at) > since) out.push({ id: 'r:' + r.id, kind: 'recado', at: r.replied_at, title: 'Resposta ao que você mandou', text: r.reply, quote: r.text });
  for (const i of imports) {
    if (!['conta', 'cartao'].includes(i.source) || !i.created_by || i.created_by === me || !(Date.parse(i.created_at) > since)) continue;
    out.push({ id: 'i:' + i.id, kind: 'familia', at: i.created_at, title: `${first(nameOf(i.created_by))} importou ${i.source === 'cartao' ? 'a fatura' : 'o extrato'}${mName(i.month) ? ' de ' + mName(i.month) : ''}`, text: 'A sobra do mês já está atualizada.' });
  }
  for (const [k, c] of Object.entries(closed || {})) {
    if (!c?.at || !(Date.parse(c.at) > since) || (c.by && myName && first(c.by) === first(myName))) continue;
    out.push({ id: 'c:' + k, kind: 'familia', at: c.at, title: `${first(c.by)} fechou ${mName(k)}`, text: 'Veja a retrospectiva do mês.' });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// Unread: newer than the last time the bell was opened and not already shown in a pop-up.
export const unread = (feed, { seenAt = 0, shown = [] } = {}) => feed.filter(x => Date.parse(x.at) > (Date.parse(seenAt) || +seenAt || 0) && !shown.includes(x.id));
