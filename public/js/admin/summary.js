// "Copiar resumo para o Claude": a text summary of the product (usage, opinions, backlog) to paste in the chat.
// Only first names, never e-mails or any family's money. Pure function, tested in tests/loop.test.mjs.
import { FEATURE_LABELS } from './content.js';
import { FLOWS, flowFunnel } from './flows.js';

const first = n => String(n || '').trim().split(/\s+/)[0] || 'Sem nome';
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const d = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—';
const label = k => FEATURE_LABELS[k] || k;
const KIND = { erro: 'Erro', ideia: 'Ideia', critica: 'Crítica', duvida: 'Dúvida' };
const ST = { agora: 'Agora', proximo: 'Próximo', ideia: 'Ideia', depois: 'Depois', feito: 'Feito', descartado: 'Descartado' };

export function buildSummary({ metrics: m, usage: u, feedback = [], backlog = [], today = new Date().toISOString().slice(0, 10) }) {
  const L = [`# Pra Onde Foi: resumo do produto em ${d(today)}`, ''];
  if (m) {
    L.push('## Números gerais',
      `- Pessoas: ${m.users} (${m.users_7d} nos últimos 7 dias); famílias: ${m.families} (${m.families_shared} com 2 pessoas ou mais)`,
      `- Ativos: ${m.wau} na semana, ${m.mau} no mês`,
      `- Funil: criaram conta ${m.users} → entraram numa família ${m.in_family} → famílias com 1 mês importado ${m.families_1_month} (${pct(m.families_1_month, m.families)}) → 2 meses ou mais ${m.families_2_months} → fecharam um mês ${m.families_closed}`,
      `- Voltaram depois de 7 dias: ${pct(m.d7_retained, m.d7_eligible)} (${m.d7_retained}/${m.d7_eligible}); depois de 30 dias: ${pct(m.d30_retained, m.d30_eligible)} (${m.d30_retained}/${m.d30_eligible})`,
      `- Últimos 30 dias: ${m.imports_30d} PDFs importados, ${m.manual_30d} lançamentos à mão ou voz, ${m.receipts_30d} notas fiscais; ${m.push_devices} celulares com avisos`, '');
  }
  if (u) {
    const feats = Object.entries(u.features || {}).sort((a, b) => b[1].users - a[1].users || b[1].n - a[1].n);
    L.push(`## Uso nos últimos ${u.days} dias`, '### Pessoas');
    for (const p of u.people || []) {
      const top = Object.entries(p.features || {}).filter(([k]) => !k.startsWith('aba.')).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${label(k)} ${n}×`).join(', ');
      L.push(`- ${first(p.name)} (${p.family ? 'família ' + p.family : 'sem família'}): última vez ${d(p.last_day)}, ${p.days} dias ativos, ${p.feedbacks || 0} opiniões${top ? '; usa: ' + top : ''}`);
    }
    L.push('', '### Partes mais usadas (pessoas diferentes, vezes)');
    feats.forEach(([k, v]) => L.push(`- ${label(k)}: ${v.users} pessoas, ${v.n}×`));
    L.push('', '### Funil por fluxo (pessoas por etapa)');
    for (const f of FLOWS.filter(x => x.steps)) {
      const steps = flowFunnel(f.steps, u.features || {}).filter(x => x.users != null);
      if (steps.length) L.push(`- ${f.title}: ${steps.map(x => `${x.action} ${x.users}${x.drop > 0 ? ` (−${x.drop}%)` : ''}`).join(' → ')}`);
    }
    const hours = {}; (u.hours || []).forEach(([, h, n]) => { hours[h] = (hours[h] || 0) + n; });
    const peak = Object.entries(hours).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h + 'h');
    if (peak.length) L.push('', `Horários de mais uso: ${peak.join(', ')}`);
    L.push('');
  }
  const open = feedback.filter(f => ['novo', 'visto'].includes(f.status));
  L.push(`## Opiniões (${feedback.length} no total, ${open.length} em aberto)`);
  for (const f of feedback.slice(0, 80)) {
    L.push(`- [#${f.id} ${KIND[f.kind] || f.kind} · ${first(f.name)} · ${d(f.created_at)} · tela ${f.screen || '—'} · ${f.device || ''} · ${f.status}] ${String(f.text).replace(/\s+/g, ' ')}`
      + (f.kind === 'duvida' ? ` → resposta do assistente: ${f.answer ? String(f.answer).replace(/\s+/g, ' ').slice(0, 200) : '(nenhuma)'}; ${f.helpful === true ? 'resolveu' : f.helpful === false ? 'NÃO resolveu' : 'sem retorno'}` : '')
      + (f.reply ? ` → recado enviado${f.reply_seen ? ' (visto)' : ''}` : ''));
  }
  L.push('', '## Backlog');
  const by = s => backlog.filter(i => i.status === s);
  L.push(Object.keys(ST).map(s => `${ST[s]}: ${by(s).length}`).join(' · '));
  for (const s of ['agora', 'proximo', 'ideia']) {
    if (!by(s).length) continue;
    L.push(`### ${ST[s]}`);
    by(s).forEach(i => { const n = (i.from || []).length; L.push(`- ${i.id}: ${i.title}${i.problem ? ' (problema: ' + i.problem + ')' : ''}${n ? ` · pedido por ${n}` : ''} · esforço ${i.effort || '—'}`); });
  }
  L.push('', 'Sem e-mails e sem valores das famílias. Gerado na Central do produto.');
  return L.join('\n');
}
