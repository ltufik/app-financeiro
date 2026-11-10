// "Previsão do mês" on Início: how this month is likely to close and how much fits per day for the goal.
// Sharper with the open card bill (one number from the bank app); the Sunday 19h push asks for it.
import { S, settings } from './state.js';
import * as db from './db.js';
import { toast, confirmInline, invalid, clearInvalid } from './ui.js';
import { track } from './usage.js';
import { checkNumber } from './lib/validate.js';
import { todayISO, esc, brl0, mLong } from './lib/format.js';
import { forecast, forecastText, forecastBreakdown, checkinTarget } from './lib/monthend.js';

const brD = d => String(d || '').split('-').reverse().slice(0, 2).join('/');
export const familyForecast = () => forecast({ txs: S.txs, categories: S.categories, settings: settings(), today: todayISO() });

export function renderForecast(box) {
  if (!box) return;
  const f = familyForecast();
  box.hidden = !f; if (!f) { box.innerHTML = ''; return; }
  const me = S.members.find(m => m.user_id === S.user?.id)?.display_name || '';
  const t = forecastText(f, me), st = settings(), today = todayISO();
  const billIn = S.txs.some(x => x.month === today.slice(0, 7) && x.source === 'cartao' && !x.manual);
  const tg = checkinTarget(today, +st.cardCloseDay || 24, billIn);
  if (f.nextBill && tg.month === f.nextBill.month) tg.closeDate = f.nextBill.closeDate;
  const basis = f.basis === 'fatura' ? `Com a fatura de ${mLong(f.month)} já no app.` : f.basis === 'checkin' ? `Com a fatura aberta de ${brl0(f.checkin.value)} informada em ${brD(f.checkin.date)}.` : `Estimada pelo jeito de gastar de vocês nos últimos ${f.hist.length} meses. Fica mais certa com a fatura aberta.`;
  const tone = f.status === 'ok' ? 'good' : f.status === 'risco' ? 'warn' : 'bad';
  box.className = `panel fc fc-${tone}`;
  box.innerHTML = `<p class="eyebrow">Previsão do mês · atualize com um número</p><h3>${esc(t.title)}</h3>
    <p class="small">${esc(t.head)}</p><p class="small"><strong>${esc(t.day)}</strong></p>
    <p class="tiny muted">${esc(basis)}${t.counted ? ' ' + esc(t.counted) : ''}</p>
    ${t.next ? `<p class="small">${esc(t.next)}</p>` : ''}
    <details class="fc-calc" id="fcCalc"><summary class="small">Ver a conta</summary><table class="small"><tbody>${forecastBreakdown(f).map(r => `<tr class="fc-${r.kind}"><td>${esc(r.label)}</td><td class="num">${r.kind === 'note' ? brl0(r.value) : (r.value < 0 ? '− ' : '') + brl0(Math.abs(r.value))}</td></tr>`).join('')}</tbody></table>
      <p class="tiny muted">"Pela média" é a mediana dos últimos 3 meses completos de vocês. Uma conta que cai todo mês entra como fixa quando a categoria dela é de conta fixa (Menu → Categorias).</p></details>
    <div class="fc-ask" id="fcMore"><p class="small"><strong>${tg.closed ? `Quanto veio a fatura que fechou dia ${brD(tg.closeDate)}?` : `Quanto está a fatura aberta${tg.month !== today.slice(0, 7) ? ` de ${mLong(tg.month).split(' ')[0]}` : ''} hoje?`}</strong></p>
      <p class="tiny muted">${tg.closed ? 'O valor está no app do banco, na fatura fechada.' : `Está no app do banco (a fatura que fecha dia ${brD(tg.closeDate)}). Tem mais de um cartão? Some as faturas. Leva 10 segundos e deixa a previsão certa.`}</p>
      <div class="rowbtn"><label class="f" style="flex:1">Valor (R$)<input type="number" inputmode="decimal" step="0.01" min="0" id="fcAmount" placeholder="Ex.: 8450"></label><button class="btn primary" type="button" id="fcSave">Atualizar a previsão</button></div></div>`;
  if (S.openForecast) { S.openForecast = false; track('inicio.previsao_aviso'); }
  box.querySelector('#fcCalc')?.addEventListener('toggle', e => { if (e.target.open) track('inicio.previsao_conta'); });
  const btn = box.querySelector('#fcSave'); if (!btn) return;
  btn.onclick = async () => {
    const inp = box.querySelector('#fcAmount'); clearInvalid(box);
    const v = +String(inp.value).replace(',', '.'), e = checkNumber(inp.value === '' ? NaN : v, { min: 0, max: 1e7, label: 'O valor da fatura' });
    if (e) return invalid(inp, e);
    if (!await confirmInline(btn, { title: 'Atualizar a previsão?', text: `${brl0(v)} como ${tg.closed ? 'a fatura que fechou' : 'a fatura aberta de hoje'}. O app usa esse valor só para a previsão; os lançamentos continuam vindo do PDF.`, yes: 'Sim, atualizar' })) return;
    btn.disabled = true;
    try {
      const cur = settings(), next = { ...cur, checkins: [...(cur.checkins || []), { date: today, month: tg.month, value: Math.round(v * 100) / 100, by: S.user?.id || null }].slice(-40) };
      await db.saveSettings(S.hh.id, next); S.hh.settings = next; track('inicio.previsao_checkin');
      const nf = familyForecast(), nt = nf && forecastText(nf);
      toast(nt ? `Pronto! ${tg.month === today.slice(0, 7) ? nt.day : nt.next || nt.day}` : 'Pronto! Previsão atualizada.');
      S.render();
    } catch (err) { btn.disabled = false; toast('Não foi possível salvar agora. ' + db.errorText(err)); }
  };
}
