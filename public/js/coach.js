// Guided walkthrough: balloons that point at the real buttons of the app.
// Shown on the first accesses (up to MAX_TIMES), until the person finishes it or ticks "Não mostrar mais".
import { $ } from './ui.js';

const MAX_TIMES = 3;
export const COACH_STEPS = [
  { sel: '.hero', tab: 'resumo', title: 'Quanto sobrou', text: 'Aqui fica a sobra do mês: o que entrou menos o que saiu no dia a dia. Embaixo, cartão, categorias e metas.' },
  { sel: '#monthSel', title: 'Escolha o mês', text: 'Troque o mês aqui. No fim da lista dá para ver o ano inteiro.' },
  { sel: '.tab[data-tab="lancar"]', title: 'Lançar', text: 'Mande a fatura, o extrato ou a foto de uma nota fiscal. Ou fale um gasto no microfone.' },
  { sel: '.tab[data-tab="graficos"]', title: 'Gráficos', text: 'Monte gráficos do seu jeito: pizza, linha ou barra, com o período e as categorias que quiser.' },
  { sel: '.tab[data-tab="perguntar"]', title: 'Perguntar', text: 'Pergunte em português: "quanto gastei com mercado?", "quando chego na meta?".' },
  { sel: '.tab[data-tab="extrato"]', title: 'Extrato', text: 'Todos os lançamentos. Toque na categoria para corrigir: o app aprende para as próximas vezes.' },
  { sel: '#menuBtn', title: 'Menu', text: 'Família e convites, metas, patrimônio, categorias, backup e a sua conta ficam aqui.' },
];

const key = (uid, k) => `fin.coach.${k}.${uid}`;
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

export function shouldCoach(user) {
  if (!user) return false;
  if (user.user_metadata?.coach_done || get(key(user.id, 'done')) === '1') return false;
  return (+get(key(user.id, 'n')) || 0) < MAX_TIMES;
}

let box = null;
// startCoach({user, go, onEnd(reason), onNever}) — reason: 'done' | 'skip' | 'never'
export function startCoach({ user, go, onEnd, onNever, force = false } = {}) {
  if (box) return;
  if (!force && !shouldCoach(user)) { onEnd && onEnd('none'); return; }
  if (!force) set(key(user.id, 'n'), String((+get(key(user.id, 'n')) || 0) + 1));
  const steps = COACH_STEPS.filter(s => s.tab || document.querySelector(s.sel));
  let i = 0;
  box = document.createElement('div');
  box.className = 'coach';
  box.innerHTML = `<div class="coach-spot" aria-hidden="true"></div>
    <div class="coach-tip" role="dialog" aria-modal="true" aria-labelledby="coachT" aria-describedby="coachX">
      <div class="coach-top"><span class="tiny muted" id="coachN"></span><button type="button" class="tour-skip" id="coachSkip">Pular</button></div>
      <h3 id="coachT"></h3><p class="small" id="coachX"></p>
      <label class="coach-never tiny"><input type="checkbox" id="coachNever"> Não mostrar mais</label>
      <div class="coach-nav"><button type="button" class="btn" id="coachBack">Voltar</button><button type="button" class="btn primary" id="coachNext">Próximo</button></div>
    </div>`;
  document.body.append(box);
  const spot = box.querySelector('.coach-spot'), tip = box.querySelector('.coach-tip');

  const place = () => {
    const s = steps[i], t = document.querySelector(s.sel);
    if (!t) return;
    const r = t.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, innerHeight * 0.5) + pad * 2 + 'px' });
    const tw = Math.min(340, innerWidth - 32), below = r.top + Math.min(r.height, innerHeight * 0.5) + pad + 14;
    tip.style.width = tw + 'px';
    tip.style.left = Math.max(16, Math.min(innerWidth - tw - 16, r.left + r.width / 2 - tw / 2)) + 'px';
    const th = tip.offsetHeight;
    tip.style.top = (below + th < innerHeight - 12 ? below : Math.max(12, r.top - pad - 14 - th)) + 'px';
  };
  const show = k => {
    i = Math.max(0, Math.min(steps.length - 1, k));
    const s = steps[i];
    if (s.tab && go) go(s.tab);
    const t = document.querySelector(s.sel);
    if (!t) { if (k < steps.length - 1) return show(k + 1); return end('done'); }
    t.scrollIntoView({ block: 'center' });
    $('#coachN').textContent = `${i + 1} de ${steps.length}`;
    $('#coachT').textContent = s.title; $('#coachX').textContent = s.text;
    $('#coachBack').style.visibility = i ? 'visible' : 'hidden';
    $('#coachNext').textContent = i === steps.length - 1 ? 'Entendi' : 'Próximo';
    requestAnimationFrame(place);
  };
  const end = reason => {
    const never = $('#coachNever')?.checked;
    if (reason === 'done' || never) { set(key(user.id, 'done'), '1'); onNever && onNever(); }
    removeEventListener('resize', place); removeEventListener('scroll', place, true);
    box.remove(); box = null;
    onEnd && onEnd(never ? 'never' : reason);
  };
  $('#coachNext').onclick = () => i === steps.length - 1 ? end('done') : show(i + 1);
  $('#coachBack').onclick = () => show(i - 1);
  $('#coachSkip').onclick = () => end('skip');
  box.addEventListener('keydown', e => { if (e.key === 'Escape') end('skip'); });
  addEventListener('resize', place); addEventListener('scroll', place, true);
  show(0); $('#coachNext').focus();
}
