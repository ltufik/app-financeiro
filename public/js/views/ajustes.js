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
    <h2>Backup</h2>
    <p class="small muted">Um arquivo com todos os lançamentos, categorias e ajustes da família. Guarde num lugar seguro: ele tem os seus dados financeiros.</p>
    <div class="rowbtn"><button class="btn" id="dExport" type="button">Baixar backup</button>
      <span class="btn" style="position:relative">Importar backup<input type="file" id="dImport" class="fileover" accept=".json,application/json" aria-label="Importar backup"></span></div>
    <p class="status" id="bkStatus" role="status" hidden></p>
  </div>

  <div class="panel stack">
    <h2>Conta</h2>
    <div class="rowbtn"><button class="btn" id="signOut" type="button">Sair da conta</button>
      ${owner ? '<button class="btn danger" id="delFam" type="button">Apagar os dados da família</button>' : '<button class="btn" id="leave" type="button">Sair desta família</button>'}
      <button class="btn danger" id="delAcc" type="button">Excluir minha conta</button></div>
    <div id="confirmBox"></div>
  </div>  </div>`;

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
  const status = (kind, text) => { const p = $('#bkStatus'); p.hidden = false; p.className = 'status ' + kind; p.textContent = text; };
  const backup = async () => {
    status('busy', 'Preparando o backup...'); $('#dExport').disabled = true;
    try {
      const b = await db.exportBackup(S.hh.id, S.hh);
      const name = `backup-${S.hh.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-${todayISO()}.json`;
      const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      status('ok', `Backup pronto: ${name}, com ${b.transactions.length.toLocaleString('pt-BR')} lançamentos. Ele fica na pasta de downloads (no iPhone, no app Arquivos).`);
      return true;
    } catch (e) { status('err', 'Não foi possível gerar o backup. Verifique a internet e tente de novo.'); return false; }
    finally { $('#dExport').disabled = false; }
  };
  $('#dExport').onclick = backup;
  $('#dImport').onchange = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    let b;
    try { b = JSON.parse(await f.text()); if (b.version !== 1 || !Array.isArray(b.transactions)) throw new Error(); }
    catch (err) { status('err', 'Este arquivo não é um backup do app.'); return; }
    status('busy', `Importando ${b.transactions.length.toLocaleString('pt-BR')} lançamentos...`);
    try {
      await db.importBackup(S.hh.id, b, t => status('busy', 'Importando... ' + t));
      await S.reload(true); S.render();
      status('ok', `Pronto: ${b.transactions.length.toLocaleString('pt-BR')} lançamentos importados.`); toast('Backup importado');
    } catch (err) { status('err', 'A importação parou no meio: ' + (err.message || 'erro desconhecido') + '. Tente de novo; o que já entrou não se duplica nas categorias e regras.'); }
  };

  // account: every destructive action asks once, in the page, with a backup option
  const flashAndReload = msg => { try { sessionStorage.setItem('fin.flash', msg); localStorage.removeItem('fin.hh'); } catch (e) { /* storage blocked */ } location.reload(); };
  const ask = ({ title, text, label, run }) => {
    const box = $('#confirmBox');
    box.innerHTML = `<div class="confirm"><h3>${title}</h3><p class="small">${text}</p>
      <div class="rowbtn" style="margin-top:12px"><button class="btn" type="button" data-b>Baixar backup antes</button></div>
      <div class="rowbtn" style="margin-top:10px"><button class="btn danger-fill" type="button" data-y>${label}</button><button class="btn" type="button" data-n>Cancelar</button></div>
      <p class="status" role="status" hidden></p></div>`;
    const st = box.querySelector('.status'), yes = box.querySelector('[data-y]');
    box.querySelector('[data-b]').onclick = backup;
    box.querySelector('[data-n]').onclick = () => { box.innerHTML = ''; };
    yes.onclick = async () => {
      yes.disabled = true; st.hidden = false; st.className = 'status busy'; st.textContent = 'Processando...';
      try { await run(); } catch (e) { st.className = 'status err'; st.textContent = 'Não foi possível concluir. Verifique a internet e tente de novo.'; yes.disabled = false; }
    };
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $('#signOut').onclick = async () => { await db.sb.auth.signOut(); location.reload(); };
  $('#delAcc').onclick = () => ask({
    title: 'Excluir minha conta?',
    text: `Seu login será apagado. ${S.members.length > 1 ? 'A família tem outras pessoas, então os dados dela continuam com elas.' : 'Você é a única pessoa da família, então todos os dados dela também serão apagados.'} Isso não pode ser desfeito.`,
    label: 'Sim, excluir minha conta',
    run: async () => { await db.deleteMyAccount(); try { localStorage.clear(); } catch (e) { /* storage blocked */ } await db.sb.auth.signOut().catch(() => {}); flashAndReload('Sua conta foi excluída' + (S.members.length > 1 ? '.' : ', junto com os dados da família.') + ' Obrigado por testar o app.'); },
  });
  if (owner) $('#delFam').onclick = () => ask({
    title: 'Apagar os dados da família?',
    text: `Lançamentos, categorias, regras, estudos e a família "${esc(S.hh.name)}" serão apagados para todos os membros. Sua conta continua e você pode criar outra família. Isso não pode ser desfeito.`,
    label: 'Sim, apagar os dados',
    run: async () => { await db.deleteHousehold(S.hh.id); flashAndReload('Os dados da família foram apagados.'); },
  });
  else $('#leave').onclick = () => ask({
    title: 'Sair desta família?',
    text: 'Você deixa de ver os dados dela. Os dados continuam com as outras pessoas. Para voltar, é preciso um novo convite.',
    label: 'Sim, sair da família',
    run: async () => { await db.leaveHousehold(S.hh.id, S.user.id); flashAndReload('Você saiu da família.'); },
  });
}

const num = (id, label, v) => `<label class="f">${label}<input type="number" step="any" id="${id}" value="${v == null || v === '' || isNaN(+v) ? '' : +(+v).toFixed(4)}"></label>`;
const val = id => +$('#' + id).value || 0;

async function save(patch, msg) {
  const st = { ...settings(), ...patch };
  try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; toast(msg); } catch (e) { toast('Não foi possível salvar.'); }
}
