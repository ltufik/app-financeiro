// Server health: what each check means and the overall color. Pure, tested in tests/lib.test.mjs.
// checks: [{ id, ok, ms }]. Red when something the family needs to use the app fails (site, database, login, the
// libraries the phone downloads); yellow when something secondary fails (pushes, assistant) or the app is slow.
export const CHECKS = {
  banco: { label: 'Banco de dados', critical: true },
  login: { label: 'Login', critical: true },
  bibliotecas: { label: 'Leitura de PDF e conexão (bibliotecas que o celular baixa)', critical: true },
  avisos: { label: 'Avisos no celular (chaves configuradas)', critical: false },
  assistente: { label: 'Assistente (chave configurada)', critical: false },
};
export const SLOW_MS = 2500;
export function healthColor(checks = []) {
  const bad = checks.filter(c => !c.ok), crit = bad.filter(c => CHECKS[c.id]?.critical !== false);
  const slow = checks.filter(c => c.ok && +c.ms > SLOW_MS);
  const color = crit.length ? 'vermelho' : bad.length || slow.length ? 'amarelo' : 'verde';
  const text = color === 'verde' ? 'Tudo funcionando.'
    : color === 'vermelho' ? `Fora do ar: ${crit.map(c => CHECKS[c.id]?.label || c.id).join(', ')}.`
    : [bad.length ? `Com problema: ${bad.map(c => CHECKS[c.id]?.label || c.id).join(', ')}.` : '', slow.length ? `Lento: ${slow.map(c => CHECKS[c.id]?.label || c.id).join(', ')}.` : ''].filter(Boolean).join(' ');
  return { color, ok: color !== 'vermelho', text };
}
// History of the daily checks (job_runs "servidor"): days with a problem in the last N.
export function healthHistory(runs = [], days = 7, now = new Date().toISOString()) {
  const t = Date.parse(now), mine = runs.filter(r => r.job === 'servidor' && t - Date.parse(r.at) <= days * 864e5).sort((a, b) => (a.at < b.at ? 1 : -1));
  return { runs: mine.length, bad: mine.filter(r => !r.ok).length, list: mine.map(r => ({ at: r.at, ok: !!r.ok, color: r.summary?.color || (r.ok ? 'verde' : 'vermelho'), text: r.summary?.text || '' })) };
}
