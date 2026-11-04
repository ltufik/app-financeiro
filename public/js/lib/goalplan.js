// Scenarios for "O sonho de vocês": how much the family puts aside per month, from their own numbers.
// "Média dos últimos 3 meses" is always computed (never a number typed once and forgotten); the family's own
// plan and saved scenarios come after. Pure module, tested in tests/lib.test.mjs.
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mShort = (k, yr) => MES[+k.slice(5) - 1] + (yr ? '/' + k.slice(2, 4) : '');

// Complete months: with the bank statement, before the current month. rows: [{month, res}] in order.
export function averagePace(rows, n = 3) {
  const last = rows.slice(-n);
  if (!last.length) return { value: 0, months: [], text: 'ainda sem meses completos' };
  const avg = last.reduce((a, r) => a + (+r.res || 0), 0) / last.length;
  const months = last.map(r => r.month);
  return { value: Math.max(0, Math.round(avg / 50) * 50), raw: avg, months, text: months.length > 1 ? (y => `${mShort(months[0], y)} a ${mShort(months[months.length - 1], y)}`)(months[0].slice(0, 4) !== months[months.length - 1].slice(0, 4)) : mShort(months[0]) };
}

// [{name, monthly, yearly, auto}]: the real average first, then the family's plan, then the saved scenarios.
// Old saved scenarios named "Ritmo atual" were a fixed number; the computed average replaces them.
export function paceScenarios({ rows = [], goals = {}, saved = [] }) {
  const a = averagePace(rows, 3), out = [{ name: `Média dos últimos ${a.months.length || 3} meses`, monthly: a.value, yearly: 0, auto: true, note: a.months.length ? `o que sobrou de verdade em ${a.text}${a.raw < 0 ? ' (ficou no vermelho; contamos como zero)' : ''}` : 'aparece quando houver meses com o extrato da conta' }];
  if (+goals.planMonthly > 0 || +goals.planYearly > 0) out.push({ name: 'O plano de vocês', monthly: +goals.planMonthly || 0, yearly: +goals.planYearly || 0, note: 'o que vocês disseram em Metas que conseguem guardar' });
  out.push({ name: '+ R$ 1.000 por mês', monthly: a.value + 1000, yearly: 0, note: 'a média dos últimos meses mais R$ 1.000' });
  for (const p of saved || []) if (Array.isArray(p) && p[0] && !/^ritmo atual$/i.test(String(p[0]).trim())) out.push({ name: String(p[0]), monthly: +p[1] || 0, yearly: +p[2] || 0, note: 'cenário salvo', saved: true });
  return out;
}
