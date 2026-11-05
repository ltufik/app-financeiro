// Real photos of families and couples dealing with their bills.
// Each photo falls back to the matching SVG scene when it can't load (offline, blocked).
import { SCENES, HERO } from './art.js';

// Pexels License: free for commercial use, credit not required; hotlinked from images.pexels.com.
// Credits are kept here (`by`). Before the public launch, decide whether to show them (e.g. on an "Sobre" page).
const U = id => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop`;

// Each photo is used once in the app (no repeats).
export const PHOTOS = {
  lost:    { id: '6964111', by: 'Mikhail Nilov', alt: 'Casal na cozinha olhando as contas, ele com cara de assustado' },
  together:{ id: '6963026', by: 'Mikhail Nilov', alt: 'Casal organizando as finanças juntos no notebook' },
  bills:   { id: '6964105', by: 'Mikhail Nilov', alt: 'Casal conferindo as contas da casa com notebook e calculadora' },
  phone:   { id: '14599250', by: 'Vodafone x Rankin', alt: 'Casal à mesa anotando gastos no celular' },
  calc:    { id: '6963888', by: 'Mikhail Nilov', alt: 'Casal calculando as contas do mês juntos' },
  talk:    { id: '6963918', by: 'Mikhail Nilov', alt: 'Casal conversando sobre o planejamento financeiro' },
  family:  { id: '6297624', by: 'Kampus Production', alt: 'Mãe e filha juntas à mesa da sala' },
  happy:   { id: '4308016', by: 'Ketut Subiyanto', alt: 'Homem sorrindo com as contas em dia e a esposa ao lado' },
  // Year retrospective (stories): the feeling of each screen; worried ones only when the numbers are in the red.
  y_intro:   { id: '5779171', by: 'Pexels', alt: 'Família sorrindo junta para a câmera' },
  y_saved:   { id: '1602726', by: 'Pexels', alt: 'Moeda entrando no cofrinho' },
  y_red:     { id: '6964127', by: 'Mikhail Nilov', alt: 'Homem preocupado à mesa com as contas, ao lado da esposa' },
  y_best:    { id: '4262169', by: 'Pexels', alt: 'Família jantando e comemorando' },
  y_where:   { id: '6963056', by: 'Mikhail Nilov', alt: 'Casal conversando sobre as finanças na mesa da cozinha' },
  y_bank:    { id: '7735783', by: 'Pexels', alt: 'Casal fazendo o orçamento' },
  y_home:    { id: '7642037', by: 'Pexels', alt: 'Família na sala da casa nova segurando as chaves' },
  y_moments: { id: '7414910', by: 'Pexels', alt: 'Família se mudando para a casa nova' },
  y_level:   { id: '7743567', by: 'Pexels', alt: 'Família alegre se divertindo na praia' },
  y_start:   { id: '6964083', by: 'Mikhail Nilov', alt: 'Homem com as mãos no rosto, preocupado com as contas' },
  y_end:     { id: '30675902', by: 'Pexels', alt: 'Família caminhando na praia ao pôr do sol' },
};

// photo(key, {w, ratio, fallback}) -> HTML of a figure with credit and an SVG fallback.
export function photo(key, { w = 900, ratio = '4 / 3', fallback = '', cls = '' } = {}) {
  const p = PHOTOS[key];
  const fb = fallback === 'hero' ? HERO : (SCENES[fallback] || '');
  return `<figure class="photo ${cls}" style="aspect-ratio:${ratio}">
    <img src="${U(p.id)}&w=${w}" srcset="${U(p.id)}&w=${Math.round(w / 2)} ${Math.round(w / 2)}w, ${U(p.id)}&w=${w} ${w}w" sizes="(max-width:560px) 100vw, 520px"
      alt="${p.alt}" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('figure').classList.add('off')">
    <div class="photo-fb">${fb}</div>
  </figure>`;
}
