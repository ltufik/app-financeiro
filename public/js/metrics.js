// "Métricas do produto": the MVP funnel and retention, for the product owner (ADMIN_EMAILS).
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './lib/format.js';

const token = async () => (await db.sb.auth.getSession()).data?.session?.access_token || '';
export async function checkAdmin() {
  try { const r = await fetch('/api/metrics?probe=1', { headers: { authorization: 'Bearer ' + await token() } }); S.isAdmin = r.ok; } catch (e) { S.isAdmin = false; }
}
// One row per person per day the app is opened (only the day, nothing about what they did).
export function touchActivity() {
  const day = new Date().toISOString().slice(0, 10), k = 'fin.act.' + S.user.id;
  try { if (localStorage.getItem(k) === day) return; localStorage.setItem(k, day); } catch (e) { /* storage blocked */ }
  db.sb.rpc('touch_activity', { p_household: S.hh.id }).then(() => {}, () => {});
}

const P = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
export async function renderMetrics(box) {
  box.innerHTML = '<p class="small muted">Carregando...</p>';
  let m;
  try { const r = await fetch('/api/metrics', { headers: { authorization: 'Bearer ' + await token() } }); if (!r.ok) throw new Error(r.status); m = await r.json(); }
  catch (e) { box.innerHTML = '<p class="small">Não foi possível carregar as métricas agora.</p>'; return; }
  const funnel = [
    ['Criaram conta', m.users, m.users],
    ['Entraram numa família', m.in_family, m.users],
    ['Famílias com 1 mês importado', m.families_1_month, m.families],
    ['Famílias com 2 meses ou mais', m.families_2_months, m.families],
    ['Famílias que fecharam um mês', m.families_closed, m.families],
  ];
  const mx = Math.max(1, ...m.daily.map(d => d.users));
  box.innerHTML = `
    <div class="mgrid">
      ${[['Pessoas', m.users, `+${m.users_7d} nos últimos 7 dias`], ['Famílias', m.families, `${m.families_shared} com 2 pessoas ou mais`], ['Ativos na semana', m.wau, `${m.mau} no mês`], ['Voltaram depois de 7 dias', P(m.d7_retained, m.d7_eligible), `${m.d7_retained} de ${m.d7_eligible} pessoas`]]
        .map(([k, v, s]) => `<div class="mcard"><span class="tiny muted">${k}</span><span class="num">${v}</span><span class="tiny muted">${s}</span></div>`).join('')}
    </div>
    <h3>Funil</h3>
    <p class="tiny muted">O caminho que importa: entrar, mandar o primeiro mês e voltar no mês seguinte.</p>
    <div class="funnel">${funnel.map(([k, v, base]) => `<div class="frow"><span class="small">${k}</span><span class="fbar"><span style="width:${base ? v / base * 100 : 0}%"></span></span><span class="small num">${v} <span class="tiny muted">${P(v, base)}</span></span></div>`).join('')}</div>
    <h3>Retenção</h3>
    <ul class="list small">
      <li><span>Voltaram 7 dias ou mais depois do cadastro<br><span class="tiny muted">Entre quem se cadastrou há pelo menos 7 dias</span></span><span class="amt">${P(m.d7_retained, m.d7_eligible)} <span class="tiny muted">${m.d7_retained}/${m.d7_eligible}</span></span></li>
      <li><span>Voltaram 30 dias ou mais depois do cadastro<br><span class="tiny muted">Referência de mercado: cerca de 7% em apps de finanças</span></span><span class="amt">${P(m.d30_retained, m.d30_eligible)} <span class="tiny muted">${m.d30_retained}/${m.d30_eligible}</span></span></li>
    </ul>
    <h3>Pessoas por dia (14 dias)</h3>
    <div class="daily" role="img" aria-label="Pessoas que abriram o app por dia">${m.daily.map(d => `<span title="${esc(d.day.split('-').reverse().join('/'))}: ${d.users}"><i style="height:${d.users / mx * 100}%"></i><b class="tiny">${+d.day.slice(8)}</b></span>`).join('')}</div>
    <h3>Uso nos últimos 30 dias</h3>
    <ul class="list small">${[['PDFs importados', m.imports_30d], ['Lançamentos à mão ou por voz', m.manual_30d], ['Notas fiscais lidas', m.receipts_30d], ['Gráficos salvos (total)', m.charts], ['Estudos salvos no Perguntar (total)', m.studies], ['Celulares com avisos ligados', m.push_devices]].map(([k, v]) => `<li><span>${k}</span><span class="amt">${v}</span></li>`).join('')}</ul>
    <p class="tiny muted">Só números somados. Nenhum valor ou lançamento de família aparece aqui. Atualizado em ${new Date(m.at).toLocaleString('pt-BR')}.</p>`;
}
