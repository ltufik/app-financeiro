import { S, settings, goals, reindex } from '../state.js';
import * as db from '../db.js';
import { GROUPS } from '../lib/calc.js';
import { esc, todayISO } from '../lib/format.js';
import { $, toast } from '../ui.js';
import { installHelpHTML, wireInstall } from '../steps.js';

const LISTS = {
  assets: { title: 'Bens (imóveis, veículos)', hint: 'Valor de mercado e quanto falta pagar.', cols: [['name', 'Nome', 'text'], ['value', 'Valor', 'number'], ['debt', 'Falta pagar', 'number']] },
  debts: { title: 'Financiamentos e dívidas', hint: 'Usados nas simulações de quitação. Taxa ao ano, ex.: 12 para 12%.', cols: [['name', 'Nome', 'text'], ['saldo', 'Saldo devedor', 'number'], ['taxa', 'Taxa % a.a.', 'pct'], ['parcela', 'Parcela', 'number']] },
  receivables: { title: 'A receber', hint: 'Empréstimos que alguém está pagando. Parcelas em branco = sem fim.', cols: [['name', 'Nome', 'text'], ['monthly', 'Por mês', 'number'], ['start', 'Desde (AAAA-MM)', 'text'], ['n', 'Nº de parcelas', 'int']] },
  redemptions: { title: 'Resgates previstos', hint: 'Dinheiro que vai entrar numa data (ex.: resgate de previdência).', cols: [['name', 'Nome', 'text'], ['value', 'Valor', 'number'], ['month', 'Mês (AAAA-MM)', 'text']] },
  recurring: { title: 'Recorrentes do cartão', hint: 'Assinaturas, seguros, contas fixas no cartão. Entram no piso da próxima fatura.', cols: [[0, 'Item', 'text'], [1, 'Valor por mês', 'number'], [2, 'Observação', 'text']] },
};

export function render(el) {
  const st = settings(), g = goals(), owner = S.role === 'owner';
  el.innerHTML = `
  <div class="panel stack">
    <h2>Família</h2>
    <label class="f">Nome<input type="text" id="fName" value="${esc(S.hh.name)}"></label>
    <ul class="list small">${S.members.map(m => `<li><span>${esc(m.display_name || 'Membro')}${m.user_id === S.user.id ? ' (você)' : ''}</span><span class="tiny muted">${m.role === 'owner' ? 'dono' : 'membro'}</span></li>`).join('')}</ul>
    <div class="rowbtn"><button class="btn" id="fInvite" type="button">Gerar convite</button><span id="fCode" class="code"></span></div>
    <p class="tiny muted" id="fCodeHint" hidden>Mande este código para quem vai participar. Ele vale por 7 dias e serve para uma pessoa. A pessoa cria a conta no app e escolhe "Entrar com um convite".</p>
  </div>

  <div class="panel stack">
    <h2>Metas</h2>
    <div class="grid3">
      ${num('gCard', 'Cartão por mês (R$)', g.cardMonthly)}${num('gSav', 'Poupança (%)', g.savings * 100)}${num('gSav2', 'Poupança sem financiamento (%)', g.savingsNoFin * 100)}
      ${num('gPat', 'Meta de investimentos (R$)', g.patrimonio)}${num('gAge', 'Idade hoje', g.ageNow)}${num('gAgeGoal', 'Idade da meta', g.ageGoal)}
      ${num('gRet', 'Retorno real ao ano (%)', (g.ret ?? 0.05) * 100)}${num('gClose', 'Fechamento do cartão (dia)', st.cardCloseDay || 24)}
    </div>
    <div><button class="btn primary" id="gSave" type="button">Salvar metas</button></div>
  </div>

  <div class="panel stack">
    <h2>Patrimônio</h2>
    <div class="grid3">${num('iTotal', 'Investimentos (R$)', st.invest?.total || '')}<label class="f">Data<input type="date" id="iDate" value="${esc(st.invest?.date || '')}"></label></div>
    <p class="tiny muted">O extrato de investimentos em PDF atualiza este valor sozinho.</p>
    ${Object.entries(LISTS).map(([k, d]) => `<h3 style="margin-top:6px">${d.title}</h3><p class="tiny muted">${d.hint}</p><div class="tw edtable"><table><thead><tr>${d.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody data-list="${k}"></tbody></table></div><div><button class="chip" type="button" data-add="${k}">Adicionar</button></div>`).join('')}
    <div><button class="btn primary" id="pSave" type="button">Salvar patrimônio</button></div>
  </div>

  <div class="panel stack">
    <h2>Categorias</h2>
    <p class="tiny muted">O grupo decide como a categoria entra na conta da sobra. Marque "financiamento" para a taxa de poupança sem financiamento.</p>
    <div class="tw"><table><thead><tr><th>Categoria</th><th>Grupo</th><th>Financiamento</th></tr></thead><tbody id="catRows"></tbody></table></div>
    <div class="rowbtn"><input type="text" id="cNew" placeholder="Nova categoria" style="flex:1 1 180px"><select id="cNewG" style="flex:0 1 220px">${Object.entries(GROUPS).map(([k, l]) => `<option value="${k}"${k === 'dia' ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn" id="cAdd" type="button">Adicionar</button></div>
  </div>

  <div class="panel stack">
    <h2>Contexto para o assistente</h2>
    <p class="tiny muted">Fatos que ajudam o Claude a entender a família, um por linha (ex.: "A renda extra não entra no controle oficial").</p>
    <textarea id="facts" style="min-height:140px">${esc((st.facts || []).join('\n'))}</textarea>
    <div><button class="btn primary" id="factsSave" type="button">Salvar</button></div>
  </div>

  <div class="panel stack">
    <h2>Ajuda</h2>
    <div class="rowbtn"><button class="btn" id="hTour" type="button">Ver a apresentação de novo</button><button class="btn" id="hSteps" type="button">Mostrar os primeiros passos</button></div>
    <details class="help"><summary>Instalar o app no celular</summary>${installHelpHTML()}</details>
  </div>

  <div class="panel stack">
    <h2>Dados</h2>
    <div class="rowbtn"><button class="btn" id="dExport" type="button">Baixar backup</button>
      <span class="drop" style="padding:10px 16px;border-width:1px;flex-direction:row"><span>Importar backup</span><input type="file" id="dImport" class="fileover" accept=".json,application/json" aria-label="Importar backup"></span></div>
    <div class="log" id="dLog"></div>
    ${owner ? `<details><summary class="small" style="color:var(--bad)">Apagar todos os dados da família</summary><p class="small" style="margin-top:8px">Apaga lançamentos, categorias, regras, estudos e a família. Não dá para desfazer. Digite o nome da família para confirmar.</p><div class="rowbtn" style="margin-top:8px"><input type="text" id="delName" placeholder="${esc(S.hh.name)}" style="flex:1 1 200px"><button class="btn" id="delGo" type="button" style="border-color:var(--bad);color:var(--bad)">Apagar</button></div></details>` : `<div><button class="btn" id="leave" type="button">Sair desta família</button></div>`}
    <div><button class="btn" id="signOut" type="button">Sair da conta</button></div>
    <details><summary class="small" style="color:var(--bad)">Excluir minha conta</summary>
      <p class="small" style="margin-top:8px">Apaga o seu login. ${S.members.length > 1 ? 'Como a família tem outras pessoas, os dados dela continuam com elas.' : 'Como você é a única pessoa da família, todos os dados dela também são apagados.'} Não dá para desfazer. Se quiser, baixe um backup antes. Digite EXCLUIR para confirmar.</p>
      <div class="rowbtn" style="margin-top:8px"><input type="text" id="delAcc" placeholder="EXCLUIR" autocomplete="off" style="flex:1 1 160px"><button class="btn" id="delAccGo" type="button" style="border-color:var(--bad);color:var(--bad)">Excluir conta</button></div></details>
  </div>`;

  // help
  $('#hTour').onclick = () => S.showTour('app');
  $('#hSteps').onclick = () => { try { localStorage.removeItem('fin.steps.hide.' + S.hh.id); } catch (e) { /* storage blocked */ } S.go('resumo', '#stepsBox'); };
  wireInstall(el);

  // family
  $('#fName').onchange = async e => { const n = e.target.value.trim(); if (!n) return; try { await db.renameHousehold(S.hh.id, n); S.hh.name = n; $('#brand').textContent = n; toast('Nome salvo'); } catch (err) { toast('Não foi possível salvar.'); } };
  $('#fInvite').onclick = async () => { try { $('#fCode').textContent = await db.createInvite(S.hh.id); $('#fCodeHint').hidden = false; } catch (e) { toast('Não foi possível gerar o convite.'); } };

  // goals
  $('#gSave').onclick = () => save({ goals: { ...g, cardMonthly: val('gCard'), savings: val('gSav') / 100, savingsNoFin: val('gSav2') / 100, patrimonio: val('gPat'), ageNow: val('gAge') || null, ageGoal: val('gAgeGoal') || null, ret: val('gRet') / 100 }, cardCloseDay: Math.min(31, Math.max(1, val('gClose') || 24)) }, 'Metas salvas');

  // lists
  const data = {}; for (const k in LISTS) data[k] = JSON.parse(JSON.stringify(st[k] || []));
  const drawList = k => {
    const d = LISTS[k], tb = el.querySelector(`[data-list="${k}"]`);
    tb.innerHTML = data[k].map((r, i) => `<tr>${d.cols.map(([key, , type]) => { let v = r[key]; if (type === 'pct' && v != null && v !== '') v = +(v * 100).toFixed(4); return `<td><input type="${type === 'text' ? 'text' : 'number'}" ${type !== 'text' ? 'step="any"' : ''} data-i="${i}" data-k="${key}" data-t="${type}" value="${esc(v ?? '')}"></td>`; }).join('')}<td><button class="chip" type="button" data-rm="${i}" aria-label="Remover">×</button></td></tr>`).join('') || `<tr><td colspan="${d.cols.length + 1}" class="tiny muted">Nada cadastrado.</td></tr>`;
    tb.querySelectorAll('input').forEach(inp => inp.onchange = () => { const r = data[k][+inp.dataset.i], t = inp.dataset.t; let v = inp.value; if (t === 'number') v = v === '' ? 0 : +v; else if (t === 'int') v = v === '' ? null : Math.round(+v); else if (t === 'pct') v = v === '' ? null : +v / 100; r[isNaN(+inp.dataset.k) ? inp.dataset.k : +inp.dataset.k] = v; });
    tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { data[k].splice(+b.dataset.rm, 1); drawList(k); });
  };
  for (const k in LISTS) drawList(k);
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const k = b.dataset.add; data[k].push(k === 'recurring' ? ['', 0, ''] : k === 'debts' ? { id: 'd' + Date.now().toString(36), name: '', saldo: 0, taxa: null, parcela: 0 } : {}); drawList(k); });
  $('#pSave').onclick = () => save({ ...data, invest: { ...(st.invest || {}), total: val('iTotal'), date: $('#iDate').value || todayISO() } }, 'Patrimônio salvo');

  // categories
  const cats = S.categories.slice().sort((a, b) => Object.keys(GROUPS).indexOf(a.grp) - Object.keys(GROUPS).indexOf(b.grp) || a.name.localeCompare(b.name, 'pt'));
  $('#catRows').innerHTML = cats.map(c => `<tr><td>${esc(c.name)}</td><td><select data-c="${c.id}" data-f="grp">${Object.entries(GROUPS).map(([k, l]) => `<option value="${k}"${k === c.grp ? ' selected' : ''}>${l}</option>`).join('')}</select></td><td><input type="checkbox" data-c="${c.id}" data-f="financing" style="width:auto" ${c.financing ? 'checked' : ''}></td></tr>`).join('');
  $('#catRows').querySelectorAll('[data-c]').forEach(inp => inp.onchange = async () => {
    const c = S.categories.find(x => x.id === inp.dataset.c), patch = { [inp.dataset.f]: inp.type === 'checkbox' ? inp.checked : inp.value };
    try { await db.updateCategory(c.id, patch); Object.assign(c, patch); reindex(); toast('Categoria atualizada'); } catch (e) { toast('Não foi possível salvar.'); }
  });
  $('#cAdd').onclick = async () => {
    const name = $('#cNew').value.trim(); if (!name) return;
    if (S.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('Essa categoria já existe.'); return; }
    try { S.categories.push(await db.addCategory(S.hh.id, { name, grp: $('#cNewG').value })); reindex(); toast('Categoria criada'); render(el); } catch (e) { toast('Não foi possível criar.'); }
  };

  $('#factsSave').onclick = () => save({ facts: $('#facts').value.split('\n').map(s => s.trim()).filter(Boolean) }, 'Contexto salvo');

  // data
  const dlog = t => { const p = document.createElement('div'); p.textContent = t; $('#dLog').append(p); };
  $('#dExport').onclick = async () => {
    try {
      const b = await db.exportBackup(S.hh.id, S.hh);
      const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `backup-${todayISO()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast('Não foi possível gerar o backup.'); }
  };
  $('#dImport').onchange = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    $('#dLog').innerHTML = '';
    try {
      const b = JSON.parse(await f.text());
      if (b.version !== 1 || !Array.isArray(b.transactions)) throw new Error('formato');
      dlog(`Backup com ${b.transactions.length} lançamentos. Importando...`);
      await db.importBackup(S.hh.id, b, dlog);
      await S.reload(true); S.render(); $('#dLog').textContent = `Pronto: ${b.transactions.length} lançamentos importados.`; toast('Backup importado');
    } catch (err) { dlog('Não consegui importar: ' + (err.message || err)); }
  };
  if (owner) $('#delGo').onclick = async () => {
    if ($('#delName').value.trim() !== S.hh.name) { toast('Digite o nome exato da família.'); return; }
    try { await db.deleteHousehold(S.hh.id); toast('Dados apagados'); location.reload(); } catch (e) { toast('Não foi possível apagar.'); }
  };
  else $('#leave').onclick = async () => { try { await db.leaveHousehold(S.hh.id, S.user.id); location.reload(); } catch (e) { toast('Não foi possível sair.'); } };
  $('#signOut').onclick = async () => { await db.sb.auth.signOut(); location.reload(); };
  $('#delAccGo').onclick = async () => {
    if ($('#delAcc').value.trim().toUpperCase() !== 'EXCLUIR') { toast('Digite EXCLUIR para confirmar.'); return; }
    $('#delAccGo').disabled = true;
    try {
      await db.deleteMyAccount();
      try { localStorage.clear(); } catch (e) { /* storage blocked */ }
      await db.sb.auth.signOut().catch(() => {});
      location.reload();
    } catch (e) { toast('Não foi possível excluir a conta.'); $('#delAccGo').disabled = false; }
  };
}

const num = (id, label, v) => `<label class="f">${label}<input type="number" step="any" id="${id}" value="${v == null || v === '' || isNaN(+v) ? '' : +(+v).toFixed(4)}"></label>`;
const val = id => +$('#' + id).value || 0;

async function save(patch, msg) {
  const st = { ...settings(), ...patch };
  try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; toast(msg); } catch (e) { toast('Não foi possível salvar.'); }
}
