// "O ano de vocês": the year retrospective as full-screen stories (like the music apps' year in review).
// One idea per screen, big number, its own color; tap right/left (or swipe) to move, progress bars on top.
// The level (bronze, silver, gold, by percentage) is the high point; the last screen shares without amounts.
import { S, goals, settings, patrimonio, projectFor, needPmtFor } from './state.js';
import { yearRetro, yearLevel, yearMilestones } from './lib/closing.js';
import { feesOf } from './lib/bankfees.js';
import { brl0, pct, esc, mLong } from './lib/format.js';
import { toast } from './ui.js';
import { track } from './usage.js';

const MES = k => mLong(k).split(' de ')[0];
const cap = s => s[0].toUpperCase() + s.slice(1);

export function wrappedSlides(year) {
  const G = goals(), st = settings();
  const r = yearRetro({ year, txs: S.txs, idx: S.catIdx, goals: G, fees: feesOf(S.txs.filter(t => t.month.startsWith(year + '-'))), closed: st.closed || {} });
  if (!r.n) return { r, slides: [] };
  const lv = yearLevel(r), ms = yearMilestones({ year, per: r.per, txs: S.txs, idx: S.catIdx, debts: st.debts || [] });
  const fam = /^fam[ií]lia\b/i.test(S.hh.name || '') ? S.hh.name : 'família ' + (S.hh.name || '');
  const slides = [];
  slides.push({ bg: 'w-intro', html: `<p class="w-k">Retrospectiva</p><h2 class="w-h">O ${year} da ${esc(fam)}</h2><p class="w-t">${r.n === 12 ? 'O ano inteiro' : `${r.n} meses`} de números de verdade: ${r.count.toLocaleString('pt-BR')} lançamentos, ${r.closedCount ? `${r.closedCount} ${r.closedCount > 1 ? 'meses fechados' : 'mês fechado'}` : 'sem anotar nada à mão'}.</p><p class="w-tap">Toque para continuar →</p>` });
  slides.push({ bg: r.res >= 0 ? 'w-green' : 'w-red', html: `<p class="w-k">Vocês guardaram</p><div class="w-big">${brl0(r.res)}</div><p class="w-t">${pct(r.tx)} do que ganharam${r.meta ? `. A meta era ${pct(r.meta)}` : ''}.</p><p class="w-t">Em ${r.positive} de ${r.n} meses sobrou dinheiro.</p>` });
  if (r.best) slides.push({ bg: 'w-blue', html: `<p class="w-k">O melhor mês</p><div class="w-big">${cap(MES(r.best.month))}</div><p class="w-t">${brl0(r.best.res)} de sobra.</p>${r.worst && r.worst.month !== r.best.month ? `<p class="w-t w-dim">O mais difícil foi ${MES(r.worst.month)} (${brl0(r.worst.res)}).</p>` : ''}` });
  if (r.top.length) slides.push({ bg: 'w-orange', html: `<p class="w-k">Para onde mais foi</p><div class="w-big w-mid">${esc(r.top[0].name)}</div><p class="w-t">${brl0(r.top[0].value)}, ${pct(r.top[0].share)} das despesas.</p><ol class="w-list">${r.top.slice(1, 5).map(t => `<li>${esc(t.name)} <span>${brl0(t.value)}</span></li>`).join('')}</ol>` });
  if (r.big || r.fees) slides.push({ bg: 'w-purple', html: `${r.big ? `<p class="w-k">O maior gasto do dia a dia</p><div class="w-big w-mid">${brl0(r.big.value)}</div><p class="w-t">${esc(r.big.description)}, em ${MES(r.big.month)}.</p>` : ''}${r.fees ? `<p class="w-k" style="margin-top:22px">O banco cobrou</p><div class="w-big w-mid">${brl0(r.fees)}</div><p class="w-t w-dim">em juros, IOF, anuidade e tarifas.</p>` : ''}` });
  // Equity and the dream: where they stand and whether this year's pace takes them there.
  const P = patrimonio();
  if (P.rows.length || G.patrimonio) {
    const pace = Math.max(0, r.res / r.n), inv = P.rows.find(x => x.name === 'Investimentos');
    let dream = '';
    if (G.patrimonio) {
      const pts = projectFor(pace, 0), end = pts[pts.length - 1], need = Math.ceil(needPmtFor(0, G.patrimonio) / 50) * 50;
      dream = end >= G.patrimonio ? `<p class="w-t">No ritmo de ${year} (${brl0(pace)} por mês), vocês chegam ao sonho de ${brl0(G.patrimonio)}${G.ageGoal ? ` aos ${G.ageGoal} anos` : ''}. Estão no caminho.</p>`
        : `<p class="w-t">No ritmo de ${year} (${brl0(pace)} por mês), chegam a ${brl0(end)}${G.ageGoal ? ` aos ${G.ageGoal} anos` : ''}. Para o sonho de ${brl0(G.patrimonio)}, o ritmo precisa ser de ${brl0(need)} por mês.</p>`;
    }
    slides.push({ bg: 'w-teal', html: `<p class="w-k">O patrimônio de vocês hoje</p><div class="w-big">${brl0(P.total)}</div>${inv ? `<p class="w-t w-dim">Investimentos: ${brl0(inv.value)}${/estimado/.test(inv.note) ? ' (estimado)' : ''}.</p>` : ''}${dream}` });
  }
  if (ms.length) slides.push({ bg: 'w-pink', html: `<p class="w-k">Os marcos do ano</p><ul class="w-ms">${ms.map(m => `<li><span class="w-mi">${m.icon}</span><span><strong>${esc(m.title)}</strong><br>${esc(m.text)}</span></li>`).join('')}</ul>` });
  // The level: the high point.
  const nxt = lv.next ? (lv.next.level === 'ouro' ? `Para o ouro: guardar ${pct(r.meta || 0.2)} da renda${lv.next.steady ? '' : ' e ter sobra em 3 de cada 4 meses'}. Faltam ${Math.max(1, Math.round(lv.next.points * 100))} pontos.` : lv.next.level === 'prata' ? `Para a prata: guardar 10% da renda. Faltam ${Math.max(1, Math.round(lv.next.points * 100))} pontos.` : 'O próximo passo é fechar o ano com sobra. Dá para começar este mês.') : 'O nível mais alto. Vocês bateram a meta e foram constantes.';
  slides.push({ bg: 'w-lv-' + lv.level, html: `<p class="w-k">O nível de vocês em ${year}</p><div class="w-medal" aria-hidden="true">${{ ouro: '🥇', prata: '🥈', bronze: '🥉', inicio: '🌱' }[lv.level]}</div><div class="w-big">${lv.label}</div><p class="w-t">${pct(r.tx)} da renda guardada, sobra em ${r.positive} de ${r.n} meses.</p><p class="w-t w-dim">${nxt}</p>` });
  slides.push({ bg: 'w-end', html: `<p class="w-k">Compartilhe</p><h2 class="w-h">${lv.level === 'inicio' ? 'Um ano de começo.' : `${lv.label} em ${year}.`}</h2><p class="w-t">Só o nível e a porcentagem guardada vão junto, sem valores.</p><div class="w-btns"><button class="btn primary" type="button" id="wShare">Compartilhar</button><button class="btn" type="button" id="wPage">Ver tudo numa página</button></div>` });
  return { r, lv, slides };
}

export function openWrapped(year) {
  const { r, lv, slides } = wrappedSlides(year);
  if (!slides.length) { toast('Ainda não há meses completos (com o extrato da conta) neste ano.', 'info'); return; }
  track('retro.ano'); try { localStorage.setItem(`fin.retro.${S.hh?.id || ''}.${year}`, '1'); } catch (e) { /* private mode */ }
  let i = 0;
  const el = document.createElement('div'); el.id = 'wrapped'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Retrospectiva de ${year}`);
  el.innerHTML = `<div class="w-bars">${slides.map(() => '<span><i></i></span>').join('')}</div><button class="w-x" type="button" aria-label="Fechar">×</button><div class="w-slide" aria-live="polite"></div><button class="w-prev" type="button" aria-label="Anterior"></button><button class="w-next" type="button" aria-label="Próxima"></button>`;
  document.body.append(el); document.body.classList.add('cfm-open');
  const close = () => { el.remove(); document.body.classList.remove('cfm-open'); document.removeEventListener('keydown', key); };
  const show = n => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    el.className = slides[i].bg; el.querySelector('.w-slide').innerHTML = slides[i].html;
    el.querySelectorAll('.w-bars i').forEach((b, k) => b.style.width = k <= i ? '100%' : '0');
    const sh = el.querySelector('#wShare');
    if (sh) sh.onclick = async e => {
      e.stopPropagation(); track('retro.compartilhar');
      const text = lv.level === 'inicio' ? `${year} foi o ano em que a nossa família começou a ver para onde vai o dinheiro, com o Pra Onde Foi. Sem anotar nada e sem senha do banco: https://praondefoi.app.br` : `Nível ${lv.label} em ${year}: a nossa família guardou ${pct(r.tx)} do que ganhou, com o Pra Onde Foi. Sem anotar nada e sem senha do banco: https://praondefoi.app.br`;
      try { if (navigator.share) { await navigator.share({ title: `Retrospectiva ${year}`, text }); return; } await navigator.clipboard.writeText(text); toast('Texto copiado. É só colar no WhatsApp.'); }
      catch (err) { if (err?.name !== 'AbortError') toast('Não foi possível compartilhar agora.'); }
    };
    const pg = el.querySelector('#wPage'); if (pg) pg.onclick = e => { e.stopPropagation(); close(); S.closeMonth = 'ano:' + year; S.go('fechar'); };
  };
  el.querySelector('.w-x').onclick = close;
  el.querySelector('.w-prev').onclick = () => show(i - 1);
  el.querySelector('.w-next').onclick = () => i === slides.length - 1 ? null : show(i + 1);
  let x0 = null; el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); }, { passive: true });
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); };
  document.addEventListener('keydown', key);
  show(0);
}
