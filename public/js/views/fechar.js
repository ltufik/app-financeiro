// "Fechar o mês": guided closing of a month — missing statements, manual entries, uncategorized,
// fixed expenses that didn't show up, then the month's retrospective.
import { S, settings, monthKeys, goals, closeDay, reindex } from '../state.js';
import { checklist, retrospective, monthToClose } from '../lib/closing.js';
import { brl, brl0, pct, esc, mLong, todayISO, isoToBr, norm, round2, cycleMonth } from '../lib/format.js';
import * as db from '../db.js';
import { notifyFamily } from '../push.js';
import { settle } from '../lib/settle.js';
import { $, toast, catPicker, confirmInline, invalid, clearInvalid } from '../ui.js';
import { checkNumber, checkDate } from '../lib/validate.js';

const ck = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>';
const cap = s => s[0].toUpperCase() + s.slice(1);

export function render(el) {
  const st = settings(), closed = st.closed || {};
  const m = S.closeMonth && monthKeys().includes(S.closeMonth) ? S.closeMonth : monthToClose(monthKeys(), closed, todayISO());
  if (!m) {
    el.innerHTML = `<div class="subhead"><button class="chip" type="button" data-back>‹ Início</button><h2>Fechar o mês</h2></div>
      <div class="panel"><p class="small">Nenhum mês para fechar agora. Quando um mês terminar, o app lembra você aqui no Início.</p></div>`;
    el.querySelector('[data-back]').onclick = () => S.go('resumo');
    return;
  }
  S.closeMonth = m;
  const ignored = new Set((st.closeIgnore || {})[m] || []);
  const cl = checklist({ month: m, txs: S.txs, idx: S.catIdx, skip: st.closeSkip || {} });
  const missing = cl.missing.filter(x => !ignored.has(x.category));
  const r = retrospective({ month: m, txs: S.txs, idx: S.catIdx, goals: goals() });
  const isClosed = !!closed[m];
  const open = cl.data.filter(d => !d.done).length + cl.pending.length + missing.length;

  el.innerHTML = `<div class="subhead"><button class="chip" type="button" data-back>‹ Início</button><h2>${isClosed ? '' : 'Fechar '}${mLong(m)}</h2></div>
  ${isClosed ? `<p class="status ok">Mês fechado em ${isoToBr(closed[m].at)}${closed[m].by ? ' por ' + esc(closed[m].by) : ''}.</p>` : `<p class="small muted" style="margin:-6px 2px 0">${open ? `Faltam ${open} ${open > 1 ? 'coisas' : 'coisa'} para o mês ficar completo. Leva poucos minutos.` : 'Tudo certo. Veja a retrospectiva e feche o mês.'}</p>`}

  <section class="panel stack closestep ${cl.data.every(d => d.done) ? 'done' : ''}">
    <h3><span class="ck">${cl.data.every(d => d.done) ? ck : '1'}</span>Extrato e fatura</h3>
    <ul class="list small">${cl.data.map(d => `<li><span>${d.label}<br><span class="tiny muted">${d.done ? 'Recebido.' : d.key === 'cartao' ? `A fatura que vence em ${mLong(m)}.` : `O mês inteiro de ${mLong(m)}.`}</span></span>
      ${d.done ? `<span class="tiny muted">ok</span>` : `<span class="rowbtn"><button class="chip" type="button" data-send>Enviar PDF</button><button class="linkbtn tiny" type="button" data-skipsrc="${d.key}">Não uso</button></span>`}</li>`).join('')}</ul>
  </section>

  ${cl.manual.length ? `<section class="panel stack closestep">
    <h3><span class="ck">2</span>Lançados à mão</h3>
    <p class="tiny muted">Eles contam no mês até o extrato ou a fatura chegar. Na importação, os que baterem são juntados sozinhos. Apague só o que não aconteceu.</p>
    <ul class="list small">${cl.manual.map(t => `<li><span>${esc(isoToBr(t.date))} · ${esc(t.description)}<br><span class="tiny muted">${esc(t.category || 'A classificar')} · ${t.source === 'cartao' ? 'cartão' : 'conta'}</span></span><span class="rowbtn"><span class="amt">${brl(t.amount)}</span><button class="chip" type="button" data-delman="${t.id}">Apagar</button></span></li>`).join('')}</ul>
  </section>` : ''}

  <section class="panel stack closestep ${cl.pending.length ? '' : 'done'}">
    <h3><span class="ck">${cl.pending.length ? '3' : ck}</span>Para conferir${cl.pending.length ? ` <span class="tiny muted">${cl.pending.length}</span>` : ''}</h3>
    ${cl.pending.length ? `<p class="tiny muted">O app sugeriu uma categoria, mas não tem certeza. Toque em Ok para aceitar ou na categoria para trocar. Ele aprende e não pergunta de novo.</p>
      ${cl.pending.some(t => t.category && t.category !== 'A classificar') ? '<div><button class="btn" type="button" id="clOkAll">Aceitar todas as sugestões</button></div>' : ''}
      <ul class="list small pendlist" id="clPend"></ul>` : '<p class="small muted">Tudo conferido.</p>'}
  </section>

  <section class="panel stack closestep ${missing.length ? '' : 'done'}">
    <h3><span class="ck">${missing.length ? '4' : ck}</span>Despesas fixas que não apareceram</h3>
    ${missing.length ? `<p class="tiny muted">Costumam aparecer todo mês, mas não estão em ${mLong(m)}. Faltou lançar?</p>
      <ul class="list small" id="clMiss">${missing.map((x, i) => `<li data-i="${i}"><span>${esc(x.category)}<br><span class="tiny muted">Média dos últimos meses: ${brl(x.avg)}</span></span>
        <span class="rowbtn"><button class="chip" type="button" data-add="${i}">Lançar</button><button class="linkbtn tiny" type="button" data-ign="${i}">Não teve</button></span></li>`).join('')}</ul>` : '<p class="small muted">Nenhuma despesa fixa faltando.</p>'}
  </section>

  <section class="panel stack retro">
    <h3>Retrospectiva de ${mLong(m)}</h3>
    <div class="retro-big ${r.res < 0 ? 'neg' : ''}"><span class="tiny">Sobra</span><span class="num">${brl(r.res)}</span><span class="small">${r.renda ? `${pct(r.tx)} da renda${r.meta ? ` · meta ${pct(r.meta)}` : ''}` : ''}</span></div>
    <p class="small">${retroText(r)}</p>
    <div class="row">${[['Receitas', r.receitas], ['Despesas', r.despesas], ['Extras', r.extras]].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${brl0(v)}</span></div>`).join('')}</div>
    ${r.top.length ? `<h4 class="small" style="margin:6px 0 0">Para onde mais foi</h4><ul class="list small">${r.top.map(t => `<li><span>${esc(t.name)}</span><span class="amt">${brl0(t.value)} <span class="tiny muted">${pct(t.share)}</span></span></li>`).join('')}</ul>` : ''}
    ${settleHTML(m)}
    <div class="rowbtn">${isClosed ? '<button class="btn" type="button" id="clReopen">Reabrir o mês</button>' : '<button class="btn primary" type="button" id="clClose">Fechar o mês</button>'}</div>
  </section>`;

  el.querySelector('[data-back]').onclick = () => S.go('resumo');
  el.querySelectorAll('[data-send]').forEach(b => b.onclick = () => S.go('lancar', '#drop'));
  el.querySelectorAll('[data-skipsrc]').forEach(b => b.onclick = async e => {
    const src = b.dataset.skipsrc;
    if (!await confirmInline(e.target, { text: src === 'cartao' ? 'A família não usa cartão de crédito? O fechamento deixa de pedir a fatura.' : 'A família não usa esta conta? O fechamento deixa de pedir o extrato.', yes: 'Sim, não uso' })) return;
    await save({ closeSkip: { ...(settings().closeSkip || {}), [src]: true } }); render(el);
  });
  el.querySelectorAll('[data-delman]').forEach(b => b.onclick = async e => {
    const t = S.txs.find(x => x.id === b.dataset.delman);
    if (!await confirmInline(e.target, { text: `Apagar "${esc(t.description)}" de ${brl(t.amount)}?`, yes: 'Sim, apagar', danger: true })) return;
    try { await db.deleteTransaction(t.id); S.txs = S.txs.filter(x => x.id !== t.id); toast('Lançamento apagado'); render(el); } catch (err) { toast('Não foi possível apagar. ' + db.errorText(err)); }
  });
  const tb = $('#clPend');
  // Accepting or changing a category also teaches the rule for next time.
  const setCat = async (t, c) => {
    await db.updateTransaction(t.id, { category: c, pending: false }); t.category = c; t.pending = false;
    if (!t.manual) { await db.learnRule(S.hh.id, t.source, norm(t.description), c).catch(() => {}); S.rules.push({ source: t.source, kind: 'exact', pattern: norm(t.description), category: c }); }
  };
  if (tb) cl.pending.forEach(t => {
    const li = document.createElement('li'), sug = t.category && t.category !== 'A classificar' ? t.category : '';
    li.innerHTML = `<span class="pd"><span>${esc(t.description)}</span><span class="tiny muted">${esc(t.day || isoToBr(t.date).slice(0, 5))} · ${t.source === 'cartao' ? 'cartão' : 'conta'} · ${brl(t.amount)}</span></span><span class="rowbtn pc"></span>`;
    const pc = li.querySelector('.pc');
    pc.append(catPicker(S.categories, sug, true, async c => { try { await setCat(t, c); reindex(); toast('Categoria salva'); setTimeout(() => render(el)); } catch (err) { toast('Não foi possível salvar.'); } }));
    if (sug) { const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'chip okchip'; ok.textContent = 'Ok'; ok.setAttribute('aria-label', `Aceitar ${sug} para ${t.description}`); ok.onclick = async () => { try { await setCat(t, sug); reindex(); toast('Categoria confirmada'); render(el); } catch (err) { toast('Não foi possível salvar.'); } }; pc.append(ok); }
    tb.append(li);
  });
  const okAll = $('#clOkAll');
  if (okAll) okAll.onclick = async e => {
    const list = cl.pending.filter(t => t.category && t.category !== 'A classificar');
    if (!await confirmInline(e.target, { text: `Aceitar as ${list.length} categorias sugeridas? Os que estão "A classificar" continuam na lista.`, yes: 'Sim, aceitar' })) return;
    try { for (const t of list) await setCat(t, t.category); reindex(); toast('Sugestões aceitas'); render(el); } catch (err) { toast('Parou no meio. ' + db.errorText(err)); render(el); }
  };
  el.querySelectorAll('[data-ign]').forEach(b => b.onclick = async () => {
    const x = missing[+b.dataset.ign], ig = { ...(settings().closeIgnore || {}) };
    ig[m] = [...(ig[m] || []), x.category]; await save({ closeIgnore: ig }); render(el);
  });
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addFixed(el, b.closest('li'), missing[+b.dataset.add], m));
  const close = $('#clClose');
  if (close) close.onclick = async e => {
    const left = cl.data.filter(d => !d.done).length + cl.pending.length + missing.length;
    if (!await confirmInline(e.target, { text: left ? `Ainda ${left > 1 ? 'faltam ' + left + ' coisas' : 'falta 1 coisa'} acima. Fechar ${mLong(m)} mesmo assim?` : `Fechar ${mLong(m)}? Dá para reabrir depois.`, yes: 'Sim, fechar' })) return;
    const by = (S.user?.user_metadata?.display_name || '').split(' ')[0];
    await save({ closed: { ...(settings().closed || {}), [m]: { at: todayISO(), by, res: round2(r.res), tx: Math.round(r.tx * 1000) / 1000 } } });
    notifyFamily('closed', { month: m });
    toast(r.hitGoal ? 'Mês fechado. Parabéns pela meta!' : 'Mês fechado'); S.closeMonth = m; S.render();
  };
  const reopen = $('#clReopen');
  if (reopen) reopen.onclick = async e => {
    if (!await confirmInline(e.target, { text: `Reabrir ${mLong(m)}? Ele volta a aparecer para fechar no Início.`, yes: 'Sim, reabrir' })) return;
    const c = { ...(settings().closed || {}) }; delete c[m]; await save({ closed: c }); toast('Mês reaberto'); S.render();
  };
}

function retroText(r) {
  const parts = [];
  if (r.res < 0) parts.push('O mês fechou no vermelho: saiu mais do que entrou.');
  else if (r.hitGoal) parts.push('Vocês bateram a meta de poupança. Parabéns!');
  else if (r.meta && r.renda) parts.push(`Ficou ${pct(r.meta - r.tx)} abaixo da meta de poupança.`);
  if (r.vsAvg != null && Math.abs(r.vsAvg) > 100) parts.push(r.vsAvg > 0 ? `As despesas ficaram ${brl0(r.vsAvg)} acima da média dos meses anteriores.` : `As despesas ficaram ${brl0(-r.vsAvg)} abaixo da média dos meses anteriores.`);
  if (r.top[0]) parts.push(`${r.top[0].name} foi o maior gasto (${pct(r.top[0].share)} das despesas).`);
  return esc(parts.join(' '));
}

// Inline form to add a fixed expense that didn't show up this month.
function addFixed(el, li, x, m) {
  const d = (m === todayISO().slice(0, 7) ? todayISO() : m + '-28');
  li.innerHTML = `<div class="stack" style="width:100%"><strong>${esc(x.category)}</strong>
    <div class="grid2"><label class="f">Valor (R$)<input type="number" step="0.01" min="0" data-f="v" value="${x.avg}"></label>
    <label class="f">Data<input type="date" data-f="d" value="${d}"></label>
    <label class="f">Onde<select data-f="s"><option value="conta">Conta (pix, boleto, débito)</option><option value="cartao">Cartão</option></select></label></div>
    <div class="rowbtn"><button class="btn primary" type="button" data-ok>Lançar</button><button class="btn" type="button" data-no>Cancelar</button></div></div>`;
  li.querySelector('[data-no]').onclick = () => render(el);
  li.querySelector('[data-ok]').onclick = async e => {
    clearInvalid(li);
    const v = li.querySelector('[data-f=v]'), dt = li.querySelector('[data-f=d]'), src = li.querySelector('[data-f=s]').value;
    const bad = checkNumber(v.value, { min: 0.01, max: 1e6, label: 'Valor' }); if (bad) return invalid(v, bad);
    const bd = checkDate(dt.value); if (bd) return invalid(dt, bd);
    const amount = round2(+v.value);
    if (!await confirmInline(e.target, { text: `Lançar ${brl(amount)} de ${esc(x.category)} em ${isoToBr(dt.value)}?`, yes: 'Sim, lançar' })) return;
    const month = src === 'cartao' ? cycleMonth(dt.value, closeDay()) : dt.value.slice(0, 7);
    try {
      const [t] = await db.addTransactions([{ household_id: S.hh.id, source: src, month, date: dt.value, day: isoToBr(dt.value).slice(0, 5), description: x.category, amount: src === 'cartao' ? amount : -amount, category: x.category, manual: true }]);
      S.txs.push({ ...t, amount: +t.amount }); toast('Lançado'); render(el);
    } catch (err) { toast('Não foi possível lançar. ' + db.errorText(err)); }
  };
}

async function save(patch) {
  const st = { ...settings(), ...patch };
  try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; } catch (e) { toast('Não foi possível salvar. ' + db.errorText(e)); throw e; }
}

// Settle-up inside the retrospective (families with 2 people or more).
function settleHTML(m) {
  if (S.members.length < 2) return '';
  const r = settle({ txs: S.txs.filter(t => t.month === m), idx: S.catIdx, members: S.members, split: settings().split || {} });
  const name = id => esc(S.members.find(x => x.user_id === id)?.display_name?.split(' ')[0] || 'Alguém');
  return `<h4 class="small" style="margin:6px 0 0">Acerto do mês</h4><p class="small">${r.balances.map(b => `${name(b.id)} pagou ${brl0(b.paid)}`).join(' · ')}${r.unknown ? ` · sem dono ${brl0(r.unknown)}` : ''}.<br><strong>${r.transfers.length ? r.transfers.map(t => `${name(t.from)} passa ${brl0(t.amount)} para ${name(t.to)}`).join('; ') : 'Está tudo equilibrado.'}</strong></p>`;
}
