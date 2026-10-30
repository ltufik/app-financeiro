import { S, settings, goals, monthKeys, calcMonth, txsOf, manualOf, patrimonio, recurringSum, nextFatura, projOpts, latestCard } from '../state.js';
import { track } from '../usage.js';
import { byCategory, expandSplits, project, needPmt, payoff, schedule } from '../lib/calc.js';
import { brl0, esc, todayISO, norm, addM } from '../lib/format.js';
import * as db from '../db.js';
import { chat, aiErrorText } from '../ai.js';
import { attachMic } from '../speech.js';
import { $, toast, md, confirmInline } from '../ui.js';

let turns = [], ctl = null;

const PRESETS = () => {
  const g = goals(), d = settings().debts || [];
  return [
    g.patrimonio ? `Como chegar a ${brl0(g.patrimonio)}${g.ageGoal ? ' aos ' + g.ageGoal : ''}?` : 'Quanto consigo juntar em 10 anos no ritmo atual?',
    'Onde dá para cortar R$ 1.000 por mês?',
    'Como fica a próxima fatura do cartão?',
    d.length ? `Se eu amortizar R$ 50 mil do ${d[0].name.toLowerCase()}, o que muda?` : 'Quais gastos mais cresceram nos últimos 3 meses?',
    'Qual categoria mais cresceu nos últimos 3 meses?',
    'Projete como termina este mês.',
  ];
};

export function render(el) {
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `
    <div class="panel"><h2>Perguntar</h2><p class="muted small">Projeções, simulações e estudos de redução de custo com os números reais da família. As contas são feitas pelo app.</p><div class="chips" style="margin-top:10px" id="askPresets"></div></div>
    <div class="chat" id="chat"></div>
    <div class="panel">
      <div class="inwrap"><textarea id="askText" placeholder="Ex.: se eu cortar o delivery pela metade, quanto sobra a mais no ano?"></textarea><button id="askMic"></button></div>
      <div class="rowbtn" style="margin-top:10px"><button class="btn primary" id="askGo" type="button">Perguntar</button><button class="btn" id="askStop" type="button" hidden>Parar</button><button class="btn" id="askClear" type="button">Nova conversa</button></div>
    </div>
    <div class="panel"><h3>Estudos salvos</h3><div id="studyList" style="margin-top:6px"></div></div>`;
    attachMic($('#askMic'), $('#askText'));
    $('#askGo').onclick = ask; $('#askStop').onclick = () => ctl?.abort(); $('#askClear').onclick = () => { turns = []; renderChat(); };
  }
  $('#askPresets').innerHTML = PRESETS().map(q => `<button class="chip" type="button">${esc(q)}</button>`).join('');
  $('#askPresets').querySelectorAll('.chip').forEach(b => b.onclick = () => { $('#askText').value = b.textContent; ask(); });
  renderChat(); renderStudies();
}

function renderStudies() {
  const list = S.studies.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  $('#studyList').innerHTML = list.length ? list.map(s => `<details style="padding:8px 0;border-bottom:1px solid var(--line)"><summary class="small">${esc(s.question)} <span class="tiny muted">· ${new Date(s.created_at).toLocaleDateString('pt-BR')}</span></summary><div class="msg a small" style="margin-top:8px">${md(s.answer)}<div class="act"><button class="chip" type="button" data-del="${s.id}">Apagar estudo</button></div></div></details>`).join('') : '<div class="empty small">Salve aqui as respostas que quiser guardar.</div>';
  $('#studyList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!await confirmInline(b, { text: 'Apagar este estudo salvo?', yes: 'Sim, apagar', danger: true })) return; try { await db.deleteStudy(b.dataset.del); S.studies = S.studies.filter(s => s.id !== b.dataset.del); renderStudies(); } catch (e) { toast('Não foi possível apagar.'); } });
}

function renderChat() {
  const c = $('#chat'); c.innerHTML = '';
  turns.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'msg ' + (t.role === 'user' ? 'u' : 'a');
    if (t.role === 'user') d.textContent = t.content;
    else d.innerHTML = md(t.content) + (t.done ? `<div class="act"><button class="chip" type="button" data-save="${i}">Salvar estudo</button></div>` : '');
    c.append(d);
  });
  c.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
    const i = +b.dataset.save;
    try { const s = await db.addStudy(S.hh.id, turns[i - 1]?.content || '', turns[i].content); S.studies.push(s); b.textContent = 'Salvo'; b.disabled = true; renderStudies(); } catch (e) { toast('Não foi possível salvar.'); }
  });
}

function summaryRows() {
  return monthKeys().map(k => { const r = calcMonth(k); return { mes: k, renda: Math.round(r.renda), entradas: Math.round(r.E), saidas_dia_a_dia: Math.round(r.out), cartao_dia_a_dia: Math.round(r.card), fatura_total: Math.round(r.cardTotal), sobra: Math.round(r.res), taxa: +(r.tx * 100).toFixed(1), taxa_sem_financiamento: +(r.tx2 * 100).toFixed(1), fora_do_dia_a_dia: Math.round(r.EX - r.DX), lancamentos_manuais: manualOf(k).length }; });
}

const TOOLS = () => [
  { name: 'gastos_por_categoria', description: 'Despesas (fixas e variáveis) por categoria, mês a mês. Retorna {mes: {categoria: valor}}. Use para comparar meses e achar onde cortar.', input_schema: { type: 'object', properties: { meses: { type: 'array', items: { type: 'string' }, description: 'AAAA-MM; vazio = todos' }, fonte: { type: 'string', enum: ['ambos', 'cartao', 'conta'] } } },
    execute: i => { const ks = (i.meses?.length ? i.meses : monthKeys()).map(String); const o = {}; ks.forEach(k => { const c = byCategory(txsOf(k), S.catIdx, i.fonte === 'cartao' ? 'cartao' : i.fonte === 'conta' ? 'conta' : undefined); o[k] = Object.fromEntries(Object.entries(c).filter(e => e[1] > 1).sort((a, b) => b[1] - a[1]).map(([a, b]) => [a, Math.round(b)])); }); return o; } },
  { name: 'buscar_lancamentos', description: 'Busca lançamentos por texto, categoria e/ou mês. Retorna total, quantidade e até 80 linhas {mes, fonte, data, descricao, categoria, valor}. Lançamentos detalhados por nota fiscal vêm divididos por categoria e trazem itens_da_nota com o valor de cada produto (a busca por texto também procura nos itens; para o gasto com um produto, some os itens_da_nota que correspondem). Conta: negativo = saída. Cartão: positivo = compra.', input_schema: { type: 'object', properties: { texto: { type: 'string' }, categoria: { type: 'string' }, mes: { type: 'string' } } },
    execute: i => { const q = norm(i.texto || ''), cat = String(i.categoria || ''); const f = expandSplits(S.txs).filter(t => (!i.mes || t.month === String(i.mes)) && (!q || norm(t.description + ' ' + (t.receipt?.items || []).map(x => x.description).join(' ')).includes(q)) && (!cat || t.category === cat)); return { total: Math.round(f.reduce((a, t) => a + t.amount, 0) * 100) / 100, quantidade: f.length, linhas: f.slice(0, 80).map(t => ({ mes: t.month, fonte: t.source + (t.manual ? ' (manual)' : ''), data: t.date || t.day, descricao: t.description + (t.installment ? ' ' + t.installment : ''), categoria: t.category, valor: t.amount, ...(t.receipt ? { nota: t.receipt.store, itens_da_nota: t.receipt.items } : {}) })) }; } },
  { name: 'projetar_meta', description: 'Projeta os investimentos até a idade da meta (em dinheiro de hoje), com recebíveis e resgates cadastrados. Retorna valor final, caminho ano a ano e o aporte mensal necessário para a meta.', input_schema: { type: 'object', properties: { aporte_mensal: { type: 'number' }, aporte_extra_anual: { type: 'number' }, retorno_real_aa: { type: 'number', description: 'ex.: 0.05' }, anos: { type: 'number' }, aporte_unico_inicial: { type: 'number', description: 'negativo para resgate (ex.: usar investimentos para amortizar)' } }, required: ['aporte_mensal'] },
    execute: i => { const g = goals(); const o = projOpts(+i.aporte_mensal || 0, +i.aporte_extra_anual || 0, i.retorno_real_aa != null ? { ret: +i.retorno_real_aa } : {}); if (i.anos) o.years = +i.anos; o.start += +i.aporte_unico_inicial || 0; const p = project(o); return { inicio: Math.round(o.start), anos: o.years, valor_final: Math.round(p[p.length - 1]), por_ano: p.map((v, k) => ({ ano: k, idade: g.ageNow ? g.ageNow + k : null, valor: Math.round(v) })), meta: g.patrimonio || null, aporte_mensal_necessario_para_meta: g.patrimonio ? Math.ceil(needPmt({ ...o }, g.patrimonio) / 50) * 50 : null }; } },
  { name: 'simular_quitacao', description: 'Simula a quitação de um financiamento cadastrado (ou com os dados informados) com amortização inicial e extras, mantendo a parcela e reduzindo o prazo. Compara com o cenário sem extras.', input_schema: { type: 'object', properties: { divida: { type: 'string', description: 'id ou nome da dívida cadastrada' }, amortizacao_inicial: { type: 'number' }, extra_mensal: { type: 'number' }, extra_anual: { type: 'number' }, taxa_aa: { type: 'number' }, saldo: { type: 'number' }, parcela: { type: 'number' } } },
    execute: i => { const ds = settings().debts || []; const d = ds.find(x => x.id === i.divida || norm(x.name).includes(norm(i.divida || ''))) || ds[0] || {}; const base = { saldo: +i.saldo || +d.saldo, rate: i.taxa_aa != null ? +i.taxa_aa : +d.taxa, parcela: +i.parcela || +d.parcela }; if (!base.saldo || !base.parcela || base.rate == null || isNaN(base.rate)) return { erro: 'Dívida sem saldo, taxa ou parcela. Pergunte ao usuário ou peça para cadastrar em Ajustes.' }; const a = payoff(base), b = payoff({ ...base, amort: +i.amortizacao_inicial || 0, extraM: +i.extra_mensal || 0, extraY: +i.extra_anual || 0 }); const fmt = x => ({ meses: x.months, anos: x.months ? +(x.months / 12).toFixed(1) : null, total_pago: x.paid && Math.round(x.paid), juros: x.juros && Math.round(x.juros) }); return { divida: d.name || 'informada', premissas: base, sem_extras: fmt(a), com_extras: fmt(b), economia_de_juros: a.juros && b.juros ? Math.round(a.juros - b.juros) : null, observacao: 'Aproximação com parcela fixa; confirmar com a simulação oficial do banco.' }; } },
  { name: 'recorrentes_e_parcelas', description: 'Gastos recorrentes cadastrados e parcelas já contratadas no cartão para as próximas faturas (piso da fatura).', input_schema: { type: 'object', properties: {} },
    execute: () => { const L = latestCard(); const s = L ? schedule(txsOf(L).filter(t => t.source === 'cartao'), 10) : []; const rec = recurringSum(); return { recorrentes: (settings().recurring || []).map(r => ({ item: r[0], valor_mes: r[1], obs: r[2] })), total_recorrente: Math.round(rec), parcelas_proximas_faturas: s.map((v, k) => ({ fatura: addM(L, k + 1), parcelas: Math.round(v), piso_com_recorrentes: Math.round(v + rec) })) }; } },
];

function system() {
  const st = settings(), g = goals(), P0 = patrimonio(), nf = nextFatura();
  return `Você é o assistente financeiro da ${S.hh.name}, dentro do app de controle financeiro deles. Hoje é ${todayISO()}.
Responda em português do Brasil, direto e prático, com valores em R$. Use as ferramentas para qualquer cálculo de projeção ou quitação e para buscar dados; nunca invente números. Em estudos de redução de custo, aponte itens concretos dos dados (categoria, estabelecimento, recorrente, parcela), o ganho por mês e o efeito na meta. Projeções são contas de referência, não recomendação de investimento: diga isso em uma frase quando projetar. Formato: parágrafos curtos, listas e tabelas simples em Markdown, até ~250 palavras, salvo se pedirem mais.

Como o app conta: toda categoria é receita (fixa, variável ou extra), despesa (fixa, variável ou extra) ou "não conta". Sobra = receitas fixas + receitas variáveis − despesas fixas e variáveis (conta e cartão). Receitas e despesas extras ficam fora da sobra. Taxa de poupança = sobra ÷ renda recorrente. Gastos "fora do dia a dia" e entradas pontuais ficam fora da sobra. Cartão conta pelo mês da fatura.
${(st.facts || []).length ? '\nFatos da família:\n- ' + st.facts.join('\n- ') + '\n' : ''}
Resumo mês a mês: ${JSON.stringify(summaryRows())}
Categorias: ${S.categories.map(c => c.name + ' [' + c.grp + (c.financing ? ', financiamento' : '') + ']').join('; ')}
Investimentos: ${st.invest?.total ? brl0(st.invest.total) + ' em ' + st.invest.date + (st.invest.classes?.length ? ' (' + st.invest.classes.map(c => c[0] + ' ' + brl0(c[1])).join('; ') + ')' : '') : 'não cadastrados'}.
Patrimônio líquido: ${P0.rows.length ? brl0(P0.total) + ' (' + P0.rows.map(r => r.name + ' ' + brl0(r.value)).join('; ') + ')' : 'não cadastrado'}.
Dívidas: ${(st.debts || []).map(d => `${d.name} (id ${d.id}): saldo ${brl0(d.saldo)}, ${(d.taxa * 100).toFixed(2)}% a.a., parcela ${brl0(d.parcela)}`).join('; ') || 'nenhuma cadastrada'}.
Próxima fatura (piso): ${nf ? brl0(nf.total) + ' em ' + nf.month : 'sem fatura importada'}.
Metas: ${[g.cardMonthly ? 'cartão até ' + brl0(g.cardMonthly) + '/mês' : null, g.savings ? 'poupança de ' + Math.round(g.savings * 100) + '%' : null, g.patrimonio ? brl0(g.patrimonio) + ' investidos' + (g.ageGoal ? ' aos ' + g.ageGoal + ' (hoje ' + g.ageNow + ')' : '') : null].filter(Boolean).join('; ') || 'não definidas'}.`;
}

async function ask() {
  const q = $('#askText').value.trim(); if (!q) return;
  $('#askText').value = ''; turns.push({ role: 'user', content: q });
  const a = { role: 'assistant', content: 'Pensando...' }; turns.push(a); renderChat();
  $('#askGo').disabled = true; $('#askStop').hidden = false; ctl = new AbortController();
  const hist = [];
  for (let i = 0; i < turns.length - 3; i += 2) if (turns[i + 1]?.done) hist.push({ role: 'user', content: turns[i].content }, { role: 'assistant', content: turns[i + 1].content });
  hist.splice(0, Math.max(0, hist.length - 8));
  hist.push({ role: 'user', content: q });
  try {
    track('perguntar.enviar'); a.content = await chat({ system: system(), messages: hist, tools: TOOLS(), signal: ctl.signal, onStep: () => { a.content = 'Fazendo as contas...'; renderChat(); } });
    a.done = true;
  } catch (e) { a.content = aiErrorText(e); a.done = false; }
  $('#askGo').disabled = false; $('#askStop').hidden = true; renderChat();
  $('#chat').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
