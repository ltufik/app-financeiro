// Ferramentas (3.1): every tool of the app in one place, with the everyday name and one line on what it does.
// Open tools open with one tap; tools still locked by the trail show the step that opens them and, on tap, what to do.
import { S } from '../state.js';
import { esc } from '../lib/format.js';
import { TOOLS } from '../lib/trail.js';
import { trailNow, openTool } from '../trail.js';
import { track } from '../usage.js';

// Order on screen: what the family uses every week first.
export const TOOL_ORDER = ['gastos', 'perguntar', 'sobra', 'previsao', 'fechar', 'semana', 'metas', 'contas_casa', 'contas_ano', 'divisao', 'patrimonio', 'retro'];
const MARK = { gastos: 'G', perguntar: '?', sobra: '=', previsao: '→', fechar: '✓', semana: '7', metas: '★', contas_casa: '⌂', contas_ano: 'A', divisao: '½', patrimonio: '$', retro: '◷' };

export function render(el) {
  const st = trailNow(), cur = st.current;
  const rows = TOOL_ORDER.filter(id => TOOLS[id]).map(id => {
    const t = TOOLS[id], open = st.open.has(id);
    return `<button class="tool${open ? '' : ' locked'}" type="button" data-tool="${id}">
      <span class="tool-ic" aria-hidden="true">${open ? MARK[id] || '•' : t.step}</span>
      <span class="tool-t"><strong>${esc(t.name)}</strong><span>${esc(t.desc)}</span></span>
      <span class="tool-tag">${open ? 'Abrir' : 'Etapa ' + t.step}</span></button>`;
  }).join('');
  const locked = st.locked.length;
  el.innerHTML = `<div class="panel stack">
    <h2>Ferramentas</h2>
    <p class="small muted">${locked ? `Tudo o que o app faz. As de borda tracejada abrem quando vocês terminam a etapa da trilha${cur ? `: agora é a ${cur.n}, "${esc(cur.title)}"` : ''}.` : 'Tudo o que o app faz, num lugar só.'}</p>
    <div class="tools">${rows}</div>
    <p class="tiny muted" id="toolMsg" aria-live="polite"></p>
  </div>`;
  el.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => {
    const id = b.dataset.tool;
    if (trailNow().open.has(id)) return openTool(id);
    track('ferramentas.trancada_' + id);
    const s = trailNow().steps.find(x => x.n === TOOLS[id].step), now = trailNow().current;
    const msg = el.querySelector('#toolMsg');
    msg.innerHTML = `<strong>${esc(TOOLS[id].name)}</strong> abre na etapa ${TOOLS[id].step}${s ? ` ("${esc(s.title)}")` : ''}. ${now ? `Agora é a etapa ${now.n}: ${esc(now.title)}. <button class="linkbtn" type="button" id="toolGo">Fazer agora</button>` : ''}`;
    msg.querySelector('#toolGo')?.addEventListener('click', () => { track('ferramentas.fazer_etapa'); S.go('resumo', '#stepsBox'); });
  });
}
