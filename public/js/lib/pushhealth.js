// Health of the push notifications, for the Central ("Avisos no celular") and the alert to the owner.
// logs: push_log rows of the last days ({at, job, kind, ok, status, error}); runs: job_runs rows ({at, job, ok, ms,
// summary}); now: ISO. Pure, tested in tests/lib.test.mjs.

// The robots and how often each must run (with a margin): a run older than that is "late".
export const ROBOTS = {
  diario: { label: 'Avisos do dia (9h)', hours: 26 },
  versao: { label: 'Novidades das versões (9h)', hours: 26 },
  lembrete: { label: 'Lembrete da noite (21h)', hours: 26 },
  previsao: { label: 'Previsão de domingo (19h)', hours: 8 * 24 + 2 },
};
export const JOB_LABELS = { ...Object.fromEntries(Object.entries(ROBOTS).map(([k, v]) => [k, v.label])), familia: 'Avisos da família', teste: 'Pushes de teste', recado: 'Respostas às opiniões', novidade: 'Novidade enviada pela Central' };
const MIN_FOR_RATE = 5, LOW_RATE = 0.8;

export function pushHealth(logs = [], runs = [], now = new Date().toISOString()) {
  const t = Date.parse(now), hrs = at => (t - Date.parse(at)) / 36e5;
  const jobs = Object.entries(ROBOTS).map(([job, r]) => {
    const mine = runs.filter(x => x.job === job).sort((a, b) => (a.at < b.at ? 1 : -1)), last = mine[0] || null;
    const week = mine.filter(x => hrs(x.at) <= 7 * 24);
    return { job, label: r.label, lastAt: last?.at || null, lastOk: last ? !!last.ok : null, hoursAgo: last ? Math.round(hrs(last.at)) : null,
      late: !!last && hrs(last.at) > r.hours, never: !last, runs7: week.length, fails7: week.filter(x => !x.ok).length, lastSummary: last?.summary || null };
  });
  const by = {};
  for (const l of logs) {
    const b = by[l.job] ||= { job: l.job, label: JOB_LABELS[l.job] || l.job, sent: 0, ok: 0, failed: 0, gone: 0 };
    b.sent++; if (l.ok) b.ok++; else if (l.status === 404 || l.status === 410) b.gone++; else b.failed++;
  }
  const byJob = Object.values(by).map(b => ({ ...b, rate: b.sent ? b.ok / b.sent : 0 })).sort((a, b) => b.sent - a.sent);
  const sent = logs.length, ok = logs.filter(l => l.ok).length;
  const errs = {}; for (const l of logs) if (!l.ok) { const k = l.error || (l.status ? `resposta ${l.status}` : 'sem resposta'); errs[k] = (errs[k] || 0) + 1; }
  const errors = Object.entries(errs).map(([text, n]) => ({ text, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  const alerts = [];
  for (const j of jobs) {
    if (j.late) alerts.push({ job: j.job, text: `${j.label} não roda há ${j.hoursAgo >= 48 ? Math.round(j.hoursAgo / 24) + ' dias' : j.hoursAgo + ' horas'}.` });
    else if (j.lastOk === false) alerts.push({ job: j.job, text: `${j.label}: a última rodada deu erro.` });
  }
  // Removed devices (gone) are normal housekeeping, not a delivery problem.
  for (const b of byJob) { const tried = b.sent - b.gone; if (tried >= MIN_FOR_RATE && b.ok / tried < LOW_RATE) alerts.push({ job: b.job, text: `${b.label}: só ${Math.round(b.ok / tried * 100)}% chegaram nos últimos 7 dias.` }); }
  return { jobs, byJob, total: { sent, ok, rate: sent ? ok / sent : 0 }, errors, alerts };
}

// The push to the owner when something is wrong (at most one a day, from the 9h robot).
export function healthAlertMessage(alerts = []) {
  if (!alerts.length) return null;
  return { title: alerts.length > 1 ? `${alerts.length} problemas nos avisos do app` : 'Problema nos avisos do app', body: alerts.map(a => a.text).join(' ').slice(0, 200), tag: 'saude_avisos' };
}
