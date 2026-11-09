// Texts of the pushes that do not come from the Início notices: the Sunday summary of the week, the 21h reminder
// and the family notices. Pure (the robots in api/ send them; Central → Mensagens shows them). Tested in tests/.
import { expandSplits } from './calc.js';

const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

export function weekly(txs, idx, today) {
  const recent = expandSplits(txs).filter(t => t.date && days(today, t.date) >= 0 && days(today, t.date) < 7);
  const by = {};
  for (const t of recent) { const c = idx.get(t.category); if (c && c.grp !== 'dia') continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v > 0) by[t.category || 'A classificar'] = (by[t.category || 'A classificar'] || 0) + v; }
  const total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (!total) return { id: 'semanal', title: 'Resumo da semana', text: 'Nenhuma despesa lançada nos últimos 7 dias. Lembre de lançar os gastos do pix e do dinheiro.', url: '/?tab=lancar' };
  return { id: 'semanal', title: 'Resumo da semana', text: `Nos últimos 7 dias saíram ${R(total)} em despesas. Maiores: ${top.map(e => `${e[0]} ${R(e[1])}`).join(', ')}.`, url: '/?tab=resumo' };
}

// Evening reminder (21h in Brazil): only for people who launched nothing today, once a day.
// Families with no data at all get the first step (send the statement) instead of the voice reminder.
export const reminderMessage = (name, { empty = false } = {}) => empty
  ? { title: `${name ? name.split(' ')[0] + ', o' : 'O'} app de vocês ainda está vazio`, body: 'Mande a última fatura do cartão, em PDF, foto ou print. Em 2 minutos você vê para onde foi o dinheiro.', url: '/?acao=pdf', tag: 'lembrete' }
  : ({ title: `${name ? name.split(' ')[0] + ', g' : 'G'}astou algo hoje no pix ou em dinheiro?`, body: 'Toque e fale em 5 segundos. O app lança para você.', url: '/?acao=voz', tag: 'lembrete' });

// Real-time family notices (api/notify.js): tells the OTHER members when someone joins, imports or closes a month.
const MES_N = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => /^\d{4}-\d{2}$/.test(k || '') ? MES_N[+k.slice(5) - 1] : 'mês';

export function message({ type, name, family, source, month }) {
  if (type === 'joined') return { title: `${name} entrou na família`, body: `Agora vocês veem os mesmos números da ${family}.`, url: '/?tab=resumo', tag: 'familia-joined' };
  if (type === 'imported') return { title: `${name} importou ${source === 'cartao' ? 'a fatura' : 'o extrato'} de ${mName(month)}`, body: 'A sobra do mês já está atualizada.', url: '/?tab=resumo', tag: 'familia-imported' };
  if (type === 'closed') return { title: `${name} fechou ${mName(month)}`, body: 'Veja a retrospectiva do mês.', url: '/?tab=fechar', tag: 'familia-closed' };
  return null;
}

