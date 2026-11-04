// Where a notification (or any message) takes the person when tapped. The server builds the link, the app
// reads it: a note or a reply opens in full, the test goes to Notificações, the others to the right screen.
// Pure module, tested in tests/lib.test.mjs.

const TABS = ['resumo', 'lancar', 'graficos', 'perguntar', 'extrato', 'fechar', 'ajustes'];
const SECS = /^[a-z]{2,20}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

// kind: 'novidade' (id of the note), 'recado' (id of the reply), 'avisos', or 'tela' ({tab, sec}).
export function linkFor(kind, { id, tab, sec } = {}) {
  if ((kind === 'novidade' || kind === 'recado') && ID.test(String(id ?? ''))) return `/?abrir=${kind}&id=${encodeURIComponent(id)}`;
  if (kind === 'avisos') return '/?abrir=avisos';
  if (kind === 'tela' && TABS.includes(tab)) return `/?tab=${tab}${(tab === 'ajustes' && SECS.test(sec || '')) || (tab === 'lancar' && sec === 'pdf') ? '&sec=' + sec : ''}`;
  return '/';
}

// What a link asks for, checked (it comes from the address bar): {abrir, id} or {tab, sec} or null.
export function parseLink(url, base = 'https://app.local') {
  let u; try { u = new URL(url, base); } catch (e) { return null; }
  const p = u.searchParams, abrir = p.get('abrir'), id = p.get('id');
  if ((abrir === 'novidade' || abrir === 'recado') && ID.test(id || '')) return { abrir, id };
  if (abrir === 'avisos') return { abrir };
  const tab = p.get('tab'), sec = p.get('sec');
  if (TABS.includes(tab)) return { tab, ...((tab === 'ajustes' && SECS.test(sec || '')) || (tab === 'lancar' && sec === 'pdf') ? { sec } : {}) };
  return null;
}
