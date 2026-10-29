import { S, closeDay, txsOf, pendingManual, latestCard, latestClosed, monthKeys, settings } from '../state.js';
import * as db from '../db.js';
import { askJSON, aiErrorText } from '../ai.js';
import { attachMic, speechSupported } from '../speech.js';
import { classify } from '../lib/categorize.js';
import { lineify, detect, parseFaturaSantander, parseExtratoSantander, faturaMonth, checkFatura, checkExtrato, MONEY } from '../lib/parse.js';
import { brl, esc, mLong, addM, todayISO, isoToBr, cycleMonth, norm, round2, thisMonth } from '../lib/format.js';
import { $, toast, catPicker } from '../ui.js';

const EXAMPLES = ['gastei 230 no mercado hoje no cartão', 'paguei 350 de terapia por pix', 'recebi 1.950 de reembolso do plano de saúde', 'almoço de 180 no cartão ontem'];
let Q = null;          // quick-entry preview items
let R = null;          // PDF review state
const PDF = { bytes: null, name: '' };

export function render(el) {
  if (!el.dataset.built) build(el);
  renderManual(); renderImports();
}

function build(el) {
  el.dataset.built = '1';
  el.innerHTML = `
  <div class="panel">
    <h2>Lançar um gasto ou entrada</h2>
    <p class="muted small">Fale ou escreva do jeito que diria. Pode ser mais de um na mesma frase.</p>
    <div class="inwrap" style="margin-top:10px"><textarea id="qText" placeholder="Ex.: gastei 230 no mercado hoje no cartão e 350 de terapia por pix"></textarea><button id="qMic"></button></div>
    <p class="tiny muted" style="margin-top:6px">${speechSupported ? 'Toque no microfone, fale e toque de novo para parar.' : 'Para falar, use o microfone do teclado do celular.'}</p>
    <div class="chips" style="margin-top:8px" id="qExamples">${EXAMPLES.map(e => `<button class="chip" type="button">${esc(e)}</button>`).join('')}</div>
    <div class="rowbtn" style="margin-top:12px"><button class="btn primary" id="qGo" type="button">Interpretar</button><span class="small muted" id="qStatus"></span></div>
    <div id="qPreview" hidden style="margin-top:14px"></div>
  </div>
  <div class="panel">
    <h2>Enviar PDF</h2>
    <p class="muted small">Fatura do cartão, extrato da conta ou extrato de investimentos. O app lê, confere os totais e mostra tudo para você revisar antes de salvar. O arquivo não fica guardado.</p>
    <div class="drop" id="drop" style="margin-top:12px">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/></svg>
      <strong>Escolher PDF</strong>
      <span class="small muted">PDF com senha também funciona: o app pede a senha e não a guarda.</span>
      <input type="file" id="pdfIn" class="fileover" accept=".pdf,application/pdf" aria-label="Escolher PDF">
    </div>
    <div id="pwBox" hidden style="margin-top:12px" class="stack">
      <label class="f" for="pwIn">Senha do PDF<input type="password" id="pwIn" autocomplete="off"></label>
      <div><button class="btn primary" id="pwGo" type="button">Abrir</button></div>
    </div>
    <div class="log" id="pdfLog" style="margin-top:12px"></div>
    <div id="review" hidden style="margin-top:14px"></div>
  </div>
  <div class="panel">
    <h3>Lançamentos manuais em aberto</h3>
    <p class="muted small">Entram nas contas do mês até chegar o extrato ou a fatura. Na importação, os que baterem são conciliados.</p>
    <div id="manualList" style="margin-top:8px"></div>
  </div>
  <div class="panel"><h3>Importações</h3><ul class="list small" id="importList"></ul></div>`;
  attachMic($('#qMic'), $('#qText'));
  el.querySelectorAll('#qExamples .chip').forEach(b => b.onclick = () => { $('#qText').value = b.textContent; $('#qText').focus(); });
  $('#qGo').onclick = interpret;
  $('#pdfIn').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) startPdf(f).catch(err => plog('Não consegui ler este arquivo (' + (err?.message || err) + ').', 'var(--bad)')).finally(() => { e.target.value = ''; }); };
  const drop = $('#drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) startPdf(f).catch(err => plog('Não consegui ler este arquivo (' + (err?.message || err) + ').', 'var(--bad)')); };
  $('#pwGo').onclick = () => openPdf($('#pwIn').value);
}

// ---------- manual entries ----------
function renderManual() {
  const list = pendingManual().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const box = $('#manualList');
  box.innerHTML = list.length ? `<ul class="list small">${list.map(t => `<li><span>${esc(isoToBr(t.date))} · ${esc(t.description)}<br><span class="tiny muted">${esc(t.category || 'A classificar')} · ${t.source === 'cartao' ? 'cartão, fatura de ' + mLong(t.month) : 'conta'}</span></span><span class="rowbtn"><span class="amt">${brl(t.amount)}</span><button class="chip" type="button" data-del="${t.id}">Apagar</button></span></li>`).join('')}</ul>` : '<div class="empty small">Nenhum lançamento manual em aberto.</div>';
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Confirmar'; b.style.borderColor = 'var(--bad)'; return; }
    try { await db.deleteTransaction(b.dataset.del); S.txs = S.txs.filter(t => t.id !== b.dataset.del); toast('Lançamento apagado'); S.render(); } catch (e) { toast('Não foi possível apagar.'); }
  });
}
function renderImports() {
  const list = S.imports.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  $('#importList').innerHTML = list.length ? list.map(i => `<li><span>${esc(i.label)}<br><span class="tiny muted">${esc(i.file_name || '')}</span></span><span class="tiny muted">${new Date(i.created_at).toLocaleDateString('pt-BR')}</span></li>`).join('') : '<li class="muted">Nenhuma importação ainda.</li>';
}

// ---------- quick entry ----------
const catList = () => S.categories.map(c => `${c.name} [${c.grp}]`).join(' | ');
async function interpret() {
  const txt = $('#qText').value.trim(); if (!txt) return;
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
    const names = new Set(S.categories.map(c => c.name));
    Q = its.map(x => {
      const source = x.meio === 'cartao' ? 'cartao' : 'conta';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : todayISO();
      const sign = x.sentido === 'entrada' ? 1 : -1;
      return { source, date, description: String(x.descricao || txt).slice(0, 80), amount: round2(source === 'cartao' ? -sign * x.valor : sign * x.valor), category: names.has(x.categoria) ? x.categoria : (sign > 0 ? 'Outras entradas' : 'A classificar') };
    });
    renderQ(); $('#qStatus').textContent = 'Confira e salve.';
  } catch (e) { $('#qStatus').textContent = e.code === 'empty' ? 'Não achei um valor. Tente dizer quanto foi e o que foi.' : aiErrorText(e); }
  finally { $('#qGo').disabled = false; }
}
function renderQ() {
  const box = $('#qPreview'); box.hidden = false;
  box.innerHTML = `<div class="tw"><table><thead><tr><th>Data</th><th>Descrição</th><th>Onde</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody></tbody></table></div>
  <p class="tiny muted" style="margin-top:6px">Na conta, saída é negativa. No cartão, compra é positiva.</p>
  <div class="rowbtn" style="margin-top:10px"><button class="btn primary" id="qSave" type="button">Salvar ${Q.length > 1 ? Q.length + ' lançamentos' : 'lançamento'}</button><button class="btn" id="qCancel" type="button">Descartar</button></div>`;
  const tb = box.querySelector('tbody');
  Q.forEach((it, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="date" value="${it.date}" data-f="date" style="min-width:130px"></td><td><input type="text" value="${esc(it.description)}" data-f="description" style="min-width:150px"></td><td><select data-f="source"><option value="cartao"${it.source === 'cartao' ? ' selected' : ''}>Cartão</option><option value="conta"${it.source === 'conta' ? ' selected' : ''}>Conta</option></select></td><td></td><td class="r"><input type="number" step="0.01" value="${it.amount}" data-f="amount" style="width:110px;text-align:right"></td>`;
    tr.children[3].append(catPicker(S.categories, it.category, 0, c => { it.category = c; renderQ(); }));
    tr.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
      const f = inp.dataset.f;
      if (f === 'source') { if (inp.value !== it.source) it.amount = -it.amount; it.source = inp.value; renderQ(); }
      else it[f] = f === 'amount' ? +inp.value : inp.value;
    });
    tb.append(tr);
  });
  $('#qCancel').onclick = () => { box.hidden = true; Q = null; };
  $('#qSave').onclick = async () => {
    $('#qSave').disabled = true;
    try {
      const rows = Q.map(it => ({ household_id: S.hh.id, source: it.source, month: it.source === 'cartao' ? cycleMonth(it.date, closeDay()) : it.date.slice(0, 7), date: it.date, day: isoToBr(it.date).slice(0, 5), description: it.description, amount: round2(it.amount), category: it.category, manual: true }));
      const saved = await db.addTransactions(rows);
      S.txs.push(...saved.map(t => ({ ...t, amount: +t.amount })));
      toast(rows.length > 1 ? 'Lançamentos salvos' : 'Lançamento salvo'); box.hidden = true; Q = null; $('#qText').value = ''; $('#qStatus').textContent = ''; S.render();
    } catch (e) { toast('Não foi possível salvar.'); $('#qSave').disabled = false; }
  };
}

// ---------- PDF ----------
const plog = (t, color) => { const p = document.createElement('div'); p.textContent = t; if (color) p.style.color = color; $('#pdfLog').append(p); };
async function startPdf(file) {
  $('#pdfLog').innerHTML = ''; $('#review').hidden = true; $('#pwBox').hidden = true;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { plog('Este arquivo não parece ser um PDF.', 'var(--bad)'); return; }
  if (file.size > 25 * 1024 * 1024) { plog('O PDF é grande demais (máximo 25 MB).', 'var(--bad)'); return; }
  PDF.bytes = new Uint8Array(await file.arrayBuffer()); PDF.name = file.name;
  plog('Lendo ' + file.name + '...');
  return openPdf();
}
async function openPdf(password) {
  if (!window.pdfjsLib) { plog('O leitor de PDF ainda não carregou. Espere um instante e tente de novo.', 'var(--bad)'); return; }
  let doc;
  try { doc = await window.pdfjsLib.getDocument({ data: PDF.bytes.slice(), password: password || undefined, isEvalSupported: false }).promise; }
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
  if (type === 'fatura-santander') {
    const r = parseFaturaSantander(pages.flatMap((p, i) => lineify(p.items, p.w, i === 0 ? 1 : 2)));
    if (r.ok) { plog(`Fatura lida: ${r.items.length} lançamentos. Totais por cartão conferem.`, 'var(--good)'); return reviewRows('cartao', r.items, faturaMonth(r.vencimento), { total: r.net, venc: r.vencimento, checks: r.checks }); }
    plog('A leitura direta não fechou com os totais. Vou pedir ao Claude.', 'var(--warn)');
    return viaClaude(doc, pages, text, 'fatura');
  }
  if (type === 'extrato-santander') {
    const ex = parseExtratoSantander(lines1);
    if (ex.ok) { plog(`Extrato lido: ${ex.rows.length} movimentos. Saldo de ${brl(ex.saldoIni)} para ${brl(ex.saldoFim)} confere.`, 'var(--good)'); return reviewRows('conta', ex.rows, ex.month, { saldoIni: ex.saldoIni, saldoFim: ex.saldoFim }); }
  }
  if (type === 'imagem') {
    plog('Este PDF é uma imagem (sem texto). Diga o que ele é:');
    const box = document.createElement('div'); box.className = 'chips';
    box.innerHTML = [['fatura', 'Fatura do cartão'], ['extrato', 'Extrato da conta'], ['investimentos', 'Investimentos']].map(([k, l]) => `<button class="chip" type="button" data-k="${k}">${l}</button>`).join('');
    $('#pdfLog').append(box);
    box.querySelectorAll('.chip').forEach(b => b.onclick = () => { box.remove(); viaClaude(doc, pages, '', b.dataset.k); });
    return;
  }
  const kind = type.startsWith('fatura') ? 'fatura' : type.startsWith('extrato') ? 'extrato' : type === 'investimentos' ? 'investimentos' : 'auto';
  return viaClaude(doc, pages, text, kind);
}

const JSON_EXTRATO = `{"tipo":"extrato","mes":"AAAA-MM","saldoAnterior":0.00,"saldoFinal":0.00,"movimentos":[{"data":"dd/mm","descricao":"histórico + nome","valor":-123.45}]}`;
const JSON_FATURA = `{"tipo":"fatura","vencimento":"dd/mm/aaaa","cartoes":[{"final":"1234","valorTotal":0.00}],"itens":[{"cartao":"1234","data":"dd/mm","descricao":"...","parcela":"01/10 ou vazio","valor":123.45}]}`;
const JSON_INVEST = `{"tipo":"investimentos","data":"AAAA-MM-DD","totalBruto":0.00,"totalLiquido":0.00,"classes":[{"nome":"...","valor":0.00}]}`;
const RULES_TXT = 'Extrato: só a movimentação da conta, na ordem, débitos com valor negativo; não inclua linhas de saldo. Fatura: ignore o pagamento da fatura anterior; créditos e estornos com valor negativo; se houver vários cartões (titular e adicionais), informe o total de cada um. Investimentos: use o resumo por classe e o total da carteira.';

async function viaClaude(doc, pages, text, kind) {
  const fmt = kind === 'investimentos' ? JSON_INVEST : kind === 'extrato' ? JSON_EXTRATO : kind === 'fatura' ? JSON_FATURA : `um destes formatos, conforme o documento: ${JSON_EXTRATO} ou ${JSON_FATURA} ou ${JSON_INVEST}`;
  try {
    if (text && (text.match(MONEY) || []).length > 5) {
      plog('Pedindo ao Claude para ler o documento...');
      const r = await askJSON(`Extraia os dados deste documento financeiro brasileiro (texto extraído de PDF). Responda só com JSON em ${fmt}.\n${RULES_TXT}\nDocumento:\n"""${text.slice(0, 150000)}"""`, { maxTokens: 16000 });
      return handleExtracted(r);
    }
    const parts = [];
    for (let i = 0; i < pages.length; i++) {
      plog(`Lendo a página ${i + 1} de ${pages.length}...`);
      const vp = pages[i].pg.getViewport({ scale: 2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pages[i].pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      try { parts.push(await askJSON(`A imagem é a página ${i + 1} de ${pages.length} de um documento financeiro brasileiro (${kind}). Extraia só o que aparece nesta página. Responda só com JSON em ${fmt}. Se a página não tiver lançamentos, devolva as listas vazias.\n${RULES_TXT}`, { images: [blob], maxTokens: 8000 })); }
      catch (e) { plog(`A página ${i + 1} não pôde ser lida (${aiErrorText(e)})`, 'var(--warn)'); if (['not_configured', 'not_allowed', 'not_signed_in'].includes(e.code)) return; }
    }
    const m = { tipo: kind === 'auto' ? parts.find(p => p?.tipo)?.tipo : kind };
    if (m.tipo === 'fatura') { m.itens = parts.flatMap(p => p?.itens || []); const cs = {}; parts.forEach(p => (p?.cartoes || []).forEach(c => { if (c?.final && +c.valorTotal) cs[c.final] = +c.valorTotal; })); m.cartoes = Object.entries(cs).map(([final, valorTotal]) => ({ final, valorTotal })); m.vencimento = parts.map(p => p?.vencimento).find(Boolean); }
    else if (m.tipo === 'extrato') { m.movimentos = parts.flatMap(p => p?.movimentos || []); m.saldoAnterior = parts.map(p => p?.saldoAnterior).find(v => v != null); m.saldoFinal = parts.map(p => p?.saldoFinal).filter(v => v != null).pop(); m.mes = parts.map(p => p?.mes).find(Boolean); }
    else Object.assign(m, parts.find(p => p && p.totalBruto) || {});
    return handleExtracted(m);
  } catch (e) { plog(aiErrorText(e), 'var(--bad)'); }
}

function handleExtracted(r) {
  if (!r || typeof r !== 'object') { plog('Resposta vazia.', 'var(--bad)'); return; }
  if (r.tipo === 'fatura') {
    const items = (r.itens || []).filter(x => x && isFinite(+x.valor)).map(x => ({ day: (x.data || '').slice(0, 5), description: String(x.descricao || '').replace(/\s+/g, ' ').trim(), installment: x.parcela || '', amount: +x.valor, card: x.cartao ? String(x.cartao) : '' }));
    const c = checkFatura(items, r.cartoes);
    plog(c.ok ? 'Totais por cartão conferem.' : 'Atenção: a soma dos lançamentos não bate com o total de algum cartão. Revise com cuidado.', c.ok ? 'var(--good)' : 'var(--warn)');
    return reviewRows('cartao', items, faturaMonth(r.vencimento), { total: round2(items.reduce((a, i) => a + i.amount, 0)), venc: r.vencimento, checks: c.checks, viaClaude: true });
  }
  if (r.tipo === 'extrato') {
    const mes = /^\d{4}-\d{2}$/.test(r.mes || '') ? r.mes : null;
    const rows = (r.movimentos || []).filter(x => x && isFinite(+x.valor)).map(x => { const d = (x.data || '').slice(0, 5); const [dd, mm] = d.split('/'); return { day: d, date: mes && dd && mm ? `${mes.slice(0, 4)}-${mm}-${dd}` : null, description: String(x.descricao || '').replace(/\s+/g, ' ').trim(), amount: +x.valor }; });
    const ok = checkExtrato(rows, r.saldoAnterior, r.saldoFinal);
    plog(ok ? `Saldo de ${brl(+r.saldoAnterior)} para ${brl(+r.saldoFinal)} confere.` : 'Atenção: os movimentos não fecham com os saldos. Revise com cuidado.', ok ? 'var(--good)' : 'var(--warn)');
    return reviewRows('conta', rows, mes, { saldoIni: +r.saldoAnterior, saldoFim: +r.saldoFinal, viaClaude: true });
  }
  if (r.tipo === 'investimentos') return reviewInvest(r);
  plog('Não reconheci o tipo do documento.', 'var(--bad)');
}

async function suggest(source, rows) {
  const unk = rows.filter(r => !r.category); if (!unk.length) return;
  plog(`Pedindo sugestão de categoria para ${unk.length} lançamento${unk.length > 1 ? 's' : ''} novo${unk.length > 1 ? 's' : ''}...`);
  const names = new Set(S.categories.map(c => c.name));
  try {
    for (let i = 0; i < unk.length; i += 120) {
      const chunk = unk.slice(i, i + 120);
      const r = await askJSON(`Classifique lançamentos financeiros de uma família brasileira. Categorias possíveis (grupo entre colchetes): ${catList()}.
Responda só com JSON: [{"i":0,"categoria":"<nome exato da lista>","confianca":"alta"|"baixa"}].
Lançamentos (${source === 'cartao' ? 'cartão de crédito' : 'conta corrente; valor negativo = saída'}):
${chunk.map((r, k) => `${k}. ${r.description} | ${r.amount}`).join('\n')}`, { tier: 'quick', maxTokens: 6000 });
      (Array.isArray(r) ? r : []).forEach(x => { const row = chunk[+x.i]; if (row && names.has(x.categoria)) { row.category = x.categoria; row.pending = x.confianca !== 'alta'; row.how = 'sugestão'; } });
    }
  } catch (e) { plog('Sem sugestões do Claude agora (' + aiErrorText(e) + ').', 'var(--warn)'); }
  unk.forEach(r => { if (!r.category) { r.category = r.amount > 0 && source === 'conta' ? 'Outras entradas' : 'A classificar'; r.pending = true; } });
}

async function reviewRows(source, rows, month, info) {
  if (!month) month = addM((source === 'cartao' ? latestCard() : latestClosed()) || addM(thisMonth(), -1), 1);
  const prevCard = source === 'cartao' ? txsOf(addM(month, -1)).filter(t => t.source === 'cartao') : null;
  rows.forEach(r => { r.source = source; const k = classify(r, S.prepared, prevCard); if (k) { r.category = k.category; r.how = k.how; r.pending = false; } });
  await suggest(source, rows);
  R = { source, rows, month, info };
  renderReview();
}

function renderReview() {
  const box = $('#review'); box.hidden = false;
  const { source, rows, info } = R;
  const exist = txsOf(R.month).some(t => t.source === source && !t.manual);
  const pend = txsOf(R.month).filter(t => t.manual && t.source === source);
  pend.forEach(e => { if (e._match == null) e._match = rows.some(r => Math.abs(r.amount - e.amount) < 0.01); });
  const ks = monthKeys(); const months = [...new Set([R.month, ...ks, addM(ks[ks.length - 1] || R.month, 1)])].sort();
  const tot = rows.reduce((a, r) => a + r.amount, 0);
  const head = source === 'cartao' ? `Fatura de ${mLong(R.month)}: ${brl(tot)}` : `Extrato de ${mLong(R.month)}: ${rows.length} movimentos`;
  const sub = source === 'cartao' ? (info.checks || []).map(c => `cartão ${c.card} ${c.ok ? '✓' : '≠ ' + brl(c.sum) + ' de ' + brl(c.total)}`).join(' · ') : `Saldo inicial ${brl(info.saldoIni)} · saldo final ${brl(info.saldoFim)}`;
  box.innerHTML = `<h3>${esc(head)}</h3><p class="small muted">${esc(sub)}</p>
  <label class="f" style="margin-top:10px;max-width:260px">Salvar no mês<select id="rvMonth">${months.map(k => `<option value="${k}"${k === R.month ? ' selected' : ''}>${mLong(k)}</option>`).join('')}</select></label>
  ${exist ? `<p class="banner at" style="margin-top:10px">Este mês já tem ${source === 'cartao' ? 'fatura' : 'extrato'} salvo. Salvar substitui os lançamentos importados antes.</p>` : ''}
  <p class="small" style="margin-top:10px"><span class="pill at">${rows.filter(r => r.pending).length} a classificar</span> <span class="tiny muted">Toque na categoria para trocar. O app aprende.</span></p>
  <div class="tw" style="margin-top:8px;max-height:440px;overflow:auto"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th></tr></thead><tbody id="rvRows"></tbody></table></div>
  <div id="rvPend" style="margin-top:12px"></div>
  <div class="rowbtn" style="margin-top:12px"><button class="btn primary" id="rvSave" type="button">Salvar</button><button class="btn" id="rvCancel" type="button">Descartar</button></div>`;
  const tb = $('#rvRows');
  rows.map((r, i) => [r, i]).sort((a, b) => (b[0].pending ? 1 : 0) - (a[0].pending ? 1 : 0)).forEach(([r]) => {
    const tr = document.createElement('tr'); if (r.pending) tr.className = 'pend';
    tr.innerHTML = `<td>${esc(r.day)}</td><td style="min-width:170px">${esc(r.description)}${r.installment ? ' <span class="tiny muted">' + esc(r.installment) + '</span>' : ''}</td><td></td><td class="r${source === 'conta' && r.amount > 0 ? ' neg' : ''}">${brl(r.amount)}</td>`;
    tr.children[2].append(catPicker(S.categories, r.category, r.pending, c => { if (c !== r.category) r.learn = true; r.category = c; r.pending = false; renderReview(); }));
    tb.append(tr);
  });
  if (pend.length) {
    $('#rvPend').innerHTML = `<h3>Lançamentos manuais deste mês</h3><p class="tiny muted">Marcados: já aparecem no documento e serão apagados ao salvar.</p>` + pend.map((e, i) => `<label class="small" style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-i="${i}" style="width:auto" ${e._match ? 'checked' : ''}> ${esc(e.description)} · ${brl(e.amount)}</label>`).join('');
    $('#rvPend').querySelectorAll('input').forEach(inp => inp.onchange = () => { pend[+inp.dataset.i]._match = inp.checked; });
  }
  $('#rvMonth').onchange = e => { R.month = e.target.value; renderReview(); };
  $('#rvCancel').onclick = () => { box.hidden = true; $('#pdfLog').innerHTML = ''; R = null; };
  $('#rvSave').onclick = () => saveReview(pend);
}

async function saveReview(pend) {
  $('#rvSave').disabled = true;
  const { source, rows, month, info } = R;
  try {
    const payload = rows.map(r => ({ date: r.date || null, day: r.day, description: r.description, amount: round2(r.amount), category: r.category, installment: r.installment || null, card: r.card || null, pending: !!r.pending }));
    const label = (source === 'cartao' ? 'Fatura de ' : 'Extrato de ') + mLong(month);
    await db.replaceMonth(S.hh.id, source, month, payload, pend.filter(e => e._match).map(e => e.id), label, PDF.name, { total: info.total ?? null, venc: info.venc || null, saldoIni: info.saldoIni ?? null, saldoFim: info.saldoFim ?? null, viaClaude: !!info.viaClaude });
    for (const r of rows.filter(r => r.learn)) { try { await db.learnRule(S.hh.id, source, norm(r.description), r.category); S.rules.push({ source, kind: 'exact', pattern: norm(r.description), category: r.category }); } catch (e) { /* learning is best effort */ } }
    await S.reload();
    toast(label + ' salvo'); $('#review').hidden = true; $('#pdfLog').innerHTML = ''; R = null; S.m = month; S.render();
  } catch (e) { toast('Não foi possível salvar.'); $('#rvSave').disabled = false; }
}

function reviewInvest(r) {
  const box = $('#review'); box.hidden = false;
  const cls = (r.classes || []).filter(c => c && +c.valor), sum = cls.reduce((a, c) => a + +c.valor, 0);
  const total = +r.totalBruto || sum, ok = Math.abs(sum - total) < 5;
  box.innerHTML = `<h3>Investimentos em ${esc(isoToBr(r.data || ''))}: ${brl(total)}</h3><p class="small muted">${+r.totalLiquido ? 'Valor líquido ' + brl(+r.totalLiquido) + ' · ' : ''}${ok ? 'soma das classes confere' : 'a soma das classes não bate com o total'}</p>
  <ul class="list small" style="margin-top:8px">${cls.map(c => `<li><span>${esc(c.nome)}</span><span class="amt">${brl(+c.valor)}</span></li>`).join('')}</ul>
  <label class="f" style="margin-top:10px;max-width:280px">Somar valor guardado em outro lugar (opcional)<input type="number" step="0.01" id="ivExtra" value="0"></label>
  <div class="rowbtn" style="margin-top:12px"><button class="btn primary" id="ivSave" type="button">Atualizar investimentos</button><button class="btn" id="ivCancel" type="button">Descartar</button></div>`;
  $('#ivCancel').onclick = () => { box.hidden = true; };
  $('#ivSave').onclick = async () => {
    const extra = +$('#ivExtra').value || 0, classes = cls.map(c => [c.nome, +c.valor]); if (extra) classes.push(['Outros', extra]);
    const st = { ...settings(), invest: { date: r.data || todayISO(), total: total + extra, liquido: (+r.totalLiquido || 0) + extra, classes } };
    try { await db.saveSettings(S.hh.id, st); S.hh.settings = st; toast('Investimentos atualizados'); box.hidden = true; S.render(); } catch (e) { toast('Não foi possível salvar.'); }
  };
}
