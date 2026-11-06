// "Gastos do ano" (menu ☰ → Família e metas): IPVA, IPTU, school and the like. The app finds them in the history,
// the family confirms, and the page shows the next months' calendar, how much to set aside per month and, for each
// one, whether to pay at once or in installments given the family's situation. Rules in lib/annual.js.
import { S, settings, goals, closedKeys, calcMonth, txsOf } from './state.js';
import * as db from './db.js';
import { esc, brl0, todayISO, mLong } from './lib/format.js';
import { toast, confirmInline, invalid, clearInvalid } from './ui.js';
import { track } from './usage.js';
import { checkNumber, checkName } from './lib/validate.js';
import { IPVA_RULES, IPTU_SP, UFS, KINDS, detectAnnual, extraMonths, calendar, setAside, payAdvice, nextValue, fipeFromIpva, paidThisYear, effectiveItems, vehicleSuggestions, isVehicle, ipvaOf } from './lib/annual.js';
import { investNow } from './lib/debt.js';
import { feesOf } from './lib/bankfees.js';

const MES = n => ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][(n - 1 + 12) % 12];
const pctTxt = v => Math.round((+v || 0) * 100) + '%';

// What the family has: investments, an emergency reserve of 3 months of spending, the usual leftover,
// months in the red and card interest lately.
export function familyFactors() {
  const ks = closedKeys('conta').filter(k => k < todayISO().slice(0, 7)), last = ks.slice(-6), c = last.map(calcMonth), c3 = c.slice(-3);
  const avg = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
  return { invest: investNow(settings().invest, goals().ret ?? 0.1, todayISO()).value, reserve: 3 * avg(c3, x => x.out), avgLeft: Math.max(0, avg(c3, x => x.res)), redMonths: c.filter(x => x.res < 0).length, interest: feesOf(last.slice(-3).flatMap(txsOf)).by.juros, ret: goals().ret ?? 0.1 };
}
export const annualItems = () => settings().annual || [];
// Months until an item's first payment (from today), for "separem por mês até lá".
const monthsTo = start => { const m = +todayISO().slice(5, 7); return ((start - m + 12) % 12) || 12; };
export function annualPlan() {
  const raw = annualItems(), assets = settings().assets || [], items = effectiveItems(raw, assets), ex = extraMonths(S.txs, S.catIdx, todayISO()), cal = calendar(items.filter(i => !i.gone), ex, todayISO(), 6), skip = settings().annualSkip || [];
  return { raw, items, assets, cal, aside: setAside(cal), next3: cal.slice(0, 3).reduce((a, m) => a + m.total, 0), found: detectAnnual(S.txs, todayISO(), [...skip, ...raw.map(i => i.key).filter(Boolean)]), vehicles: vehicleSuggestions(raw, assets, skip), noState: assets.filter(a => a.name && isVehicle(a) && !a.uf) };
}

async function saveAnnual(items, skip) {
  const st = settings(), next = { ...st, annual: items, ...(skip ? { annualSkip: skip } : {}) };
  await db.saveSettings(S.hh.id, next); S.hh.settings = next;
}
// A found payment becomes an item with the rules of its state (IPVA) or city (IPTU, São Paulo as the example).
function fromFound(f, uf = 'SP', assetName = null) {
  if (assetName) return { id: 'a' + Date.now().toString(36), key: f.key, kind: f.kind, name: 'IPVA do ' + assetName, assetName, lastPaid: f.total, value: f.total, start: f.start, mode: f.mode, parcelas: f.parcelas, from: f.name };
  const rule = f.kind === 'ipva' ? IPVA_RULES[uf] || {} : f.kind === 'iptu' ? IPTU_SP : {};
  const name = f.kind === 'ipva' ? 'IPVA' : f.kind === 'iptu' ? 'IPTU' : f.kind === 'licenciamento' ? 'Licenciamento' : f.name;
  return { id: 'a' + Date.now().toString(36), key: f.key, kind: f.kind, name, lastPaid: f.total, value: f.total, uf: f.kind === 'ipva' || f.kind === 'licenciamento' ? uf : null, tipo: 'car',
    start: rule.start || f.start, mode: f.mode, parcelas: f.mode === 'parcelado' ? Math.max(f.parcelas, rule.parc || 1) : rule.parc || 1, maxParc: Math.max(f.parcelas, rule.parc || 1), desc: rule.desc || 0, from: f.name };
}

export function renderAnnual(box) {
  const P = annualPlan(), F = familyFactors(), sel = (opts, v) => opts.map(([o, l]) => `<option value="${o}"${String(v) === String(o) ? ' selected' : ''}>${l}</option>`).join('');
  const vehicles = P.assets.filter(a => a.name && isVehicle(a)), closest = paid => (vehicles.map(a => ({ a, q: ipvaOf(a) })).filter(x => x.q).sort((x, y) => Math.abs(x.q.atOnce - paid) - Math.abs(y.q.atOnce - paid))[0] || { a: vehicles[0] }).a?.name || '';
  box.innerHTML = `<h3>Gastos do ano</h3>
    <p class="small muted">IPVA, IPTU, escola e outros que voltam todo ano. O app acha no histórico, vocês confirmam, e ele avisa com antecedência quanto separar.</p>
    ${P.noState.length ? `<div class="dpay"><p class="small">Para calcular o IPVA certo, diga em que estado ${P.noState.map(a => esc(a.name)).join(' e ')} ${P.noState.length > 1 ? 'são registrados' : 'é registrado'}: a alíquota vai de 1% a 4% e o calendário muda de um estado para outro.</p><div><button class="btn primary" type="button" id="anGoPat">Completar no Patrimônio</button></div></div>` : ''}
    ${!vehicles.length ? '<p class="small">Tem carro ou moto? Cadastre em Patrimônio e dívidas (valor e estado de registro) e o app calcula o IPVA pela alíquota do estado.</p>' : ''}
    ${P.vehicles.length ? `<div class="stack">${P.vehicles.map((v, i) => `<div class="dpay"><p class="small"><strong>IPVA do ${esc(v.asset.name)} (${v.asset.uf})</strong>: ${brl0(v.q.base)} por ano (${pctTxt(v.q.rate)} de ${brl0(v.asset.value)})${v.q.desc ? `, ou ${brl0(v.q.atOnce)} à vista em ${MES(v.q.start)} com ${pctTxt(v.q.desc)} de desconto` : ''}. Incluir nos gastos do ano?</p>
      <div class="rowbtn"><button class="btn primary" type="button" data-vyes="${i}">Sim, incluir</button><button class="btn" type="button" data-vno="${i}">Não paga IPVA</button></div></div>`).join('')}</div>` : ''}
    ${P.cal.some(m => m.total) ? `<div class="anCal" id="anCal"><p class="small"><strong>Nos próximos 6 meses</strong></p>
      <ul class="pbars">${P.cal.map(m => `<li><span class="pm">${mLong(m.month).slice(0, 3)}</span><span class="pb"><i style="width:${Math.round(m.total / Math.max(...P.cal.map(x => x.total), 1) * 100)}%"></i></span><span class="pv num">${brl0(m.total)}</span></li>`).join('')}</ul>
      <p class="small">Para não apertar, <strong>separem ${brl0(P.aside)} por mês</strong> a partir de agora.</p>
      <details class="help"><summary>O que entra em cada mês</summary><ul class="small">${P.cal.filter(m => m.rows.length).map(m => `<li><strong>${mLong(m.month)}</strong>: ${m.rows.map(r => `${esc(r.name)} ${brl0(r.value)}`).join(', ')}</li>`).join('')}</ul></details></div>` : ''}
    ${P.found.length ? `<div class="stack anFound"><p class="small"><strong>Achamos estes pagamentos no histórico.</strong> Voltam todo ano?</p>${P.found.map((f, i) => `<div class="dpay" data-f="${i}">
      <p class="small"><strong>${esc(f.name)}</strong>: ${brl0(f.total)} ${f.mode === 'parcelado' ? `em ${f.months.length} parcelas, de ${MES(+f.months[0].slice(5))} a ${MES(+f.months[f.months.length - 1].slice(5))}` : `em ${MES(f.start)}`}${f.kind === 'ipva' ? '. É o IPVA?' : f.kind === 'iptu' ? '. É o IPTU?' : f.kind === 'licenciamento' ? '. É o licenciamento do veículo?' : ''}${f.once ? '<br><span class="tiny muted">Valor alto e uma vez só: pode ter sido um gasto que não se repete (como o ITBI de uma compra).</span>' : ''}</p>
      ${f.kind === 'ipva' && vehicles.length ? `<label class="f">De qual veículo?<select data-veh="${i}">${sel([...vehicles.map(a => [a.name, `${a.name}${a.uf ? ' (' + a.uf + ')' : ''}`]), ['', 'Outro (não está no patrimônio)']], closest(f.total))}</select></label>` : ''}
      ${(f.kind === 'ipva' && !vehicles.length) || f.kind === 'licenciamento' ? `<label class="f">Estado do veículo<select data-uf="${i}">${sel(UFS.map(u => [u, u]), 'SP')}</select></label>` : ''}
      <div class="rowbtn"><button class="btn${f.once ? '' : ' primary'}" type="button" data-yes="${i}">Sim, volta todo ano</button><button class="btn" type="button" data-no="${i}">${f.once ? 'Não, foi só uma vez' : 'Não'}</button></div></div>`).join('')}</div>` : ''}
    ${P.items.length ? `<div class="stack">${P.items.map((it, i) => { if (it.gone) return `<div class="dnow anItem" data-i="${i}"><p class="small"><strong>${esc(it.name)}</strong>: esse veículo saiu do patrimônio.</p><div class="rowbtn"><button class="btn" type="button" data-del="${i}">Tirar da lista</button></div></div>`; const nv = nextValue(it), adv = it.desc && it.parcelas > 1 ? payAdvice({ ...it, monthsTo: monthsTo(it.start) }, F) : null, fipe = it.kind === 'ipva' && it.uf ? fipeFromIpva(it.lastPaid || it.value, it.uf, it.tipo, it.paidDesc ? it.desc : 0) : null;
      return `<div class="dnow anItem" data-i="${i}"><p class="small"><strong>${esc(it.name)}</strong>${it.uf ? ` (${it.uf})` : ''}: ${it.fromAsset ? brl0(it.mode === 'avista' ? it.fromAsset.atOnce : it.fromAsset.base) : it.typed ? brl0(nv.value) : `cerca de ${brl0(nv.value)} <span class="tiny muted">(entre ${brl0(nv.low)} e ${brl0(nv.high)})</span>`}, a partir de ${MES(it.start)}</p>
        ${it.fromAsset ? `<p class="small">Pelo valor do ${esc(it.asset.name)} (${brl0(it.asset.value)}) e a alíquota de ${it.uf} (${pctTxt(it.fromAsset.rate)}): ${brl0(it.fromAsset.base)} por ano${it.fromAsset.desc ? `; à vista em ${MES(it.fromAsset.start)}, com ${pctTxt(it.fromAsset.desc)} de desconto: ${brl0(it.fromAsset.atOnce)}` : ''}${it.fromAsset.parc > 1 ? `; ou em até ${it.fromAsset.parc} parcelas de ${brl0(it.fromAsset.base / it.fromAsset.parc)}` : ''}.</p><p class="tiny muted">O estado usa a tabela FIPE do fim do ano anterior, então o valor pode mudar um pouco. Trocou de carro ou de estado? Atualize em Patrimônio e dívidas.</p>` : ''}
        <div class="grid3">
          ${it.fromAsset ? '' : `<label class="f">Valor no ano (R$)<input type="number" inputmode="decimal" step="0.01" min="0" data-k="value" value="${it.value || ''}"></label>
          <label class="f">Começa em<select data-k="start">${sel(Array.from({ length: 12 }, (_, m) => [m + 1, MES(m + 1)]), it.start)}</select></label>`}
          <label class="f">Como pagar<select data-k="pay">${sel([['avista', `À vista${it.desc ? ` (${pctTxt(it.desc)} de desconto)` : ''}`], ...Array.from({ length: Math.max(0, (it.maxParc || it.parcelas || 1) - 1) }, (_, p) => [p + 2, `${p + 2} parcelas`])], it.mode === 'parcelado' ? it.parcelas : 'avista')}</select></label>
          ${it.kind === 'ipva' && !it.fromAsset ? `<label class="f">Estado<select data-k="uf">${sel(UFS.map(u => [u, u]), it.uf || 'SP')}</select></label><label class="f">Veículo<select data-k="tipo">${sel([['car', 'Carro'], ['moto', 'Moto']], it.tipo)}</select></label>` : ''}
          ${it.fromAsset ? '' : `<label class="f">Desconto à vista (%)<input type="number" inputmode="decimal" step="0.5" min="0" max="50" data-k="desc" value="${Math.round((it.desc || 0) * 1000) / 10}"></label>`}
        </div>
        ${fipe && !it.fromAsset ? `<p class="tiny muted">Pelo IPVA pago, o veículo vale cerca de ${brl0(fipe)} na tabela do estado (${pctTxt(IPVA_RULES[it.uf][it.tipo === 'moto' ? 'moto' : 'car'])}). Isento (PCD, mais de 20 anos em SP, táxi)? Coloque o valor 0.</p>` : ''}
        ${(pd => pd.total ? `<p class="small">✓ Em ${todayISO().slice(0, 4)}: pago ${brl0(pd.total)} ${pd.months.length > 1 ? `em ${pd.months.length} parcelas` : `em ${MES(+pd.months[0].slice(5))}`}${(exp => exp && Math.abs(pd.total - exp) / exp > 0.03 && it.typed ? ` (${pd.total > exp ? 'mais' : 'menos'} que os ${brl0(exp)} previstos${it.fromAsset ? ' pelo valor de hoje do veículo' : ''})` : '')(pd.months.length === 1 ? (it.fromAsset ? it.fromAsset.atOnce : it.value * (1 - (it.desc || 0))) : it.value)}.</p>` : '')(paidThisYear(it, S.txs, todayISO(), P.items))}
        ${adv ? `<p class="small anAdv"><strong>Sugestão: ${adv.pick === 'avista' ? 'à vista' : 'parcelar'}.</strong> ${esc(adv.why)}</p>` : ''}
        <div class="rowbtn"><button class="linkbtn small" type="button" data-del="${i}">Tirar da lista</button></div></div>`; }).join('')}</div>` : ''}
    <details class="help" id="anAdd"><summary>Adicionar outro gasto do ano</summary><div class="stack">
      <div class="grid3"><label class="f">Tipo<select id="anKind">${sel(Object.entries(KINDS), 'escola')}</select></label>
      <label class="f">Nome<input id="anName" maxlength="60" placeholder="Ex.: Matrícula da escola"></label>
      <label class="f">Valor no ano (R$)<input id="anVal" type="number" inputmode="decimal" step="0.01" min="0"></label>
      <label class="f">Mês<select id="anMonth">${sel(Array.from({ length: 12 }, (_, m) => [m + 1, MES(m + 1)]), 2)}</select></label></div>
      <div><button class="btn" type="button" id="anAddGo">Adicionar</button></div></div></details>
    <p class="tiny muted">Regras do IPVA de 2026 por estado (início, parcelas, desconto à vista), conferidas nas Secretarias da Fazenda; o IPTU segue o exemplo de São Paulo (3% à vista, até 10 vezes, a partir de fevereiro) e dá para mudar. Valores estimados pelo que foi pago no último ano até chegar o valor de verdade.</p>`;

  // Found payments: yes (with the state) or no (it does not come back).
  box.querySelectorAll('[data-yes]').forEach(b => b.onclick = async () => {
    const f = P.found[+b.dataset.yes], uf = box.querySelector(`[data-uf="${b.dataset.yes}"]`)?.value || 'SP', veh = box.querySelector(`[data-veh="${b.dataset.yes}"]`)?.value || null;
    try { await saveAnnual([...P.raw, fromFound(f, uf, veh)]); track('ano.confirmou'); toast('Combinado: entra no calendário do ano.'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  box.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => {
    const f = P.found[+b.dataset.no];
    try { await saveAnnual(P.raw, [...(settings().annualSkip || []), f.key].slice(-100)); track('ano.nao_volta'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  // Vehicles of Patrimônio: include their IPVA (value and state come from there) or say it does not pay.
  box.querySelectorAll('[data-vyes]').forEach(b => b.onclick = async () => {
    const v = P.vehicles[+b.dataset.vyes], it = { id: 'a' + Date.now().toString(36), kind: 'ipva', name: 'IPVA do ' + v.asset.name, assetName: v.asset.name, mode: v.q.desc ? 'avista' : 'parcelado', parcelas: v.q.parc };
    try { await saveAnnual([...P.raw, it]); track('ano.confirmou'); toast('Combinado: o IPVA entra no calendário do ano.'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  box.querySelectorAll('[data-vno]').forEach(b => b.onclick = async () => {
    const v = P.vehicles[+b.dataset.vno];
    if (!await confirmInline(b, { text: `${esc(v.asset.name)} não paga IPVA (isento, por exemplo)?`, yes: 'Não paga' })) return;
    try { await saveAnnual(P.raw, [...(settings().annualSkip || []), v.key]); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  box.querySelector('#anGoPat')?.addEventListener('click', () => S.go('ajustes', null, 'patrimonio'));
  // Editing an item: each change saves (and the suggestion and the calendar follow).
  box.querySelectorAll('.anItem').forEach(card => {
    const i = +card.dataset.i;
    card.querySelectorAll('[data-k]').forEach(inp => inp.onchange = async () => {
      const it = { ...P.raw[i] }, k = inp.dataset.k, v = inp.value;
      if (k === 'value') { const e = checkNumber(v, { min: 0, max: 1e7, label: 'Valor' }); if (e) return invalid(inp, e); clearInvalid(inp); it.value = +v; it.typed = true; }
      else if (k === 'start') it.start = +v;
      else if (k === 'pay') { if (v === 'avista') it.mode = 'avista'; else { it.mode = 'parcelado'; it.parcelas = +v; } }
      else if (k === 'desc') { const e = checkNumber(v, { min: 0, max: 50, label: 'Desconto' }); if (e) return invalid(inp, e); it.desc = +v / 100; }
      else if (k === 'uf') { const r = IPVA_RULES[v] || {}; it.uf = v; it.start = r.start || it.start; it.desc = r.desc || 0; it.maxParc = r.parc || it.maxParc; }
      else if (k === 'tipo') it.tipo = v;
      const items = P.raw.map((x, j) => j === i ? it : x);
      try { await saveAnnual(items); track('ano.editou'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
    });
  });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const it = P.items[+b.dataset.del];
    if (!await confirmInline(b, { text: `Tirar ${esc(it.name)} dos gastos do ano?`, yes: 'Sim, tirar' })) return;
    try { await saveAnnual(P.raw.filter((_, j) => j !== +b.dataset.del), it.key ? [...(settings().annualSkip || []), it.key] : undefined); toast('Tirado da lista.'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  });
  box.querySelector('#anAddGo').onclick = async () => {
    const name = box.querySelector('#anName'), val = box.querySelector('#anVal');
    const en = checkName(name.value, 'o nome'); if (en) return invalid(name, en); clearInvalid(name);
    const ev = checkNumber(val.value, { min: 1, max: 1e7, label: 'Valor' }); if (ev) return invalid(val, ev); clearInvalid(val);
    const kind = box.querySelector('#anKind').value, uf = 'SP', rule = kind === 'ipva' ? IPVA_RULES[uf] : kind === 'iptu' ? IPTU_SP : {};
    const it = { id: 'a' + Date.now().toString(36), kind, name: name.value.trim(), value: +val.value, typed: true, start: +box.querySelector('#anMonth').value, mode: 'avista', parcelas: rule.parc || 1, maxParc: rule.parc || 1, desc: rule.desc || 0, uf: kind === 'ipva' ? uf : null, tipo: 'car' };
    try { await saveAnnual([...P.raw, it]); track('ano.adicionou'); toast('Adicionado ao calendário do ano.'); renderAnnual(box); } catch (e) { toast('Não foi possível salvar agora. ' + db.errorText(e)); }
  };
}
