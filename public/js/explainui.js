// "Ver a conta": the table under a number (rows from lib/explain.js or lib/monthend.js forecastBreakdown).
import { esc, brl0 } from './lib/format.js';
import { track } from './usage.js';
export const calcBox = (rows, { id = '', foot = '' } = {}) => !rows?.length ? '' : `<details class="fc-calc"${id ? ` id="calc_${id}" data-calc="${id}"` : ''}><summary class="small">Ver a conta</summary><table class="small"><tbody>${rows.map(r => `<tr class="fc-${r.kind}"><td>${esc(r.label)}</td><td class="num">${typeof r.value === 'string' ? esc(r.value) : (r.kind !== 'note' && r.value < 0 ? '− ' : '') + brl0(Math.abs(r.value))}</td></tr>`).join('')}</tbody></table>${foot ? `<p class="tiny muted">${esc(foot)}</p>` : ''}</details>`;
// One listener for every "Ver a conta" (counts which ones people open).
document.addEventListener('toggle', e => { const d = e.target; if (d?.dataset?.calc && d.open) track('conta.' + d.dataset.calc); }, true);
