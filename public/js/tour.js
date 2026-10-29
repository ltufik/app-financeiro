// Welcome tour: a swipeable carousel for people who have never used a finance app.
import { $ } from './ui.js';

const ART = {
  welcome: `<rect x="40" y="70" width="140" height="90" rx="14" fill="var(--card)" stroke="var(--accent)" stroke-width="4"/><path d="M62 140v-22M90 140v-40M118 140v-28M146 140v-52" stroke="var(--accent)" stroke-width="10" stroke-linecap="round"/><circle cx="168" cy="66" r="22" fill="var(--accent)"/><path d="M158 66l7 7 13-14" stroke="var(--accent-ink)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  pdf: `<path d="M70 40h60l28 28v100a10 10 0 0 1-10 10H70a10 10 0 0 1-10-10V50a10 10 0 0 1 10-10z" fill="var(--card)" stroke="var(--accent)" stroke-width="4"/><path d="M130 40v28h28" fill="none" stroke="var(--accent)" stroke-width="4"/><path d="M78 92h56M78 110h56M78 128h40" stroke="var(--bar)" stroke-width="6" stroke-linecap="round"/><circle cx="150" cy="150" r="24" fill="var(--accent)"/><path d="M139 150l8 8 14-15" stroke="var(--accent-ink)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  voice: `<rect x="88" y="40" width="44" height="78" rx="22" fill="var(--accent)"/><path d="M70 100a40 40 0 0 0 80 0M110 140v22M90 164h40" stroke="var(--accent)" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M40 80q-10 20 0 40M54 88q-6 12 0 24M180 80q10 20 0 40M166 88q6 12 0 24" stroke="var(--bar)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  sobra: `<circle cx="110" cy="105" r="62" fill="var(--card)" stroke="var(--sunk)" stroke-width="18"/><path d="M110 43a62 62 0 0 1 59 43" stroke="var(--accent)" stroke-width="18" fill="none"/><text x="110" y="112" text-anchor="middle" style="font:700 26px var(--display);fill:var(--ink)">20%</text><text x="110" y="134" text-anchor="middle" style="font:600 12px var(--body);fill:var(--muted)">sobrou</text>`,
  ask: `<path d="M44 60a16 16 0 0 1 16-16h100a16 16 0 0 1 16 16v54a16 16 0 0 1-16 16H92l-26 22v-22h-6a16 16 0 0 1-16-16z" fill="var(--card)" stroke="var(--accent)" stroke-width="4"/><path d="M70 76h80M70 96h52" stroke="var(--bar)" stroke-width="6" stroke-linecap="round"/><path d="M170 140l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="var(--warn)"/>`,
  family: `<circle cx="82" cy="78" r="22" fill="var(--accent)"/><circle cx="140" cy="78" r="22" fill="var(--bar)"/><path d="M44 158a38 38 0 0 1 76 0z" fill="var(--accent)"/><path d="M102 158a38 38 0 0 1 76 0z" fill="var(--bar)"/><rect x="88" y="160" width="46" height="14" rx="7" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/>`,
  start: `<path d="M70 170V44" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/><path d="M72 48h88l-18 24 18 24H72z" fill="var(--accent)"/><circle cx="70" cy="172" r="10" fill="var(--ink)"/>`,
};

const SLIDES = [
  { art: 'welcome', title: 'O dinheiro da família, num lugar só', text: 'Veja quanto sobra no mês, onde dá para economizar e quando vocês chegam na meta.' },
  { art: 'pdf', title: 'Mande a fatura e o extrato', text: 'Baixe o PDF no app do banco e envie aqui. O app lê tudo, confere os totais e separa por categoria. Você só revisa e salva.', note: 'PDF com senha funciona. O arquivo e a senha não ficam guardados.' },
  { art: 'voice', title: 'Gastou? É só falar', text: 'Toque no microfone e diga, por exemplo: "gastei 80 na farmácia no cartão". O app entende e lança para você.' },
  { art: 'sobra', title: 'Saiba quanto sobra', text: 'Sobra é o que entra menos o que sai no dia a dia. O app mostra a sobra do mês, a fatura do cartão e o quanto falta para a meta.' },
  { art: 'ask', title: 'Pergunte o que quiser', text: '"Quanto gastei com delivery?", "Onde corto R$ 500 por mês?", "Quando chego em R$ 1 milhão?". O assistente responde com os seus números.' },
  { art: 'family', title: 'Use junto com quem divide as contas', text: 'Convide seu par com um código. Vocês veem os mesmos números. Ninguém de fora tem acesso.' },
];

let el = null, i = 0, opts = null;

export function openTour(o = {}) {
  opts = o; i = 0;
  const slides = [...SLIDES, { art: 'start', title: o.finalTitle || 'Vamos começar?', text: o.finalText || 'Leva poucos minutos.', cta: o.finalLabel || 'Começar' }];
  el = document.createElement('div');
  el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Apresentação do app');
  el.innerHTML = `<div class="tour-card">
    <div class="tour-top"><span class="tiny muted" id="tourCount"></span><button class="tour-skip" type="button" id="tourSkip">Pular</button></div>
    <div class="tour-view"><div class="tour-track">${slides.map((s, k) => `<section class="tour-slide" aria-hidden="${k !== 0}">
      <svg class="tour-art" viewBox="0 0 220 200" aria-hidden="true"><circle cx="110" cy="105" r="92" fill="var(--accent-soft)"/>${ART[s.art]}</svg>
      <h2>${s.title}</h2><p>${s.text}</p>${s.note ? `<p class="tiny muted">${s.note}</p>` : ''}</section>`).join('')}</div></div>
    <div class="tour-dots" role="tablist">${slides.map((_, k) => `<button type="button" role="tab" aria-label="Passo ${k + 1}" data-k="${k}"></button>`).join('')}</div>
    <div class="tour-nav"><button class="btn" type="button" id="tourBack">Voltar</button><button class="btn primary" type="button" id="tourNext">Próximo</button></div>
  </div>`;
  document.body.append(el); document.body.style.overflow = 'hidden';
  const n = slides.length, track = el.querySelector('.tour-track');
  const go = k => {
    i = Math.max(0, Math.min(n - 1, k));
    track.style.transform = `translateX(${-i * 100}%)`;
    el.querySelectorAll('.tour-slide').forEach((s, k2) => s.setAttribute('aria-hidden', k2 !== i));
    el.querySelectorAll('.tour-dots button').forEach((d, k2) => d.setAttribute('aria-selected', k2 === i));
    $('#tourCount').textContent = `${i + 1} de ${n}`;
    $('#tourBack').style.visibility = i ? 'visible' : 'hidden';
    $('#tourNext').textContent = i === n - 1 ? slides[i].cta : 'Próximo';
    $('#tourSkip').style.visibility = i === n - 1 ? 'hidden' : 'visible';
  };
  $('#tourNext').onclick = () => i === n - 1 ? close(true) : go(i + 1);
  $('#tourBack').onclick = () => go(i - 1);
  $('#tourSkip').onclick = () => close(false);
  el.querySelectorAll('.tour-dots button').forEach(d => d.onclick = () => go(+d.dataset.k));
  el.onkeydown = e => { if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'Escape') close(false); };
  // swipe
  let x0 = null, dx = 0;
  const view = el.querySelector('.tour-view');
  view.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; track.style.transition = 'none'; }, { passive: true });
  view.addEventListener('touchmove', e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; track.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`; }, { passive: true });
  view.addEventListener('touchend', () => { track.style.transition = ''; if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); else go(i); x0 = null; });
  go(0); $('#tourNext').focus();
}

function close(finished) {
  el.remove(); el = null; document.body.style.overflow = '';
  opts.onClose && opts.onClose(finished);
}
