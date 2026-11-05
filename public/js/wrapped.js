// "O ano de vocês": the year retrospective as full-screen stories (like the music apps' year in review).
// One idea per screen, big number, its own color; tap right/left (or swipe) to move, progress bars on top.
// The level (bronze, silver, gold, by percentage) is the high point; the last screen shares without amounts.
import { S, goals, settings, patrimonio, projectFor, needPmtFor } from './state.js';
import { yearRetro, yearLevel, yearMilestones, yearOpportunities, yearEvolution } from './lib/closing.js';
import { feesOf } from './lib/bankfees.js';
import { brl0, pct, esc, mLong } from './lib/format.js';
import { toast } from './ui.js';
import { photo } from './photos.js';
import { track } from './usage.js';

const MES = k => mLong(k).split(' de ')[0];
const cap = s => s[0].toUpperCase() + s.slice(1);

// The month that closes the year so far ("até outubro"), and whether the year is complete (the year-end edition).
export const retroUpTo = r => r.months[r.months.length - 1];
const firstTime = () => { try { return !Object.keys(localStorage).some(k => k.startsWith(`fin.retro.${S.hh?.id || ''}.`)); } catch (e) { return false; } };

// Which edition the family has to see: it changes every time a month of the year is closed ("até outubro").
// Without any closed month, the first one appears once there are 3 complete months.
export function retroVersion(year) { return Object.keys(settings().closed || {}).filter(k => k.startsWith(year + '-')).sort().pop() || 'base'; }
export function retroSeen(year) { try { return localStorage.getItem(`fin.retro.${S.hh?.id || ''}.${year}`) === retroVersion(year); } catch (e) { return false; } }

// Savings rate per month, with the goal line: the year's evolution at a glance.
function evoSVG(e, meta) {
  const W = 320, H = 150, n = e.months.length, bw = W / n * 0.62, mx = Math.max(0.3, ...e.months.map(m => m.tx)), mn = Math.min(0, ...e.months.map(m => m.tx));
  const y = v => 10 + (mx - v) / (mx - mn) * (H - 30), z = y(0);
  return `<svg class="w-evo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Quanto guardaram em cada mês">${meta ? `<line x1="0" x2="${W}" y1="${y(meta)}" y2="${y(meta)}" stroke="currentColor" stroke-dasharray="4 4" opacity=".6"/>` : ''}<line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="currentColor" opacity=".5"/>
    ${e.months.map((m, i) => { const x = i * W / n + (W / n - bw) / 2, top = Math.min(y(m.tx), z), h = Math.max(2, Math.abs(y(m.tx) - z)); return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${m.tx < 0 ? '#FFB4B4' : 'currentColor'}"/><text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="currentColor">${MES(m.month).slice(0, 1).toUpperCase()}</text>`; }).join('')}</svg>`;
}

export function wrappedSlides(year) {
  const G = goals(), st = settings();
  const r = yearRetro({ year, txs: S.txs, idx: S.catIdx, goals: G, fees: feesOf(S.txs.filter(t => t.month.startsWith(year + '-'))), closed: st.closed || {} });
  if (!r.n) return { r, slides: [] };
  const lv = yearLevel(r), ms = yearMilestones({ year, per: r.per, txs: S.txs, idx: S.catIdx, debts: st.debts || [] });
  const fam = /^fam[ií]lia\b/i.test(S.hh.name || '') ? S.hh.name : 'família ' + (S.hh.name || '');
  const slides = [], final = r.n === 12 || (retroUpTo(r) === year + '-12'), upTo = MES(retroUpTo(r)), first = firstTime();
  // First time: what this is and how it works, before any number.
  if (first) slides.push({ bg: 'w-intro', img: 'y_intro', html: `<p class="w-k">A primeira retrospectiva de vocês</p><h2 class="w-h">O que os seus meses contam</h2><p class="w-t">Com os meses que vocês já mandaram, o app montou o ano até aqui: quanto guardaram, os marcos, o nível e onde dá para melhorar.</p><p class="w-t w-dim">A cada mês fechado, ela se atualiza. Em janeiro vem o fechamento do ano, completo.</p><p class="w-tap">Toque para continuar →</p>` });
  slides.push({ bg: final ? 'w-final' : 'w-intro', img: first ? null : 'y_intro', html: `<p class="w-k">${final ? 'Fechamento do ano' : `Retrospectiva até ${upTo}`}</p><h2 class="w-h">O ${year} da ${esc(fam)}</h2><p class="w-t">${r.n === 12 ? 'O ano inteiro' : `${r.n} meses`} de números de verdade: ${r.count.toLocaleString('pt-BR')} lançamentos, ${r.closedCount ? `${r.closedCount} ${r.closedCount > 1 ? 'meses fechados' : 'mês fechado'}` : 'sem anotar nada à mão'}.</p><p class="w-tap">Toque para continuar →</p>` });
  slides.push({ bg: r.res >= 0 ? 'w-green' : 'w-red', img: r.res >= 0 ? 'y_saved' : 'y_red', html: `<p class="w-k">Vocês guardaram</p><div class="w-big">${brl0(r.res)}</div><p class="w-t">${pct(r.tx)} do que ganharam${r.meta ? `. A meta era ${pct(r.meta)}` : ''}.</p><p class="w-t">Em ${r.positive} de ${r.n} meses sobrou dinheiro.</p>` });
  if (r.best) slides.push({ bg: 'w-blue', img: r.best.res > 0 ? 'y_best' : 'y_red', html: `<p class="w-k">O melhor mês</p><div class="w-big">${cap(MES(r.best.month))}</div><p class="w-t">${brl0(r.best.res)} de sobra.</p>${r.worst && r.worst.month !== r.best.month ? `<p class="w-t w-dim">O mais difícil foi ${MES(r.worst.month)} (${brl0(r.worst.res)}).</p>` : ''}` });
  if (r.top.length) slides.push({ bg: 'w-orange', img: 'y_where', html: `<p class="w-k">Para onde mais foi</p><div class="w-big w-mid">${esc(r.top[0].name)}</div><p class="w-t">${brl0(r.top[0].value)}, ${pct(r.top[0].share)} das despesas.</p><ol class="w-list">${r.top.slice(1, 5).map(t => `<li>${esc(t.name)} <span>${brl0(t.value)}</span></li>`).join('')}</ol>` });
  if (r.big || r.fees) slides.push({ bg: 'w-purple', img: 'y_bank', html: `${r.big ? `<p class="w-k">O maior gasto do dia a dia</p><div class="w-big w-mid">${brl0(r.big.value)}</div><p class="w-t">${esc(r.big.description)}, em ${MES(r.big.month)}.</p>` : ''}${r.fees ? `<p class="w-k" style="margin-top:22px">O banco cobrou</p><div class="w-big w-mid">${brl0(r.fees)}</div><p class="w-t w-dim">em juros, IOF, anuidade e tarifas.</p>` : ''}` });
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
    slides.push({ bg: 'w-teal', img: 'y_home', html: `<p class="w-k">O patrimônio de vocês hoje</p><div class="w-big">${brl0(P.total)}</div>${inv ? `<p class="w-t w-dim">Investimentos: ${brl0(inv.value)}${/estimado/.test(inv.note) ? ' (estimado)' : ''}.</p>` : ''}${dream}` });
  }
  if (ms.length) slides.push({ bg: 'w-pink', img: 'y_moments', html: `<p class="w-k">Os marcos do ano</p><ul class="w-ms">${ms.map(m => `<li><span class="w-mi">${m.icon}</span><span><strong>${esc(m.title)}</strong><br>${esc(m.text)}</span></li>`).join('')}</ul>` });
  // Evolution through the year (4 months or more).
  const evo = yearEvolution(r);
  if (evo) { const better = evo.second > evo.first + 0.01, worse = evo.second < evo.first - 0.01; slides.push({ bg: 'w-blue', html: `<p class="w-k">A evolução no ano</p>${evoSVG(evo, r.meta)}<p class="w-t">${better ? `Melhoraram: de ${pct(evo.first)} para ${pct(evo.second)} da renda guardada, da primeira para a segunda metade.` : worse ? `Caiu de ${pct(evo.first)} para ${pct(evo.second)} da renda guardada, da primeira para a segunda metade.` : `Constantes: cerca de ${pct(evo.second)} da renda guardada nas duas metades.`}</p>${r.meta ? '<p class="w-t w-dim">A linha tracejada é a meta de vocês.</p>' : ''}` }); }
  // Where they can do better: for everyone, first for whoever was in the red.
  const ops = yearOpportunities({ r, txs: S.txs, idx: S.catIdx });
  if (ops.length) slides.push({ bg: r.res < 0 || r.positive < r.n ? 'w-orange' : 'w-teal', html: `<p class="w-k">${r.res < 0 ? 'O caminho para sair do vermelho' : 'Onde dá para melhorar'}</p><ul class="w-ms">${ops.map(o => `<li><span class="w-mi">${o.icon}</span><span><strong>${esc(o.title)}</strong><br>${esc(o.text)}</span></li>`).join('')}</ul>` });
  // The level: the high point.
  const nxt = lv.next ? (lv.next.level === 'ouro' ? `Para o ouro: guardar ${pct(r.meta || 0.2)} da renda${lv.next.steady ? '' : ' e ter sobra em 3 de cada 4 meses'}. Faltam ${Math.max(1, Math.round(lv.next.points * 100))} pontos.` : lv.next.level === 'prata' ? `Para a prata: guardar 10% da renda. Faltam ${Math.max(1, Math.round(lv.next.points * 100))} pontos.` : 'O próximo passo é fechar o ano com sobra. Dá para começar este mês.') : 'O nível mais alto. Vocês bateram a meta e foram constantes.';
  slides.push({ bg: 'w-lv-' + lv.level + (final && lv.level !== 'inicio' ? ' w-confetti' : ''), img: lv.level === 'inicio' ? 'y_start' : 'y_level', html: `<p class="w-k">${final ? 'O nível de vocês em' : 'O nível até agora em'} ${year}</p><div class="w-medal" aria-hidden="true">${{ ouro: '🥇', prata: '🥈', bronze: '🥉', inicio: '🌱' }[lv.level]}</div><div class="w-big">${lv.label}</div><p class="w-t">${pct(r.tx)} da renda guardada, sobra em ${r.positive} de ${r.n} meses.</p><p class="w-t w-dim">${nxt}</p>` });
  slides.push({ bg: 'w-end', img: 'y_end', html: `<p class="w-k">Compartilhe</p><h2 class="w-h">${lv.level === 'inicio' ? 'Um ano de começo.' : `${lv.label} em ${year}.`}</h2><p class="w-t">Só o nível e a porcentagem guardada vão junto, sem valores.</p><div class="w-btns"><button class="btn primary" type="button" id="wShare">Compartilhar</button><button class="btn" type="button" id="wPage">Ver tudo numa página</button></div>` });
  return { r, lv, slides, final };
}

export function openWrapped(year) {
  const { r, lv, slides, final } = wrappedSlides(year);
  if (!slides.length) { toast('Ainda não há meses completos (com o extrato da conta) neste ano.', 'info'); return; }
  track('retro.ano'); try { localStorage.setItem(`fin.retro.${S.hh?.id || ''}.${year}`, retroVersion(year)); } catch (e) { /* private mode */ }
  // Load every photo now, so each screen shows its picture right away.
  const tmp = document.createElement('div'); slides.forEach(s => { if (s.img) { tmp.innerHTML = photo(s.img, { w: 900 }); const im = tmp.querySelector('img'); if (im) { const p = new Image(); p.srcset = im.srcset; p.sizes = im.sizes; p.src = im.src; } } });
  let i = 0;
  const el = document.createElement('div'); el.id = 'wrapped'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Retrospectiva de ${year}`);
  el.innerHTML = `<div class="w-bars">${slides.map(() => '<span><i></i></span>').join('')}</div><button class="w-x" type="button" aria-label="Fechar">×</button><div class="w-slide" aria-live="polite"></div><button class="w-prev" type="button" aria-label="Anterior"></button><button class="w-next" type="button" aria-label="Próxima"></button>`;
  document.body.append(el); document.body.classList.add('cfm-open');
  const close = () => { el.remove(); document.body.classList.remove('cfm-open'); document.removeEventListener('keydown', key); };
  const show = n => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    el.className = slides[i].bg; el.querySelector('.w-slide').innerHTML = (slides[i].img ? photo(slides[i].img, { w: 900, ratio: '4 / 3', fallback: 'family', cls: 'w-photo' }) : '') + slides[i].html;
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
