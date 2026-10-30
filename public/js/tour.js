// Welcome tour: a swipeable carousel for people who have never used a finance app.
import { $ } from './ui.js';
import { photo } from './photos.js';

const SLIDES = [
  { art: 'welcome', ph: 'beach', title: 'O dinheiro da família, num lugar só', text: 'Veja quanto sobra no mês, onde dá para economizar e quando vocês chegam na meta.' },
  { art: 'pdf', ph: 'laptop', title: 'Mande a fatura e o extrato', text: 'Baixe o PDF no app do banco e envie aqui. O app lê tudo, confere os totais e separa por categoria. Você só revisa e salva.', note: 'PDF com senha funciona. O arquivo e a senha não ficam guardados.' },
  { art: 'voice', ph: 'kitchen', title: 'Gastou? É só falar', text: 'Toque no microfone e diga, por exemplo: "gastei 80 na farmácia no cartão". O app entende e lança para você.' },
  { art: 'sobra', ph: 'charts', title: 'Saiba quanto sobra', text: 'Sobra é o que entra menos o que sai no dia a dia. O app mostra a sobra do mês, a fatura do cartão e o quanto falta para a meta.' },
  { art: 'ask', ph: 'house', title: 'Pergunte o que quiser', text: '"Quanto gastei com delivery?", "Onde corto R$ 500 por mês?", "Quando chego em R$ 1 milhão?". O assistente responde com os seus números.' },
  { art: 'family', ph: 'family', title: 'Use junto com quem divide as contas', text: 'Convide seu par com um código. Vocês veem os mesmos números. Ninguém de fora tem acesso.' },
];

let el = null, i = 0, opts = null;

export function openTour(o = {}) {
  opts = o; i = 0;
  const slides = [...SLIDES, { art: 'start', ph: 'beach', title: o.finalTitle || 'Vamos começar?', text: o.finalText || 'Leva poucos minutos.', cta: o.finalLabel || 'Começar' }];
  el = document.createElement('div');
  el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Apresentação do app');
  el.innerHTML = `<div class="tour-card">
    <div class="tour-top"><span class="tiny muted" id="tourCount"></span><button class="tour-skip" type="button" id="tourSkip">Pular</button></div>
    <div class="tour-view"><div class="tour-track">${slides.map((s, k) => `<section class="tour-slide" aria-hidden="${k !== 0}">
      ${photo(s.ph, { w: 800, ratio: '16 / 11', fallback: s.art, cls: 'tour-photo' })}
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
