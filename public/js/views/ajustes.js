import { S, settings, goals, reindex, monthKeys, txsOf, presets, debtsNow } from '../state.js';
import { SISTEMAS, debtNow, debtOfAsset } from '../lib/debt.js';
import { renderPendingPayments, applyAmortization, undoAmortization } from '../debtpay.js';
import * as db from '../db.js';
import { track, APP_VERSION } from '../usage.js';
import { KINDS, kindOf, kindByKey, byCategory } from '../lib/calc.js';
import { suggestBudgets, budgetsOf } from '../lib/budget.js';
import { esc, todayISO, brl, isoToBr } from '../lib/format.js';
import { $, toast, validate, invalid, clearInvalid, confirmInline } from '../ui.js';
import { checkName, checkNumber, checkMonth, checkDate } from '../lib/validate.js';
import { installHelpHTML, wireInstall, renderConquistas } from '../steps.js';
import { renderInviter } from '../onboarding.js';
import { SECTIONS, openMenu } from '../menu.js';
import { renderMetrics } from '../metrics.js';
import { renderFeedback, renderDuvidas } from '../feedback.js';
import { showAllNews, welcomeAlpha } from '../messages.js';
import { renderApplePay } from '../applepay.js';
import { renderAnnual } from '../annual.js';
import { renderTaught } from '../learnask.js';
import { testSurvey } from '../survey.js';
import { SURVEYS } from '../lib/survey.js';
import { ASSET_TYPES, UFS, guessAssetType, isVehicle, ipvaOf } from '../lib/annual.js';
import { renderSecurity, signOutSafely } from '../lock.js';
import { PHOTOS } from '../photos.js';
import { platformOf, phoneSteps, testOutcome } from '../lib/pushask.js';
import { toCSV } from '../lib/csv.js';
import { mergeSuggestions, mergeSettings, pairKey } from '../lib/catmerge.js';
import { PUSH_TYPES, pushStatus, currentPrefs, enablePush, savePrefs, disablePush, sendTest, isIOS } from '../push.js';

const LISTS = {
  assets: { title: 'Bens (imóveis, veículos)', hint: 'O que a família tem de valor. Para carro e moto, o estado onde estão registrados decide o IPVA (o app calcula pelo valor e pela alíquota do estado). Trocou de carro ou de casa? Atualize aqui. Se o bem ainda está sendo pago, ligue ao financiamento: o quanto falta passa a vir de lá e diminui a cada parcela e amortização.', cols: [['name', 'O que é', 'text'], ['value', 'Quanto vale hoje', 'number'], ['tipo', 'Tipo', 'select', ASSET_TYPES], ['uf', 'Estado (registro do veículo, onde fica o imóvel)', 'select', [['', '—'], ...UFS.map(u => [u, u])]], ['debtId', 'Financiamento', 'debtlink'], ['debt', 'Quanto falta pagar', 'number']] },
  debts: { title: 'Financiamentos e dívidas', hint: 'O que vocês ainda estão pagando. Com os juros, a parcela e o tipo de parcela, o app abate o saldo sozinho todo mês (estimado) e cada amortização que vocês confirmarem. Os juros são ao ano: escreva 12 para 12%. "Quanto falta hoje" já vem atualizado. Se o extrato do banco mostrar outro saldo, digite por cima: ele passa a valer a partir de hoje.', cols: [['name', 'O que é', 'text'], ['saldo', 'Quanto falta hoje', 'number'], ['taxa', 'Juros ao ano (%)', 'pct'], ['parcela', 'Parcela por mês', 'number'], ['sistema', 'Tipo de parcela', 'select', SISTEMAS], ['meses', 'Meses que faltam', 'int']] },
  receivables: { title: 'Dinheiro que alguém está devolvendo', hint: 'Quando vocês emprestaram dinheiro e a pessoa devolve um pouco por mês. Ex.: emprestaram R$ 6.000 para um parente, que devolve R$ 500 por mês em 12 vezes. Se não tem data para acabar, deixe "Quantas vezes" em branco.', cols: [['name', 'Quem está devolvendo', 'text'], ['monthly', 'Quanto por mês', 'number'], ['start', 'Começou em (AAAA-MM)', 'text'], ['n', 'Quantas vezes', 'int']] },
  redemptions: { title: 'Dinheiro que vai entrar numa data', hint: 'Um valor grande que vocês já sabem que vem. Ex.: resgate da previdência, venda do carro.', cols: [['name', 'O que é', 'text'], ['value', 'Quanto', 'number'], ['month', 'Quando (AAAA-MM)', 'text']] },
  recurring: { title: 'Contas fixas no cartão', hint: 'O que cai todo mês no cartão: streaming, seguro, academia. Serve para prever a próxima fatura.', cols: [[0, 'O que é', 'text'], [1, 'Quanto por mês', 'number'], [2, 'Observação', 'text']] },
};

export function render(el) {
  const st = settings(), g = goals(), owner = S.role === 'owner';
  const sec = SECTIONS.find(x => x.key === S.sec && (!x.admin || S.isAdmin)) || SECTIONS[0]; S.sec = sec.key;
  el.innerHTML = `<div class="subhead"><button class="chip" type="button" id="secBack" aria-label="Voltar ao menu">‹ Menu</button><h2>${sec.title}</h2></div>
  <div class="panel stack" data-sec="familia">
    <label class="f">Nome<input type="text" id="fName" value="${esc(S.hh.name)}"></label>
    <ul class="list small">${S.members.map(m => `<li><span>${esc(m.display_name || 'Membro')}${m.user_id === S.user.id ? ' (você)' : ''}${m.relation ? `<br><span class="tiny muted">${esc(m.relation)}</span>` : ''}</span><span class="tiny muted">${m.role === 'owner' ? 'dono' : 'membro'}</span></li>`).join('')}</ul>
    <label class="f">Como você quer ser chamado<input type="text" id="fMe" value="${esc(S.user.user_metadata?.display_name || '')}"></label>
    <h3 style="margin-top:6px">Convidar alguém</h3>
    <p class="tiny muted">O convite vai pelo WhatsApp com um link. A pessoa toca, cria a conta e já entra na família.</p>
    <div id="fInviter"></div>
  </div>

  <div class="panel stack" data-sec="divisao">
    <h2>Quem paga o quê</h2>
    <p class="small muted">Ligue cada cartão e a conta a uma pessoa. O Início e o fechamento do mês mostram quanto cada um pagou e quem deve passar quanto para quem. Lançamentos feitos à mão contam para quem lançou.</p>
    <div id="splitBox" class="stack"></div>
  </div>

  <div class="panel stack" data-sec="metas">
    <h2>Metas</h2>
    <p class="small muted">São três combinados da família. O app usa esses números para avisar quando o gasto passa do ponto e para mostrar se vocês estão no caminho.</p>
    <h3>1. Limite do cartão</h3>
    <p class="tiny muted">Até quanto vocês querem que a fatura chegue por mês. Se passar, o app avisa.</p>
    <div class="grid3">${num('gCard', 'Limite da fatura por mês (R$)', g.cardMonthly)}${num('gClose', 'Dia em que a fatura fecha', st.cardCloseDay || 24)}</div>
    <h3>2. Quanto guardar</h3>
    <p class="tiny muted">Quanto da renda vocês querem que sobre no fim do mês. Ex.: 20 quer dizer guardar R$ 20 de cada R$ 100 que entram.</p>
    <div class="grid3">${num('gSav', 'Guardar da renda (%)', g.savings * 100)}${num('gSav2', 'Se pagam financiamento de imóvel: guardar sem contar ele (%)', g.savingsNoFin * 100)}</div>
    <h3>3. O sonho de vocês</h3>
    <p class="tiny muted">Quanto querem ter investido no futuro e com que idade. O app mostra se o que guardam hoje leva até lá.</p>
    <div class="grid3">${num('gPat', 'Quanto querem ter investido (R$)', g.patrimonio)}${num('gAge', 'Sua idade hoje', g.ageNow)}${num('gAgeGoal', 'Com que idade querem chegar lá', g.ageGoal)}
      ${num('gRet', 'Rendimento acima da inflação (% ao ano). Na dúvida, deixe 5', (g.ret ?? 0.05) * 100)}</div>
    <h3>4. Quanto vocês acham que conseguem guardar</h3>
    <p class="tiny muted" id="gPaceHint">O Início mostra o sonho com a média do que sobrou de verdade nos últimos meses. Aqui vocês dizem o que acham possível, e ele vira mais um cenário.</p>
    <div class="grid3">${num('gPlan', 'Por mês (R$)', g.planMonthly)}${num('gPlanY', 'Extra por ano: 13º, PLR, bônus (R$)', g.planYearly)}</div>
    <div id="gScen"></div>
    <div><button class="btn primary" id="gSave" type="button">Salvar metas</button></div>
    <h3 style="margin-top:10px">Orçamento por categoria</h3>
    <p class="tiny muted">Um limite por mês para as categorias que mais pesam. O Início mostra quanto já foi usado e o app avisa antes de estourar.</p>
    <div id="bRows" class="stack"></div>
    <div class="rowbtn"><button class="chip" type="button" id="bAdd">Adicionar categoria</button><button class="chip" type="button" id="bSuggest">Sugerir pela média dos últimos meses</button></div>
    <div><button class="btn primary" id="bSave" type="button">Salvar orçamento</button></div>
  </div>

  <div class="panel stack" data-sec="conquistas"><div id="conqBox" class="stack"></div></div>
  <div class="panel stack" data-sec="gastos_ano"><div id="anBox" class="stack"></div></div>
  <div class="panel stack" data-sec="patrimonio">
    <h2>Patrimônio</h2>
    <div class="grid3">${num('iTotal', 'Investimentos (R$)', st.invest?.total || '')}<label class="f">Data<input type="date" id="iDate" value="${esc(st.invest?.date || '')}"></label></div>
    <p class="tiny muted">O extrato de investimentos em PDF atualiza este valor sozinho. Entre um extrato e outro, o Início mostra o valor de hoje estimado pelo rendimento das Metas; o extrato novo traz o valor real.</p>
    ${Object.entries(LISTS).map(([k, d]) => `<h3 style="margin-top:6px">${d.title}</h3><p class="tiny muted">${d.hint}</p><div class="tw edtable"><table><thead><tr>${d.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody data-list="${k}"></tbody></table></div><div><button class="chip" type="button" data-add="${k}">Adicionar</button></div>`).join('')}
    <div><button class="btn primary" id="pSave" type="button">Salvar patrimônio</button></div>
    <div class="stack" id="pDebtPay" hidden></div>
    <div class="stack" id="pDebtNow" hidden></div>
  </div>

  <div class="panel stack" data-sec="categorias">
    <h2>Categorias</h2>
    <p class="small muted">Toda categoria é uma receita ou uma despesa. As fixas se repetem todo mês; as extras ficam fora da sobra do mês, para não distorcer a conta.</p>
    <div id="catMerge" class="stack"></div>
    <h3 style="margin-top:6px">Criar categoria</h3>
    <label class="f">Nome<input type="text" id="cNew" maxlength="60" placeholder="Ex.: Academia"></label>
    <div class="kinds" role="radiogroup" aria-label="Tipo da categoria" id="cKinds">${KINDS.map(k => `<button type="button" class="kind" role="radio" aria-checked="${k.key === 'dvar'}" data-kind="${k.key}"><strong>${k.label}</strong><span>${k.hint}</span></button>`).join('')}</div>
    <div><button class="btn primary" id="cAdd" type="button">Criar categoria</button></div>
    <div id="taught" class="stack" hidden></div>
    <h3 style="margin-top:10px">Suas categorias</h3>
    <div id="catList" class="stack"></div>
  </div>

  <div class="panel stack" data-sec="avisos">
    <h2>Notificações</h2>
    <p class="small muted">O app avisa no celular quando algo importante acontece com o dinheiro da família. No máximo um aviso por dia. Vale para este aparelho.</p>
    <div id="pushBox" class="stack"><p class="small muted">Verificando...</p></div>
  </div>

  <div class="panel stack" data-sec="sobre">
    <h2>Sobre o app</h2>
    <p class="small"><strong>Pra Onde Foi</strong> mostra para onde vai o dinheiro da família: lê faturas e extratos em PDF de qualquer banco, confere os totais e separa por categoria. Versão de teste com família e amigos. Este celular está na versão <strong id="aboutVer">${APP_VERSION}</strong> (aparece também no fim do menu ☰).</p>
    <h3>O que o app guarda</h3>
    <ul class="small">
      <li>Os lançamentos, as categorias, as metas e os ajustes da sua família. Só quem está na família vê. O que você marca como "Só meu" (um lançamento, uma fatura ou um extrato) só você vê; o resto da família vê apenas o total do mês.</li>
      <li>De cada nota fiscal, só os itens e valores lidos. A foto não fica guardada.</li>
      <li>De cada pessoa, os dias em que abriu o app e quais telas e botões usou e por quanto tempo (por exemplo, "lançou por voz"), e os erros que aparecerem, para saber o que ajuda e o que melhorar. Nunca valores nem o que foi escrito.</li>
      <li>As opiniões e dúvidas que você mandar, com a tela em que estava e o tipo de celular, e as respostas às pesquisas de satisfação (opções e textos curtos, nunca valores).</li>
    </ul>
    <h3>O que o app nunca guarda</h3>
    <ul class="small"><li>O arquivo do PDF, da foto ou do print, inclusive o que chega pelos atalhos do iPhone: é lido e descartado.</li><li>A sua digital ou o seu rosto: ficam no próprio celular. O app guarda só, neste aparelho, o número da chave que o celular criou.</li><li>A senha do PDF.</li><li>Senhas de banco: o app não se conecta ao seu banco.</li></ul>
    <p class="small">Você pode baixar uma cópia de tudo em Backup e apagar tudo em Conta, quando quiser.</p>
    <h3>Créditos das fotos</h3>
    <p class="small muted">Fotos do Pexels, de uso gratuito: ${[...new Set(Object.values(PHOTOS).map(p => p.by))].map(esc).join(', ')}.</p>
  </div>

  <div class="panel stack" data-sec="metricas">
    <h2>Métricas do produto</h2>
    <a class="btn primary" href="/admin.html" target="_blank" rel="noopener" id="adminLink">Abrir a Central do produto</a>
    <p class="tiny muted">Painel, backlog, benchmarking, precificação e desenho do produto, numa página para o computador.</p>
    <div id="metricsBox" class="stack"></div>
    <h3>Testar a jornada neste aparelho</h3>
    <p class="tiny muted">Faz este aparelho voltar a mostrar, ao abrir, o convite para ligar as notificações e o da digital, como para quem acabou de chegar. Os dados não mudam.</p>
    <div><button class="btn" type="button" id="jrReset">Ver de novo os convites de abertura</button></div>
    <div class="rowbtn"><label class="f" style="flex:1">Testar uma pesquisa<select id="svTest">${Object.entries(SURVEYS).map(([k, v]) => `<option value="${k}">${esc(v.title)}</option>`).join('')}</select></label><button class="btn" type="button" id="svTestGo">Mostrar no Início</button></div>
    <p class="tiny muted">Mostra a pesquisa agora, sem as regras. A resposta fica marcada como teste e não entra nos resultados.</p>
  </div>

  <div class="panel stack" data-sec="contexto">
    <h2>Contexto para o assistente</h2>
    <p class="tiny muted">Fatos que ajudam o assistente a entender a família, um por linha (ex.: "A renda extra não entra no controle oficial").</p>
    <textarea id="facts" style="min-height:140px">${esc((st.facts || []).join('\n'))}</textarea>
    <div><button class="btn primary" id="factsSave" type="button">Salvar</button></div>
  </div>

  <div class="panel stack" data-sec="ajuda">
    <h2>Ajuda</h2>
    <div class="rowbtn"><button class="btn" id="hTour" type="button">Ver a apresentação de novo</button><button class="btn" id="hSteps" type="button">Ver as missões</button><button class="btn" id="hCoach" type="button">Fazer o tour guiado</button><button class="btn" id="hNews" type="button">Ver o que mudou</button><button class="btn" id="hAlpha" type="button">Sobre o teste</button></div>
    <details class="help"><summary>Instalar o app no celular</summary>${installHelpHTML()}</details>
    <h3 style="margin-top:6px">Aparência</h3>
    <div class="seg" role="radiogroup" aria-label="Aparência" id="themeSeg">${[['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Igual ao celular']].map(([k, l]) => `<button type="button" class="chip" role="radio" data-theme-opt="${k}" aria-pressed="${theme() === k}" aria-checked="${theme() === k}">${l}</button>`).join('')}</div>
  </div>

  <div class="panel stack" data-sec="applepay"><div id="apBox" class="stack"></div></div>

  <div class="panel stack" data-sec="duvidas"><div id="faqBox" class="stack"></div></div>

  <div class="panel stack" data-sec="opiniao"><div id="fbBox" class="stack"></div></div>

  <div class="panel stack" data-sec="backup">
    <h2>Backup</h2>
    <p class="small muted">Um arquivo com todos os lançamentos, categorias e ajustes da família. Guarde num lugar seguro: ele tem os seus dados financeiros.</p>
    <p class="tiny muted">A planilha tem todos os lançamentos, um por linha, e abre no Excel ou no Google Planilhas. O backup serve para trazer tudo de volta para o app.</p>
    <div class="rowbtn"><button class="btn" id="dExport" type="button">Baixar backup</button><button class="btn" id="dCsv" type="button">Baixar planilha (Excel)</button>
      <span class="btn" style="position:relative">Importar backup<input type="file" id="dImport" class="fileover" accept=".json,application/json" aria-label="Importar backup"></span></div>
    <p class="status" id="bkStatus" role="status" hidden></p>
  </div>

  <div class="panel stack" data-sec="conta">
    <h2>Conta</h2>
    <div id="secBox" class="stack"></div>
    <h3>Sair ou apagar</h3>
    <div class="rowbtn"><button class="btn" id="signOut" type="button">Sair da conta</button>
      ${owner ? '<button class="btn danger" id="clearTx" type="button">Zerar os lançamentos</button>' : ''}
      ${owner ? '<button class="btn danger" id="delFam" type="button">Apagar os dados da família</button>' : '<button class="btn" id="leave" type="button">Sair desta família</button>'}
      <button class="btn danger" id="delAcc" type="button">Excluir minha conta</button></div>
    <div id="confirmBox"></div>
  </div>  </div>`;

  el.querySelectorAll('[data-sec]').forEach(p => { p.hidden = p.dataset.sec !== sec.key; });
  $('#secBack').onclick = () => openMenu();
  if (sec.key === 'avisos') renderPush($('#pushBox'));
  if (sec.key === 'divisao') renderSplit($('#splitBox'));
  if (sec.key === 'metricas') {
    renderMetrics($('#metricsBox'));
    $('#svTestGo').onclick = () => { testSurvey($('#svTest').value); S.go('resumo'); };
    $('#jrReset').onclick = async e => {
      if (!await confirmInline(e.target, { text: 'Mostrar de novo os convites de abertura neste aparelho? O app vai recarregar.', yes: 'Sim, mostrar' })) return;
      try { for (const k of ['fin.pushask.' + S.user.id, 'fin.bio.ask.' + S.user.id]) localStorage.removeItem(k); } catch (err) { /* storage blocked */ }
      track('teste.jornada'); toast('Pronto. Abrindo o app de novo...'); setTimeout(() => { if (!window.__noReload) location.reload(); }, 900);
    };
  }
  if (sec.key === 'duvidas') renderDuvidas($('#faqBox'));
  if (sec.key === 'applepay') renderApplePay($('#apBox'));
  if (sec.key === 'gastos_ano') renderAnnual($('#anBox'));
  if (sec.key === 'conquistas') renderConquistas($('#conqBox'));
  if (sec.key === 'categorias') renderTaught($('#taught'));
  if (sec.key === 'conta') renderSecurity($('#secBox'));
  if (sec.key === 'opiniao') renderFeedback($('#fbBox'));
  // help
  $('#hTour').onclick = () => S.showTour('app');
  $('#hCoach').onclick = () => S.startCoach(true);
  $('#hNews').onclick = () => showAllNews();
  $('#hAlpha').onclick = () => welcomeAlpha({ force: true });
  el.querySelectorAll('[data-theme-opt]').forEach(b => b.onclick = () => {
    const t = b.dataset.themeOpt; try { localStorage.setItem('fin.theme', t); } catch (e) { /* storage blocked */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    el.querySelectorAll('[data-theme-opt]').forEach(x => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b); });
  });
  $('#hSteps').onclick = () => S.go('ajustes', null, 'conquistas');
  wireInstall(el);

  // family
  $('#fName').onchange = async e => { const n = e.target.value.trim(); if (!validate([[e.target, checkName(n, 'o nome da família', 2, 60)]])) return; try { await db.renameHousehold(S.hh.id, n); S.hh.name = n; $('#brand').textContent = n; toast('Nome salvo'); } catch (err) { toast('Não foi possível salvar.'); } };
  renderInviter($('#fInviter'));
  $('#fMe').onchange = async e => {
    const v = e.target.value.trim(); if (!validate([[e.target, checkName(v, 'como você quer ser chamado', 2, 40)]])) return;
    try { const { data } = await db.sb.auth.updateUser({ data: { display_name: v } }); if (data?.user) S.user = data.user; await db.updateMyMemberName(S.user.id, v); const me = S.members.find(m => m.user_id === S.user.id); if (me) me.display_name = v; toast('Nome salvo'); } catch (err) { toast('Não foi possível salvar.'); }
  };

  // goals
  $('#gSave').onclick = () => {
    clearInvalid(el);
    const ok = validate([
      [$('#gCard'), checkNumber($('#gCard').value, { min: 0, max: 1e6, label: 'Limite da fatura', allowEmpty: true })],
      [$('#gSav'), checkNumber($('#gSav').value, { min: 0, max: 100, label: 'Guardar da renda (%)', allowEmpty: true })],
      [$('#gSav2'), checkNumber($('#gSav2').value, { min: 0, max: 100, label: 'Guardar sem contar o financiamento (%)', allowEmpty: true })],
      [$('#gPat'), checkNumber($('#gPat').value, { min: 0, max: 1e9, label: 'Quanto querem ter investido', allowEmpty: true })],
      [$('#gAge'), checkNumber($('#gAge').value, { min: 0, max: 120, integer: true, label: 'Sua idade hoje', allowEmpty: true })],
      [$('#gAgeGoal'), checkNumber($('#gAgeGoal').value, { min: 1, max: 120, integer: true, label: 'Com que idade querem chegar lá', allowEmpty: true }) || ($('#gAge').value && $('#gAgeGoal').value && +$('#gAgeGoal').value <= +$('#gAge').value ? 'A idade da meta precisa ser maior que a idade de hoje.' : '')],
      [$('#gRet'), checkNumber($('#gRet').value, { min: -10, max: 30, label: 'Rendimento acima da inflação (%)', allowEmpty: true })],
      [$('#gPlan'), checkNumber($('#gPlan').value, { min: 0, max: 1e6, label: 'Quanto conseguem guardar por mês', allowEmpty: true })],
      [$('#gPlanY'), checkNumber($('#gPlanY').value, { min: 0, max: 1e7, label: 'Extra por ano', allowEmpty: true })],
      [$('#gClose'), checkNumber($('#gClose').value, { min: 1, max: 31, integer: true, label: 'Dia em que a fatura fecha', allowEmpty: true })],
    ]);
    if (!ok) return;
    save({ goals: { ...g, cardMonthly: val('gCard'), savings: val('gSav') / 100, savingsNoFin: val('gSav2') / 100, patrimonio: val('gPat'), ageNow: val('gAge') || null, ageGoal: val('gAgeGoal') || null, ret: val('gRet') / 100, planMonthly: val('gPlan') || 0, planYearly: val('gPlanY') || 0 }, goalsSet: true, cardCloseDay: Math.min(31, Math.max(1, val('gClose') || 24)) }, 'Metas salvas');
  };

  // The dream's scenarios: the real average (always computed) and the ones saved before, which can be removed.
  const drawScen = () => {
    const box = $('#gScen'); if (!box) return;
    const pr = presets(), avg = pr[0], saved = pr.filter(x => x[4]);
    $('#gPaceHint').textContent = `O Início mostra o sonho com a média do que sobrou de verdade: ${brl(avg[1])} por mês (${avg[3]}). Aqui vocês dizem o que acham possível, e ele vira mais um cenário.`;
    box.innerHTML = saved.length ? `<p class="tiny muted" style="margin:6px 0 4px">Cenários salvos antes</p><ul class="list small">${saved.map(x => `<li><span>${esc(x[0])}: ${brl(x[1])}/mês${x[2] ? ' + ' + brl(x[2]) + '/ano' : ''}</span><button class="chip" type="button" data-rmscen="${esc(x[0])}">Remover</button></li>`).join('')}</ul>` : '';
    box.querySelectorAll('[data-rmscen]').forEach(b => b.onclick = async () => {
      if (!await confirmInline(b, { text: `Remover o cenário "${esc(b.dataset.rmscen)}"?`, yes: 'Sim, remover', danger: true })) return;
      const st2 = { ...settings(), presets: (settings().presets || []).filter(p => p[0] !== b.dataset.rmscen) };
      try { await db.saveSettings(S.hh.id, st2); S.hh.settings = st2; toast('Cenário removido'); drawScen(); } catch (e) { toast('Não foi possível remover.'); }
    });
  };
  drawScen();

  // budget per category
  const dayCats = S.categories.filter(c => c.grp === 'dia' && c.name !== 'A classificar').map(c => c.name).sort((a, b) => a.localeCompare(b, 'pt'));
  let bud = Object.entries(budgetsOf(st)).map(([c, v]) => ({ c, v }));
  const drawBud = () => {
    $('#bRows').innerHTML = bud.length ? bud.map((r, i) => `<div class="brow" data-i="${i}"><select data-bc aria-label="Categoria">${['', ...dayCats].map(n => `<option value="${esc(n)}"${n === r.c ? ' selected' : ''}>${n ? esc(n) : 'Escolher categoria'}</option>`).join('')}</select>
      <input type="number" step="50" min="0" data-bv value="${r.v || ''}" placeholder="Limite (R$)" aria-label="Limite por mês"><button class="chip" type="button" data-brm aria-label="Remover">×</button></div>`).join('') : '<p class="small muted">Nenhum limite ainda.</p>';
    $('#bRows').querySelectorAll('.brow').forEach(row => {
      const r = bud[+row.dataset.i];
      row.querySelector('[data-bc]').onchange = e => { r.c = e.target.value; };
      row.querySelector('[data-bv]').onchange = e => { r.v = +e.target.value || 0; };
      row.querySelector('[data-brm]').onclick = async e => {
        if (!await confirmInline(e.target, { text: `Tirar o limite de ${esc(r.c || 'esta linha')}? Vale quando você tocar em Salvar orçamento.`, yes: 'Sim, tirar', danger: true })) return;
        bud.splice(+row.dataset.i, 1); drawBud();
      };
    });
  };
  drawBud();
  $('#bAdd').onclick = () => { bud.push({ c: '', v: 0 }); drawBud(); $('#bRows').lastElementChild.querySelector('select').focus(); };
  $('#bSuggest').onclick = async e => {
    const ks = monthKeys().filter(k => S.txs.some(t => t.month === k && !t.manual)).slice(-3);
    if (!ks.length) { toast('Importe pelo menos um mês para o app sugerir.'); return; }
    const sug = suggestBudgets(ks.map(k => byCategory(txsOf(k), S.catIdx)));
    if (!await confirmInline(e.target, { text: `Sugerir limites para ${Object.keys(sug).length} categorias, pela média de ${ks.length > 1 ? 'os últimos ' + ks.length + ' meses' : '1 mês'}? Os limites que você já pôs ficam como estão. Revise antes de salvar.`, yes: 'Sim, sugerir' })) return;
    for (const [c, v] of Object.entries(sug)) if (!bud.some(r => r.c === c)) bud.push({ c, v });
    drawBud();
  };
  $('#bSave').onclick = () => {
    clearInvalid(el);
    const rows = [...$('#bRows').querySelectorAll('.brow')], seen = new Set();
    for (let i = 0; i < bud.length; i++) {
      const r = bud[i], row = rows[i];
      if (!r.c) return invalid(row.querySelector('[data-bc]'), 'Escolha a categoria.');
      if (seen.has(r.c)) return invalid(row.querySelector('[data-bc]'), 'Essa categoria já tem limite.');
      seen.add(r.c);
      const m = checkNumber(r.v, { min: 1, max: 1e7, label: 'Limite' }); if (m) return invalid(row.querySelector('[data-bv]'), m);
    }
    save({ budgets: Object.fromEntries(bud.map(r => [r.c, Math.round(r.v * 100) / 100])) }, 'Orçamento salvo');
  };

  // lists
  const data = {}; for (const k in LISTS) data[k] = JSON.parse(JSON.stringify(st[k] || []));
  // The balance field shows what is left TODAY (installments and amortizations already off); typing another value replaces it from today.
  const shownSaldo = new Map(data.debts.map(d => [d.id, d.saldoEm ? debtNow(d, todayISO()).saldo : (+d.saldo || 0)]));
  data.debts.forEach(d => { d.saldo = shownSaldo.get(d.id); });
  const drawList = k => {
    const d = LISTS[k], tb = el.querySelector(`[data-list="${k}"]`);
    tb.innerHTML = data[k].map((r, i) => `<tr>${d.cols.map(([key, , type, opts]) => { let v = r[key]; if (type === 'pct' && v != null && v !== '') v = +(v * 100).toFixed(4);
      if (type === 'select') { if (key === 'tipo' && !v) v = r.tipo = guessAssetType(r.name); return `<td><select data-i="${i}" data-k="${key}" data-t="${type}">${opts.map(([o, l]) => `<option value="${o}"${(v || opts[0][0]) === o ? ' selected' : ''}>${l}</option>`).join('')}</select></td>`; }
      if (type === 'debtlink') { const cur = debtOfAsset(r, data.debts)?.id || ''; return `<td><select data-i="${i}" data-k="${key}" data-t="${type}"><option value="">Nenhum (quitado ou à parte)</option>${data.debts.filter(x => x.name).map(x => `<option value="${esc(x.id)}"${cur === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td>`; }
      if (k === 'assets' && key === 'debt') { const ln = debtOfAsset(r, data.debts); if (ln) return `<td><input type="text" readonly data-i="${i}" data-k="${key}" data-t="linked" value="${esc('R$ ' + Math.round(debtNow(ln, todayISO()).saldo).toLocaleString('pt-BR'))}" title="Vem do financiamento"></td>`; }
      return `<td><input type="${type === 'text' ? 'text' : 'number'}" ${type !== 'text' ? 'step="any"' : ''} data-i="${i}" data-k="${key}" data-t="${type}" value="${esc(v ?? '')}"></td>`; }).join('')}<td><button class="chip" type="button" data-rm="${i}" aria-label="Remover">×</button></td></tr>`).join('') || `<tr><td colspan="${d.cols.length + 1}" class="tiny muted">Nada cadastrado.</td></tr>`;
    tb.querySelectorAll('input:not([readonly]), select').forEach(inp => inp.onchange = () => { const r = data[k][+inp.dataset.i], t = inp.dataset.t; let v = inp.value;
      if (t === 'debtlink') { r.debtId = v || null; if (!v) r.debt = 0; drawList('assets'); return; }
      if (t === 'number') v = v === '' ? 0 : +v; else if (t === 'int') v = v === '' ? null : Math.round(+v); else if (t === 'pct') v = v === '' ? null : +v / 100; r[isNaN(+inp.dataset.k) ? inp.dataset.k : +inp.dataset.k] = v; });
    tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      const r = data[k][+b.dataset.rm], label = (Array.isArray(r) ? r[0] : r.name) || 'esta linha';
      if (!await confirmInline(b, { text: `Remover "${esc(label)}"? A remoção vale quando você tocar em Salvar patrimônio.`, yes: 'Sim, remover', danger: true })) return;
      data[k].splice(+b.dataset.rm, 1); drawList(k);
    });
  };
  for (const k in LISTS) drawList(k);
  el.querySelector('[data-list="debts"]').addEventListener('change', () => drawList('assets'));
  drawDebtsNow();
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const k = b.dataset.add; data[k].push(k === 'recurring' ? ['', 0, ''] : k === 'debts' ? { id: 'd' + Date.now().toString(36), name: '', saldo: 0, taxa: null, parcela: 0, sistema: 'price', meses: null } : {}); drawList(k); });
  // Every row of every list must be complete and sensible before saving.
  const checkLists = () => {
    for (const k in LISTS) {
      const d = LISTS[k], tb = el.querySelector(`[data-list="${k}"]`);
      for (let i = 0; i < data[k].length; i++) {
        const r = data[k][i], inp = key => tb.querySelector(`[data-i="${i}"][data-k="${key}"]`);
        for (const [key, label, type] of d.cols) {
          const v = r[key];
          const msg = type === 'text' && (key === 'name' || key === 0) ? checkName(v, label.toLowerCase(), 2, 80)
            : type === 'text' && /month|start/.test(key) ? checkMonth(v, { allowEmpty: key === 'start', label })
            : type === 'number' ? checkNumber(v, { min: 0, max: 1e9, label })
            : type === 'pct' ? checkNumber(v == null ? '' : v * 100, { min: 0, max: 100, label, allowEmpty: false })
            : type === 'int' ? checkNumber(v ?? '', { min: 0, max: 600, integer: true, label, allowEmpty: true }) : '';
          if (msg) return invalid(inp(key), msg);
        }
      }
    }
    // A financing needs what the app uses to take off each installment.
    const dtb = el.querySelector('[data-list="debts"]');
    for (let i = 0; i < data.debts.length; i++) {
      const r = data.debts[i], inp = key => dtb.querySelector(`[data-i="${i}"][data-k="${key}"]`);
      if (!(+r.parcela > 0) && +r.saldo > 0) return invalid(inp('parcela'), 'Informe a parcela por mês: com ela o app abate o saldo todo mês.');
      if (r.sistema === 'sac' && !(+r.meses > 0)) return invalid(inp('meses'), 'Nas parcelas que diminuem (SAC), diga quantos meses faltam.');
    }
    // A car or motorcycle needs its state: the IPVA rate and calendar depend on it.
    const atb = el.querySelector('[data-list="assets"]');
    for (let i = 0; i < data.assets.length; i++) { const a = data.assets[i]; if (a.name && isVehicle(a) && !a.uf) return invalid(atb.querySelector(`[data-i="${i}"][data-k="uf"]`), `Em que estado ${a.name} é registrado? O IPVA depende disso (a alíquota vai de 1% a 4%).`); }
    // A property still being paid without its financing: create it and ask for the data.
    for (let i = 0; i < data.assets.length; i++) {
      const a = data.assets[i];
      if (+a.debt > 0 && !debtOfAsset(a, data.debts)) {
        const id = 'd' + Date.now().toString(36);
        data.debts.push({ id, name: 'Financiamento de ' + a.name, saldo: +a.debt, taxa: null, parcela: 0, sistema: 'price', meses: null }); a.debtId = id;
        drawList('debts'); drawList('assets');
        return invalid(dtb.querySelector(`[data-i="${data.debts.length - 1}"][data-k="taxa"]`), `${a.name} ainda tem ${'R$ ' + Math.round(a.debt).toLocaleString('pt-BR')} para pagar. Complete o financiamento (juros, parcela e tipo de parcela) para o app ir abatendo sozinho.`);
      }
    }
    return validate([[$('#iTotal'), checkNumber($('#iTotal').value, { min: 0, max: 1e10, label: 'Investimentos', allowEmpty: true })]]);
  };
  // Balances typed by hand count from today; old ones get today's date so the installments start counting.
  const stampDebts = () => { const prev = new Map((st.debts || []).map(d => [d.id, d])), now = new Date().toISOString();
    data.debts = data.debts.map(d => { const p = prev.get(d.id); const changed = !p || Math.abs((shownSaldo.get(d.id) ?? (+p.saldo || 0)) - (+d.saldo || 0)) >= 0.01; return changed ? { ...d, saldoEm: todayISO(), saldoAt: now, log: p ? d.log : [] } : { ...d, saldo: p.saldo, saldoEm: d.saldoEm || todayISO() }; });
    data.assets = data.assets.map(a => { const ln = debtOfAsset(a, data.debts); return ln ? { ...a, debtId: ln.id, debt: 0 } : { ...a, debtId: null }; }); };
  // Each financing today: balance, what came off and when; register an extra payment by hand.
  function drawDebtsNow() {
    const box = $('#pDebtNow'); if (!box) return;
    const ds = debtsNow().filter(d => d.name);
    box.hidden = !ds.length;
    box.innerHTML = ds.length ? `<h3>Como está cada financiamento hoje</h3>${ds.map(d => `<div class="dnow"><p class="small"><strong>${esc(d.name)}</strong>: faltam <strong>${brl(d.now.saldo)}</strong>${d.now.months ? ' (estimado)' : ''}</p>
      <ul class="tiny muted">${d.now.history.map(h => `<li>${h.kind === 'inicio' ? `${isoToBr(h.date)}: saldo informado ${brl(h.value)}` : h.kind === 'amortizacao' ? `${isoToBr(h.date)}: amortização −${brl(h.value)}${h.note ? ' (' + esc(h.note) + ')' : ''}${h.at ? ` <button class="linkbtn tiny" type="button" data-undo="${esc(d.id)}" data-at="${esc(h.at)}" data-v="${h.value}">Desfazer</button>` : ''}` : `${esc(h.note)}: −${brl(h.value)}`}</li>`).join('')}</ul>
      <details class="help"><summary>Registrar uma amortização</summary><div class="grid3">${num('am' + d.id, 'Valor (R$)', '')}<label class="f">Data<input type="date" id="amd${esc(d.id)}" value="${todayISO()}"></label></div><button class="btn" type="button" data-amort="${esc(d.id)}">Abater do saldo</button></details></div>`).join('')}
      <p class="tiny muted">Com o comprovante, é mais fácil: mande em Lançar e diga que é amortização. Quando chegar o extrato do financiamento, digite o saldo dele acima e salve.</p>` : '';
    box.querySelectorAll('[data-amort]').forEach(b => b.onclick = async () => {
      const id = b.dataset.amort, v = +String($('#am' + id).value).replace(',', '.'), dt = $('#amd' + id).value;
      const e = checkNumber(v, { min: 1, max: 1e9, label: 'Valor' }); if (e) return invalid($('#am' + id), e);
      const de = checkDate(dt); if (de) return invalid($('#amd' + id), de);
      const d = ds.find(x => x.id === id);
      if (!await confirmInline(b, { title: 'Abater do financiamento?', text: `${brl(v)} saem do saldo do ${esc(d.name)} e o patrimônio líquido sobe o mesmo valor.`, yes: 'Sim, abater' })) return;
      try { const s = await applyAmortization(id, { value: v, date: dt, note: 'registrado à mão' }); toast(`O saldo do ${d.name} agora é ${brl(s)}.`); S.render(); } catch (err) { toast('Não foi possível abater agora. ' + db.errorText(err)); }
    });
    box.querySelectorAll('[data-undo]').forEach(b => b.onclick = async () => {
      const d = ds.find(x => x.id === b.dataset.undo);
      if (!await confirmInline(b, { title: 'Desfazer esta amortização?', text: `${brl(+b.dataset.v)} voltam para o saldo do ${esc(d.name)} e o lançamento volta para a categoria de antes (conta de novo na sobra do mês). O app não pergunta mais sobre esse pagamento.`, yes: 'Sim, desfazer' })) return;
      try { const r = await undoAmortization(d.id, b.dataset.at); toast(`Desfeito. O saldo do ${d.name} agora é ${brl(r.saldo)}.${r.hadTx && !r.back ? ' Confira a categoria do lançamento no Extrato.' : ''}`); S.render(); } catch (err) { toast('Não foi possível desfazer agora. ' + db.errorText(err)); }
    });
    renderPendingPayments($('#pDebtPay'), { onDone: () => S.render() });
  }
  $('#pSave').onclick = async () => { clearInvalid(el); if (!checkLists()) return; stampDebts(); await save({ ...data, invest: { ...(st.invest || {}), total: val('iTotal'), date: $('#iDate').value || todayISO() } }, 'Patrimônio salvo'); S.render(); };

  // categories
  let newKind = 'dvar';
  el.querySelectorAll('#cKinds .kind').forEach(b => b.onclick = () => { newKind = b.dataset.kind; el.querySelectorAll('#cKinds .kind').forEach(x => x.setAttribute('aria-checked', x === b)); });
  // Joining categories: entries, rules and receipt parts move to the one that stays (database, in one go);
  // budgets add up. Used by the suggestions ("Categorias parecidas") and by "Juntar com…" on each category.
  const usage = () => { const u = {}; for (const t of S.txs) for (const c of (t.splits?.length ? t.splits.map(x => x.category) : [t.category])) if (c) u[c] = (u[c] || 0) + 1; return u; };
  const joinCats = async (drop, keep, btn) => {
    const n = usage()[drop.name] || 0;
    if (!await confirmInline(btn, { title: `Juntar "${esc(drop.name)}" em "${esc(keep.name)}"?`, text: `${n ? `Os ${n} lançamentos de "${esc(drop.name)}"` : 'As regras'} passam para "${esc(keep.name)}", e "${esc(drop.name)}" deixa de existir. As regras e o orçamento também passam.`, yes: 'Sim, juntar' })) return false;
    try {
      await db.mergeCategory(drop.id, keep.id);
      S.txs.forEach(t => { if (t.category === drop.name) t.category = keep.name; (t.splits || []).forEach(x => { if (x.category === drop.name) x.category = keep.name; }); });
      S.rules.forEach(r => { if (r.category === drop.name) r.category = keep.name; });
      S.categories = S.categories.filter(c => c.id !== drop.id);
      const st = mergeSettings(settings(), drop.name, keep.name);
      if (st.budgets !== settings().budgets) { await db.saveSettings(S.hh.id, st).catch(() => {}); S.hh.settings = st; }
      reindex(); track('categorias.juntar'); toast(`Pronto: ${n} ${n === 1 ? 'lançamento passou' : 'lançamentos passaram'} para ${keep.name}.`); drawCats(); S.render();
      return true;
    } catch (err) { toast(err?.code === 'needs_schema' ? 'O banco de dados precisa de uma atualização para juntar categorias. Avise quem cuida do app.' : 'Não foi possível juntar. ' + db.errorText(err), 'err'); return false; }
  };
  const drawMerge = () => {
    const box = $('#catMerge'), dismissed = settings().catKeepApart || [];
    const list = mergeSuggestions(S.categories, usage(), dismissed);
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<h3 style="margin-top:10px">Categorias parecidas <span class="tiny muted">${list.length}</span></h3>
      <p class="small muted">O app achou categorias que parecem a mesma coisa. Juntar deixa os gráficos e o orçamento mais claros.</p>
      ${list.map((x, i) => `<article class="mergecard" data-i="${i}"><p class="small"><strong>${esc(x.drop)}</strong> <span class="tiny muted">(${x.dropCount} ${x.dropCount === 1 ? 'lançamento' : 'lançamentos'})</span> e <strong>${esc(x.keep)}</strong> <span class="tiny muted">(${x.keepCount})</span>: ${esc(x.reason)}.</p>
        <div class="rowbtn"><button class="btn primary" type="button" data-mj>Juntar em ${esc(x.keep)}</button><button class="btn" type="button" data-mjr>Juntar em ${esc(x.drop)}</button><button class="btn" type="button" data-mk>Manter separadas</button></div></article>`).join('')}`;
    box.querySelectorAll('.mergecard').forEach(card => {
      const x = list[+card.dataset.i], A = S.categories.find(c => c.name === x.keep), B = S.categories.find(c => c.name === x.drop);
      card.querySelector('[data-mj]').onclick = e => joinCats(B, A, e.target);
      card.querySelector('[data-mjr]').onclick = e => joinCats(A, B, e.target);
      card.querySelector('[data-mk]').onclick = async () => {
        const st = { ...settings(), catKeepApart: [...dismissed, pairKey(x.keep, x.drop)].slice(-200) };
        try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; toast('Combinado: ficam separadas e o app não pergunta de novo.'); drawMerge(); } catch (err) { toast('Não foi possível salvar.'); }
      };
    });
  };
  const drawCats = () => {
    drawMerge();
    const box = $('#catList');
    box.innerHTML = KINDS.map(k => {
      const list = S.categories.filter(c => kindOf(c).key === k.key).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
      if (!list.length) return '';
      return `<section class="catgroup"><h4>${k.label} <span class="tiny muted">${list.length}</span></h4><ul class="list small">${list.map(c => `<li data-c="${c.id}">
        <span class="catname">${esc(c.name)}${c.financing ? ' <span class="pill ok" style="font-size:11px;padding:1px 6px">financiamento</span>' : ''}</span>
        <span class="rowbtn"><select data-kind aria-label="Tipo de ${esc(c.name)}">${KINDS.map(x => `<option value="${x.key}"${x.key === k.key ? ' selected' : ''}>${x.label}</option>`).join('')}</select><button class="chip" type="button" data-ren>Renomear</button><button class="chip" type="button" data-join>Juntar com…</button></span></li>`).join('')}</ul></section>`;
    }).join('');
    box.querySelectorAll('li[data-c]').forEach(li => {
      const c = S.categories.find(x => x.id === li.dataset.c);
      li.querySelector('[data-kind]').onchange = async e => {
        const k = kindByKey(e.target.value), patch = { grp: k.grp, recurring: k.recurring };
        if (!await confirmInline(e.target, { text: `Mudar "${esc(c.name)}" para ${k.label}? Os meses já lançados são recalculados.`, yes: 'Sim, mudar' })) { e.target.value = kindOf(c).key; return; }
        try { await db.updateCategory(c.id, patch); Object.assign(c, patch); reindex(); toast('Categoria atualizada'); drawCats(); } catch (err) { toast('Não foi possível salvar.'); e.target.value = kindOf(c).key; }
      };
      li.querySelector('[data-join]').onclick = () => {
        const span = li.querySelector('.catname'), others = S.categories.filter(x => x.id !== c.id && x.name !== 'A classificar' && kindOf(x).side === kindOf(c).side).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
        if (!others.length) { toast('Não há outra categoria do mesmo lado (receita ou despesa) para juntar.', 'info'); return; }
        span.innerHTML = `${esc(c.name)}<label class="f" style="margin-top:6px">Juntar "${esc(c.name)}" em<select data-into>${others.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label><span class="rowbtn" style="margin-top:6px"><button class="btn primary" type="button" data-ok>Juntar</button><button class="btn" type="button" data-no>Cancelar</button></span>`;
        span.querySelector('[data-no]').onclick = drawCats;
        span.querySelector('[data-ok]').onclick = e => joinCats(c, S.categories.find(o => o.id === span.querySelector('[data-into]').value), e.target);
      };
      li.querySelector('[data-ren]').onclick = () => {
        const span = li.querySelector('.catname');
        span.innerHTML = `<input type="text" maxlength="60" value="${esc(c.name)}" aria-label="Novo nome" style="min-width:160px"><span class="rowbtn" style="margin-top:6px"><button class="btn primary" type="button" data-ok>Salvar nome</button><button class="btn" type="button" data-no>Cancelar</button></span>`;
        const inp = span.querySelector('input'); inp.focus(); inp.select();
        span.querySelector('[data-no]').onclick = drawCats;
        span.querySelector('[data-ok]').onclick = async e => {
          const name = inp.value.trim();
          const msg = checkName(name, 'o nome da categoria', 2, 60) || (name !== c.name && S.categories.some(x => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase()) ? 'Essa categoria já existe.' : '');
          if (msg) return invalid(inp, msg);
          if (name === c.name) return drawCats();
          if (!await confirmInline(e.target, { text: `Renomear "${esc(c.name)}" para "${esc(name)}"? Os lançamentos dessa categoria passam a usar o nome novo.`, yes: 'Sim, renomear' })) return;
          try {
            await db.renameCategory(c.id, name);
            const old = c.name; c.name = name;
            S.txs.forEach(t => { if (t.category === old) t.category = name; (t.splits || []).forEach(x => { if (x.category === old) x.category = name; }); });
            S.rules.forEach(r => { if (r.category === old) r.category = name; });
            reindex(); toast('Categoria renomeada'); drawCats();
          } catch (err) { toast('Não foi possível renomear. ' + db.errorText(err)); }
        };
      };
    });
  };
  drawCats();
  $('#cAdd').onclick = async e => {
    clearInvalid(el);
    const name = $('#cNew').value.trim(), k = kindByKey(newKind);
    if (!validate([[$('#cNew'), checkName(name, 'o nome da categoria', 2, 60) || (S.categories.some(c => c.name.toLowerCase() === name.toLowerCase()) ? 'Essa categoria já existe.' : '')]])) return;
    if (!await confirmInline(e.target, { text: `Criar a categoria "${esc(name)}" como ${k.label}?`, yes: 'Sim, criar' })) return;
    try { S.categories.push(await db.addCategory(S.hh.id, { name, grp: k.grp, recurring: k.recurring })); reindex(); toast('Categoria criada'); $('#cNew').value = ''; drawCats(); } catch (err) { toast('Não foi possível criar. ' + db.errorText(err)); }
  };

  $('#factsSave').onclick = () => save({ facts: $('#facts').value.split('\n').map(s => s.trim()).filter(Boolean) }, 'Contexto salvo');

  // data
  const statusBk = (kind, text) => { const p = $('#bkStatus'); p.hidden = false; p.className = 'status ' + kind; p.textContent = text; };
  const backup = async (status = statusBk) => {
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
  $('#dCsv').onclick = async e => {
    if (!await confirmInline(e.target, { title: 'Baixar a planilha?', text: `Todos os ${S.txs.length.toLocaleString('pt-BR')} lançamentos da família, para abrir no Excel. Guarde num lugar seguro e não compartilhe.`, yes: 'Sim, baixar' })) return;
    try {
      const name = `lancamentos-${S.hh.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-${todayISO()}.csv`;
      const url = URL.createObjectURL(new Blob([toCSV(S.txs, S.categories)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      track('backup.planilha'); statusBk('ok', `Planilha pronta: ${name}. Ela fica na pasta de downloads (no iPhone, no app Arquivos).`);
    } catch (err) { statusBk('err', 'Não foi possível gerar a planilha. Tente de novo.'); }
  };
  $('#dExport').onclick = async e => {
    if (!await confirmInline(e.target, { title: 'Baixar o backup?', text: 'O arquivo tem todos os dados financeiros da família. Guarde num lugar seguro e não compartilhe.', yes: 'Sim, baixar' })) return;
    if (await backup()) toast('Backup baixado. Ele está na pasta de downloads do aparelho.'); else toast('Não foi possível gerar o backup. Verifique a internet e tente de novo.');
  };
  $('#dImport').onchange = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    let b;
    try { b = JSON.parse(await f.text()); if (b.version !== 1 || !Array.isArray(b.transactions)) throw new Error(); }
    catch (err) { statusBk('err', 'Este arquivo não é um backup do app.'); return; }
    // Months that already have data are skipped, so importing the same backup twice never duplicates.
    const have = new Set(S.txs.map(t => t.source + '|' + t.month));
    const skip = [...new Set(b.transactions.filter(t => have.has(t.source + '|' + t.month)).map(t => t.month))].sort();
    const toAdd = b.transactions.filter(t => !have.has(t.source + '|' + t.month));
    const anchor = $('#dExport');
    const text = `Importar ${toAdd.length.toLocaleString('pt-BR')} lançamentos para a ${esc(S.hh.name)}?` + (skip.length ? ` Os meses ${skip.map(m => m.split('-').reverse().join('/')).join(', ')} já têm dados e serão pulados para não duplicar.` : '') + (b.household?.settings ? ' As metas, o patrimônio e os investimentos do backup substituem os atuais; os outros ajustes continuam.' : '');
    if (!await confirmInline(anchor, { text, yes: 'Sim, importar' })) { statusBk('ok', 'Importação cancelada.'); return; }
    b = { ...b, transactions: toAdd };
    statusBk('busy', `Importando ${b.transactions.length.toLocaleString('pt-BR')} lançamentos...`);
    try {
      await db.importBackup(S.hh.id, b, t => statusBk('busy', 'Importando... ' + t));
      await S.reload(true); S.render();
      statusBk('ok', `Pronto: ${b.transactions.length.toLocaleString('pt-BR')} lançamentos importados.`); toast('Backup importado');
    } catch (err) { statusBk('err', 'A importação parou no meio: ' + db.errorText(err) + ' Tente de novo: os meses que já entraram serão pulados.'); }
  };

  // account: every destructive action asks once, in the page, with a backup option
  const flashAndReload = msg => { try { sessionStorage.setItem('fin.flash', msg); localStorage.removeItem('fin.hh'); } catch (e) { /* storage blocked */ } location.reload(); };
  const ask = ({ title, text, label, run }) => {
    const box = $('#confirmBox');
    box.innerHTML = `<div class="confirm"><h3>${title}</h3><p class="small">${text}</p>
      <div class="bkfirst"><p class="small"><strong>Antes, baixe uma cópia dos seus dados.</strong> Depois de excluir, não dá para recuperar.</p>
      <div class="rowbtn" style="margin-top:8px"><button class="btn primary" type="button" data-b>Baixar backup agora</button></div>
      <p class="status" role="status" data-bks hidden></p></div>
      <div class="rowbtn" style="margin-top:10px"><button class="btn danger-fill" type="button" data-y>${label}</button><button class="btn" type="button" data-n>Cancelar</button></div>
      <p class="status" role="status" hidden></p></div>`;
    const st = box.querySelector('.status'), yes = box.querySelector('[data-y]');
    const bks = box.querySelector('[data-bks]');
    box.querySelector('[data-b]').onclick = () => backup((k, t) => { bks.hidden = false; bks.className = 'status ' + k; bks.textContent = t; });
    box.querySelector('[data-n]').onclick = () => { box.innerHTML = ''; document.body.classList.remove('cfm-open'); };
    document.body.classList.add('cfm-open');
    box.onclick = e => { if (e.target === box) { box.innerHTML = ''; document.body.classList.remove('cfm-open'); } };
    yes.onclick = async () => {
      yes.disabled = true; st.hidden = false; st.className = 'status busy'; st.textContent = 'Processando...';
      try { await run(); } catch (e) { st.className = 'status err'; st.textContent = 'Não foi possível concluir. Verifique a internet e tente de novo.'; yes.disabled = false; }
    };
    box.querySelector('[data-n]').focus();
  };
  $('#signOut').onclick = () => signOutSafely(db.sb);
  $('#delAcc').onclick = () => ask({
    title: 'Excluir minha conta?',
    text: `Seu login será apagado. ${S.members.length > 1 ? 'A família tem outras pessoas, então os dados dela continuam com elas.' : 'Você é a única pessoa da família, então todos os dados dela também serão apagados.'} Isso não pode ser desfeito.`,
    label: 'Sim, excluir minha conta',
    run: async () => { await db.deleteMyAccount(); try { localStorage.clear(); } catch (e) { /* storage blocked */ } await db.sb.auth.signOut().catch(() => {}); flashAndReload('Sua conta foi excluída' + (S.members.length > 1 ? '.' : ', junto com os dados da família.') + ' Obrigado por testar o app.'); },
  });
  if (owner) $('#clearTx').onclick = () => ask({
    title: 'Zerar os lançamentos?',
    text: `Todos os lançamentos e importações da ${esc(S.hh.name)} serão apagados, inclusive os que ${S.members.length > 1 ? 'as outras pessoas da família fizeram' : 'você fez'}. A família, as pessoas, as categorias, as regras e as metas continuam. Bom para começar do zero e importar um backup. Isso não pode ser desfeito.`,
    label: 'Sim, zerar os lançamentos',
    run: async () => { await db.clearEntries(S.hh.id); track('conta.zerar'); flashAndReload('Lançamentos zerados. Agora é só importar o backup ou mandar a primeira fatura.'); },
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

// Notifications page: what this device can do, which notices, test and turn off.
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
async function renderPush(box) {
  const st = await pushStatus().catch(() => 'unsupported');
  S.pushStatus = st;
  const focus = S.pushFocus; S.pushFocus = false;
  const msg = {
    'need-install': `<p class="small">No iPhone, os avisos só funcionam com o app instalado na tela de início. Instale e abra pelo ícone; depois volte aqui.</p><details class="help" open><summary>Como instalar</summary>${installHelpHTML()}</details>`,
    'no-sw': '<p class="small">O app ainda está terminando de instalar neste aparelho. Feche e abra de novo, e volte aqui.</p>',
    unsupported: '<p class="small">Este navegador não recebe avisos. No Android, use o Chrome. No iPhone, instale o app na tela de início.</p>',
    'not-configured': '<p class="small">Os avisos ainda não foram ligados no servidor do app. Assim que forem, esta página libera o botão.</p>',
    denied: `<p class="small">Os avisos estão bloqueados para este app no celular. Para liberar:</p><ol class="small">${isIOS() ? '<li>Abra os Ajustes do iPhone → Notificações.</li><li>Toque em Pra Onde Foi e ligue Permitir Notificações.</li>' : '<li>No Chrome, toque no ícone ao lado do endereço (ou segure o ícone do app → Informações do app).</li><li>Toque em Notificações e escolha Permitir.</li>'}<li>Volte aqui e toque em Ativar avisos.</li></ol>`,
  }[st];
  if (msg) { box.innerHTML = msg; wireInstall(box); if (focus) box.classList.add('pulse'); return; }
  const prefs = await currentPrefs().catch(() => ({ dados: true, gastos: true, conquistas: true, semanal: true }));
  box.innerHTML = `${st === 'on' ? '<p class="status ok">Avisos ligados neste celular.</p>' : ''}
    <fieldset class="pushtypes"><legend class="small muted">Quero ser avisado sobre</legend>
    ${PUSH_TYPES.map(t => `<label class="radio"><input type="checkbox" data-pt="${t.key}" ${prefs[t.key] !== false ? 'checked' : ''}><span><strong>${t.label}</strong><br><span class="tiny muted">${t.hint}</span></span></label>`).join('')}</fieldset>
    <div class="rowbtn">${st === 'on' ? '<button class="btn" type="button" id="pTest">Enviar aviso de teste</button><button class="btn danger" type="button" id="pOff">Desligar avisos</button>' : '<button class="btn primary" type="button" id="pOn">Ativar avisos neste celular</button>'}</div>
    <p class="status" id="pMsg" role="status" hidden></p>
    ${st === 'on' ? `<div class="pcheck stack" id="pCheck" hidden><p><strong>Mandamos um aviso de teste.</strong> Ele apareceu na tela do celular?</p>
      <div class="rowbtn"><button class="btn primary" type="button" id="pYes">Sim, apareceu</button><button class="btn" type="button" id="pNo">Não apareceu</button></div></div>
    <details class="help" id="pPhone"><summary>O aviso não aparece? Veja os ajustes do celular</summary>
      <p class="small">Tocar em Permitir libera o app, mas o próprio celular pode continuar segurando os avisos. Confira:</p>
      <ol class="small">${phoneSteps(platformOf(navigator.userAgent)).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="tiny muted">Depois, volte aqui e toque em Enviar aviso de teste.</p></details>` : ''}`;
  const say = (k, t) => { const p = $('#pMsg'); p.hidden = false; p.className = 'status ' + k; p.textContent = t; };
  const read = () => Object.fromEntries([...box.querySelectorAll('[data-pt]')].map(i => [i.dataset.pt, i.checked]));
  box.querySelectorAll('[data-pt]').forEach(i => i.onchange = async () => {
    if (!Object.values(read()).some(Boolean)) { i.checked = true; say('err', 'Deixe pelo menos um tipo de aviso ligado, ou toque em Desligar avisos.'); return; }
    if (st === 'on') { try { await savePrefs(read()); say('ok', 'Preferências salvas.'); } catch (e) { say('err', 'Não foi possível salvar. Verifique a internet.'); } }
  });
  if (st !== 'on' && focus) setTimeout(() => { const b = $('#pOn'); if (!b) return; b.scrollIntoView({ behavior: 'smooth', block: 'center' }); b.classList.add('pulse'); b.focus({ preventScroll: true }); }, 80);
  if (st !== 'on') $('#pOn').onclick = async () => {
    say('busy', 'O celular vai pedir permissão. Toque em Permitir.');
    try {
      const r = await enablePush(read());
      if (r === 'on') { lsSet('fin.push.on', '1'); S.pushStatus = 'on'; track('avisos.ligou'); toast('Avisos ligados'); S.pushAskCheck = true; renderPush(box); }
      else if (r === 'denied') renderPush(box);
      else say('err', 'Você não permitiu os avisos. Quando quiser, toque em Ativar de novo.');
    } catch (e) { say('err', 'Não foi possível ligar os avisos. ' + db.errorText(e)); }
  };
  else {
    // Did it really show on the phone? If not, the phone's own settings are holding it: show the way.
    // The service worker says when the test reaches this phone: then the question is only whether it showed.
    let got = null;
    const onMsg = ev => { if (ev.data?.type === 'push' && ev.data.tag === 'teste') got = ev.data.shown === false ? 'blocked' : 'arrived'; };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    const ask = () => {
      const c = $('#pCheck'); if (!c) return;
      const o = testOutcome(got || 'missing');
      if (got === 'blocked') { $('#pNo').click(); return; }
      c.querySelector('p').innerHTML = `<strong>${o.ask}</strong>`; c.hidden = false;
    };
    const test = async () => {
      got = null; say('busy', 'Enviando...');
      try {
        await sendTest(); say('ok', 'Aviso enviado. Ele chega em alguns segundos.');
        const t0 = Date.now(); const wait = setInterval(() => { if (got || Date.now() - t0 > 15000) { clearInterval(wait); ask(); } }, 500);
      } catch (e) { say('err', 'Não foi possível enviar o teste agora. Verifique a internet e tente de novo.'); }
    };
    $('#pTest').onclick = test;
    $('#pYes').onclick = () => { track('avisos.teste_chegou'); $('#pCheck').hidden = true; say('ok', 'Tudo certo! Os avisos vão chegar assim.'); };
    $('#pNo').onclick = () => {
      track(got === 'arrived' ? 'avisos.teste_nao_mostrou' : got === 'blocked' ? 'avisos.teste_bloqueado' : 'avisos.teste_nao_chegou'); $('#pCheck').hidden = true;
      const d = $('#pPhone'); d.open = true; d.classList.add('pulse'); d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      say('err', testOutcome(got || 'missing').no);
    };
    if (S.pushAskCheck) { S.pushAskCheck = false; setTimeout(test, 400); }
    $('#pOff').onclick = async e => {
      if (!await confirmInline(e.target, { text: 'Desligar os avisos neste celular? Dá para ligar de novo quando quiser.', yes: 'Sim, desligar', danger: true })) return;
      await disablePush(); lsSet('fin.push.on', '0'); S.pushStatus = 'off'; toast('Avisos desligados'); renderPush(box);
    };
  }
}

function theme() { try { return localStorage.getItem('fin.theme') || 'light'; } catch (e) { return 'light'; } }

// "Quem paga o quê": card and account owners, and how expenses are shared.
function renderSplit(box) {
  const sp = settings().split || {}, mem = S.members, nm = m => esc(m.display_name || 'Membro');
  if (mem.length < 2) { box.innerHTML = '<p class="small">Só faz sentido com duas pessoas ou mais na família. Convide quem divide as contas em Família e convites.</p><div><button class="chip" type="button" data-inv>Convidar alguém</button></div>'; box.querySelector('[data-inv]').onclick = () => S.go('ajustes', '#ivName', 'familia'); return; }
  const cards = [...new Set(S.txs.filter(t => t.source === 'cartao' && t.card).map(t => t.card))].sort();
  const opt = (sel, none = 'Ninguém / não sei') => `<option value="">${none}</option>` + mem.map(m => `<option value="${m.user_id}"${m.user_id === sel ? ' selected' : ''}>${nm(m)}</option>`).join('');
  const share = mem.map(m => Math.round(((sp.share || {})[m.user_id] ?? 1 / mem.length) * 100));
  box.innerHTML = `<h3>Cartões</h3>
    ${cards.length ? cards.map(c => `<label class="f">Cartão final ${esc(c)}<select data-card="${esc(c)}">${opt(sp.cards?.[c])}</select></label>`).join('') : '<p class="small muted">Os cartões aparecem aqui depois da primeira fatura importada.</p>'}
    <h3>Conta</h3>
    <label class="f">Quem paga o que sai da conta<select data-conta>${opt(sp.conta)}</select></label>
    <h3>Como dividir as despesas</h3>
    <div class="grid2">${mem.map((m, i) => `<label class="f">${nm(m)} (%)<input type="number" min="0" max="100" step="1" data-share="${m.user_id}" value="${share[i]}"></label>`).join('')}</div>
    <p class="tiny muted">Meio a meio é o comum. Se um ganha mais, dá para dividir na proporção da renda (ex.: 60 e 40).</p>
    <div><button class="btn primary" type="button" id="spSave">Salvar</button></div>`;
  $('#spSave').onclick = async e => {
    clearInvalid(box);
    const ins = [...box.querySelectorAll('[data-share]')], tot = ins.reduce((a, i) => a + (+i.value || 0), 0);
    for (const i of ins) { const m = checkNumber(i.value, { min: 0, max: 100, integer: true, label: 'Parte' }); if (m) return invalid(i, m); }
    if (tot !== 100) return invalid(ins[ins.length - 1], `As partes somam ${tot}%. Precisam somar 100%.`);
    if (!await confirmInline(e.target, { text: 'Salvar quem paga cada cartão e conta, e a divisão das despesas?', yes: 'Sim, salvar' })) return;
    const split = { cards: Object.fromEntries([...box.querySelectorAll('[data-card]')].filter(s => s.value).map(s => [s.dataset.card, s.value])), conta: box.querySelector('[data-conta]').value || null, share: Object.fromEntries(ins.map(i => [i.dataset.share, (+i.value) / 100])) };
    save({ split }, 'Divisão salva');
  };
}
