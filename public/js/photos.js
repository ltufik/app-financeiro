// Real photos (free Unsplash License, hotlinked from Unsplash as their guidelines ask).
// Each photo falls back to the matching SVG scene when it can't load (offline, blocked).
import { SCENES, HERO } from './art.js';

const U = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70`;

export const PHOTOS = {
  family:  { id: 'photo-1770871821382-60ea99b0a941', by: 'Aleksandra Sapozhnikova', alt: 'Família correndo junta num jardim ensolarado' },
  laptop:  { id: 'photo-1664575602276-acd073f104c1', by: 'Microsoft 365', alt: 'Pessoa sentada à mesa usando o notebook' },
  kitchen: { id: 'photo-1761839258568-fd466a93f68b', by: "Land O'Lakes", alt: 'Família cozinhando junta numa cozinha clara' },
  charts:  { id: 'photo-1707157284454-553ef0a4ed0d', by: 'Jakub Żerdzicki', alt: 'Mesa com celular e gráficos de gastos' },
  house:   { id: 'photo-1721222204126-e7042f2893b1', by: 'Sanju Pandita', alt: 'Casa moderna com piscina e jardim' },
  beach:   { id: 'photo-1767449985562-013c41bd7fda', by: 'Kristaps Ungurs', alt: 'Praia vista de cima, com o mar encontrando a areia' },
};

// photo(key, {w, ratio, fallback}) -> HTML of a figure with credit and an SVG fallback.
export function photo(key, { w = 900, ratio = '4 / 3', fallback = '', cls = '' } = {}) {
  const p = PHOTOS[key];
  const fb = fallback === 'hero' ? HERO : (SCENES[fallback] || '');
  return `<figure class="photo ${cls}" style="aspect-ratio:${ratio}">
    <img src="${U(p.id)}&w=${w}" srcset="${U(p.id)}&w=${Math.round(w / 2)} ${Math.round(w / 2)}w, ${U(p.id)}&w=${w} ${w}w" sizes="(max-width:560px) 100vw, 520px"
      alt="${p.alt}" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('figure').classList.add('off')">
    <figcaption>Foto: ${p.by} / Unsplash</figcaption>
    <div class="photo-fb">${fb}</div>
  </figure>`;
}
