import { S, reindex, closeDay, txsOf, pendingManual, latestCard, latestClosed, monthKeys, settings } from '../state.js';
import { debtForTx, looksLikeDebtPayment } from '../lib/debt.js';
import { applyAmortization, AMORT_CAT } from '../debtpay.js';
// After saving: if the home has news because of it (a warning, a good one), say so.
function homeNews() {
  S.savedAt = Date.now();
  setTimeout(() => import('./resumo.js').then(m => { const x = m.freshNotices().find(n => n.tone !== 'info'); if (x) toast(`${x.title}. Veja no Início.`, x.tone === 'good' ? 'ok' : 'info'); }).catch(() => {}), 3200);
}
import { track } from '../usage.js';
import * as db from '../db.js';
import { askJSON, aiErrorText } from '../ai.js';
import { attachMic, speechSupported } from '../speech.js';
import { classify } from '../lib/categorize.js';
import { lineify, detect, parseFaturaSantander, parseExtratoSantander, faturaMonth, checkFatura, checkExtrato, detectBank, MONEY } from '../lib/parse.js';
import { brl, esc, mLong, addM, todayISO, isoToBr, cycleMonth, norm, round2, thisMonth } from '../lib/format.js';
import { $, toast, catPicker, confirmInline, invalid, clearInvalid, busy } from '../ui.js';
import { checkDate, checkNumber, checkName } from '../lib/validate.js';
import { notifyFamily } from '../push.js';
import { receiptPrompt, normalizeReceipt, splitByCategory, findMatches } from '../lib/receipt.js';
import { classifyText, aiKind, KIND_LABEL, KIND_RULES } from '../lib/classify.js';
import { docKeys, compareStatement, docsText } from '../lib/statements.js';
import { applyMemos } from '../lib/memo.js';
import { parseCSV, detectColumns, buildEntries, markDuplicates, matchCategory } from '../lib/sheet.js';
import { makeQueue, advance, isDone, position, queueSummary, STATUS_LABEL, QUEUE_MAX, progressOf, nowHint, failedIndexes } from '../lib/queue.js';

const EXAMPLES = ['gastei 230 no mercado hoje no cartão', 'paguei 350 de terapia por pix', 'recebi 1.950 de reembolso do plano de saúde', 'almoço de 180 no cartão ontem'];
let Q = null;          // quick-entry preview items
let R = null;          // PDF review state
const PDF = { bytes: null, name: '' };

export function render(el) {
  if (!el.dataset.built) build(el);
  renderManual(); renderImports();
  const nm = pendingManual().length, ni = S.imports.length;
  $('#lHistSum').textContent = `${nm} em aberto · ${ni} ${ni === 1 ? 'importação' : 'importações'}`;
}

// One way of entering at a time: the tiles on top open the matching panel.
let mode = null;
export function openMode(m, focus) {
  if (focus) track('lancar.' + m);
  mode = m === 'mao' ? 'falar' : m;
  document.querySelectorAll('#v-lancar [data-panel]').forEach(p => { p.hidden = p.dataset.panel !== mode; });
  document.querySelectorAll('#v-lancar .ltile').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  if (m === 'mao') $('#qManual').click();
  if (focus) { const p = document.querySelector(`#v-lancar [data-panel="${mode}"]`); p.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (m === 'falar') setTimeout(() => $('#qText').focus({ preventScroll: true }), 300); }
}
// Called by S.go before scrolling to an element of this view (e.g. "#drop" from the home ruler).
export function reveal(sel) {
  const e = document.querySelector(sel), p = e && e.closest('#v-lancar [data-panel]');
  if (p && p.hidden) openMode(p.dataset.panel);
  if (e && e.closest('#lHist')) $('#lHist').open = true;
}

function build(el) {
  el.dataset.built = '1';
  el.innerHTML = `
  <div class="panel stack">
    <h2>O que você quer lançar?</h2>
    <div class="ltiles" role="group" aria-label="Como lançar"><button type="button" class="ltile" data-mode="falar" aria-pressed="false"><span class="lti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span><span><strong>Falar ou escrever</strong><span class="tiny muted">"Gastei 45 na padaria no pix"</span></span></button><button type="button" class="ltile" data-mode="nota" aria-pressed="false"><span class="lti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span><span><strong>Foto da nota</strong><span class="tiny muted">Separa cada item por categoria</span></span></button><button type="button" class="ltile" data-mode="pdf" aria-pressed="false"><span class="lti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/></svg></span><span><strong>Fatura ou extrato</strong><span class="tiny muted">PDF, foto ou planilha</span><span class="lmany">Vários de uma vez</span></span></button><button type="button" class="ltile" data-mode="mao" aria-pressed="false"><span class="lti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></span><span><strong>Preencher à mão</strong><span class="tiny muted">Data, valor e categoria</span></span></button></div>
  </div>
  <div class="panel stack qbar" id="qBar" hidden aria-live="polite"></div>
  <div class="panel" data-panel="falar" hidden>
    <h2>Lançar um gasto ou entrada</h2>
    <p class="muted small">Fale ou escreva do jeito que diria. Pode ser mais de um na mesma frase.</p>
    <div class="inwrap" style="margin-top:10px"><textarea id="qText" placeholder="Ex.: gastei 230 no mercado hoje no cartão e 350 de terapia por pix"></textarea><button id="qMic"></button></div>
    <p class="tiny muted" style="margin-top:6px">${speechSupported ? 'Toque no microfone, fale e toque de novo para parar.' : 'Para falar, use o microfone do teclado do celular.'}</p>
    <div class="chips" style="margin-top:8px" id="qExamples">${EXAMPLES.map(e => `<button class="chip" type="button">${esc(e)}</button>`).join('')}</div>
    <div class="rowbtn" style="margin-top:12px"><button class="btn primary" id="qGo" type="button">Interpretar</button><button class="btn" id="qManual" type="button">Preencher à mão</button><span class="small muted" id="qStatus"></span></div>
    <div id="qPreview" hidden style="margin-top:14px"></div>
  </div>
  <div class="panel" id="rcPanel" data-panel="nota" hidden>
    <h2>Nota fiscal ou cupom</h2>
    <p class="muted small">Tire uma foto da nota (ou envie o PDF) e o app separa cada item na categoria certa. Ex.: na farmácia, remédio vai para Saúde e suplemento para Suplementos. A foto não fica guardada.</p>
    <div class="rowbtn" style="margin-top:12px">
      <span class="btn primary" style="position:relative">Tirar foto<input type="file" id="rcCam" class="fileover" accept="image/*" capture="environment" aria-label="Tirar foto da nota"></span>
      <span class="btn" style="position:relative">Enviar foto ou PDF<input type="file" id="rcFile" class="fileover" accept="image/*,.pdf,application/pdf" aria-label="Enviar foto ou PDF da nota"></span>
    </div>
    <div class="log" id="rcLog" style="margin-top:12px"></div>
    <div id="rcReview" hidden style="margin-top:14px"></div>
  </div>
  <div class="panel" data-panel="pdf" hidden>
    <h2>Enviar faturas, extratos ou planilha</h2>
    <p class="muted small">O app descobre o que é cada arquivo pelo conteúdo, lê, confere os totais e mostra tudo para você revisar antes de salvar. O arquivo não fica guardado.</p>
    <div class="cansend" id="canSend">
      <p class="cs-t"><strong>O que dá para mandar</strong> <span class="lmany">um ou vários de uma vez</span></p>
      <ul>
        <li><b>Faturas de todos os cartões</b><span>do mesmo mês, juntas</span></li>
        <li><b>Extrato da conta</b><span>mesmo se o banco dividiu em vários arquivos</span></li>
        <li><b>Planilha Excel ou CSV</b><span>a que vocês já usavam para controlar</span></li>
        <li><b>Foto ou print</b><span>de fatura, extrato ou comprovante</span></li>
      </ul>
      <p class="tiny muted">Mandou vários? O app lê um por vez, numa fila, e você revisa cada um. PDF com senha também funciona: o app pede a senha e não a guarda.</p>
      <p class="trust-line small" id="lTrust"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Sem senha do banco: o arquivo é lido neste celular e descartado.</p>
    </div>
    <div class="drop" id="drop" style="margin-top:12px">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/></svg>
      <strong>Escolher arquivos (um ou vários)</strong>
      <span class="small muted">PDF, foto, print ou planilha.</span>
      <input type="file" id="pdfIn" class="fileover" accept=".pdf,application/pdf,image/*,.xlsx,.xls,.csv,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" multiple aria-label="Escolher arquivos: PDF, foto, print ou planilha (um ou vários)">
    </div>
    <details class="help" style="margin-top:10px"><summary>Como marcar vários arquivos no celular?</summary><ol>
      <li><strong>iPhone:</strong> toque em Escolher arquivos → <em>Escolher Arquivo</em> (ou <em>Procurar</em>), depois em <em>Selecionar</em>, no canto de cima, marque todos e toque em <em>Abrir</em>.</li>
      <li><strong>Android:</strong> toque em Escolher arquivos, segure o dedo no primeiro arquivo até ele ficar marcado, toque nos outros e depois em <em>Selecionar</em> (ou <em>Abrir</em>).</li>
      <li>Também dá para compartilhar vários PDFs de uma vez a partir do app do banco ou de Arquivos: toque em Compartilhar → Pra Onde Foi (no Android, com o app instalado).</li></ol></details>
    <details class="help" style="margin-top:10px"><summary>Onde encontro o PDF no app do banco?</summary><ol>
      <li><strong>Fatura do cartão:</strong> no app do banco, abra Cartões → Fatura e procure <em>Baixar PDF</em>, <em>Compartilhar</em> ou <em>Enviar por e-mail</em>.</li>
      <li><strong>Extrato da conta:</strong> abra Conta → Extrato, escolha o mês inteiro (do dia 1 ao último dia) e procure <em>Exportar PDF</em> ou <em>Compartilhar</em>.</li>
      <li>No celular, ao compartilhar, escolha <em>Salvar em Arquivos</em> (iPhone) ou <em>Salvar no aparelho</em> (Android). Depois toque em Escolher arquivos aqui e procure o arquivo.</li>
      <li>Se o banco mandar o PDF por e-mail, abra o anexo e salve do mesmo jeito.</li></ol></details>
    <div id="pwBox" hidden style="margin-top:12px" class="stack">
      <label class="f" for="pwIn">Senha do PDF<input type="password" id="pwIn" autocomplete="off"></label>
      <div><button class="btn primary" id="pwGo" type="button">Abrir</button></div>
    </div>
    <div class="log" id="pdfLog" style="margin-top:12px"></div>
    <div id="review" hidden style="margin-top:14px"></div>
    <div id="shReview" hidden style="margin-top:14px"></div>
  </div>
  <details class="more" id="lHist">
    <summary><span><strong>Lançados à mão e importações</strong><br><span class="tiny muted" id="lHistSum"></span></span></summary>
    <div class="stack">
      <div class="panel">
        <h3>Lançamentos manuais em aberto</h3>
        <p class="muted small">Entram nas contas do mês até chegar o extrato ou a fatura. Na importação, os que baterem são conciliados.</p>
        <div id="manualList" style="margin-top:8px"></div>
      </div>
      <div class="panel"><h3>Importações</h3><ul class="list small" id="importList"></ul></div>
    </div>
  </details>`;
  el.querySelectorAll('.ltile').forEach(b => b.onclick = () => openMode(b.dataset.mode, true));
  attachMic($('#qMic'), $('#qText'));
  el.querySelectorAll('#qExamples .chip').forEach(b => b.onclick = () => { $('#qText').value = b.textContent; $('#qText').focus(); });
  $('#qGo').onclick = interpret;
  $('#qManual').onclick = () => { Q = [{ source: 'conta', date: todayISO(), description: '', amount: 0, category: 'A classificar' }]; renderQ(); $('#qStatus').textContent = 'Preencha e salve.'; };
  $('#pdfIn').onchange = e => { const fs = [...(e.target.files || [])]; e.target.value = ''; startFiles(fs, 'pdf'); };
  const drop = $('#drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); startFiles([...(e.dataTransfer.files || [])], 'pdf'); };
  $('#pwGo').onclick = () => withBusy('Abrindo o PDF...', () => openPdf($('#pwIn').value), resultArea, 'Abrindo o PDF');
  for (const id of ['#rcCam', '#rcFile']) $(id).onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) withBusy('Lendo a nota...', () => routeFile(f, 'nota'), resultArea, 'Lendo a nota fiscal'); };
}

// ---------- manual entries ----------
function renderManual() {
  const list = pendingManual().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const box = $('#manualList');
  box.innerHTML = list.length ? `<ul class="list small">${list.map(t => `<li><span>${esc(isoToBr(t.date))} · ${esc(t.description)}<br><span class="tiny muted">${esc(t.category || 'A classificar')} · ${t.source === 'cartao' ? 'cartão, fatura de ' + mLong(t.month) : 'conta'}</span></span><span class="rowbtn"><span class="amt">${brl(t.amount)}</span><button class="chip" type="button" data-del="${t.id}">Apagar</button></span></li>`).join('')}</ul>` : '<div class="empty small">Nenhum lançamento manual em aberto.</div>';
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const t = S.txs.find(x => x.id === b.dataset.del);
    if (!await confirmInline(b, { text: `Apagar "${esc(t?.description || '')}" de ${brl(t?.amount || 0)}?`, yes: 'Sim, apagar', danger: true })) return;
    try { await db.deleteTransaction(b.dataset.del); S.txs = S.txs.filter(x => x.id !== b.dataset.del); toast('Lançamento apagado'); S.render(); } catch (e) { toast('Não foi possível apagar. ' + db.errorText(e)); }
  });
}
function renderImports() {
  const list = S.imports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  $('#importList').innerHTML = list.length ? list.map(i => `<li><span>${esc(i.label)}<br><span class="tiny muted">${esc(i.file_name || '')}</span></span><span class="tiny muted">${new Date(i.created_at).toLocaleDateString('pt-BR')}</span></li>`).join('') : '<li class="muted">Nenhuma importação ainda.</li>';
}

// ---------- quick entry ----------
const catList = () => S.categories.map(c => `${c.name} [${c.grp}]`).join(' | ');
async function interpret() {
  const txt = $('#qText').value.trim();
  if (!txt) { invalid($('#qText'), 'Escreva ou fale o gasto, por exemplo: "gastei 45 na padaria no pix".'); return; }
  $('#qGo').disabled = true; $('#qStatus').textContent = 'Interpretando...';
  const prompt = `Você registra lançamentos financeiros de uma família brasileira (${S.hh.name}). Hoje é ${todayISO()}.
Transforme a frase abaixo em lançamentos. Responda só com JSON no formato:
{"itens":[{"descricao":"texto curto","valor":123.45,"sentido":"saida"|"entrada","data":"AAAA-MM-DD","meio":"cartao"|"conta","categoria":"<nome exato de uma categoria da lista>"}]}
Regras: valor sempre positivo. "meio" = cartao quando falar em cartão ou crédito; conta para pix, boleto, débito, transferência ou dinheiro; sem meio dito, use conta. Datas relativas (hoje, ontem, sexta) a partir de hoje. Escolha a categoria pelo nome; o grupo entre colchetes ajuda (renda, entrada, pontual, dia, fora, neutro).
Categorias: ${catList()}
Frase: """${txt}"""`;
  try {
    const r = await askJSON(prompt, { tier: 'quick', maxTokens: 1500 });
    const its = (r?.itens || []).filter(x => x && +x.valor > 0);
    if (!its.length) throw { code: 'empty' };
    Q = itemsToQ(its, txt);
    renderQ(); $('#qStatus').textContent = 'Confira e salve.';
  } catch (e) { $('#qStatus').textContent = e.code === 'empty' ? 'Não achei um valor. Tente dizer quanto foi e o que foi.' : aiErrorText(e); }
  finally { $('#qGo').disabled = false; }
}
// Items from the assistant ({descricao, valor, sentido, data, meio, categoria}) as rows to review.
function itemsToQ(its, fallback) {
  const names = new Set(S.categories.map(c => c.name));
  return its.map(x => {
    const source = x.meio === 'cartao' ? 'cartao' : 'conta';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : todayISO();
    const sign = x.sentido === 'entrada' ? 1 : -1, v = Math.abs(+x.valor);
    return { source, date, description: String(x.descricao || fallback || '').slice(0, 80), amount: round2(source === 'cartao' ? -sign * v : sign * v), category: names.has(x.categoria) ? x.categoria : (sign > 0 ? 'Outras entradas' : 'A classificar') };
  });
}

// ---------- shared with the app (Android: "Compartilhar" in the bank app) ----------
// A Pix/TED receipt becomes an entry to review; a fiscal receipt goes to "Foto da nota";
// a statement PDF goes to "Fatura ou extrato"; shared text is read like a spoken phrase.
export async function handleShared() {
  let meta = null; const files = [];
  try {
    const c = await caches.open('share');
    const m = await c.match('/shared/meta'); meta = m ? await m.json() : null;
    const list = meta?.files?.length ? meta.files : [{ name: meta?.name, type: meta?.type }];
    for (let i = 0; i < list.length; i++) {
      const key = i ? '/shared/file' + i : '/shared/file', f = await c.match(key);
      if (f) { const b = await f.blob(); files.push(new File([b], list[i].name || 'compartilhado', { type: list[i].type || b.type })); }
      await c.delete(key);
    }
    await c.delete('/shared/meta');
  } catch (e) { /* no cache: nothing shared */ }
  if (!meta || (!files.length && !meta.text)) { toast('Não recebi nada do compartilhamento. Tente de novo pelo botão Compartilhar do banco.', 'info'); return; }
  if (!files.length) { openMode('falar', true); $('#qText').value = meta.text.slice(0, 500); return interpret(); }
  if (files.length > 1) return startFiles(files, 'share');
  return withBusy('Lendo o que você compartilhou...', () => routeFile(files[0], 'share'), resultArea);
}

// ---------- several files at once ----------
// One file: as always. Several: read one at a time, each with its review ("2 de 3"); saving, discarding or
// skipping moves to the next; a summary at the end. Later files see what the earlier ones saved, so a second
// card's bill enters alongside the first.
let QU = null, QFILES = [];
function startFiles(files, from) {
  files = files.filter(f => f && f.size !== 0);
  if (!files.length) return;
  if (files.length === 1 && !QU) return withBusy('Lendo ' + files[0].name + '...', () => routeFile(files[0], from), resultArea).catch(err => plog('Não consegui ler este arquivo (' + (err?.message || err) + ').', 'var(--bad)'));
  if (QU && !isDone(QU)) { toast('Termine os arquivos que já estão na fila antes de escolher outros.', 'info'); return; }
  QU = makeQueue(files); QFILES = files.slice(0, QUEUE_MAX); QU.items[0].status = 'lendo'; track('lancar.varios');
  if (QU.extra) toast(`Dá para ler até ${QUEUE_MAX} arquivos por vez. Os outros ${QU.extra} ficaram de fora.`, 'info');
  openMode('pdf', false); runCurrent();
}
// Something is waiting for the person: a review, the password, the "what is it?" choice.
const waiting = () => ['#review', '#pwBox', '#qPreview', '#rcReview', '#shReview'].some(s => $(s) && !$(s).hidden) || !!$('#pdfLog .chips');
async function runCurrent() {
  renderQueue();
  const f = QFILES[QU.i];
  $('#toast').hidden = true; $('#pdfLog').innerHTML = ''; $('#rcLog').innerHTML = '';
  await withBusy(`Lendo ${f.name}...`, () => routeFile(f, 'fila'), resultArea, `Arquivo ${position(QU)}`).catch(err => plog('Não consegui ler este arquivo (' + (err?.message || err) + ').', 'var(--bad)'));
  if (QU && !isDone(QU) && QFILES[QU.i] === f && !waiting()) docDone('erro', failReason());
  else renderQueue();
}
// Why the file could not be read: the last problem the reading wrote, or the message it showed.
function failReason() {
  const lines = [...document.querySelectorAll('#pdfLog div, #rcLog div')].filter(d => /--(bad|warn)/.test(d.style.color)).map(d => d.textContent.trim());
  const t = !$('#toast').hidden ? ($('#toast .tt > span')?.textContent || '').trim() : '';
  return (lines.pop() || t || 'Não reconheci o documento.').replace(/\s+/g, ' ').slice(0, 140);
}
// What the person has to do now, from what is on screen.
const nowWhat = () => !$('#shReview').hidden ? 'planilha' : !$('#review').hidden ? 'revisao' : !$('#pwBox').hidden ? 'senha' : $('#pdfLog .chips') ? 'escolher' : !$('#qPreview').hidden ? 'lancamento' : !$('#rcReview').hidden ? 'nota' : '';
const nowTarget = { planilha: '#shReview', revisao: '#review', senha: '#pwBox', escolher: '#pdfLog', lancamento: '#qPreview', nota: '#rcReview' };
// Called when the current document was saved, discarded or could not be read. Does nothing outside a queue.
function docDone(status, label = '') {
  if (!QU || isDone(QU)) return;
  const name = QU.items[QU.i]?.name;
  advance(QU, status, label);
  ['#review', '#pwBox', '#qPreview', '#rcReview', '#shReview'].forEach(s => { if ($(s)) $(s).hidden = true; });
  if (status === 'erro' && !isDone(QU)) toast(`${name} não deu para ler. Seguindo para o próximo; no fim dá para tentar de novo.`, 'info');
  if (isDone(QU)) { renderQueue(); toast(queueSummary(QU).head.replace(/^Pronto:\s*/, 'Arquivos lidos: ')); $('#qBar').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  setTimeout(runCurrent, 400);
}
function renderQueue() {
  const bar = $('#qBar'); if (!bar) return;
  // While files are being read and reviewed, the upload area steps aside so the review sits right below.
  document.querySelector('#v-lancar [data-panel="pdf"]')?.classList.toggle('inqueue', !!QU && !isDone(QU));
  if (!QU) { bar.hidden = true; return; }
  const done = isDone(QU), s = queueSummary(QU);
  bar.hidden = false;
  const what = done ? '' : nowWhat(), failed = done ? failedIndexes(QU) : [];
  bar.innerHTML = `<div class="qbar-h"><h3>${done ? esc(s.head) : `Arquivo ${position(QU)}`}</h3>${done ? '<button class="btn" type="button" id="quClose">Fechar</button>' : '<button class="btn" type="button" id="quSkip">Pular este arquivo</button>'}</div>
    ${what ? `<p class="qnow">${esc(nowHint(what))} <button class="linkbtn small" type="button" id="quGo">Ver ↓</button></p>` : ''}
    <ol class="qlist small">${s.lines.map((x, i) => `<li class="q-${x.status}${!done && i === QU.i ? ' now' : ''}"><span>${esc(x.name)}</span><span class="tiny ${x.status === 'erro' ? 'qerr' : 'muted'}">${esc(x.status === 'erro' ? 'Não deu para ler' + (x.label ? ': ' + x.label : '') : x.label || STATUS_LABEL[x.status])}</span></li>`).join('')}</ol>
    ${failed.length ? `<p class="small">Tente de novo. Se continuar sem ler, mande um print ou uma foto da fatura: o app lê imagens também.</p><div><button class="btn primary" type="button" id="quRetry">Tentar de novo ${failed.length > 1 ? `os ${failed.length} que falharam` : `o que falhou`}</button></div>` : ''}
    ${done ? '' : '<p class="tiny muted">Cada arquivo tem a sua revisão. Ao salvar ou descartar, o próximo começa sozinho.</p>'}`;
  if (what) $('#quGo').onclick = () => $(nowTarget[what])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (failed.length) $('#quRetry').onclick = () => { const fs = failed.map(i => QFILES[i]); QU = null; QFILES = []; $('#pdfLog').innerHTML = ''; startFiles(fs, 'pdf'); };
  if (done) $('#quClose').onclick = () => { QU = null; QFILES = []; renderQueue(); $('#pdfLog').innerHTML = ''; };
  else $('#quSkip').onclick = () => { R = null; Q = null; RC = null; SH = null; $('#pdfLog').innerHTML = ''; docDone('pulado'); };
}

// ---------- what is this document? ----------
// Decided by the content, never by the extension: a photo, a print or a PDF of a bill goes to the
// bill import; of a Pix receipt, to a single entry; of a store receipt, to "Foto da nota".
// Text documents are classified by the rules in lib/classify.js; images (and PDFs without text)
// by the reading assistant, in the same call that reads them. A document is sent to another
// path at most once (HOP), so two opinions that disagree can never loop.
let HOP = 0;
const canHop = () => HOP++ < 1;
async function sniffFile(file) {
  // Some banks share with a generic type or no name: look at the first bytes.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer()), sig = String.fromCharCode(...head);
  const type = sig.startsWith('%PDF') ? 'application/pdf' : head[0] === 0xFF && head[1] === 0xD8 ? 'image/jpeg' : sig.slice(1, 4) === 'PNG' ? 'image/png' : sig.slice(8, 12) === 'WEBP' ? 'image/webp' : sig.slice(4, 8) === 'ftyp' ? 'image/heic' : '';
  return type && type !== file.type ? new File([file], file.name || 'documento', { type }) : file;
}
const isPdfFile = f => f.type === 'application/pdf';
const isSheetFile = f => /\.(xlsx|xls|csv|ods)$/i.test(f.name || '') || /spreadsheet|ms-excel|text\/csv|opendocument\.spreadsheet/.test(f.type || '');
const isImageFile = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || '');
// The part of Lançar that ended up with something to show.
const resultArea = () => ['#qPreview', '#rcReview', '#review', '#shReview', '#pwBox'].map(s => $(s)).find(el => el && !el.hidden) || (mode === 'nota' ? $('#rcLog') : mode === 'pdf' ? $('#pdfLog') : null);
async function routeFile(file, from) {
  HOP = 0;
  file = await sniffFile(file);
  if (file.size > 25 * 1024 * 1024) { toast('O arquivo é grande demais (máximo 25 MB).', 'info'); return; }
  if (isSheetFile(file)) { if (mode !== 'pdf') openMode('pdf', false); return readSheet(file); }
  if (isPdfFile(file)) { if (mode !== 'pdf') openMode('pdf', from === 'share'); return startPdf(file); }
  if (!isImageFile(file)) { toast('Esse tipo de arquivo não dá para ler. Envie um PDF, uma foto ou um print.', 'info'); return; }
  if (from === 'nota') return readReceipt(file);
  return readProof({ file });
}
// A photo or print of a bill, statement or investments goes to the bill import, read from the image.
async function statementFromImage(file, kind) {
  openMode('pdf', false);
  $('#pdfLog').innerHTML = ''; $('#review').hidden = true; $('#pwBox').hidden = true;
  PDF.bytes = null; PDF.name = file.name || 'imagem'; PDF.bank = null; PDF.pageTexts = null;
  plog(`É ${kind === 'fatura' ? 'uma' : 'um'} ${KIND_LABEL[kind]}. Lendo a imagem...`);
  let blob;
  try { blob = await shrink(file, 2400); } catch (e) { plog('Não consegui abrir a imagem. Se for do iPhone (HEIC), tire um print e envie o print.', 'var(--bad)'); return; }
  return viaClaude(null, [], '', kind, [blob]);
}
async function readProof({ file, text = '' }) {
  openMode('falar', false);
  let images = [];
  if (file) { try { images = [await shrink(file)]; } catch (e) { toast('Não consegui abrir a imagem. Se for do iPhone (HEIC), tire um print e envie o print.', 'info'); return; } }
  const doc = text ? '\nTexto do documento:\n"""' + text.slice(0, 8000) + '"""' : '';
  const prompt = `Você recebeu ${file ? 'a imagem' : 'o texto'} de um documento compartilhado por uma família brasileira (${S.hh.name}). Hoje é ${todayISO()}.
Diga o que é e extraia os lançamentos. Responda só com JSON:
{"tipo":"comprovante"|"nota"|"fatura"|"extrato"|"investimentos"|"outro","itens":[{"descricao":"texto curto: para quem ou de quem e o motivo, se houver","valor":123.45,"sentido":"saida"|"entrada","data":"AAAA-MM-DD","meio":"cartao"|"conta","categoria":"<nome exato de uma categoria da lista>"}]}
${KIND_RULES}
Só preencha "itens" para "comprovante" (um lançamento); para os outros tipos deixe itens vazio.
Regras: valor sempre positivo; Pix e transferência enviados, boleto e débito são "conta" e "saida"; recebidos são "entrada"; compra no crédito é "cartao". Não invente: se não achar o valor, deixe itens vazio.
Categorias: ${catList()}${doc}`;
  let r;
  try { r = await askJSON(prompt, { tier: 'quick', images, maxTokens: 1500 }); }
  catch (e) { toast(aiErrorText(e)); return; }
  const kind = aiKind(r?.tipo);
  if (kind === 'nota' && canHop()) { openMode('nota', false); return file ? readReceipt(file) : readReceipt(null, { text }); }
  if (['fatura', 'extrato', 'investimentos'].includes(kind) && canHop()) {
    if (file) return statementFromImage(file, kind);
    openMode('pdf', false); return viaClaude(null, [], text, kind);
  }
  const its = (r?.itens || []).filter(x => x && +x.valor > 0);
  if (r?.tipo === 'outro' || !its.length) { toast('Não achei um valor nesse arquivo. Confira se é um comprovante ou lance falando.', 'info'); openMode('falar', true); return; }
  Q = itemsToQ(its, 'Comprovante'); renderQ(); $('#qStatus').textContent = 'Lido do comprovante. Confira e salve.'; track('lancar.comprovante');
}

function renderQ() {
  const box = $('#qPreview'); box.hidden = false;
  box.innerHTML = `<div class="tw"><table><thead><tr><th>Data</th><th>Descrição</th><th>Onde</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody></tbody></table></div>
  <p class="tiny muted" style="margin-top:6px">Na conta, saída é negativa. No cartão, compra é positiva.</p>
  <div class="stack qdebts" id="qDebts" hidden></div>
  <div class="rowbtn" style="margin-top:10px"><button class="btn primary" id="qSave" type="button">Salvar ${Q.length > 1 ? Q.length + ' lançamentos' : 'lançamento'}</button><button class="btn" id="qCancel" type="button">Descartar</button></div>`;
  const tb = box.querySelector('tbody');
  Q.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="date" value="${it.date}" data-f="date" style="min-width:130px"></td><td><input type="text" value="${esc(it.description)}" data-f="description" style="min-width:150px"></td><td><select data-f="source"><option value="cartao"${it.source === 'cartao' ? ' selected' : ''}>Cartão</option><option value="conta"${it.source === 'conta' ? ' selected' : ''}>Conta</option></select></td><td></td><td class="r"><input type="number" step="0.01" value="${it.amount}" data-f="amount" style="width:110px;text-align:right"></td>`;
    tr.children[3].append(catPicker(S.categories, it.category, 0, c => { it.category = c; renderQ(); }, { description: it.description, amount: it.amount }));
    tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
      const f = inp.dataset.f;
      if (f === 'source') { if (inp.value !== it.source) it.amount = -it.amount; it.source = inp.value; renderQ(); }
      else it[f] = f === 'amount' ? +String(inp.value).replace(',', '.') : inp.value;
    });
    tb.append(tr);
    // A payment that may be paying a financing: ask, with the likely one already chosen.
    const debts = (settings().debts || []).filter(d => d.name);
    if (debts.length && it.source === 'conta' && it.amount < 0 && (looksLikeDebtPayment(it) || Math.abs(it.amount) >= 1000)) {
      if (it.debtId === undefined) it.debtId = debtForTx(it, debts)?.id || '';
      const dr = document.createElement('div'); dr.className = 'qdebt'; $('#qDebts').hidden = false;
      dr.innerHTML = `<label class="f">${Q.length > 1 ? esc(it.description) + ': i' : 'I'}sso abate um financiamento?<select data-debt="${i}"><option value="">Não</option>${debts.map(d => `<option value="${esc(d.id)}"${it.debtId === d.id ? ' selected' : ''}>Sim, é amortização do ${esc(d.name)}</option>`).join('')}</select></label>
        <p class="tiny muted">${it.debtId ? `O valor sai do saldo do financiamento, o patrimônio sobe e o lançamento vai para "${AMORT_CAT}", fora da sobra do mês.` : 'Se for parcela do mês, deixe "Não": as parcelas já são abatidas sozinhas.'}</p>`;
      dr.querySelector('select').onchange = e => { it.debtId = e.target.value; renderQ(); };
      $('#qDebts').append(dr);
    }
  });
  $('#qCancel').onclick = () => { box.hidden = true; Q = null; $('#qStatus').textContent = ''; docDone('descartado'); };
  $('#qSave').onclick = async () => {
    clearInvalid(box);
    // Validate every row before saving.
    const trs = [...tb.children];
    for (let i = 0; i < Q.length; i++) {
      const it = Q[i], tr = trs[i], dErr = checkDate(it.date);
      if (dErr) return invalid(tr.querySelector('[data-f=date]'), dErr);
      if (!String(it.description || '').trim()) return invalid(tr.querySelector('[data-f=description]'), 'Escreva o que foi.');
      if (!isFinite(it.amount) || it.amount === 0) return invalid(tr.querySelector('[data-f=amount]'), 'Informe o valor.');
      if (Math.abs(it.amount) >= 1e6) return invalid(tr.querySelector('[data-f=amount]'), 'Valor alto demais. Confira se não faltou a vírgula.');
    }
    if (!await confirmInline($('#qSave'), { title: Q.length > 1 ? `Salvar ${Q.length} lançamentos?` : 'Salvar o lançamento?', text: Q.map(it => `${esc(it.description)}: ${brl(it.amount)} (${it.source === 'cartao' ? 'cartão' : 'conta'}, ${esc(it.category)})`).join('<br>'), yes: 'Sim, salvar' })) return;
    $('#qSave').disabled = true;
    try {
      const rows = Q.map(it => ({ household_id: S.hh.id, source: it.source, month: it.source === 'cartao' ? cycleMonth(it.date, closeDay()) : it.date.slice(0, 7), date: it.date, day: isoToBr(it.date).slice(0, 5), description: it.description, amount: round2(it.amount), category: it.category, manual: true }));
      const saved = await db.addTransactions(rows); track('lancar.salvar'); homeNews();
      S.txs.push(...saved.map(t => ({ ...t, amount: +t.amount })));
      // Payments confirmed as amortization come off the financing's balance.
      for (let i = 0; i < Q.length; i++) if (Q[i].debtId && saved[i]) {
        const d = (settings().debts || []).find(x => x.id === Q[i].debtId);
        try { const s = await applyAmortization(Q[i].debtId, { value: Q[i].amount, date: Q[i].date, txId: saved[i].id, note: Q[i].description }); toast(`O saldo do ${d?.name || 'financiamento'} agora é ${brl(s)}.`); }
        catch (e) { toast('O lançamento foi salvo, mas não consegui abater do financiamento. Faça em Patrimônio e dívidas.'); }
      }
      toast(rows.length > 1 ? 'Lançamentos salvos' : 'Lançamento salvo'); box.hidden = true; Q = null; $('#qText').value = ''; $('#qStatus').textContent = ''; S.render(); docDone('salvo', rows.length > 1 ? rows.length + ' lançamentos' : 'Lançamento');
    } catch (e) { toast('Não foi possível salvar. ' + db.errorText(e)); $('#qSave').disabled = false; }
  };
}

// ---------- PDF ----------
let BUSY = null;
const pdfResult = () => !$('#review').hidden ? $('#review') : !$('#pwBox').hidden ? $('#pwBox') : $('#pdfLog');
const plog = (t, color) => { const p = document.createElement('div'); p.textContent = t; if (color) p.style.color = color; $('#pdfLog').append(p); if (BUSY) BUSY.set(t, progressOf(t)); };
// Shows progress while the PDF is read, then brings the result (or the problem) into view.
async function withBusy(first, run, where, title = 'Lendo o documento') {
  BUSY = busy(first, { title });
  try { return await run(); }
  finally { BUSY.done(); BUSY = null; const t = where(); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
async function startPdf(file) {
  $('#pdfLog').innerHTML = ''; $('#review').hidden = true; $('#pwBox').hidden = true;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { plog('Este arquivo não parece ser um PDF.', 'var(--bad)'); return; }
  if (file.size > 25 * 1024 * 1024) { plog('O PDF é grande demais (máximo 25 MB).', 'var(--bad)'); return; }
  PDF.bytes = new Uint8Array(await file.arrayBuffer()); PDF.name = file.name; PDF.pageTexts = null;
  plog('Lendo ' + file.name + '...');
  return openPdf();
}
// The PDF reader (pdf.js, loaded from the CDN in index.html). Waits for it when the app has just opened
// (a share) and says where its worker is: Safari on iPhone does not find it by itself.
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function pdfReady() {
  for (let i = 0; i < 40 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 250));
  const lib = window.pdfjsLib; if (!lib) return false;
  if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc && !globalThis.pdfjsWorker) lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  return true;
}
async function openPdf(password) {
  // Opened from a share right at start, the PDF reader may still be loading.
  if (!await pdfReady()) { plog('O leitor de PDF ainda não carregou. Espere um instante e tente de novo.', 'var(--bad)'); return; }
  let doc;
  // A reader that has just started can get stuck on the first file: give it 15 s, then try once more.
  const open = () => { const task = window.pdfjsLib.getDocument({ data: PDF.bytes.slice(), password: password || undefined, isEvalSupported: false });
    return Promise.race([task.promise, new Promise((_, no) => setTimeout(() => { task.destroy?.(); no(new Error('lento')); }, 15000))]); };
  // Right after the app opens (a share), the reader can fail once while it starts: try again before giving up.
  try { doc = await open().catch(e => e?.name === 'PasswordException' ? Promise.reject(e) : new Promise(r => setTimeout(r, 800)).then(open)); }
  catch (e) {
    if (e?.name === 'PasswordException') { $('#pwBox').hidden = false; $('#pwIn').value = ''; $('#pwIn').focus(); plog(e.code === 2 ? 'Senha incorreta. Tente de novo.' : 'Este PDF tem senha. Digite abaixo; ela não é guardada.', e.code === 2 ? 'var(--bad)' : null); return; }
    plog('Não consegui abrir este PDF.', 'var(--bad)'); return;
  }
  $('#pwBox').hidden = true; $('#pwIn').value = '';
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    pages.push({ pg, w: vp.width, items: tc.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width })) });
  }
  const lines1 = pages.flatMap(p => lineify(p.items, p.w, 1)), text = lines1.join('\n'), type = detect(text);
  PDF.pageTexts = pages.map(p => lineify(p.items, p.w, 1).join('\n'));
  PDF.bank = detectBank(text);
  // What the text says it is decides the path, whatever button was used.
  const cls = classifyText(text, { pages: doc.numPages });
  if (cls.kind === 'comprovante' && canHop()) { plog('É um comprovante: vira um lançamento para você conferir.'); return readProof({ text }); }
  if (cls.kind === 'nota' && canHop()) { plog('É uma nota fiscal: vou separar os itens por categoria.'); openMode('nota', false); return readReceipt(null, { text }); }
  if (!cls.kind && !cls.many && !cls.empty && canHop()) return readProof({ text });
  if (type === 'fatura-santander') {
    const r = parseFaturaSantander(pages.flatMap((p, i) => lineify(p.items, p.w, i === 0 ? 1 : 2)));
    if (r.ok) { plog(`Fatura lida: ${r.items.length} lançamentos. Totais por cartão conferem.`, 'var(--good)'); return reviewRows('cartao', r.items, faturaMonth(r.vencimento), { total: r.net, venc: r.vencimento, checks: r.checks }); }
    plog('A leitura direta não fechou com os totais. Vou usar a leitura inteligente.', 'var(--warn)');
    return viaClaude(doc, pages, text, 'fatura');
  }
  if (type === 'extrato-santander') {
    const ex = parseExtratoSantander(lines1);
    if (ex.ok) { plog(`Extrato lido: ${ex.rows.length} movimentos. Saldo de ${brl(ex.saldoIni)} para ${brl(ex.saldoFim)} confere.`, 'var(--good)'); return reviewRows('conta', ex.rows, ex.month, { saldoIni: ex.saldoIni, saldoFim: ex.saldoFim }); }
  }
  if (type === 'imagem') {
    // A scanned PDF or a photo saved as PDF: the assistant looks at the first page and says what it is.
    let first = null, kind = null;
    try {
      plog('Este PDF é uma imagem. Vendo o que ele é...');
      const vp = pages[0].pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pages[0].pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      first = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      const r = await askJSON(`A imagem é a primeira página de um documento financeiro brasileiro. Diga o que é. Responda só com JSON {"tipo":"comprovante"|"nota"|"fatura"|"extrato"|"investimentos"|"outro"}.\n${KIND_RULES}`, { tier: 'quick', images: [first], maxTokens: 100 });
      kind = aiKind(r?.tipo);
    } catch (e) { kind = null; }
    const img = first && new File([first], 'pagina1.jpg', { type: 'image/jpeg' });
    if (kind === 'comprovante' && img && canHop()) return readProof({ file: img });
    if (kind === 'nota' && img && canHop()) { openMode('nota', false); return readReceipt(img); }
    if (kind === 'fatura' || kind === 'extrato' || kind === 'investimentos') { plog(`É ${kind === 'fatura' ? 'uma' : 'um'} ${KIND_LABEL[kind]}.`); return viaClaude(doc, pages, '', kind); }
    plog('Não consegui ver o que é. Diga o que ele é:');
    const box = document.createElement('div'); box.className = 'chips';
    box.innerHTML = [['fatura', 'Fatura do cartão'], ['extrato', 'Extrato da conta'], ['investimentos', 'Investimentos']].map(([k, l]) => `<button class="chip" type="button" data-k="${k}">${l}</button>`).join('');
    $('#pdfLog').append(box);
    box.querySelectorAll('.chip').forEach(b => b.onclick = () => { box.remove(); viaClaude(doc, pages, '', b.dataset.k); });
    return;
  }
  const kind = ['fatura', 'extrato', 'investimentos'].includes(cls.kind) ? cls.kind : type.startsWith('fatura') ? 'fatura' : type.startsWith('extrato') ? 'extrato' : type === 'investimentos' ? 'investimentos' : 'auto';
  return viaClaude(doc, pages, text, kind);
}

const JSON_EXTRATO = `{"tipo":"extrato","banco":"nome do banco","mes":"AAAA-MM","saldoAnterior":0.00,"saldoFinal":0.00,"totalEntradas":null,"totalSaidas":null,"movimentos":[{"data":"dd/mm","descricao":"histórico + nome","valor":-123.45}]}`;
const JSON_FATURA = `{"tipo":"fatura","banco":"nome do banco","vencimento":"dd/mm/aaaa","valorTotalFatura":0.00,"cartoes":[{"final":"1234","valorTotal":0.00}],"itens":[{"cartao":"1234","data":"dd/mm","descricao":"...","parcela":"01/10 ou vazio","valor":123.45}]}`;
const JSON_INVEST = `{"tipo":"investimentos","data":"AAAA-MM-DD","totalBruto":0.00,"totalLiquido":0.00,"classes":[{"nome":"...","valor":0.00}]}`;
const RULES_TXT = `Regras gerais: use null para o que o documento não mostrar; nunca invente valores; valores em reais com ponto decimal.
Extrato: só a movimentação da conta, na ordem, débitos com valor negativo e créditos positivos; não inclua linhas de saldo nem de totais; inclua rendimentos e tarifas. Se o extrato mostrar total de entradas e de saídas do período, informe em totalEntradas e totalSaidas (positivos).
Fatura: um item por lançamento da fatura atual, de todos os cartões (titular, adicionais e virtuais), com o final do cartão de cada um; compras e parcelas positivas; créditos, estornos e cashback negativos; inclua anuidade, IOF, juros e encargos como itens. Não inclua o pagamento da fatura anterior, saldo anterior, limite, pagamento mínimo nem simulações de parcelamento. Parcela no formato 02/10 quando houver. Se a fatura mostrar o total de cada cartão, informe em cartoes; informe sempre o valor total da fatura em valorTotalFatura.
Investimentos: use o resumo por classe de ativo e o total da carteira.`;

// Long documents are read in parts (a few pages each): one long answer can take longer than the server allows,
// and a part that fails is tried once more before giving up.
const askTwice = async (prompt, opts) => { try { return await askJSON(prompt, opts); } catch (e) { if (['not_configured', 'not_allowed', 'not_signed_in', 'rate_limited'].includes(e.code)) throw e; plog('Tentando de novo...'); return askJSON(prompt, opts); } };
function textParts(text, pageTexts, max = 9000) {
  if (!pageTexts || pageTexts.length < 2 || text.length <= max * 1.4) return [text];
  const out = []; let cur = '';
  for (const t of pageTexts) { if (cur && cur.length + t.length > max) { out.push(cur); cur = ''; } cur += (cur ? '\n' : '') + t; }
  if (cur) out.push(cur);
  return out;
}
// Joins what was read in parts (pages or pieces of text) into one document.
function mergeParts(kind, parts) {
  const m = { tipo: kind === 'auto' ? parts.find(p => p?.tipo)?.tipo : kind, banco: parts.map(p => p?.banco).find(Boolean) };
  if (m.tipo === 'fatura') {
    m.itens = parts.flatMap(p => p?.itens || []); const cs = {}; parts.forEach(p => (p?.cartoes || []).forEach(c => { if (c?.final && +c.valorTotal) cs[c.final] = +c.valorTotal; }));
    m.cartoes = Object.entries(cs).map(([final, valorTotal]) => ({ final, valorTotal })); m.vencimento = parts.map(p => p?.vencimento).find(Boolean);
    m.valorTotalFatura = parts.map(p => p?.valorTotalFatura).find(v => v != null && +v);
  } else if (m.tipo === 'extrato') {
    m.movimentos = parts.flatMap(p => p?.movimentos || []); m.saldoAnterior = parts.map(p => p?.saldoAnterior).find(v => v != null); m.saldoFinal = parts.map(p => p?.saldoFinal).filter(v => v != null).pop(); m.mes = parts.map(p => p?.mes).find(Boolean);
    m.totalEntradas = parts.map(p => p?.totalEntradas).find(v => v != null); m.totalSaidas = parts.map(p => p?.totalSaidas).find(v => v != null);
  } else Object.assign(m, parts.find(p => p && p.totalBruto) || {});
  return m;
}

async function viaClaude(doc, pages, text, kind, blobs = null) {
  const fmt = kind === 'investimentos' ? JSON_INVEST : kind === 'extrato' ? JSON_EXTRATO : kind === 'fatura' ? JSON_FATURA : `um destes formatos, conforme o documento: ${JSON_EXTRATO} ou ${JSON_FATURA} ou ${JSON_INVEST}`;
  try {
    if (text && (text.match(MONEY) || []).length > 5) {
      plog('Lendo o documento com a leitura inteligente...');
      const chunks = textParts(text, PDF.pageTexts);
      if (chunks.length === 1) return handleExtracted(await askTwice(`Extraia os dados deste documento financeiro brasileiro (texto extraído de PDF). Responda só com JSON em ${fmt}.\n${RULES_TXT}\nDocumento:\n"""${text.slice(0, 150000)}"""`, { maxTokens: 16000 }));
      const parts = [];
      for (let i = 0; i < chunks.length; i++) {
        plog(`Lendo a parte ${i + 1} de ${chunks.length}...`);
        parts.push(await askTwice(`Abaixo está a parte ${i + 1} de ${chunks.length} de um documento financeiro brasileiro (texto extraído de PDF). Extraia só o que aparece nesta parte. Responda só com JSON em ${fmt}. Se esta parte não tiver lançamentos, devolva as listas vazias; se mostrar o total da fatura, o vencimento ou os saldos, informe.\n${RULES_TXT}\nParte do documento:\n"""${chunks[i]}"""`, { maxTokens: 8000 }));
      }
      return handleExtracted(mergeParts(kind, parts));
    }
    const parts = [];
    const n = blobs ? blobs.length : pages.length;
    for (let i = 0; i < n; i++) {
      let blob = blobs?.[i];
      if (!blob) {
        plog(`Lendo a página ${i + 1} de ${n}...`);
        const vp = pages[i].pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
        await pages[i].pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      }
      try { parts.push(await askJSON(`A imagem é ${blobs ? 'uma foto ou um print' : `a página ${i + 1} de ${n}`} de um documento financeiro brasileiro (${kind}). Extraia só o que aparece nesta página. Responda só com JSON em ${fmt}. Se a página não tiver lançamentos, devolva as listas vazias.\n${RULES_TXT}`, { images: [blob], maxTokens: 8000 })); }
      catch (e) { plog(`A página ${i + 1} não pôde ser lida (${aiErrorText(e)})`, 'var(--warn)'); if (['not_configured', 'not_allowed', 'not_signed_in'].includes(e.code)) return; }
    }
    const m = mergeParts(kind, parts);
    return handleExtracted(m);
  } catch (e) { plog(aiErrorText(e), 'var(--bad)'); }
}

function handleExtracted(r) {
  if (!r || typeof r !== 'object') { plog('Resposta vazia.', 'var(--bad)'); return; }
  if (r.tipo === 'fatura') {
    const items = (r.itens || []).filter(x => x && isFinite(+x.valor)).map(x => ({ day: (x.data || '').slice(0, 5), description: String(x.descricao || '').replace(/\s+/g, ' ').trim(), installment: x.parcela || '', amount: +x.valor, card: x.cartao ? String(x.cartao) : '' }));
    const c = checkFatura(items, r.cartoes, r.valorTotalFatura);
    const bank = r.banco || PDF.bank;
    plog(`${bank ? 'Fatura do ' + bank : 'Fatura'} lida: ${items.length} lançamentos.`, 'var(--good)');
    plog(c.ok ? (c.how === 'total' ? 'A soma confere com o total da fatura.' : 'Os totais por cartão conferem.') : c.how === 'sem total' ? 'Não achei o total da fatura no documento para conferir. Revise com cuidado.' : 'Atenção: a soma dos lançamentos não bate com o total do documento. Revise com cuidado antes de salvar.', c.ok ? 'var(--good)' : 'var(--warn)');
    return reviewRows('cartao', items, faturaMonth(r.vencimento), { total: round2(items.reduce((a, i) => a + i.amount, 0)), venc: r.vencimento, checks: c.checks, viaClaude: true, bank, ok: c.ok });
  }
  if (r.tipo === 'extrato') {
    const mes = /^\d{4}-\d{2}$/.test(r.mes || '') ? r.mes : null;
    const rows = (r.movimentos || []).filter(x => x && isFinite(+x.valor)).map(x => { const d = (x.data || '').slice(0, 5); const [dd, mm] = d.split('/'); return { day: d, date: mes && dd && mm ? `${mes.slice(0, 4)}-${mm}-${dd}` : null, description: String(x.descricao || '').replace(/\s+/g, ' ').trim(), amount: +x.valor }; });
    const ok = checkExtrato(rows, r.saldoAnterior, r.saldoFinal, r.totalEntradas, r.totalSaidas);
    const bank = r.banco || PDF.bank;
    plog(`${bank ? 'Extrato do ' + bank : 'Extrato'} lido: ${rows.length} movimentos.`, 'var(--good)');
    plog(ok ? 'Os movimentos fecham com os saldos (ou com os totais) do documento.' : 'Atenção: os movimentos não fecham com os saldos do documento. Revise com cuidado antes de salvar.', ok ? 'var(--good)' : 'var(--warn)');
    return reviewRows('conta', rows, mes, { saldoIni: r.saldoAnterior != null ? +r.saldoAnterior : null, saldoFim: r.saldoFinal != null ? +r.saldoFinal : null, viaClaude: true, bank, ok });
  }
  if (r.tipo === 'investimentos') return reviewInvest(r);
  plog('Não reconheci o tipo do documento.', 'var(--bad)');
}

async function suggest(source, rows) {
  const unk = rows.filter(r => !r.category); if (!unk.length) return;
  plog(`Pedindo sugestão de categoria para ${unk.length} lançamento${unk.length > 1 ? 's' : ''} novo${unk.length > 1 ? 's' : ''}...`);
  const names = new Set(S.categories.map(c => c.name));
  // Small batches: a long answer can be cut off at the token limit. Each batch gets one retry.
  let failed = 0;
  for (let i = 0; i < unk.length; i += 40) {
    const chunk = unk.slice(i, i + 40);
    const ask = () => askJSON(`Classifique lançamentos financeiros de uma família brasileira. Categorias possíveis (grupo entre colchetes): ${catList()}.
Responda só com JSON, sem texto antes ou depois: [{"i":0,"c":"<nome exato da lista>","a":1}] onde a = 1 se tiver certeza, 0 se não.
Lançamentos (${source === 'cartao' ? 'cartão de crédito' : 'conta corrente; valor negativo = saída'}):
${chunk.map((r, k) => `${k}. ${r.description} | ${r.amount}`).join('\n')}`, { tier: 'quick', maxTokens: 4000 });
    let r = null;
    try { r = await ask(); } catch (e) { try { r = await ask(); } catch (e2) { if (['not_configured', 'not_allowed', 'not_signed_in'].includes(e2.code)) { plog('Sugestão de categorias indisponível: ' + aiErrorText(e2), 'var(--warn)'); break; } failed += chunk.length; continue; } }
    (Array.isArray(r) ? r : []).forEach(x => { const row = chunk[+x.i], c = x.c ?? x.categoria; if (row && names.has(c)) { row.category = c; row.pending = !(x.a === 1 || x.confianca === 'alta'); row.how = 'sugestão'; } });
  }
  if (failed) plog(`Não consegui sugerir a categoria de ${failed} lançamento${failed > 1 ? 's' : ''}. Eles ficam em "A classificar" para você escolher.`, 'var(--warn)');
  unk.forEach(r => { if (!r.category) { r.category = r.amount > 0 && source === 'conta' ? 'Outras entradas' : 'A classificar'; r.pending = true; } });
}

async function reviewRows(source, rows, month, info) {
  if (!month) month = addM((source === 'cartao' ? latestCard() : latestClosed()) || addM(thisMonth(), -1), 1);
  const prevCard = source === 'cartao' ? txsOf(addM(month, -1)).filter(t => t.source === 'cartao') : null;
  rows.forEach(r => { r.source = source; const k = classify(r, S.prepared, prevCard); if (k) { r.category = k.category; r.how = k.how; r.pending = false; } });
  applyMemos(rows, source, settings().memos); // personal notes remembered for the same description
  await suggest(source, rows);
  R = { source, rows, month, info };
  renderReview();
}

function renderReview() {
  const box = $('#review'); box.hidden = false;
  const { source, rows, info } = R;
  // Same document sent again, or another card/account of the same month? Decided by the cards and the rows.
  const keys = docKeys(source, rows, { bank: info.bank || PDF.bank, checks: info.checks });
  if (source === 'conta' && keys[0]) rows.forEach(r => { r.card = keys[0]; });
  const cmp = R.cmp = compareStatement({ keys, rows, existing: txsOf(R.month).filter(t => t.source === source && !t.manual) });
  const exist = cmp.mode === 'replace';
  // Another part of a document already in the month (a statement split in two files): only what is new is shown and saved.
  const part = cmp.mode === 'complement', shown = R.save = part ? rows.filter((_, i) => cmp.fresh.includes(i)) : rows;
  const thisDoc = keys.length ? docsText(source, keys).replace(/^(a fatura|o extrato) d(o|a|os|as) /, '') : '';
  const otherDocs = docsText(source, cmp.others);
  const Month = mLong(R.month).charAt(0).toUpperCase() + mLong(R.month).slice(1);
  const pend = txsOf(R.month).filter(t => t.manual && t.source === source);
  pend.forEach(e => { if (e._match == null) e._match = rows.some(r => Math.abs(r.amount - e.amount) < 0.01); });
  const ks = monthKeys(); const months = [...new Set([R.month, ...ks, addM(ks[ks.length - 1] || R.month, 1)])].sort();
  const tot = shown.reduce((a, r) => a + r.amount, 0);
  const head = source === 'cartao' ? `Fatura de ${mLong(R.month)}: ${brl(tot)}` : `Extrato de ${mLong(R.month)}: ${shown.length} movimentos${part ? ' novos' : ''}`;
  const sub = [info.bank, source === 'cartao'
    ? (info.checks || []).map(c => `${c.card === 'total' ? 'total da fatura' : 'cartão ' + c.card} ${c.ok ? '✓' : '≠ ' + brl(c.sum) + ' de ' + brl(c.total)}`).join(' · ')
    : info.saldoIni != null && info.saldoFim != null ? `Saldo inicial ${brl(info.saldoIni)} · saldo final ${brl(info.saldoFim)}` : ''].filter(Boolean).join(' · ');
  box.innerHTML = `<h3>${esc(head)}</h3><p class="small muted">${esc(sub)}</p>
  <label class="f" style="margin-top:10px;max-width:260px">Salvar no mês<select id="rvMonth">${months.map(k => `<option value="${k}"${k === R.month ? ' selected' : ''}>${mLong(k)}</option>`).join('')}</select></label>
  ${info.ok === false ? `<p class="banner no" style="margin-top:10px">A soma não bateu com o total do documento. Confira os valores com a fatura ou o extrato antes de salvar; se faltar algum lançamento, você pode lançar à mão depois.</p>` : ''}
  ${exist ? `<p class="banner at" style="margin-top:10px">${source === 'cartao' ? 'Esta fatura' : 'Este extrato'}${thisDoc ? ` (${esc(thisDoc)})` : ''} já foi ${source === 'cartao' ? 'enviada' : 'enviado'} para ${mLong(R.month)}. Salvar troca ${source === 'cartao' ? 'a anterior' : 'o anterior'} por ${source === 'cartao' ? 'esta' : 'este'}${otherDocs ? `; ${esc(otherDocs)} continua como está` : ''}.</p>` : ''}
  ${part ? (shown.length ? `<p class="banner ok" style="margin-top:10px">${source === 'cartao' ? 'Esta fatura completa' : 'Este arquivo completa'} ${esc(docsText(source, cmp.keys || keys) || (source === 'cartao' ? 'a fatura' : 'o extrato'))} de ${mLong(R.month)} que já está no app (por exemplo, a outra parte de um extrato dividido em dois arquivos). Entram só os ${shown.length} ${shown.length === 1 ? 'lançamento novo' : 'lançamentos novos'}${cmp.dup ? `; ${cmp.dup} que já ${cmp.dup === 1 ? 'estava fica' : 'estavam ficam'} como ${cmp.dup === 1 ? 'está' : 'estão'}` : ''}. Nada é apagado.</p>`
    : `<p class="banner ok" style="margin-top:10px">Tudo deste arquivo (${rows.length} ${rows.length === 1 ? 'lançamento' : 'lançamentos'}) já está em ${mLong(R.month)}. Não há nada novo para salvar; toque em Descartar.</p>`) : ''}
  ${cmp.mode === 'alongside' ? `<p class="banner ok" style="margin-top:10px">${Month} já tem ${esc(otherDocs || docsText(source, ['']))}. ${source === 'cartao' ? 'Esta fatura é de outro cartão' : 'Este extrato é de outra conta'}${thisDoc ? ` (${esc(thisDoc)})` : ''} e entra junto, sem apagar nada.</p>` : ''}
  <div class="rvguide"><strong>${QU && !isDone(QU) ? `Arquivo ${position(QU)}: o que fazer` : 'O que fazer'}</strong><ol class="small">
    <li>${info.ok === false ? 'A soma não bateu: confira os valores com o documento.' : 'A soma foi conferida com o total do documento.'}</li>
    <li>${shown.filter(r => r.pending).length ? `Toque na categoria dos <strong>${shown.filter(r => r.pending).length} marcados "a classificar"</strong> (no topo da lista) e escolha a certa. O app aprende.` : 'Todas as categorias já estão escolhidas. Se quiser trocar alguma, toque nela.'}</li>
    <li>Toque em <strong>Salvar</strong>${QU && !isDone(QU) && QU.i < QU.items.length - 1 ? '. O próximo arquivo começa sozinho' : ''}.</li></ol></div>
  <p class="small" style="margin-top:10px"><span class="pill at">${shown.filter(r => r.pending).length} a classificar</span> <span class="tiny muted">Toque na categoria para trocar. O app aprende.</span></p>
  <div class="tw" style="margin-top:8px;max-height:520px;overflow:auto"><table class="rvcards"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody id="rvRows"></tbody></table></div>
  <div id="rvPend" style="margin-top:12px"></div>
  <div class="rowbtn rvactions" style="margin-top:12px"><button class="btn primary" id="rvSave" type="button"${part && !shown.length ? ' disabled' : ''}>${part ? `Salvar ${shown.length} ${shown.length === 1 ? 'novo' : 'novos'}` : `Salvar ${source === 'cartao' ? 'a fatura' : 'o extrato'}`}</button><button class="btn" id="rvCancel" type="button">Descartar</button></div>`;
  const tb = $('#rvRows');
  shown.map((r, i) => [r, i]).sort((a, b) => (b[0].pending ? 1 : 0) - (a[0].pending ? 1 : 0)).forEach(([r]) => {
    const tr = document.createElement('tr'); if (r.pending) tr.className = 'pend';
    tr.innerHTML = `<td class="rv-d">${esc(r.day)}</td><td class="rv-x" style="min-width:170px">${esc(r.description)}${r.installment ? ' <span class="tiny muted">' + esc(r.installment) + '</span>' : ''}${r.note ? `<span class="xnote">${esc(r.note)}</span>` : ''}</td><td class="rv-c"></td><td class="r${source === 'conta' && r.amount > 0 ? ' neg' : ''}">${brl(r.amount)}</td>`;
    tr.children[2].append(catPicker(S.categories, r.category, r.pending, c => { if (c !== r.category) r.learn = true; r.category = c; r.pending = false; renderReview(); }, { description: r.description, amount: r.amount }));
    tb.append(tr);
  });
  if (pend.length) {
    $('#rvPend').innerHTML = `<h3>Lançamentos manuais deste mês</h3><p class="tiny muted">Marcados: já aparecem no documento e serão apagados ao salvar.</p>` + pend.map((e, i) => `<label class="small" style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-i="${i}" style="width:auto" ${e._match ? 'checked' : ''}> ${esc(e.description)} · ${brl(e.amount)}</label>`).join('');
    $('#rvPend').querySelectorAll('input').forEach(inp => inp.onchange = () => { pend[+inp.dataset.i]._match = inp.checked; });
  }
  $('#rvMonth').onchange = e => { R.month = e.target.value; renderReview(); };
  $('#rvCancel').onclick = async e => { if (!await confirmInline(e.target, { text: 'Descartar a leitura deste PDF? Nada será salvo.', yes: 'Sim, descartar', danger: true })) return; box.hidden = true; $('#pdfLog').innerHTML = ''; R = null; docDone('descartado'); };
  $('#rvSave').onclick = async e => {
    const n = shown.length, nPend = shown.filter(r => r.pending).length;
    const what = source === 'cartao' ? 'a fatura' : 'o extrato';
    const text = [exist ? `<strong>${mLong(R.month)} já tem ${what} salvo${thisDoc ? ` (${esc(thisDoc)})` : ''}.</strong> Ele será substituído por estes ${n} lançamentos.` : part ? `Juntar ${n} ${n === 1 ? 'lançamento novo' : 'lançamentos novos'} ao que já está em ${mLong(R.month)}? Nada é apagado.` : cmp.mode === 'alongside' ? `Salvar ${n} lançamentos em ${mLong(R.month)}, junto com ${esc(otherDocs || docsText(source, ['']))}?` : `Salvar ${n} lançamentos em ${mLong(R.month)}?`,
      info.ok === false ? 'Atenção: a soma não bateu com o total do documento.' : '', nPend ? `${nPend} ainda estão "a classificar" e podem ser ajustados depois no Extrato.` : ''].filter(Boolean).join(' ');
    if (!await confirmInline(e.target, { text, yes: exist ? 'Sim, substituir' : 'Sim, salvar', danger: exist })) return;
    saveReview(pend);
  };
}

async function saveReview(pend) {
  $('#rvSave').disabled = true;
  const { source, month, info } = R, rows = R.save || R.rows;
  try {
    const payload = rows.map(r => ({ date: r.date || null, day: r.day, description: r.description, amount: round2(r.amount), category: r.category, installment: r.installment || null, card: r.card || null, pending: !!r.pending, ...(r.note ? { note: r.note } : {}) }));
    const label = (source === 'cartao' ? 'Fatura de ' : 'Extrato de ') + mLong(month) + (R.cmp?.mode === 'complement' ? ' (parte)' : '');
    track('lancar.pdf_ok'); homeNews(); await db.replaceStatement(S.hh.id, source, month, payload, { cards: R.cmp?.cards || [], unknown: !!R.cmp?.unknown }, pend.filter(e => e._match).map(e => e.id), label, PDF.name, { total: info.total ?? null, venc: info.venc || null, saldoIni: info.saldoIni ?? null, saldoFim: info.saldoFim ?? null, viaClaude: !!info.viaClaude, bank: info.bank || PDF.bank || null, totalsOk: info.ok ?? true });
    notifyFamily('imported', { source, month });
    for (const r of rows.filter(r => r.learn)) { try { await db.learnRule(S.hh.id, source, norm(r.description), r.category); S.rules.push({ source, kind: 'exact', pattern: norm(r.description), category: r.category }); } catch (e) { /* learning is best effort */ } }
    await S.reload();
    toast(label + ' salvo'); $('#review').hidden = true; $('#pdfLog').innerHTML = ''; R = null; S.m = month; S.render(); docDone('salvo', label);
  } catch (e) { toast('Não foi possível salvar. ' + db.errorText(e)); $('#rvSave').disabled = false; }
}

function reviewInvest(r) {
  const box = $('#review'); box.hidden = false;
  const cls = (r.classes || []).filter(c => c && +c.valor), sum = cls.reduce((a, c) => a + +c.valor, 0);
  const total = +r.totalBruto || sum, ok = Math.abs(sum - total) < 5;
  box.innerHTML = `<h3>Investimentos em ${esc(isoToBr(r.data || ''))}: ${brl(total)}</h3><p class="small muted">${+r.totalLiquido ? 'Valor líquido ' + brl(+r.totalLiquido) + ' · ' : ''}${ok ? 'soma das classes confere' : 'a soma das classes não bate com o total'}</p>
  <ul class="list small" style="margin-top:8px">${cls.map(c => `<li><span>${esc(c.nome)}</span><span class="amt">${brl(+c.valor)}</span></li>`).join('')}</ul>
  <label class="f" style="margin-top:10px;max-width:280px">Somar valor guardado em outro lugar (opcional)<input type="number" step="0.01" id="ivExtra" value="0"></label>
  <div class="rowbtn" style="margin-top:12px"><button class="btn primary" id="ivSave" type="button">Atualizar investimentos</button><button class="btn" id="ivCancel" type="button">Descartar</button></div>`;
  $('#ivCancel').onclick = () => { box.hidden = true; docDone('descartado'); };
  $('#ivSave').onclick = async e => {
    const cur = +settings().invest?.total || 0, nv = total + (+$('#ivExtra').value || 0);
    if (!await confirmInline(e.target, { text: `Atualizar os investimentos${cur ? ` de ${brl(cur)}` : ''} para ${brl(nv)}?`, yes: 'Sim, atualizar' })) return;
    const extra = +$('#ivExtra').value || 0, classes = cls.map(c => [c.nome, +c.valor]); if (extra) classes.push(['Outros', extra]);
    const st = { ...settings(), invest: { date: r.data || todayISO(), total: total + extra, liquido: (+r.totalLiquido || 0) + extra, classes } };
    try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; toast('Investimentos atualizados'); box.hidden = true; S.render(); docDone('salvo', 'Investimentos'); } catch (e) { toast('Não foi possível salvar.'); }
  };
}

// ---------- spreadsheets (Excel or CSV) ----------
// The family's old control sheet: columns found by themselves, categories matched (or created, or left to classify),
// rows already in the app left out, and a review before saving. The file is never kept.
let SH = null;
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const loadXlsx = () => window.XLSX ? Promise.resolve(window.XLSX) : new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = XLSX_URL; sc.onload = () => ok(window.XLSX); sc.onerror = () => no(new Error('xlsx')); document.head.append(sc); });
const colName = (rows, header, j) => (header >= 0 && String(rows[header][j] ?? '').trim()) || 'Coluna ' + String.fromCharCode(65 + (j % 26));
const FIELD = { date: 'Data', description: 'Descrição', amount: 'Valor', category: 'Categoria', source: 'Conta ou cartão', kind: 'Entrada ou saída' };
async function readSheet(file) {
  $('#pdfLog').innerHTML = ''; $('#review').hidden = true; $('#shReview').hidden = true; $('#pwBox').hidden = true; SH = null;
  plog(`É uma planilha. Lendo ${file.name}...`);
  let sheets = [];
  try {
    if (/\.csv$/i.test(file.name) || /text\/csv/.test(file.type)) {
      const buf = await file.arrayBuffer(); let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buf);
      sheets = [{ name: file.name, rows: parseCSV(text) }];
    } else {
      plog('Abrindo o Excel...');
      const X = await loadXlsx(), wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      sheets = wb.SheetNames.map(n => ({ name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }));
    }
  } catch (e) { plog('Não consegui abrir a planilha. Salve como Excel (.xlsx) ou CSV e tente de novo.', 'var(--bad)'); return; }
  // Every tab with dates, values and descriptions counts (a tab per month is common).
  sheets = sheets.map(s => ({ ...s, det: detectColumns(s.rows) })).filter(s => s.det.map.date != null && s.det.map.amount != null && s.det.map.description != null);
  if (!sheets.length) { plog('Não achei na planilha as colunas de data, descrição e valor. Confira se ela tem uma linha por gasto, com essas três informações.', 'var(--bad)'); return; }
  plog(`Planilha lida: ${sheets.length > 1 ? sheets.length + ' abas com lançamentos' : 'aba ' + sheets[0].name}.`, 'var(--good)');
  SH = { file: file.name, sheets, map: { ...sheets[0].det.map }, defaultSource: 'conta', positives: 'saida', catMap: {}, includeDup: false };
  // Sheet categories: the family's when the name matches, else created with the same name.
  const all = {}; for (const s of sheets) { const r = buildEntries(s.rows, { map: s.det.map, header: s.det.header, categories: S.categories }); Object.assign(all, r.sheetCats); }
  for (const c of Object.keys(all)) SH.catMap[c] = matchCategory(c, S.categories) || '+' + c;
  renderSheet();
}
function sheetEntries() {
  // New categories are not passed as categories: their rows keep the sign of the sheet (in or out).
  const cats = S.categories;
  const catMap = Object.fromEntries(Object.entries(SH.catMap).map(([k, v]) => [k, v.startsWith('+') ? v.slice(1) : v]));
  let entries = [], skipped = 0;
  for (const s of SH.sheets) { const map = s === SH.sheets[0] ? SH.map : { ...s.det.map, ...SH.mapEdits }; const r = buildEntries(s.rows, { map, header: s.det.header, defaultSource: SH.defaultSource, positives: SH.positives, closeDay: closeDay(), categories: cats, catMap }); entries = entries.concat(r.entries); skipped += r.skipped; }
  return { entries: markDuplicates(entries, S.txs), skipped };
}
function renderSheet() {
  const box = $('#shReview'); box.hidden = false;
  const { entries, skipped } = sheetEntries(), keep = entries.filter(e => SH.includeDup || !e.dup), dups = entries.filter(e => e.dup).length;
  const months = [...new Set(keep.map(e => e.month))].sort(), out = keep.filter(e => e.source === 'conta' ? e.amount < 0 : e.amount > 0).reduce((a, e) => a + Math.abs(e.amount), 0), inn = keep.reduce((a, e) => a + Math.abs(e.amount), 0) - out;
  const s0 = SH.sheets[0], ncol = Math.max(...s0.rows.slice(0, 20).map(r => r.length));
  const allPositive = SH.map.kind == null && !s0.rows.slice(s0.det.header + 1).some(r => { const v = r[SH.map.amount]; return typeof v === 'number' ? v < 0 : /^\s*-|\(/.test(String(v)); });
  const sheetCats = Object.keys(SH.catMap).sort((a, b) => a.localeCompare(b, 'pt'));
  const catOpts = cur => `<option value="">A classificar</option>` + S.categories.filter(c => c.name !== 'A classificar').sort((a, b) => a.name.localeCompare(b.name, 'pt')).map(c => `<option value="${esc(c.name)}"${c.name === cur ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  box.innerHTML = `<h3>Planilha: ${keep.length} lançamentos${months.length ? ` de ${mLong(months[0])}${months.length > 1 ? ` a ${mLong(months[months.length - 1])}` : ''}` : ''}</h3>
    <p class="small muted">${esc(SH.file)}${SH.sheets.length > 1 ? ` · ${SH.sheets.length} abas` : ''} · saídas ${brl(out)} · entradas ${brl(inn)}${skipped ? ` · ${skipped} ${skipped === 1 ? 'linha sem data ou valor ficou' : 'linhas sem data ou valor ficaram'} de fora` : ''}</p>
    <div class="rvguide"><strong>${QU && !isDone(QU) ? `Arquivo ${position(QU)}: o que fazer` : 'O que fazer'}</strong><ol class="small">
      <li>Confira se as colunas abaixo estão certas.</li>
      <li>${sheetCats.length ? 'Diga para qual categoria do app vai cada categoria da planilha.' : 'A planilha não tem categorias: os lançamentos entram "a classificar" e o app sugere depois.'}</li>
      <li>Toque em <strong>Salvar</strong>.</li></ol></div>
    <h4 style="margin:12px 0 4px">Colunas</h4><div class="shcols">${['date', 'description', 'amount', 'category', 'source'].map(k => `<label class="f">${FIELD[k]}<select data-col="${k}"><option value="">${k === 'category' || k === 'source' ? 'Não tem' : 'Escolha'}</option>${Array.from({ length: ncol }, (_, j) => `<option value="${j}"${SH.map[k] === j ? ' selected' : ''}>${esc(colName(s0.rows, s0.det.header, j))}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="shcols">${SH.map.source == null ? `<label class="f">Os gastos foram na<select id="shSrc"><option value="conta"${SH.defaultSource === 'conta' ? ' selected' : ''}>Conta (pix, débito, boleto)</option><option value="cartao"${SH.defaultSource === 'cartao' ? ' selected' : ''}>Cartão de crédito</option></select></label>` : ''}
      ${allPositive ? `<label class="f">Valores sem sinal são<select id="shPos"><option value="saida"${SH.positives === 'saida' ? ' selected' : ''}>Gastos (saídas)</option><option value="entrada"${SH.positives === 'entrada' ? ' selected' : ''}>Entradas</option></select></label>` : ''}</div>
    ${sheetCats.length ? `<h4 style="margin:12px 0 4px">Categorias da planilha</h4><div class="stack">${sheetCats.map(c => { const v = SH.catMap[c]; return `<label class="f">${esc(c)} <span class="tiny muted">(${keep.filter(e => e.sheetCategory === c).length})</span><select data-cat="${esc(c)}"><option value="+${esc(c)}"${v === '+' + c ? ' selected' : ''}>Criar "${esc(c)}" no app</option>${catOpts(v)}</select></label>`; }).join('')}</div>` : ''}
    ${dups ? `<label class="radio" style="margin-top:10px"><input type="checkbox" id="shDup"${SH.includeDup ? ' checked' : ''}><span>${dups} ${dups === 1 ? 'linha já está' : 'linhas já estão'} no app (mesmo valor e data) e ${dups === 1 ? 'fica' : 'ficam'} de fora. Marque para trazer mesmo assim.</span></label>` : ''}
    <h4 style="margin:12px 0 4px">Primeiras linhas</h4>
    <div class="tw"><table class="rvcards"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody>${keep.slice(0, 8).map(e => `<tr><td class="rv-d">${esc(e.day)}</td><td class="rv-x">${esc(e.description)} <span class="tiny muted">${e.source === 'cartao' ? 'cartão' : 'conta'}</span></td><td class="rv-c">${esc(e.category)}</td><td class="r${e.source === 'conta' && e.amount > 0 ? ' neg' : ''}">${brl(e.amount)}</td></tr>`).join('')}</tbody></table></div>
    ${keep.length > 8 ? `<p class="tiny muted">E mais ${keep.length - 8}.</p>` : ''}
    <div class="rowbtn rvactions" style="margin-top:12px"><button class="btn primary" id="shSave" type="button"${keep.length ? '' : ' disabled'}>Salvar ${keep.length} lançamentos</button><button class="btn" id="shCancel" type="button">Descartar</button></div>`;
  box.querySelectorAll('[data-col]').forEach(sel => sel.onchange = () => { const k = sel.dataset.col; if (sel.value === '') delete SH.map[k]; else SH.map[k] = +sel.value; SH.mapEdits = { ...(SH.mapEdits || {}), [k]: SH.map[k] }; renderSheet(); });
  box.querySelectorAll('[data-cat]').forEach(sel => sel.onchange = () => { SH.catMap[sel.dataset.cat] = sel.value; renderSheet(); });
  if ($('#shSrc')) $('#shSrc').onchange = e => { SH.defaultSource = e.target.value; renderSheet(); };
  if ($('#shPos')) $('#shPos').onchange = e => { SH.positives = e.target.value; renderSheet(); };
  if ($('#shDup')) $('#shDup').onchange = e => { SH.includeDup = e.target.checked; renderSheet(); };
  $('#shCancel').onclick = async e => { if (!await confirmInline(e.target, { text: 'Descartar a leitura desta planilha? Nada será salvo.', yes: 'Sim, descartar', danger: true })) return; box.hidden = true; SH = null; $('#pdfLog').innerHTML = ''; docDone('descartado'); };
  $('#shSave').onclick = async e => {
    if (SH.map.date == null || SH.map.amount == null || SH.map.description == null) { toast('Escolha as colunas de data, descrição e valor.', 'info'); return; }
    const newCats = [...new Set(Object.values(SH.catMap).filter(v => v.startsWith('+')).map(v => v.slice(1)))].filter(n => keep.some(x => x.category === n) && !S.categories.some(c => c.name.toLowerCase() === n.toLowerCase()));
    const text = `Salvar ${keep.length} lançamentos${months.length ? ` de ${mLong(months[0])}${months.length > 1 ? ` a ${mLong(months[months.length - 1])}` : ''}` : ''}?` + (newCats.length ? ` Também cria ${newCats.length > 1 ? `as categorias ${newCats.map(n => '"' + esc(n) + '"').join(', ')} (dá para mudar o tipo de cada uma em Categorias)` : `a categoria "${esc(newCats[0])}" (dá para mudar o tipo em Categorias)`}.` : '');
    if (!await confirmInline(e.target, { text, yes: 'Sim, salvar' })) return;
    e.target.disabled = true;
    BUSY = busy('Salvando os lançamentos...', { title: 'Trazendo a planilha' });
    try {
      // A new category is income when most of its rows are money in, else a day-to-day expense.
      const isIn = x => x.source === 'conta' ? x.amount > 0 : x.amount < 0;
      for (const name of newCats) { const rs = keep.filter(x => x.category === name), inc = rs.filter(isIn).length > rs.length / 2; BUSY.set(`Criando a categoria ${name}...`); S.categories.push(await db.addCategory(S.hh.id, { name, grp: inc ? 'entrada' : 'dia', recurring: false })); }
      if (newCats.length) reindex();
      const rows = keep.map(x => ({ household_id: S.hh.id, source: x.source, month: x.month, date: x.date, day: x.day, description: x.description, amount: x.amount, category: x.category, pending: x.category === 'A classificar', manual: false }));
      const label = 'Planilha ' + SH.file.replace(/\.[^.]+$/, '');
      await db.importSheet(S.hh.id, rows, { label, file: SH.file, onStep: (n, t) => BUSY.set(`Salvando: ${n} de ${t}...`, 10 + 85 * n / t) });
      track('lancar.planilha'); await S.reload(); homeNews();
      toast(`Planilha salva: ${rows.length} lançamentos.`); box.hidden = true; SH = null; $('#pdfLog').innerHTML = ''; S.render(); docDone('salvo', label);
    } catch (err) { toast('Não foi possível salvar. ' + db.errorText(err), 'err'); e.target.disabled = false; }
    finally { BUSY?.done(); BUSY = null; }
  };
}

// ---------- receipts (nota fiscal) ----------
let RC = null; // receipt being reviewed
const rlog = (t, color) => { const p = document.createElement('div'); p.textContent = t; if (color) p.style.color = color; $('#rcLog').append(p); if (BUSY) BUSY.set(t, progressOf(t)); };
// Phone photos are big: shrink to at most 1600 px and JPEG before sending.
async function shrink(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
// `pre.text`: the text of a PDF already opened elsewhere (it may have had a password).
async function readReceipt(file, pre = null) {
  $('#rcLog').innerHTML = ''; $('#rcReview').hidden = true; RC = null;
  const isPdf = !pre && (/\.pdf$/i.test(file.name) || file.type === 'application/pdf');
  if (!pre && !isPdf && !isImageFile(file)) { rlog('Este arquivo não é foto nem PDF.', 'var(--bad)'); return; }
  if (file && file.size > 25 * 1024 * 1024) { rlog('O arquivo é grande demais (máximo 25 MB).', 'var(--bad)'); return; }
  const cats = S.categories.filter(c => c.grp === 'dia').map(c => c.name);
  let images = [], text = pre?.text || '';
  try {
    if (isPdf) {
      if (!await pdfReady()) { rlog('O leitor de PDF ainda não carregou. Espere um instante e tente de novo.', 'var(--bad)'); return; }
      rlog('Lendo o PDF da nota...');
      let doc;
      try { doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
      catch (e) { rlog(e?.name === 'PasswordException' ? 'Este PDF tem senha. Abra a nota no celular e tire um print, depois envie a imagem.' : 'Não consegui abrir este PDF.', 'var(--bad)'); return; }
      for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
        const pg = await doc.getPage(i), tc = await pg.getTextContent();
        text += tc.items.map(it => it.str).join(' ') + '\n';
        if ((text.match(MONEY) || []).length < 3) {
          const vp = pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
          await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          images.push(await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85)));
        }
      }
      if ((text.match(MONEY) || []).length >= 3) images = [];
      // Sent as a receipt but the text says otherwise: take it where it belongs.
      const cls = images.length ? { kind: null } : classifyText(text, { pages: doc.numPages });
      if (cls.kind && cls.kind !== 'nota' && canHop()) {
        rlog(`Isto é ${cls.kind === 'fatura' ? 'uma' : 'um'} ${KIND_LABEL[cls.kind]}, não uma nota fiscal.`);
        if (cls.kind === 'comprovante') return readProof({ text });
        openMode('pdf', false); return startPdf(file);
      }
    } else if (!pre) {
      rlog('Preparando a foto...');
      try { images = [await shrink(file)]; } catch (e) { rlog('Não consegui abrir a foto. Se for do iPhone (HEIC), tire de novo pelo botão Tirar foto.', 'var(--bad)'); return; }
    }
    rlog('Lendo os itens da nota...');
    const check = images.length ? `\nAntes, confira pelo conteúdo o que é o documento e informe em "tipo": "nota", "comprovante", "fatura", "extrato", "investimentos" ou "outro". ${KIND_RULES} Se não for "nota", responda só {"tipo":"..."}.` : '';
    const prompt = receiptPrompt(cats, todayISO()) + check + (images.length ? '' : `\nTexto da nota:\n"""${text.slice(0, 60000)}"""`);
    const raw = await askJSON(prompt, { images, maxTokens: 6000 });
    const kind = aiKind(raw?.tipo);
    if (kind && kind !== 'nota' && file && canHop()) {
      rlog(`Isto é ${kind === 'fatura' ? 'uma' : 'um'} ${KIND_LABEL[kind]}, não uma nota fiscal.`);
      if (kind === 'comprovante') return readProof({ file: isPdf ? new File([images[0]], 'pagina1.jpg', { type: 'image/jpeg' }) : file });
      if (isPdf) { openMode('pdf', false); return startPdf(file); }
      return statementFromImage(file, kind);
    }
    const r = normalizeReceipt(raw, todayISO());
    if (!r.ok) { rlog(r.msg, 'var(--bad)'); return; }
    rlog(`Nota lida: ${r.items.length} ${r.items.length > 1 ? 'itens' : 'item'}, total ${brl(r.total)}.`, 'var(--good)');
    if (!r.dateRead) rlog('Não achei a data na nota: usei a de hoje. Confira abaixo.', 'var(--warn)');
    RC = { ...r, source: r.payment || 'cartao', match: undefined };
    renderReceipt();
  } catch (e) { rlog(aiErrorText(e), 'var(--bad)'); }
}
// The review is drawn once; edits only refresh the summary below the fields, so a tap on
// "Salvar" right after typing a value is never lost to a redraw.
function renderReceipt() {
  const box = $('#rcReview');
  box.hidden = false;
  box.innerHTML = `<div class="stack">
    <div class="grid2">
      <label class="f">Loja<input type="text" id="rcStore" value="${esc(RC.store)}" maxlength="60"></label>
      <label class="f">Data da compra<input type="date" id="rcDate" value="${RC.date}" max="${todayISO()}"></label>
      <label class="f">Total pago (R$)<input type="number" step="0.01" min="0" id="rcTotal" value="${RC.total}"></label>
      <label class="f">Pago com<select id="rcSrc"><option value="cartao"${RC.source === 'cartao' ? ' selected' : ''}>Cartão de crédito</option><option value="conta"${RC.source === 'conta' ? ' selected' : ''}>Conta (pix, débito, dinheiro)</option></select></label>
    </div>
    <h3>Itens</h3>
    <div class="tw"><table><thead><tr><th>Item</th><th>Categoria</th><th class="r">Valor</th><th></th></tr></thead><tbody id="rcItems"></tbody></table></div>
    <div id="rcSum" class="stack"></div>
    <div id="rcMatchBox" class="stack"></div>
    <div class="rowbtn"><button class="btn primary" type="button" id="rcSave">Salvar nota</button><button class="btn" type="button" id="rcCancel">Descartar</button></div>
  </div>`;
  renderRcItems(); refreshReceipt();
  const num = v => round2(+String(v).replace(',', '.'));
  $('#rcStore').onchange = e => { RC.store = e.target.value.trim(); };
  $('#rcDate').onchange = e => { RC.date = e.target.value; RC.match = undefined; refreshReceipt(); };
  $('#rcTotal').onchange = e => { RC.total = num(e.target.value); RC.match = undefined; refreshReceipt(); };
  $('#rcSrc').onchange = e => { RC.source = e.target.value; RC.match = undefined; refreshReceipt(); };
  $('#rcCancel').onclick = async e => {
    if (!await confirmInline(e.target, { text: 'Descartar a leitura desta nota?', yes: 'Sim, descartar', danger: true })) return;
    RC = null; box.hidden = true; $('#rcLog').innerHTML = ''; docDone('descartado');
  };
  $('#rcSave').onclick = saveReceipt;
}
function renderRcItems() {
  const tb = $('#rcItems'), names = new Set(S.categories.map(c => c.name));
  tb.innerHTML = '';
  RC.items.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" value="${esc(it.description)}" data-f="description" style="min-width:150px" maxlength="80"></td><td></td><td class="r"><input type="number" step="0.01" min="0" value="${it.amount}" data-f="amount" style="width:100px;text-align:right"></td><td><button class="chip" type="button" data-rm aria-label="Remover item">×</button></td>`;
    tr.children[1].append(catPicker(S.categories, it.category, !names.has(it.category), c => { it.category = c; setTimeout(() => { renderRcItems(); refreshReceipt(); }); }, { description: it.description, amount: it.amount }));
    tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { it[inp.dataset.f] = inp.dataset.f === 'amount' ? round2(+String(inp.value).replace(',', '.')) : inp.value.trim(); if (inp.dataset.f === 'amount') refreshReceipt(); });
    tr.querySelector('[data-rm]').onclick = async e => {
      if (RC.items.length === 1) { toast('A nota precisa de pelo menos um item.'); return; }
      if (!await confirmInline(e.target, { text: `Tirar "${esc(it.description)}" da nota?`, yes: 'Sim, tirar', danger: true })) return;
      RC.items.splice(i, 1); renderRcItems(); refreshReceipt();
    };
    tb.append(tr);
  });
}
// Summary by category, difference note and the "already in the statement?" choice.
function refreshReceipt() {
  const names = new Set(S.categories.map(c => c.name));
  const total = +RC.total || 0, sum = round2(RC.items.reduce((a, x) => a + (+x.amount || 0), 0));
  const parts = splitByCategory(RC.items, total), newCats = [...new Set(RC.items.map(x => x.category).filter(c => c && !names.has(c)))];
  const matches = findMatches(S.txs.filter(t => t.source === RC.source), { total, date: RC.date });
  if (RC.match === undefined || (RC.match && !matches.some(t => t.id === RC.match))) RC.match = matches[0]?.id || null;
  $('#rcSum').innerHTML = `${Math.abs(total - sum) > 0.009 ? `<p class="tiny" style="color:var(--warn)">Os itens somam ${brl(sum)} e o total pago é ${brl(total)}. A diferença (desconto ou arredondamento) é dividida entre as categorias na mesma proporção.</p>` : ''}
    <h3>Por categoria</h3>
    <ul class="list small">${parts.map(p => `<li><span>${esc(p.category)}${names.has(p.category) ? '' : ' <span class="pill at">nova</span>'}</span><span class="amt">${brl(p.amount)}</span></li>`).join('')}</ul>
    ${newCats.length ? `<p class="tiny muted">${newCats.length > 1 ? 'As categorias novas' : 'A categoria nova'} ${newCats.map(c => '"' + esc(c) + '"').join(', ')} ${newCats.length > 1 ? 'serão criadas' : 'será criada'} como despesa variável. Se preferir uma que já existe, toque na categoria do item.</p>` : ''}`;
  $('#rcMatchBox').innerHTML = `<h3>Este gasto já está no ${RC.source === 'cartao' ? 'cartão' : 'extrato'}?</h3>
    <div class="stack" id="rcMatch" role="radiogroup" aria-label="Lançamento da nota">
      ${matches.map(t => `<label class="radio"><input type="radio" name="rcm" value="${t.id}" ${RC.match === t.id ? 'checked' : ''}><span>${esc(isoToBr(t.date))} · ${esc(t.description)} · <strong>${brl(Math.abs(t.amount))}</strong><br><span class="tiny muted">${t.manual ? 'lançado à mão' : t.source === 'cartao' ? 'fatura de ' + mLong(t.month) : 'extrato de ' + mLong(t.month)} · hoje em ${esc(t.category || 'A classificar')}</span></span></label>`).join('')}
      <label class="radio"><input type="radio" name="rcm" value="" ${RC.match ? '' : 'checked'}><span>${matches.length ? 'Nenhum desses: lançar como gasto novo' : 'Não achei esse valor. Vai entrar como gasto novo e, quando a fatura ou o extrato chegar, o app junta os dois.'}</span></label>
    </div>`;
  $('#rcMatchBox').querySelectorAll('[name=rcm]').forEach(r => r.onchange = () => { RC.match = r.value || null; });
}
async function saveReceipt(e) {
  const box = $('#rcReview'); clearInvalid(box);
  RC.store = $('#rcStore').value.trim();
  const trs = [...$('#rcItems').children];
  const ok = [[$('#rcStore'), checkName(RC.store, 'o nome da loja', 2, 60)], [$('#rcDate'), checkDate(RC.date)], [$('#rcTotal'), checkNumber(RC.total, { min: 0.01, max: 1e6, label: 'Total pago' })]];
  for (const [inp, msg] of ok) if (msg) return invalid(inp, msg);
  for (let i = 0; i < RC.items.length; i++) {
    const it = RC.items[i];
    if (!it.description) return invalid(trs[i].querySelector('[data-f=description]'), 'Escreva o nome do item.');
    if (!(it.amount > 0)) return invalid(trs[i].querySelector('[data-f=amount]'), 'Informe o valor do item.');
    if (!it.category) { toast('Escolha a categoria de todos os itens.'); return; }
  }
  const sum = RC.items.reduce((a, x) => a + x.amount, 0);
  if (Math.abs(sum - RC.total) > Math.max(5, RC.total * 0.3)) return invalid($('#rcTotal'), `Os itens somam ${brl(sum)}, bem diferente do total. Confira o total ou os valores dos itens.`);
  const names = new Set(S.categories.map(c => c.name)), newCats = [...new Set(RC.items.map(x => x.category).filter(c => !names.has(c)))];
  const parts = splitByCategory(RC.items, RC.total), match = RC.match ? S.txs.find(t => t.id === RC.match) : null;
  const partsTxt = parts.map(p => `${esc(p.category)} ${brl(p.amount)}`).join(', ');
  const text = (match ? `Detalhar "${esc(match.description)}" de ${brl(Math.abs(match.amount))} com os itens da nota: ${partsTxt}?` : `Lançar ${brl(RC.total)} de ${esc(RC.store)} como gasto novo ${RC.source === 'cartao' ? 'no cartão' : 'na conta'}: ${partsTxt}?`)
    + (newCats.length ? ` Também cria ${newCats.length > 1 ? 'as categorias' : 'a categoria'} ${newCats.map(c => '"' + esc(c) + '"').join(', ')}.` : '');
  if (!await confirmInline(e.target, { text, yes: 'Sim, salvar' })) return;
  e.target.disabled = true;
  try {
    for (const name of newCats) { S.categories.push(await db.addCategory(S.hh.id, { name, grp: 'dia' })); }
    if (newCats.length) reindex();
    const receipt = { store: RC.store, date: RC.date, total: RC.total, items: RC.items.map(x => ({ description: x.description, amount: x.amount, category: x.category })) };
    const splits = parts.map(p => ({ category: p.category, amount: p.amount }));
    if (match) {
      await db.updateTransaction(match.id, { splits, receipt });
      Object.assign(match, { splits, receipt });
    } else {
      const amount = RC.source === 'cartao' ? RC.total : -RC.total;
      const [t] = await db.addTransactions([{ household_id: S.hh.id, source: RC.source, month: RC.source === 'cartao' ? cycleMonth(RC.date, closeDay()) : RC.date.slice(0, 7), date: RC.date, day: isoToBr(RC.date).slice(0, 5), description: RC.store, amount, category: parts[0].category, manual: true, splits, receipt }]);
      S.txs.push({ ...t, amount: +t.amount });
    }
    const RC_store = RC.store; toast('Nota salva'); track('lancar.nota_ok'); RC = null; box.hidden = true;
    $('#rcLog').innerHTML = ''; rlog(match ? 'Pronto: o lançamento agora mostra os itens da nota por categoria.' : 'Pronto: gasto lançado e dividido por categoria.', 'var(--good)');
    S.render(); docDone('salvo', 'Nota de ' + RC_store);
  } catch (err) { toast('Não foi possível salvar. ' + db.errorText(err)); e.target.disabled = false; }
}
