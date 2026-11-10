// Desafios do mês and the weekly streak (gamification, part 2). The app suggests challenges from the family's own
// numbers; the family accepts one at a time; progress and the result come from the data. Pure, tested in
// tests/lib.test.mjs. Texts follow the message manual ("vocês", the family's number, the next step).
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => MES[+k.slice(5) - 1];
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');
const lastDay = k => `${k}-${String(new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const prevM = k => { const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 7); };
const sundaysIn = (a, b) => { const out = []; for (let t = Date.parse(a + 'T12:00:00Z'); t <= Date.parse(b + 'T12:00:00Z'); t += 864e5) if (!new Date(t).getUTCDay()) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
const informedSundays = (checkins, a, b) => sundaysIn(a, b).filter(d => (checkins || []).some(c => c && c.date >= addDays(d, -3) && c.date <= addDays(d, 3))).length;

/*
  facts: { today, cats: { 'AAAA-MM': { category: spent } } (day-to-day spending by category, finished months and
  the current one), fixed: [fixed categories], pending (entries to check), cash (withdrawals without detail),
  checkins, forecast: { res, meta, perDay } | null, subsUp: [{ name, prev, last }], done: { month: has bill and statement } }
  -> up to 2 suggestions: { kind, key, title, why, target, month, end }
*/
export function suggestChallenges(f = {}, history = []) {
  const cur = f.today.slice(0, 7), prev = prevM(cur), out = [], end = lastDay(cur), mes = mName(cur);
  const recent = ch => (history || []).some(h => h.key === ch.key && h.month === cur);
  // 1. The variable category that went up the most last month: back to the family's average.
  const hist = [1, 2, 3].map(i => { let k = prev; for (let j = 1; j < i; j++) k = prevM(k); return k; }).filter(k => f.cats?.[k]);
  if (hist.length >= 2 && f.cats?.[prev]) {
    const fixed = new Set(f.fixed || []), cands = Object.keys(f.cats[prev]).filter(c => !fixed.has(c) && c !== 'A classificar').map(c => {
      const base = hist.slice(1).map(k => f.cats[k][c] || 0), avg = base.reduce((a, b) => a + b, 0) / base.length, last = f.cats[prev][c] || 0;
      return { c, avg, last, up: last - avg };
    }).filter(x => x.avg > 0 && x.last > x.avg * 1.2 && x.up >= 150).sort((a, b) => b.up - a.up);
    if (cands[0]) { const x = cands[0], target = Math.max(50, Math.round(x.avg / 50) * 50);
      out.push({ kind: 'categoria', key: 'categoria:' + x.c, category: x.c, target, month: cur, end, title: `${x.c} abaixo de ${R(target)} em ${mes}`, why: `Em ${mName(prev)} foram ${R(x.last)}, ${R(x.up)} acima da média de vocês.` }); }
  }
  // 2. Hit the month's goal (when the forecast says it is at risk).
  const fc = f.forecast;
  if (fc && fc.meta > 0 && fc.res < fc.meta) out.push({ kind: 'meta', key: 'meta', target: Math.round(fc.meta), month: cur, end, title: `Bater a meta de ${mes}: sobrar ${R(fc.meta)}`, why: `A previsão de vocês hoje é sobrar ${R(fc.res)}.${fc.perDay > 0 ? ` Cabem ${R(fc.perDay)} por dia em compras novas.` : ''}` });
  // 3. Small and quick: the entries to check, the withdrawals without detail, a subscription that went up.
  if (f.pending > 0) out.push({ kind: 'conferir', key: 'conferir', target: 0, month: cur, end: addDays(f.today, 7), title: `Zerar os ${f.pending} lançamentos para conferir`, why: 'Com tudo conferido, a sobra e os gráficos de vocês ficam certos. Leva poucos minutos.' });
  if (f.cash > 0) out.push({ kind: 'saques', key: 'saques', target: 0, month: cur, end: addDays(f.today, 7), title: `Contar no que foram os ${f.cash} saques`, why: 'Dinheiro vivo some do controle de vocês: uma frase por saque resolve.' });
  const up = (f.subsUp || [])[0];
  if (up) out.push({ kind: 'assinatura', key: 'assinatura:' + up.name, name: up.name, target: 0, month: cur, end: addDays(f.today, 7), title: `Rever ${up.name}, que subiu`, why: `Foi de ${R(up.prev)} para ${R(up.last)} nas contas de vocês. Vale ligar e negociar ou cancelar.` });
  // 4. The weekly habit: the open bill on 4 Sundays.
  if (informedSundays(f.checkins, addDays(f.today, -28), f.today) < 2) out.push({ kind: 'domingos', key: 'domingos', target: 4, month: cur, start: f.today, end: addDays(f.today, 27), title: 'Informar a fatura aberta em 4 domingos', why: 'Um número do app do banco por semana deixa a previsão de vocês certa.' });
  return out.filter(x => !recent(x)).slice(0, 2);
}

/*
  progress(ch, facts) -> { status: 'ativo'|'aguardando'|'cumprido'|'nao_deu', pct, text }
  The result comes when the data is complete (category and goal: the month's bill and statement are in).
*/
export function challengeProgress(ch, f = {}) {
  const today = f.today, over = today > ch.end, mes = mName(ch.month);
  if (ch.kind === 'categoria') {
    const spent = f.cats?.[ch.month]?.[ch.category] || 0, pct = ch.target ? spent / ch.target : 0;
    if (over && !f.done?.[ch.month]) return { status: 'aguardando', pct, text: `Esperando a fatura e o extrato de ${mes} para dar o resultado: até agora, ${R(spent)}.` };
    if (over) return spent <= ch.target ? { status: 'cumprido', pct, text: `Vocês gastaram ${R(spent)} em ${ch.category}, abaixo de ${R(ch.target)}.` } : { status: 'nao_deu', pct, text: `Foram ${R(spent)} em ${ch.category}, ${R(spent - ch.target)} acima de ${R(ch.target)}.` };
    return { status: 'ativo', pct, text: `${R(spent)} até agora de ${R(ch.target)} (o cartão entra quando a fatura chegar).` };
  }
  if (ch.kind === 'meta') {
    if (over && !f.done?.[ch.month]) return { status: 'aguardando', pct: 0, text: `Esperando a fatura e o extrato de ${mes} para dar o resultado.` };
    if (over) { const res = f.result?.[ch.month] ?? 0; return res >= ch.target ? { status: 'cumprido', pct: 1, text: `Sobraram ${R(res)} em ${mes}: meta batida!` } : { status: 'nao_deu', pct: res / ch.target, text: `Sobraram ${R(res)}, ${R(ch.target - res)} abaixo da meta.` }; }
    const fc = f.forecast; return { status: 'ativo', pct: fc ? Math.max(0, Math.min(1, fc.res / ch.target)) : 0, text: fc ? `Previsão de hoje: sobrar ${R(fc.res)}${fc.perDay > 0 ? ` · cabem ${R(fc.perDay)} por dia` : ''}.` : 'A previsão aparece quando houver 2 meses completos.' };
  }
  if (ch.kind === 'conferir' || ch.kind === 'saques') {
    const left = ch.kind === 'conferir' ? +f.pending || 0 : +f.cash || 0;
    if (!left) return { status: 'cumprido', pct: 1, text: ch.kind === 'conferir' ? 'Tudo conferido!' : 'Todos os saques contados!' };
    return over ? { status: 'nao_deu', pct: 0, text: `Ficaram ${left} para fazer.` } : { status: 'ativo', pct: 0, text: `Faltam ${left}.` };
  }
  if (ch.kind === 'assinatura') return ch.reviewed ? { status: 'cumprido', pct: 1, text: `${ch.name} revista.` } : over ? { status: 'nao_deu', pct: 0, text: 'O prazo acabou.' } : { status: 'ativo', pct: 0, text: 'Toque em "Revi" depois de ligar, negociar ou cancelar.' };
  if (ch.kind === 'domingos') {
    const n = informedSundays(f.checkins, ch.start || ch.month + '-01', ch.end);
    if (n >= ch.target) return { status: 'cumprido', pct: 1, text: `${n} domingos com a fatura aberta informada.` };
    return over ? { status: 'nao_deu', pct: n / ch.target, text: `${n} de ${ch.target} domingos.` } : { status: 'ativo', pct: n / ch.target, text: `${n} de ${ch.target} domingos.` };
  }
  return { status: 'ativo', pct: 0, text: '' };
}

// Weeks in a row (Monday to Sunday) with the family doing something in the app (a bill or statement, an entry, the
// open bill, a mission, a challenge). The week going on counts once there is something; until then the streak is
// the one up to last week. -> { current, best }
export function weekStreak(dates = [], today) {
  const wk = iso => { const t = Date.parse(iso.slice(0, 10) + 'T12:00:00Z'), d = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - d * 864e5).toISOString().slice(0, 10); };
  const weeks = new Set(dates.filter(Boolean).map(wk)), now = wk(today);
  let cur = 0, w = weeks.has(now) ? now : addDays(now, -7);
  while (weeks.has(w)) { cur++; w = addDays(w, -7); }
  let best = 0, run = 0, prev = null;
  for (const x of [...weeks].sort()) { run = prev && addDays(prev, 7) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { current: cur, best };
}
