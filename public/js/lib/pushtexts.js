// Texts of the pushes that do not come from the Início notices: the Sunday summary of the week, the 21h reminder
// and the family notices. Pure (the robots in api/ send them; Central → Mensagens shows them). Tested in tests/.
import { expandSplits } from './calc.js';
import { missionList } from './missions.js';

const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const R = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

// Sunday summary of the week: what the family spent in the last 7 days against a normal week of theirs (the 4 weeks before).
export function weekly(txs, idx, today, name = '') {
  const spent = (from, to) => { const by = {}; for (const t of expandSplits(txs)) { if (!t.date) continue; const d = days(today, t.date); if (d < from || d >= to) continue; const c = idx.get(t.category); if (c && c.grp !== 'dia') continue; const v = t.source === 'conta' ? -t.amount : +t.amount; if (v > 0) by[t.category || 'A classificar'] = (by[t.category || 'A classificar'] || 0) + v; } return by; };
  const by = spent(0, 7), total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const prev = Object.values(spent(7, 35)).reduce((a, b) => a + b, 0) / 4, hey = t => t[0].toUpperCase() + t.slice(1);
  if (!total) return { id: 'semanal', title: hey('nenhum gasto lançado na semana'), text: `${prev ? `Numa semana normal são ${R(prev)}. ` : ''}Lancem os do pix e do dinheiro falando: leva 5 segundos.`, url: '/?tab=lancar' };
  const diff = total - prev, near = prev >= 1 && Math.abs(diff) < prev * 0.1;
  const title = prev >= 1 ? (near ? `Semana: ${R(total)}, perto do normal` : `Semana: ${R(diff)} ${diff > 0 ? 'acima' : 'abaixo'} do normal`) : `Semana: ${R(total)} em gastos`;
  return { id: 'semanal', title, text: `Foram ${R(total)} em 7 dias.${top[0] ? ` ${top[0][0]} foi o que mais pesou: ${R(top[0][1])}.` : ''}`, url: '/?tab=resumo' };
}

// Evening reminder (21h in Brazil): only for people who launched nothing today, once a day.
// Families with no data at all get the first step (send the statement) instead of the voice reminder.
export const reminderMessage = (name, { empty = false } = {}) => empty
  ? { title: 'Para onde foi o dinheiro deste mês?', body: 'Mande a última fatura do cartão (PDF, foto ou print): em 2 minutos você vê.', url: '/?acao=pdf', tag: 'lembrete' }
  : ({ title: 'Teve pix ou dinheiro hoje?', body: 'Toque e fale em 5 segundos: o app lança para você.', url: '/?acao=voz', tag: 'lembrete' });

// Real-time family notices (api/notify.js): tells the OTHER members when someone joins, imports or closes a month.
const MES_N = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mName = k => /^\d{4}-\d{2}$/.test(k || '') ? MES_N[+k.slice(5) - 1] : 'mês';

const MISSION_TITLES = Object.fromEntries(missionList({}).filter(m => m.starter).map(m => [m.key, m.title]));
export function message({ type, name, to = '', family, source, month, key }) {
  const hey = t => t[0].toUpperCase() + t.slice(1);
  if (type === 'joined') return { title: hey(`${name} entrou na família`), body: `Agora vocês veem os mesmos números da ${family}. Combinem as metas juntos em Metas.`, url: '/?tab=resumo', tag: 'familia-joined' };
  if (type === 'imported') return { title: hey(`${name} mandou ${source === 'cartao' ? 'a fatura' : 'o extrato'} de ${mName(month)}`), body: 'A sobra de vocês no mês já está atualizada. Toque para ver para onde foi o dinheiro.', url: '/?tab=resumo', tag: 'familia-imported' };
  if (type === 'conquista') {
    const [kind, k] = String(key || '').split(':'), m = kind === 'missao' && MISSION_TITLES[k];
    if (kind === 'missao' && m) return { title: hey(`${name} cumpriu uma missão`), body: `${m}: feito! Vejam o que falta para vocês em Missões e conquistas.`, url: '/?tab=ajustes&sec=conquistas', tag: 'familia-conquista' };
    if (kind === 'desafio' && /^[a-z_]{2,20}$/.test(k || '')) return { title: hey('vocês cumpriram o desafio do mês'), body: 'Ganharam o selo "Desafio cumprido". Vejam o próximo em Missões e conquistas.', url: '/?tab=ajustes&sec=conquistas', tag: 'familia-conquista' };
    return null;
  }
  if (type === 'closed') return { title: hey(`${name} fechou ${mName(month)}`), body: `Vejam juntos a retrospectiva de ${mName(month)}: o que vocês guardaram e o que mais pesou.`, url: '/?tab=fechar', tag: 'familia-closed' };
  return null;
}

