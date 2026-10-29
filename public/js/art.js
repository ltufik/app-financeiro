// Inline SVG illustrations. Colors come from CSS variables (--il-*), so they follow light and dark themes.

const person = ({ x, y, r = 15, skin, shirt, hair, long = false, scale = 1 }) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="-22" y="${r + 2}" width="44" height="46" rx="18" fill="${shirt}"/>
    <rect x="-5" y="${r - 2}" width="10" height="8" rx="3" fill="${skin}"/>
    <circle cx="0" cy="0" r="${r}" fill="${skin}"/>
    ${long
      ? `<path d="M${-r - 2} 2 C${-r - 4} ${-r - 6} ${r + 4} ${-r - 6} ${r + 2} 2 L${r + 3} ${r + 10} L${r - 4} ${r + 8} L${r - 4} -2 C${r / 2} ${-r / 2} ${-r / 2} ${-r / 2} ${-r + 4} -2 L${-r + 4} ${r + 8} L${-r - 3} ${r + 10} Z" fill="${hair}"/>`
      : `<path d="M${-r - 1} -1 C${-r} ${-r - 5} ${r} ${-r - 5} ${r + 1} -1 C${r / 2} ${-r / 2.2} ${-r / 2} ${-r / 2.2} ${-r - 1} -1 Z" fill="${hair}"/>`}
    <circle cx="${-r / 2.6}" cy="1" r="1.6" fill="var(--il-ink)"/><circle cx="${r / 2.6}" cy="1" r="1.6" fill="var(--il-ink)"/>
    <path d="M${-r / 3} ${r / 2.3} Q0 ${r / 1.6} ${r / 3} ${r / 2.3}" stroke="var(--il-ink)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>`;

const palm = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 0 C2 -30 4 -55 2 -80" stroke="var(--il-trunk)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g fill="var(--il-leaf)"><path d="M2 -80 C-20 -92 -40 -84 -48 -70 C-30 -80 -14 -78 2 -76Z"/><path d="M2 -80 C24 -94 44 -86 50 -70 C32 -80 16 -78 2 -76Z"/>
  <path d="M2 -80 C-6 -100 -26 -108 -40 -102 C-20 -98 -8 -90 2 -78Z"/><path d="M2 -80 C12 -102 32 -108 44 -100 C26 -98 12 -90 2 -78Z"/></g></g>`;

// Landing hero: a family at the table with a laptop, a bright glass house and a pool behind.
export const HERO = `<svg viewBox="0 0 400 270" class="hero-art" role="img" aria-label="Família sentada à mesa olhando as contas no notebook, com uma casa de vidro e piscina ao fundo">
  <rect width="400" height="270" rx="24" fill="var(--il-sky)"/>
  <circle cx="342" cy="46" r="20" fill="var(--il-sun)"/>
  <ellipse cx="70" cy="168" rx="110" ry="40" fill="var(--il-hill)"/><ellipse cx="380" cy="166" rx="90" ry="30" fill="var(--il-hill)"/>
  <!-- glass house -->
  <rect x="150" y="66" width="236" height="10" rx="2" fill="var(--il-white)"/>
  <rect x="206" y="76" width="166" height="40" fill="var(--il-glass)"/>
  <rect x="160" y="116" width="222" height="8" fill="var(--il-white)"/>
  <rect x="166" y="124" width="208" height="50" fill="var(--il-glass)"/>
  <g stroke="var(--il-frame)" stroke-width="2"><path d="M206 76v40M247 76v40M289 76v40M331 76v40M372 76v40M166 124v50M208 124v50M250 124v50M292 124v50M334 124v50M374 124v50"/></g>
  <g stroke="var(--il-white)" stroke-width="3" opacity=".55" stroke-linecap="round"><path d="M215 108l18-26M258 108l14-20M176 168l22-34M262 168l20-30M304 168l16-24"/></g>
  <rect x="300" y="132" width="26" height="42" fill="var(--il-wood)" opacity=".55"/>
  <!-- deck and pool -->
  <rect x="0" y="174" width="400" height="30" fill="var(--il-deck)"/>
  <rect x="176" y="178" width="196" height="18" rx="5" fill="var(--il-water)"/>
  <g stroke="var(--il-white)" stroke-width="2" opacity=".7" fill="none" stroke-linecap="round"><path d="M190 186q8 -4 16 0t16 0M250 189q8 -4 16 0t16 0M318 185q8 -4 16 0t16 0"/></g>
  ${palm(132, 178, 0.95)}
  <ellipse cx="380" cy="176" rx="22" ry="12" fill="var(--il-leaf)"/><ellipse cx="160" cy="178" rx="16" ry="9" fill="var(--il-leaf)"/>
  <!-- family -->
  ${person({ x: 96, y: 150, skin: 'var(--il-skin1)', shirt: 'var(--accent)', hair: 'var(--il-hair1)' })}
  ${person({ x: 146, y: 166, r: 11, skin: 'var(--il-skin3)', shirt: 'var(--il-sun)', hair: 'var(--il-hair2)', scale: 0.82 })}
  ${person({ x: 300, y: 150, skin: 'var(--il-skin2)', shirt: 'var(--blue)', hair: 'var(--il-hair1)', long: true })}
  <!-- table, laptop, mug -->
  <rect x="80" y="206" width="20" height="8" rx="4" fill="var(--accent)"/><rect x="280" y="206" width="22" height="8" rx="4" fill="var(--blue)"/>
  <rect x="34" y="210" width="332" height="12" rx="5" fill="var(--il-wood)"/>
  <rect x="60" y="222" width="8" height="40" rx="3" fill="var(--il-wood-dark)"/><rect x="332" y="222" width="8" height="40" rx="3" fill="var(--il-wood-dark)"/>
  <rect x="166" y="162" width="76" height="48" rx="5" fill="var(--il-ink)"/>
  <rect x="171" y="167" width="66" height="38" rx="2" fill="var(--il-white)"/>
  <g fill="var(--accent)"><rect x="178" y="190" width="7" height="10"/><rect x="189" y="184" width="7" height="16"/><rect x="200" y="188" width="7" height="12"/><rect x="211" y="178" width="7" height="22"/></g>
  <path d="M222 176l4 4 7-8" stroke="var(--accent)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M156 210h96l-6 -4h-84z" fill="var(--il-frame)"/>
  <rect x="320" y="196" width="14" height="14" rx="3" fill="var(--il-white)"/><path d="M334 200a4 4 0 0 1 0 7" stroke="var(--il-white)" stroke-width="2.5" fill="none"/>
</svg>`;

// Tour scenes (viewBox 220x180), one per message.
const frame = inner => `<svg class="tour-art" viewBox="0 0 220 180" aria-hidden="true"><rect width="220" height="180" rx="22" fill="var(--il-sky)"/>${inner}</svg>`;
const phone = (x, y, inner) => `<g transform="translate(${x} ${y})"><rect width="74" height="132" rx="12" fill="var(--il-ink)"/><rect x="5" y="10" width="64" height="112" rx="6" fill="var(--il-white)"/>${inner}</g>`;

export const SCENES = {
  welcome: frame(`
    <rect x="96" y="40" width="112" height="8" fill="var(--il-white)"/><rect x="104" y="48" width="98" height="56" fill="var(--il-glass)"/>
    <g stroke="var(--il-frame)" stroke-width="2"><path d="M104 48v56M128 48v56M153 48v56M178 48v56M202 48v56"/></g>
    <rect x="0" y="104" width="220" height="18" fill="var(--il-deck)"/><rect x="110" y="107" width="94" height="10" rx="4" fill="var(--il-water)"/>
    ${person({ x: 52, y: 92, skin: 'var(--il-skin1)', shirt: 'var(--accent)', hair: 'var(--il-hair1)', scale: 0.9 })}
    ${person({ x: 168, y: 92, skin: 'var(--il-skin2)', shirt: 'var(--blue)', hair: 'var(--il-hair1)', long: true, scale: 0.9 })}
    <rect x="20" y="138" width="180" height="9" rx="4" fill="var(--il-wood)"/>
    <rect x="86" y="104" width="50" height="34" rx="4" fill="var(--il-ink)"/><rect x="90" y="108" width="42" height="26" rx="2" fill="var(--il-white)"/>
    <g fill="var(--accent)"><rect x="96" y="124" width="5" height="7"/><rect x="104" y="119" width="5" height="12"/><rect x="112" y="122" width="5" height="9"/><rect x="120" y="115" width="5" height="16"/></g>`),
  pdf: frame(`
    <g transform="translate(18 34) rotate(-6)"><path d="M0 0h52l16 16v84H0z" fill="var(--il-white)" stroke="var(--il-frame)" stroke-width="2"/><path d="M52 0v16h16" fill="none" stroke="var(--il-frame)" stroke-width="2"/>
      <rect x="8" y="10" width="24" height="12" rx="3" fill="var(--bad)"/><text x="20" y="19.5" text-anchor="middle" style="font:700 8px var(--body);fill:#fff">PDF</text>
      <path d="M8 34h50M8 44h50M8 54h40M8 64h50M8 74h34" stroke="var(--il-line)" stroke-width="4" stroke-linecap="round"/></g>
    <path d="M96 92h22" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/><path d="M112 82l10 10-10 10" stroke="var(--accent)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${phone(132, 24, `<g style="font:600 7px var(--body)">${[['Mercado', 'var(--accent)'], ['Posto', 'var(--blue)'], ['Farmácia', 'var(--bad)'], ['Escola', 'var(--il-sun)'], ['Delivery', 'var(--accent)']].map(([t, c], i) => `<rect x="10" y="${18 + i * 20}" width="8" height="8" rx="2" fill="${c}"/><text x="22" y="${25 + i * 20}" style="fill:var(--il-ink)">${t}</text><path d="M56 ${20 + i * 20}l3 3 5-6" stroke="var(--accent)" stroke-width="1.8" fill="none" stroke-linecap="round"/>`).join('')}</g>`)}`),
  voice: frame(`
    ${person({ x: 62, y: 74, r: 18, skin: 'var(--il-skin2)', shirt: 'var(--blue)', hair: 'var(--il-hair1)', long: true })}
    <rect x="76" y="108" width="20" height="34" rx="5" fill="var(--il-ink)" transform="rotate(-18 86 125)"/>
    <path d="M100 96q8 6 0 14M108 90q14 12 0 26" stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="translate(118 26)"><rect width="92" height="56" rx="14" fill="var(--il-white)"/><path d="M14 56l-6 14 18-14z" fill="var(--il-white)"/>
      <text x="46" y="24" text-anchor="middle" style="font:600 9.5px var(--body);fill:var(--il-ink)">"gastei 80 na</text><text x="46" y="38" text-anchor="middle" style="font:600 9.5px var(--body);fill:var(--il-ink)">farmácia"</text></g>
    <g transform="translate(122 104)"><rect width="88" height="44" rx="10" fill="var(--accent)"/><text x="10" y="18" style="font:600 8px var(--body);fill:var(--accent-ink)">Farmácia · cartão</text><text x="10" y="34" style="font:700 12px var(--display);fill:var(--accent-ink)">R$ 80,00</text></g>`),
  sobra: frame(`
    <g transform="translate(28 22)"><rect width="164" height="136" rx="14" fill="var(--il-white)"/>
      <text x="14" y="22" style="font:600 9px var(--body);fill:var(--il-muted)">Sobrou em outubro</text>
      <text x="14" y="46" style="font:700 22px var(--display);fill:var(--il-ink)">R$ 2.650</text>
      <rect x="14" y="58" width="60" height="14" rx="7" fill="var(--accent-soft)"/><text x="44" y="68" text-anchor="middle" style="font:700 8px var(--body);fill:var(--accent)">poupança 18%</text>
      <g>${[24, 30, 18, 36, 28, 44].map((h, i) => `<rect x="${16 + i * 23}" y="${124 - h}" width="14" height="${h}" rx="3" fill="${i === 5 ? 'var(--accent)' : 'var(--il-line)'}"/>`).join('')}</g></g>`),
  ask: frame(`
    <path d="M40 30l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="var(--il-sun)"/>
    <g transform="translate(70 18)"><rect width="134" height="38" rx="14" fill="var(--il-ink)"/><text x="12" y="16" style="font:600 8.5px var(--body);fill:var(--il-white)">Onde corto R$ 500</text><text x="12" y="29" style="font:600 8.5px var(--body);fill:var(--il-white)">por mês?</text></g>
    <g transform="translate(16 66)"><rect width="168" height="96" rx="14" fill="var(--il-white)"/>
      ${[['Delivery', '−R$ 220', 0.8], ['Assinaturas', '−R$ 150', 0.55], ['Mercado', '−R$ 130', 0.48]].map(([t, v, w], i) => `<text x="12" y="${26 + i * 24}" style="font:600 8.5px var(--body);fill:var(--il-ink)">${t}</text><text x="156" y="${26 + i * 24}" text-anchor="end" style="font:700 8.5px var(--body);fill:var(--accent)">${v}</text><rect x="12" y="${31 + i * 24}" width="${144 * w}" height="5" rx="2.5" fill="var(--accent)" opacity=".3"/>`).join('')}</g>`),
  family: frame(`
    ${phone(20, 26, `<rect x="10" y="18" width="54" height="30" rx="8" fill="#25D366"/><text x="37" y="31" text-anchor="middle" style="font:600 6.5px var(--body);fill:#0b2e17">Entra na nossa</text><text x="37" y="41" text-anchor="middle" style="font:600 6.5px var(--body);fill:#0b2e17">família no app?</text><rect x="10" y="54" width="54" height="12" rx="4" fill="var(--il-glass)"/><text x="37" y="63" text-anchor="middle" style="font:600 6px var(--body);fill:var(--il-ink)">praondefoi/convite</text>`)}
    <path d="M100 92h18" stroke="var(--accent)" stroke-width="4" stroke-dasharray="4 5" stroke-linecap="round"/>
    ${person({ x: 150, y: 70, skin: 'var(--il-skin1)', shirt: 'var(--accent)', hair: 'var(--il-hair1)', scale: 0.85 })}
    ${person({ x: 186, y: 80, r: 12, skin: 'var(--il-skin3)', shirt: 'var(--il-sun)', hair: 'var(--il-hair2)', scale: 0.75 })}
    ${person({ x: 128, y: 82, skin: 'var(--il-skin2)', shirt: 'var(--blue)', hair: 'var(--il-hair1)', long: true, scale: 0.8 })}
    <rect x="104" y="132" width="108" height="22" rx="11" fill="var(--il-white)"/><path d="M114 143l4 4 8-9" stroke="var(--accent)" stroke-width="2.5" fill="none" stroke-linecap="round"/><text x="131" y="146.5" style="font:600 7.5px var(--body);fill:var(--il-ink)">os mesmos números</text>`),
  start: frame(`
    <path d="M70 152V40" stroke="var(--il-ink)" stroke-width="6" stroke-linecap="round"/><path d="M73 44h84l-16 22 16 22H73z" fill="var(--accent)"/>
    <circle cx="70" cy="154" r="9" fill="var(--il-ink)"/>
    <path d="M150 128l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="var(--il-sun)"/><path d="M178 104l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="var(--il-sun)"/>`),
};
