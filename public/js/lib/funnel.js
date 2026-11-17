// The journey funnel (one row per person, from product_health) and the alarms of the daily e-mail to the owner.
// Pure: the Central (Acompanhar → Funil e alarmes) and api/push-cron.js (e-mail at 9h) use the same functions.

export const FUNNEL = [
  { key: 'conta', label: 'Criaram a conta', ok: () => true },
  { key: 'familia', label: 'Entraram numa família', ok: p => !!p.household },
  { key: 'extrato', label: 'Mandaram o 1º extrato ou fatura', ok: p => !!p.first_import },
  { key: 'dois', label: 'Têm 2 meses ou mais', ok: p => +p.months >= 2 },
  { key: 'fechou', label: 'Fecharam um mês', ok: p => !!p.closed },
  { key: 'semana2', label: 'Voltaram na 2ª semana', ok: p => !!p.week2 },
  { key: 'ativos', label: 'Usaram nos últimos 7 dias', ok: p => +p.days_7 > 0 },
];

const day = v => String(v || '').slice(0, 10);
export const daysSince = (v, today) => v ? Math.round((Date.parse(day(today) + 'T12:00:00Z') - Date.parse(day(v) + 'T12:00:00Z')) / 864e5) : null;
export const personName = p => (p.name || '').trim() || (p.family ? `Alguém da ${p.family}` : 'Pessoa sem nome');

// Each step counts the people that passed it AND every step before (a funnel, not separate totals).
export function funnel(people = []) {
  let left = people;
  return FUNNEL.map((s, i) => {
    const prev = left.length; left = left.filter(s.ok);
    return { key: s.key, label: s.label, n: left.length, pct: people.length ? Math.round(left.length / people.length * 100) : 0, conv: i && prev ? Math.round(left.length / prev * 100) : 100 };
  });
}

// Where each person stopped: the first step not done (null = did everything).
export function stageOf(p) { const i = FUNNEL.findIndex(s => !s.ok(p)); return i < 0 ? null : FUNNEL[i]; }

/*
  healthAlarms(h, { pushAlerts, today }) -> [{ id, level: 'vermelho' | 'amarelo', title, text }]
  - novos parados: account 2 to 30 days old, no statement or bill yet (they need a hand now, not in a month)
  - sumiram: used the app (sent a statement) and did not open it for 7 to 30 days
  - etapa fraca: from "Mandaram o 1º extrato" on, a step that keeps less than 40% of the previous one (with 3 or more people)
  - ninguém abriu ontem; erros do app nas últimas 24 horas; robôs e avisos no celular (pushhealth)
*/
export function healthAlarms(h = {}, { pushAlerts = [], today } = {}) {
  const people = h.people || [], t = today || h.today, out = [];
  const list = ps => ps.slice(0, 6).map(p => `${personName(p)} (${daysSince(p.signed_up, t)} dias)`).join(', ') + (ps.length > 6 ? ` e mais ${ps.length - 6}` : '');
  const stuck = people.filter(p => { const d = daysSince(p.signed_up, t); return d >= 2 && d <= 30 && !p.first_import; });
  if (stuck.length) out.push({ id: 'novos_parados', level: 'amarelo', title: `${stuck.length === 1 ? '1 pessoa nova parada' : stuck.length + ' pessoas novas paradas'} sem mandar extrato`, text: `Criaram a conta e ainda não mandaram extrato nem fatura: ${list(stuck)}. Vale um recado ou entender onde empacaram.` });
  const gone = people.filter(p => { const d = daysSince(p.last_seen, t); return p.first_import && d >= 7 && d <= 30; });
  if (gone.length) out.push({ id: 'sumiram', level: 'amarelo', title: `${gone.length === 1 ? '1 pessoa que usava sumiu' : gone.length + ' pessoas que usavam sumiram'}`, text: `Mandaram extrato e não abrem o app há 7 dias ou mais: ${gone.slice(0, 6).map(p => `${personName(p)} (${daysSince(p.last_seen, t)} dias)`).join(', ')}.` });
  const f = funnel(people);
  for (let i = FUNNEL.findIndex(s => s.key === 'extrato'); i > 0 && i < f.length; i++) {
    if (f[i - 1].n >= 3 && f[i].conv < 40) out.push({ id: 'etapa_' + f[i].key, level: 'amarelo', title: `Etapa fraca: ${f[i].label.toLowerCase()}`, text: `Só ${f[i].conv}% de quem chegou em "${f[i - 1].label}" passou para "${f[i].label}" (${f[i].n} de ${f[i - 1].n}).` });
  }
  if (people.length && !+h.opened_yesterday) out.push({ id: 'ninguem_ontem', level: 'amarelo', title: 'Ninguém abriu o app ontem', text: `Das ${people.length} pessoas com conta, nenhuma abriu o app ontem.` });
  if (+h.errors_24h > 0) out.push({ id: 'erros', level: +h.errors_24h >= 5 ? 'vermelho' : 'amarelo', title: `${h.errors_24h} ${+h.errors_24h === 1 ? 'erro' : 'erros'} no app nas últimas 24 horas`, text: (h.errors_top || []).map(e => `${e.n}× ${e.message}${e.version ? ` (${e.version})` : ''}`).join('; ') });
  for (const a of pushAlerts) out.push({ id: 'robo_' + (a.job || 'x'), level: 'vermelho', title: 'Robô ou aviso no celular com problema', text: a.text || String(a) });
  return out.sort((a, b) => (a.level === 'vermelho' ? 0 : 1) - (b.level === 'vermelho' ? 0 : 1));
}

const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ddmm = v => { const d = day(v); return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : ''; };

// The daily e-mail: the alarms first (or "tudo em dia"), then the funnel, then the link to the Central.
export function healthEmail(h = {}, alarms = [], { centralUrl = '', today } = {}) {
  const t = today || h.today, f = funnel(h.people || []), red = alarms.filter(a => a.level === 'vermelho').length;
  const subject = `Pra Onde Foi · ${alarms.length ? `${alarms.length} ${alarms.length === 1 ? 'alarme' : 'alarmes'}${red ? ` (${red} ${red === 1 ? 'vermelho' : 'vermelhos'})` : ''}` : 'tudo em dia'} · ${ddmm(t)}`;
  const text = [subject, '', ...(alarms.length ? alarms.map(a => `${a.level === 'vermelho' ? '[VERMELHO]' : '[AMARELO]'} ${a.title}\n${a.text}`) : ['Nenhum alarme hoje.']), '',
    'Funil:', ...f.map(s => `- ${s.label}: ${s.n} (${s.pct}%)`), '', `Abriram o app ontem: ${+h.opened_yesterday || 0}`, centralUrl ? `Central: ${centralUrl}` : ''].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;color:#0E2A3F;max-width:560px">
<h2 style="margin:0 0 12px">${escH(subject)}</h2>
${alarms.length ? alarms.map(a => `<div style="border-left:4px solid ${a.level === 'vermelho' ? '#B42318' : '#B7791F'};padding:8px 12px;margin:0 0 10px;background:#F7F3EC"><strong>${escH(a.title)}</strong><br><span style="font-size:14px">${escH(a.text)}</span></div>`).join('') : '<p>Nenhum alarme hoje.</p>'}
<h3 style="margin:18px 0 6px">Funil</h3>
<table style="border-collapse:collapse;font-size:14px">${f.map(s => `<tr><td style="padding:3px 12px 3px 0">${escH(s.label)}</td><td style="padding:3px 8px;text-align:right"><strong>${s.n}</strong></td><td style="padding:3px 0;color:#56707F">${s.pct}%</td></tr>`).join('')}</table>
<p style="font-size:14px">Abriram o app ontem: <strong>${+h.opened_yesterday || 0}</strong></p>
${centralUrl ? `<p><a href="${escH(centralUrl)}" style="color:#0E7C80">Abrir a Central: Funil e alarmes</a></p>` : ''}
</div>`;
  return { subject, text, html };
}
