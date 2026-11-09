// Texts of the pushes that do not come from the Início notices: the Sunday summary of the week, the 21h reminder
// and the family notices. Pure (the robots in api/ send them; Central → Mensagens shows them). Tested in tests/.
import { expandSplits } from './calc.js';

const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

// Sunday summary of the week: what the family spent in the last 7 days against a normal week of theirs (the 4 weeks before).
export function weekly(txs, idx, today, name = '') {
  const spent = (from, to) => { const by = {}; for (const t of expandSplits(txs)) { if (!t.date) continue; const d = days(today, t.date); if (d < from || d >= to) continue; const c = idx.get(t.category); if (c && c.grp !== 'dia') continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v > 0) by[t.category || 'A classificar'] = (by[t.category || 'A classificar'] || 0) + v; } return by; };
  const by = spent(0, 7), total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const prev = Object.values(spent(7, 35)).reduce((a, b) => a + b, 0) / 4, N = String(name || '').trim().split(/\s+/)[0], hey = t => (N ? `${N}, ${t}` : t[0].toUpperCase() + t.slice(1));
  if (!total) return { id: 'semanal', title: hey('nenhum gasto de vocês lançado na semana'), text: `Saíram R$ 0 em despesas lançadas nos últimos 7 dias${prev ? `; numa semana normal de vocês são ${R(prev)}` : ''}. Lance os do pix e do dinheiro: falando, leva 5 segundos.`, url: '/?tab=lancar' };
  const diff = total - prev, cmp = prev >= 1 ? (Math.abs(diff) < prev * 0.1 ? ', perto do normal de vocês' : `, ${R(diff)} ${diff > 0 ? 'a mais' : 'a menos'} que uma semana normal de vocês`) : '';
  return { id: 'semanal', title: hey(`a semana de vocês custou ${R(total)}`), text: `Foram ${R(total)} em despesas nos últimos 7 dias${cmp}. Mais pesaram: ${top.map(e => `${e[0]} ${R(e[1])}`).join(', ')}.`, url: '/?tab=resumo' };
}

// Evening reminder (21h in Brazil): only for people who launched nothing today, once a day.
// Families with no data at all get the first step (send the statement) instead of the voice reminder.
export const reminderMessage = (name, { empty = false } = {}) => empty
  ? { title: `${name ? name.split(' ')[0] + ', o' : 'O'} app de vocês ainda está vazio`, body: 'Mande a última fatura do cartão, em PDF, foto ou print. Em 2 minutos você vê para onde foi o dinheiro.', url: '/?acao=pdf', tag: 'lembrete' }
  : ({ title: `${name ? name.split(' ')[0] + ', g' : 'G'}astou algo hoje no pix ou em dinheiro?`, body: 'Toque e fale em 5 segundos. O app lança para você.', url: '/?acao=voz', tag: 'lembrete' });

// Real-time family notices (api/notify.js): tells the OTHER members when someone joins, imports or closes a month.
const MES_N = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => /^\d{4}-\d{2}$/.test(k || '') ? MES_N[+k.slice(5) - 1] : 'mês';

export function message({ type, name, to = '', family, source, month }) {
  const hey = t => (to ? `${to}, ${t}` : t[0].toUpperCase() + t.slice(1));
  if (type === 'joined') return { title: hey(`${name} entrou na família`), body: `Agora vocês veem os mesmos números da ${family}. Combinem as metas juntos em Metas.`, url: '/?tab=resumo', tag: 'familia-joined' };
  if (type === 'imported') return { title: hey(`${name} mandou ${source === 'cartao' ? 'a fatura' : 'o extrato'} de ${mName(month)}`), body: 'A sobra de vocês no mês já está atualizada. Toque para ver para onde foi o dinheiro.', url: '/?tab=resumo', tag: 'familia-imported' };
  if (type === 'closed') return { title: hey(`${name} fechou ${mName(month)}`), body: `Vejam juntos a retrospectiva de ${mName(month)}: o que vocês guardaram e o que mais pesou.`, url: '/?tab=fechar', tag: 'familia-closed' };
  return null;
}

