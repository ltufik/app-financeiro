// Product console, "Avisos" page: who can receive notifications and on which devices, and the result of a
// test sent to the owner's own devices. Only counts and device kinds; never the push keys. Pure module,
// tested in tests/lib.test.mjs.

// The push service tells which kind of device it is.
export function deviceKind(endpoint = '') {
  let h = ''; try { h = new URL(endpoint).hostname; } catch (e) { return 'Aparelho'; }
  if (/push\.apple\.com$/.test(h)) return 'iPhone ou iPad';
  if (/fcm\.googleapis\.com$|android\.googleapis\.com$/.test(h)) return 'Android ou Chrome';
  if (/mozilla\.com$|mozaws\.net$/.test(h)) return 'Firefox';
  if (/notify\.windows\.com$/.test(h)) return 'Edge no Windows';
  return 'Aparelho';
}

// The device as the phone itself says (user agent), saved with the subscription: "Android (Chrome)", "iPhone",
// "Windows (Edge)"... Only the kind of device and browser, nothing that identifies the person.
export function deviceFromUA(ua = '') {
  const u = String(ua);
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && /Mobile/.test(u)) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Macintosh|Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
  const br = /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  if (!os) return br || '';
  return (os === 'iPhone' || os === 'iPad') ? os : br ? `${os} (${br})` : os;
}

// subs: [{user_id, endpoint, prefs, created_at}], members: [{user_id, display_name, household_id}],
// families: {household_id: name}. One line per person, the ones with more devices first.
export function pushPeople(subs = [], members = [], families = {}) {
  const by = new Map();
  for (const s of subs) {
    const p = by.get(s.user_id) || { user_id: s.user_id, devices: 0, kinds: [], novidades: false, since: s.created_at };
    p.devices++; const k = deviceKind(s.endpoint); if (!p.kinds.includes(k)) p.kinds.push(k);
    if (s.prefs?.novidades !== false) p.novidades = true;
    if (String(s.created_at || '') < String(p.since || '')) p.since = s.created_at;
    by.set(s.user_id, p);
  }
  return [...by.values()].map(p => {
    const m = members.find(x => x.user_id === p.user_id);
    return { ...p, name: m?.display_name || 'Sem nome', family: (m && families[m.household_id]) || '' };
  }).sort((a, b) => b.devices - a.devices || a.name.localeCompare(b.name, 'pt'));
}

// What the test did, in plain words. results: [{ok, gone}] one per device.
export function testText(results = []) {
  const ok = results.filter(r => r.ok).length, gone = results.filter(r => !r.ok && r.gone).length, fail = results.length - ok - gone;
  if (!results.length) return { kind: 'err', text: 'Nenhum aparelho seu está com as notificações ligadas. No celular, abra o app → menu ☰ → Notificações → Ativar avisos neste celular.' };
  const parts = [];
  if (ok) parts.push(`Enviado para ${ok} ${ok > 1 ? 'aparelhos' : 'aparelho'}. Chega em alguns segundos.`);
  if (gone) parts.push(`${gone} ${gone > 1 ? 'aparelhos antigos não existem' : 'aparelho antigo não existe'} mais e ${gone > 1 ? 'foram tirados' : 'foi tirado'} da lista.`);
  if (fail) parts.push(`${fail} ${fail > 1 ? 'aparelhos não responderam' : 'aparelho não respondeu'}; tente de novo daqui a pouco.`);
  if (!ok) parts.push('Para voltar a receber, ligue de novo no celular: menu ☰ → Notificações.');
  return { kind: ok ? 'ok' : 'err', text: parts.join(' ') };
}
