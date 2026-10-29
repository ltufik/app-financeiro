// Browser test of the whole app with Supabase and Claude mocked.
// node tests/e2e/run.mjs --playwright <playwright index.mjs> --pdfjs <pdfjs legacy build dir> [--backup file.json] [--fatura file.pdf] [--shots dir]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const { chromium } = await import(arg('playwright'));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const MOCK = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-supabase.js'), 'utf8');
const PDFJS = arg('pdfjs'), shots = arg('shots');
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'ok  ' : 'FAIL', name, extra]); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fetching the script/.test(m.text())) errors.push(m.text()); });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
await page.route('https://app.test/**', async r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } });
  if (u.pathname === '/api/ai') return r.fulfill({ json: aiMock(JSON.parse(r.request().postData())) });
  const p = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: 'nf' });
  r.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)] || 'application/octet-stream' });
});
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: MOCK, contentType: 'text/javascript' }));
await page.route('https://cdnjs.cloudflare.com/**/pdf.min.js', r => r.fulfill({ contentType: 'text/javascript', body: `Promise.all([import('https://pdfjs.test/pdf.mjs'),import('https://pdfjs.test/pdf.worker.mjs')]).then(([m,w])=>{globalThis.pdfjsWorker=w;window.pdfjsLib=m;});` }));
await page.route('https://cdnjs.cloudflare.com/**/pdf.worker.min.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
await page.route('https://pdfjs.test/*', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(PDFJS, new URL(r.request().url()).pathname.slice(1))) }));
await page.route('https://fonts.**', r => r.fulfill({ body: '' }));

let chatCalls = 0;
function aiMock(b) {
  const text = JSON.stringify(b.messages);
  const reply = t => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
  if (text.includes('Transforme a frase')) return reply(JSON.stringify({ itens: [{ descricao: 'Mercado', valor: 230, sentido: 'saida', data: '2026-10-06', meio: 'cartao', categoria: 'Mercado' }, { descricao: 'Terapia', valor: 350, sentido: 'saida', data: '2026-10-06', meio: 'conta', categoria: 'Saúde' }] }));
  if (text.includes('Classifique lançamentos')) return reply('[]');
  if (text.includes('Extraia os dados') && text.includes('Nu Pagamentos')) return reply(JSON.stringify({ tipo: 'fatura', banco: 'Nubank', vencimento: '15/11/2026', valorTotalFatura: 1234.5, cartoes: [], itens: [
    { cartao: '', data: '09/10', descricao: 'Padaria Pao Quente', parcela: '', valor: 45.9 }, { cartao: '', data: '12/10', descricao: 'Posto Shell Av Brasil', parcela: '', valor: 250 },
    { cartao: '', data: '15/10', descricao: 'iFood *Restaurante Sabor', parcela: '', valor: 89.6 }, { cartao: '', data: '20/10', descricao: 'Loja Movel Casa', parcela: '02/06', valor: 400 },
    { cartao: '', data: '25/10', descricao: 'Netflix.com', parcela: '', valor: 55.9 }, { cartao: '', data: '28/10', descricao: 'Supermercado Dia', parcela: '', valor: 413.1 },
    { cartao: '', data: '30/10', descricao: 'Estorno Loja X', parcela: '', valor: -20 }] }));
  if (b.tools) { chatCalls++; const last = b.messages[b.messages.length - 1]; if (typeof last.content === 'string') return { content: [{ type: 'tool_use', id: 't1', name: 'gastos_por_categoria', input: { meses: ['2026-09'] } }], stop_reason: 'tool_use' }; window_tool = last.content[0].content; return reply('**Resumo:** o maior gasto foi Mercado.\n\n| Categoria | Valor |\n|---|---|\n| Mercado | R$ 1.000 |'); }
  return reply('{}');
}
let window_tool = null;
const txt = async s => (await page.textContent(s)).replace(/\s+/g, ' ').trim();
const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true }); };

try {
await page.goto('https://app.test/');
await page.waitForSelector('#auth:not([hidden])');
ok('tela de login aparece', true);
await shot('01-login');
await page.click('[data-mode=signup]');
await page.fill('#aName', 'Luiz'); await page.fill('#aEmail', 'luiz@test.com'); await page.fill('#aPass', 'senha-forte-123');
await page.click('#aGo');
ok('cadastro exige consentimento', (await txt('#aMsg')).includes('concordância'));
await page.check('#aConsent'); await page.click('#aGo');
await page.waitForSelector('#onboard:not([hidden])');
await page.waitForSelector('.tour');
ok('apresentação aparece no primeiro acesso', (await txt('.tour')).includes('O dinheiro da família'));
await shot('01b-tour-1');
for (let k = 0; k < 2; k++) await page.click('#tourNext');
await shot('01c-tour-3');
const nSlides = await page.$$eval('.tour-slide', s => s.length);
for (let k = 2; k < nSlides - 1; k++) await page.click('#tourNext');
ok('último passo leva a criar a família', (await txt('#tourNext')) === 'Criar minha família');
await shot('01d-tour-fim');
await page.click('#tourNext');
ok('apresentação fecha e foca o nome da família', !(await page.$('.tour')) && await page.evaluate(() => document.activeElement.id === 'oName'));
await page.fill('#oName', 'Família Teste'); await page.click('#oCreate');
await page.waitForSelector('#app:not([hidden])');
ok('família criada e app aberto', (await txt('#brand')) === 'Família Teste');
ok('apresentação não repete depois de vista', !(await page.$('.tour')));
ok('resumo vazio mostra primeiros passos', (await txt('#stepsBox')).includes('0 de 6'), await txt('#stepsBox'));
await page.click('#stepsBox [data-k="0"]');
ok('passo leva ao envio do PDF', await page.isVisible('#v-lancar #drop'));
await page.click('[data-tab=resumo]');
await shot('02-vazio');

const backup = arg('backup');
if (backup) {
  await page.click('[data-tab=ajustes]');
  await page.setInputFiles('#dImport', backup);
  await page.waitForFunction(() => document.querySelector('#dLog')?.textContent.includes('Pronto') || document.querySelector('#dLog')?.textContent.includes('Não consegui'), null, { timeout: 30000 });
  ok('backup importado', true, await txt('#dLog'));
  await page.click('[data-tab=resumo]');
  await page.selectOption('#monthSel', '2026-09');
  const hero = await txt('#v-resumo .big');
  ok('setembro: sobra R$ 2.658,50', hero.includes('2.658,50'), hero);
  const pills = await txt('#v-resumo .hero .chips');
  ok('setembro: 6% e 18%', pills.includes('Poupança 6%') && pills.includes('Sem o financiamento 18%'), pills);
  ok('próxima fatura com parcelas', (await txt('#v-resumo')).includes('Parcelas R$ 8.401'));
  ok('meta e patrimônio aparecem', (await txt('#v-resumo')).includes('Meta de R$ 3.000.000 aos 55'));
  await shot('03-resumo-setembro');
  await page.selectOption('#monthSel', 'ano:2026');
  ok('ano: sobra R$ 53.494', (await txt('#v-resumo .big')).includes('53.494'));
  ok('primeiros passos atualizam com os dados', (await txt('#stepsBox')).includes('3 de 6'), await txt('#stepsBox .tiny'));
}

await page.click('[data-tab=lancar]');
ok('botão de microfone presente (Chrome)', await page.isVisible('#qMic'));
await page.fill('#qText', 'gastei 230 no mercado no cartão e 350 de terapia por pix');
await page.click('#qGo');
await page.waitForSelector('#qSave');
await page.click('#qSave');
await page.waitForFunction(() => document.querySelector('#manualList')?.textContent.includes('Terapia'));
const man = await txt('#manualList');
ok('lançamentos por texto salvos', man.includes('Mercado') && man.includes('fatura de outubro de 2026'), man);
await shot('04-lancar');

const fatura = arg('fatura');
if (fatura && backup) {
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#drop strong', { force: true })]);
  await fc.setFiles(fatura);
  await page.waitForSelector('#rvSave', { timeout: 30000 });
  const log = await txt('#pdfLog');
  ok('fatura lida com totais conferidos', log.includes('Totais por cartão conferem'), log);
  ok('revisão sem pendências (regras + parcelas)', (await txt('#review')).includes('0 a classificar'), (await txt('#review .pill')));
  await shot('05-revisao');
  await page.click('#rvSave');
  await page.waitForFunction(() => window.__lastReplace);
  const lr = await page.evaluate(() => window.__lastReplace);
  ok('fatura salva no mês certo', lr.p_month === '2026-09' && lr.n === 217, JSON.stringify(lr));
  await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09');
  // Same statement re-imported: only the Allpark parking (R$ 70, reclassified by hand in the original data) may differ.
  const after = await txt('#v-resumo .big');
  ok('reimportar a mesma fatura mantém a sobra (±R$ 70 do Allpark)', ['2.658,50', '2.588,50'].some(v => after.includes(v)), after);
}

const outra = arg('outra');
if (outra) {
  await page.click('[data-tab=lancar]');
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  await page.setInputFiles('#pdfIn', outra);
  await page.waitForSelector('#rvSave', { timeout: 30000 });
  const log = await txt('#pdfLog');
  ok('fatura de outro banco lida pelo Claude', log.includes('Fatura do Nubank lida pelo Claude: 7 lançamentos'), log);
  ok('fatura de outro banco conferida pelo total', log.includes('A soma confere com o total da fatura'), log);
  const rv = await txt('#review');
  ok('outro banco vai para o mês do vencimento', rv.includes('novembro de 2026'), rv.slice(0, 120));
  ok('regras genéricas classificam o básico', (await page.$$eval('#rvRows tr', rs => rs.filter(r => /Combust|Assinatura|Restaurante|Mercado/.test(r.textContent)).length)) >= 3);
  await shot('05b-outro-banco');
  await page.click('#rvSave'); await page.waitForFunction(() => window.__lastReplace?.p_month === '2026-11');
  ok('fatura de outro banco salva', true);
}

await page.click('[data-tab=perguntar]');
await page.fill('#askText', 'onde gastei mais em setembro?'); await page.click('#askGo');
await page.waitForFunction(() => document.querySelector('#chat')?.textContent.includes('maior gasto'));
ok('assistente usa ferramenta e responde', chatCalls === 2 && (await txt('#chat')).includes('Mercado'));
ok('resposta com tabela renderizada', await page.isVisible('#chat table'));
await page.click('[data-save]'); await page.waitForFunction(() => document.querySelector('#studyList')?.textContent.includes('onde gastei'));
ok('estudo salvo', true);
await shot('06-perguntar');

await page.click('[data-tab=extrato]');
const nrows = await page.$$eval('#lRows tr', r => r.length);
ok('extrato lista lançamentos', nrows > 0, nrows + ' linhas');
if (nrows) {
  await page.click('#lRows tr:first-child .chip');
  const sel = await page.$('#lRows tr:first-child select');
  const opt = await sel.evaluate(s => [...s.options].map(o => o.value).find(v => v && v !== s.value));
  await sel.selectOption(opt);
  await page.waitForTimeout(200);
  ok('troca de categoria ensina regra', await page.evaluate(() => window.__learned > 0));
}
await shot('07-extrato');
await page.click('[data-tab=ajustes]');
await page.fill('#gCard', '17000'); await page.click('#gSave'); await page.waitForTimeout(100);
ok('metas salvas', await page.evaluate(() => window.__db.households[0].settings.goals.cardMonthly === 17000));
await page.click('#fInvite'); await page.waitForTimeout(100);
ok('convite gerado', (await txt('#fCode')).length === 8);
await shot('08-ajustes');
ok('sem rolagem horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= 400));
await page.click('text=Excluir minha conta'); await page.fill('#delAcc', 'excluir'); await page.click('#delAccGo');
await page.waitForSelector('#auth:not([hidden])', { timeout: 10000 });
ok('excluir conta volta para a tela de login', true);
ok('sem erros no console', !errors.length, errors.join(' | '));

} catch (e) { results.push(['FAIL', 'exceção: ' + e.message.split('\n')[0], errors.join(' | ')]); if (shots) await page.screenshot({ path: path.join(shots, 'erro.png'), fullPage: true }).catch(() => {}); try { results.push(['info', 'log', await txt('#dLog') + ' / ' + await txt('#pdfLog')]); } catch (x) {} }
await browser.close();
for (const r of results) console.log(r[0], r[1], r[2] ? '— ' + String(r[2]).slice(0, 160) : '');
const fails = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} ok`);
process.exit(fails ? 1 : 0);
