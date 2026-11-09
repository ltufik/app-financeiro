// Screens for the product console's "Fluxos" tab, taken from the real app with a fictional family
// (Família Souza), so no real data appears. Run after changing screens:
// node tests/local/flow-screens.mjs --playwright <playwright index.mjs> --pdfjs <pdfjs legacy build dir> --demo <demo-backup.json> --pdf <fictional-fatura.pdf> --out public/flows
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const { chromium } = await import(arg('playwright'));
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../public');
const MOCK = fs.readFileSync(path.join(HERE, '../e2e/mock-supabase.js'), 'utf8'), PDFJS = arg('pdfjs'), out = arg('out');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const reply = t => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
let proof = 'pix'; // which receipt the shared file is: an ordinary Pix or paying off part of the financing
function ai(b) {
  const text = JSON.stringify(b.messages);
  if (String(b.system || '').includes('dúvidas sobre como usar')) return reply('Sim! Abra o mesmo endereço no navegador do computador e entre com o seu e-mail e senha. Os números são os mesmos do celular.');
  if (text.includes('Transforme a frase')) return reply(JSON.stringify({ itens: [proof === 'amort' ? { descricao: 'Amortização do financiamento do apartamento', valor: 15000, sentido: 'saida', data: '2026-10-30', meio: 'pix', categoria: 'Investimentos e transferências' } : { descricao: 'Padaria', valor: 45, sentido: 'saida', data: '2026-10-28', meio: 'pix', categoria: 'Mercado' }] }));
  if (text.includes('nota fiscal ou cupom')) return reply(JSON.stringify({ loja: 'Mercado Bom Preço', data: '2026-10-27', total: 186.4, pagamento: 'cartao', itens: [{ descricao: 'Arroz 5 kg', valor: 32.9, categoria: 'Mercado' }, { descricao: 'Detergente', valor: 12.5, categoria: 'Casa' }, { descricao: 'Dipirona', valor: 18, categoria: 'Saúde' }, { descricao: 'Carne', valor: 123, categoria: 'Mercado' }] }));
  if (text.includes('documento compartilhado')) return reply(JSON.stringify({ tipo: 'comprovante', itens: [proof === 'amort' ? { descricao: 'Amortização do financiamento do apartamento', valor: 15000, sentido: 'saida', data: '2026-10-30', meio: 'conta', categoria: 'Investimentos e transferências' } : { descricao: 'Pix para João Encanador', valor: 180, sentido: 'saida', data: '2026-10-29', meio: 'conta', categoria: 'Casa' }] }));
  if (text.includes('Classifique lançamentos')) return reply('[]');
  if (text.includes('Extraia os dados')) return reply(JSON.stringify({ tipo: 'fatura', banco: 'Nubank', vencimento: '15/11/2026', valorTotalFatura: 1234.5, cartoes: [], itens: [
    { cartao: '', data: '09/10', descricao: 'Padaria Pao Quente', parcela: '', valor: 45.9 }, { cartao: '', data: '12/10', descricao: 'Posto Shell Av Brasil', parcela: '', valor: 250 },
    { cartao: '', data: '15/10', descricao: 'iFood *Restaurante Sabor', parcela: '', valor: 89.6 }, { cartao: '', data: '20/10', descricao: 'Loja Movel Casa', parcela: '02/06', valor: 400 },
    { cartao: '', data: '25/10', descricao: 'Netflix.com', parcela: '', valor: 55.9 }, { cartao: '', data: '28/10', descricao: 'Supermercado Dia', parcela: '', valor: 413.1 }, { cartao: '', data: '30/10', descricao: 'Estorno Loja X', parcela: '', valor: -20 }] }));
  if (b.tools) return reply('Em setembro vocês gastaram **R$ 1.284** com mercado, 8% a menos que a média dos últimos 3 meses. O maior gasto foi no Supermercado Dia (R$ 413).');
  return reply('{}');
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36' });
// A phone with notifications never turned on (headless Chromium has no push service).
await ctx.addInitScript(() => {
  if (!navigator.serviceWorker || !window.Notification) return;
  let perm = 'default', sub = null;
  Object.defineProperty(Notification, 'permission', { get: () => perm, configurable: true });
  Notification.requestPermission = async () => { perm = 'granted'; return perm; };
  const pm = { async getSubscription() { return sub; }, async subscribe() { sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/telas', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BKey', auth: 'Auth' } }; }, async unsubscribe() { sub = null; return true; } }; return sub; } };
  Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve({ pushManager: pm }), configurable: true });
});
await ctx.addInitScript(() => { window.__noMsgs = !localStorage.getItem('shots.msgs'); window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} stop() {} }; });
const page = await ctx.newPage();
{ const cdp = await ctx.newCDPSession(page); await cdp.send('WebAuthn.enable'); await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } }); }
let news = null;
await page.route('https://app.test/**', r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', vapidPublicKey: 'BPk1vV0x2Q0cB8o9Yb0n3M6Jq0c2ZQy6k8xQe1o5gq2Wm0yUu3l7nM2kq8VbV6sH3m4u1C9yQ0r2T5w8Z1x4A7c' } });
  if (u.pathname === '/api/ai') return r.fulfill({ json: ai(JSON.parse(r.request().postData())) });
  if (u.pathname === '/api/news') return r.fulfill({ json: { items: news } });
  if (u.pathname === '/api/push-test') return r.fulfill({ json: { ok: true } });
  if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 403, json: {} });
  const p = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: '' });
  r.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)] || 'application/octet-stream' });
});
await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: MOCK, contentType: 'text/javascript' }));
await page.route('https://cdnjs.cloudflare.com/**/pdf.min.js', r => r.fulfill({ contentType: 'text/javascript', body: `Promise.all([import('https://pdfjs.test/pdf.mjs'),import('https://pdfjs.test/pdf.worker.mjs')]).then(([m,w])=>{globalThis.pdfjsWorker=w;window.pdfjsLib=m;});` }));
await page.route('https://cdnjs.cloudflare.com/**/pdf.worker.min.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
await page.route('https://pdfjs.test/*', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(PDFJS, new URL(r.request().url()).pathname.slice(1))) }));
// --online (GitHub Actions): real photos and fonts; offline: the SVG fallbacks.
if (!process.argv.includes('--online')) await page.route(/fonts\.|pexels/, r => r.fulfill({ status: 404, body: '' }));

const done = [], failed = [];
const clean = () => page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.isheet, .isheet-bg').forEach(x => x.remove()); const t = document.querySelector('#toast'); if (t && !window.__keepToast) t.hidden = true; });
const snap = async (id, { keepToast = false, scrollTo } = {}) => {
  await page.evaluate(k => { window.__keepToast = k; }, keepToast); await clean();
  if (scrollTo) await page.evaluate(s => { const e = document.querySelector(s); if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70); }, scrollTo);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); }))); });
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, id + '.jpg'), type: 'jpeg', quality: 72 }); done.push(id);
};
const step = async (id, fn, opts) => { try { await fn(); await snap(id, opts); } catch (e) { failed.push(id + ': ' + e.message.split('\n')[0]); } };
const sec = async k => { await page.click('#menuBtn'); await page.waitForSelector('#drawer.open'); if (!(await page.isVisible(`#drawer [data-sec="${k}"]`))) await page.click(`#drawer .mgroup:has([data-sec="${k}"]) .mgh`); await page.click(`#drawer [data-sec="${k}"]`); await page.waitForSelector(`#v-ajustes [data-sec="${k}"]:not([hidden])`); await page.waitForTimeout(300); };

await page.goto('https://app.test/');
await step('boas_vindas', () => page.waitForSelector('#welcome:not([hidden])'));
await step('cadastro', async () => { await page.click('#wSignup'); await page.fill('#aName', 'Ana Souza'); await page.fill('#aEmail', 'ana@exemplo.com'); await page.fill('#aPass', 'senha-forte-123'); await page.check('#aConsent'); });
await page.click('#aGo');
await step('nome', async () => { await page.waitForSelector('#obName'); await page.fill('#obName', 'Ana'); });
await page.click('#obNext');
// A phone with fingerprint or face: the app offers it right after the account is created.
await step('biometria', () => page.waitForSelector('#obBioYes', { timeout: 8000 }));
await page.click('#obBioNo').catch(() => {});
await step('familia', async () => { await page.click('[data-s="1"]'); await page.waitForSelector('#obFam'); await page.fill('#obFam', 'Família Souza'); });
await page.click('#obCreate'); await page.waitForSelector('#obDone'); await page.click('#obDone');
await step('apresentacao', () => page.waitForSelector('.tour'));
await page.click('#tourSkip');
await step('tour', () => page.waitForSelector('.coach', { timeout: 4000 }));
if (await page.$('.coach')) await page.click('#coachNever');
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelectorAll('.isheet, .isheet-bg, .cfm-wrap').forEach(x => x.remove()));
// Before any data: Início shows a month of a fictional family.
await step('inicio_exemplo', async () => { await page.click('[data-tab=resumo]'); await page.waitForSelector('#demoCard'); }, { scrollTo: '#demoCard' });
await page.click('#menuBtn'); await page.waitForSelector('#drawer.open'); if (!(await page.isVisible('#drawer [data-sec="backup"]'))) await page.click('#drawer .mgroup[data-g="dados"] .mgh'); await page.click('#drawer [data-sec="backup"]');
await page.setInputFiles('#dImport', arg('demo')); await page.click('.cfm [data-y]');
await page.waitForFunction(() => /Pronto/.test(document.querySelector('#bkStatus')?.textContent || ''));
await page.evaluate(() => document.querySelectorAll('.cfm-wrap').forEach(x => x.remove()));

await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09');
await step('inicio', () => page.waitForSelector('#todo'));
await step('inicio_mais', async () => { await page.evaluate(() => { ['fixos', 'patrimonio', 'sonho'].forEach(k => { const d = document.querySelector('#sum_' + k); if (d) d.open = true; }); }); }, { scrollTo: '#homeMore' });
await step('retro_evolucao', async () => { await page.evaluate(() => { document.querySelector('#sum_retro').open = true; }); await page.click('#homeMore [data-retro]'); await page.waitForSelector('#wrapped'); for (let k = 0; k < 12 && !/evolução no ano/i.test(await page.textContent('#wrapped .w-slide')); k++) { await page.click('#wrapped .w-next'); await page.waitForTimeout(150); } await page.waitForTimeout(600); });
await step('retro_historias', async () => { for (let k = 0; k < 12 && !/nível (de vocês|até agora)/i.test(await page.textContent('#wrapped .w-slide')); k++) { await page.click('#wrapped .w-next'); await page.waitForTimeout(150); } await page.waitForTimeout(600); });
await step('retro_ano', async () => { for (let k = 0; k < 12 && !(await page.$('#wPage')); k++) await page.click('#wrapped .w-next'); await page.click('#wPage'); await page.waitForSelector('.yretro'); });
await page.click('[data-back]').catch(() => {}); await page.waitForSelector('#homeMore').catch(() => {});
await step('fechar', async () => { await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09'); const b = await page.$('#goClose'); if (!b) throw new Error('sem cartão de fechar'); await b.click(); await page.waitForSelector('#v-fechar:not([hidden])'); });
await step('lancar', async () => { await page.click('[data-tab=lancar]'); await page.waitForSelector('.ltiles'); });
await step('lancar_falar', async () => { await page.click('.ltile[data-mode="falar"]'); await page.fill('#qText', 'gastei 45 na padaria no pix'); await page.click('#qGo'); await page.waitForSelector('#qSave'); }, { scrollTo: '.ltiles' });
await step('lancar_salvo', async () => { await page.click('#qSave'); await page.click('.cfm [data-y]'); await page.waitForSelector('#toast:not([hidden])'); }, { keepToast: true });
await step('lancar_nota', async () => { await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="nota"]'); await page.setInputFiles('#rcFile', path.join(ROOT, 'icons/icon-512.png')); await page.waitForSelector('#rcReview:not([hidden])', { timeout: 15000 }); }, { scrollTo: '#rcReview' });
// A withdrawal with no detail: "No que foi o dinheiro do saque?" with the parts already typed.
await step('saque', async () => {
  await page.evaluate(async () => { const { S } = await import('/js/state.js'); const d = new Date().toISOString().slice(0, 10); S.txs.push({ id: 'fsaque', household_id: S.hh.id, source: 'conta', month: d.slice(0, 7), date: d, description: 'SAQUE BANCO24HORAS', amount: -300, category: 'A classificar', manual: false }); S.render(); });
  await page.waitForSelector('#cashBox:not([hidden])', { timeout: 8000 }); await page.fill('#cashTxt', '150 feira, 80 uber, 40 presente');
}, { scrollTo: '#cashBox' });
await page.evaluate(async () => { const { S } = await import('/js/state.js'); S.txs = S.txs.filter(t => t.id !== 'fsaque'); S.render(); }).catch(() => {});
await step('lancar_pdf', async () => { await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="pdf"]'); await page.waitForSelector('#drop'); }, { scrollTo: '.ltiles' });
if (arg('pdf')) await step('lancar_revisao', async () => {
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  await page.setInputFiles('#pdfIn', arg('pdf')); await page.waitForSelector('#rvSave', { timeout: 30000 });
}, { scrollTo: '#review' });
// Choosing a category: the sheet with the entry, the search and the suggestions.
if (arg('pdf')) await step('categoria', async () => { await page.click('#rvRows .catchip'); await page.waitForSelector('.cps'); await page.fill('.cps-q', 'estacion'); await page.waitForTimeout(200); });
await page.click('.cps .tx').catch(() => {});
// While a document is read: the symbol building itself, the step and the percentage (shown as it looks halfway).
await step('lendo', async () => { await page.evaluate(() => import('/js/ui.js').then(m => { const b = m.busy('Lendo a parte 2 de 4...', { title: 'Arquivo 1 de 3' }); b.set('Lendo a parte 2 de 4...', 45); window.__bz = b; })); await page.waitForTimeout(900); });
await page.evaluate(() => window.__bz?.done()); await page.waitForTimeout(300);
// A spreadsheet: columns found, categories matched or created, rows already in the app left out.
await step('planilha', async () => { await page.setInputFiles('#pdfIn', path.join(HERE, '../fixtures/planilha-ficticia.csv')); await page.waitForSelector('#shReview:not([hidden])', { timeout: 15000 }); }, { scrollTo: '#shReview' });
await page.click('#shCancel').catch(() => {}); await page.click('.cfm [data-y]').catch(() => {}); await page.waitForTimeout(200);
// Several files at once: the queue on top ("Arquivo 1 de 2") and the review of the first one.
if (arg('pdf')) await step('varios_arquivos', async () => {
  if (await page.isVisible('#rvCancel')) { await page.click('#rvCancel'); await page.click('.cfm [data-y]'); await page.waitForTimeout(200); }
  await page.setInputFiles('#pdfIn', [arg('pdf'), path.join(HERE, '../fixtures/comprovante-ficticio.pdf')]); await page.waitForSelector('#rvSave', { timeout: 30000 });
}, { scrollTo: '#qBar' });
if (arg('pdf')) { await page.click('#quSkip').catch(() => {}); await page.waitForSelector('#quClose', { timeout: 30000 }).catch(() => page.click('#quSkip').catch(() => {})); await page.click('#quClose').catch(() => {}); }
await step('graficos', async () => { await page.click('[data-tab=graficos]'); await page.waitForTimeout(500); });
await step('perguntar', async () => { await page.click('[data-tab=perguntar]'); await page.waitForTimeout(300); });
await step('perguntar_resposta', async () => { await page.fill('#askText', 'quanto gastamos com mercado em setembro?'); await page.click('#askGo'); await page.waitForFunction(() => /R\$ 1\.284/.test(document.querySelector('#v-perguntar')?.textContent || ''), null, { timeout: 8000 }); });
await step('extrato', async () => { await page.click('[data-tab=extrato]'); await page.waitForTimeout(400); });
await step('anotacao', async () => { await page.click('#lRows li:not([data-split]) .notechip'); await page.waitForSelector('.nt-in'); await page.fill('.nt-in', 'cabeleireiro Lily'); });
await page.click('.cps .tx').catch(() => {});
// Survey: the general one, for a family that has used the app for a while; the first question open.
await step('pesquisa', async () => {
  await page.evaluate(async () => { window.__surveyCtx = { joined: new Date(Date.now() - 40 * 864e5).toISOString(), active_days: 6, history: [] }; (await import('/js/survey.js')).resetSurvey(); });
  await page.click('[data-tab=resumo]'); await page.waitForSelector('#survBox:not([hidden])', { timeout: 8000 }); await page.click('#svGo'); await page.waitForSelector('.surv'); await page.click('.sv-scale [data-v="9"]');
});
await page.click('#svBack').catch(() => {}); await page.evaluate(() => { window.__surveyCtx = null; document.querySelectorAll('.cfm-wrap').forEach(x => x.remove()); document.body.classList.remove('cfm-open'); }).catch(() => {});
// Learned rule: change one entry and the app asks about everything with the same name.
await step('regra_aprender', async () => {
  await page.evaluate(async () => { const { S } = await import('/js/state.js'); const m = '2026-09'; [['fr1', 'IFOOD *PIZZARIA BELLA', 'Restaurante'], ['fr2', 'IFOOD*HAMBURGUERIA', 'A classificar'], ['fr3', 'IFOOD *SUSHI DO BAIRRO', 'A classificar']].forEach(([id, d, c]) => S.txs.push({ id, household_id: S.hh.id, source: 'cartao', month: m, day: '12/09', description: d, amount: 68.9, category: c, manual: false })); S.render(); });
  await page.fill('#lSearch', 'sushi do bairro'); await page.waitForTimeout(300); await page.click('#lRows li:not([data-split]) .chip'); await page.waitForSelector('.cps');
  await page.fill('.cps-q', 'Restaurante'); await page.waitForTimeout(150); await page.click('.cps-it'); await page.waitForSelector('.lrn', { timeout: 8000 });
});
await page.click('.lrn [data-n]').catch(() => {}); await page.fill('#lSearch', '').catch(() => {});
await step('extrato_categoria', async () => { await page.click('[data-tab=extrato]'); await page.waitForTimeout(300); const v = await page.$$eval('#lCat option', o => o.map(x => x.value).filter(Boolean)); if (v.length) await page.selectOption('#lCat', v[0]); await page.waitForTimeout(300); });
await page.selectOption('#lCat', '').catch(() => {});
await step('juntar_categorias', async () => { await sec('categorias'); await page.fill('#cNew', 'Mercados'); await page.click('#cAdd'); await page.click('.cfm [data-y]'); await page.waitForSelector('#catMerge .mergecard', { timeout: 8000 }); }, { scrollTo: '#catMerge' });
await page.click('#catMerge .mergecard [data-mj]').catch(() => {}); await page.click('.cfm [data-y]').catch(() => {}); await page.waitForTimeout(300);
await page.keyboard.press('Escape').catch(() => {});
await step('menu', async () => { await page.click('#menuBtn'); await page.waitForSelector('#drawer.open'); await page.waitForTimeout(300); });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
for (const k of ['familia', 'divisao', 'metas', 'gastos_ano', 'patrimonio', 'categorias', 'avisos', 'applepay', 'contexto', 'duvidas', 'opiniao', 'ajuda', 'backup', 'sobre', 'conta']) await step('menu_' + k, () => sec(k));
await step('lancar_comprovante', async () => {
  await page.evaluate(async () => { const png = await (await fetch('/icons/icon-192.png')).blob(); const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: '', name: 'comprovante.png', type: 'image/png' }))); await c.put('/shared/file', new Response(png, { headers: { 'content-type': 'image/png' } })); });
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForSelector('#qSave', { timeout: 15000 });
}, { scrollTo: '#qPreview' });
// Financing: the receipt asks whether it pays the financing; the payment already saved waits in Patrimônio.
await step('comprovante_amortizacao', async () => {
  proof = 'amort'; await page.goto('https://app.test/'); await page.waitForSelector('[data-tab=lancar]');
  await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="falar"]');
  await page.fill('#qText', 'mandei 15 mil para amortizar o financiamento do apartamento'); await page.click('#qGo');
  await page.waitForSelector('#qPreview .qdebt', { timeout: 30000 }); proof = 'pix';
}, { scrollTo: '#qPreview' });
await step('gastos_ano_calendario', async () => { await sec('gastos_ano'); for (let k = 0; k < 4 && await page.$('#anBox [data-yes]'); k++) { await page.click('#anBox [data-yes]'); await page.waitForTimeout(400); } await page.waitForSelector('#anCal'); }, { scrollTo: '#anCal' });
await step('patrimonio_financiamento', async () => { await page.click('#qCancel').catch(() => {}); await sec('patrimonio'); await page.waitForSelector('#pDebtNow .dnow'); }, { scrollTo: '#pDebtPay' });
await step('duvidas_resposta', async () => { await sec('duvidas'); await page.fill('#fqQ', 'consigo usar no computador?'); await page.click('#fqSend'); await page.waitForSelector('#fqAns [data-h]'); }, { scrollTo: '#fqAsk' });
await step('opiniao_confirmar', async () => { await page.click('#fbBtn'); await page.waitForSelector('#fbText'); await page.click('[data-kind="ideia"]'); await page.fill('#fbText', 'Queria ver quanto gastamos por semana'); await page.click('#fbSend'); await page.waitForSelector('.cfm'); });
await step('opiniao_enviada', async () => { await page.click('.cfm [data-y]'); await page.waitForSelector('#toast:not([hidden])'); }, { keepToast: true });
// Messages: the welcome, a personal reply and what's new.
await page.evaluate(() => { localStorage.setItem('shots.msgs', '1'); });
const msg = async (id, prep) => step(id, async () => { await prep(); await page.reload(); await page.waitForSelector('.ann', { timeout: 10000 }); });
await msg('alpha', async () => { await page.evaluate(() => { localStorage.removeItem('fin.alpha.' + window.__db.users[0].id); }); });
await page.click('.ann [data-p]').catch(() => {});
await msg('recado', async () => { await page.evaluate(() => { const f = window.__db.feedback.at(-1); Object.assign(f, { reply: 'Oi, Ana! Você sugeriu "Queria ver quanto gastamos por semana". Ficou pronto: Gráfico por semana. Onde encontrar: Gráficos → por semana. Obrigado por ajudar a melhorar o app!', reply_seen: false }); localStorage.setItem('mock.db', JSON.stringify(window.__db)); }); });
await page.click('.ann [data-p]').catch(() => {});
news = [{ id: 'nx', at: new Date().toISOString(), title: 'Gasto por semana nos gráficos', items: ['Em Gráficos, escolha "por semana".', 'O resumo de domingo mostra a semana inteira.'] }];
await msg('novidades', async () => {});
await step('sininho', async () => { await page.click('.ann [data-p]').catch(() => {}); await page.click('#bellBtn'); await page.waitForSelector('.bellbox'); });
await page.evaluate(() => document.querySelectorAll('.bellbox').forEach(x => x.remove()));
await msg('convite_avisos', async () => {});
// "Quero receber" → Ativar → Permitir; the test notice did not show: the phone's own settings, step by step.
await page.click('.ann [data-p]').catch(() => {});
await step('avisos_celular', async () => { await page.click('#pOn'); await page.waitForSelector('#pCheck:not([hidden])', { timeout: 20000 }); await page.click('#pNo'); await page.waitForTimeout(400); }, { scrollTo: '#pMsg' });
// Security: the lock screen (left alone longer than the chosen time) and the message after signing out.
await page.evaluate(() => { localStorage.setItem('shots.msgs', ''); document.querySelectorAll('.bellbox, .cfm-wrap').forEach(x => x.remove()); });
// Like the bank apps: the countdown warning, then the "entrar" screen (password; and with the fingerprint turned on).
const ago = ms => page.evaluate(ms => { window.scrollTo(0, 0); localStorage.setItem('fin.lock.min', '1'); for (const k of Object.keys(localStorage)) if (k.startsWith('fin.lock.last.')) localStorage.setItem(k, String(Date.now() - ms)); }, ms);
await step('aviso_inatividade', async () => { await page.keyboard.press('Escape').catch(() => {}); await page.click('[data-tab=resumo]'); await page.waitForTimeout(500); await ago(36e3); await page.waitForSelector('#lkWarn', { timeout: 6000 }); });
await step('bloqueio', async () => { await ago(120e3); await page.waitForSelector('#lockScreen', { timeout: 6000 }); });
await step('entrar_digital', async () => {
  const cdp = await page.context().newCDPSession(page); await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true } }).catch(() => {}); // one may exist already
  await page.evaluate(() => { document.querySelector('#lockScreen')?.remove(); document.body.classList.remove('locked'); const k = Object.keys(localStorage).find(x => x.startsWith('fin.lock.last.')); localStorage.setItem('fin.bio.' + k.slice(14), 'AAAA'); });
  await ago(120e3); await page.waitForSelector('#lockScreen #lkBio', { timeout: 6000 });
});
await step('saiu', async () => { await page.click('#lkOut'); await page.waitForSelector('#welcome:not([hidden])'); await page.waitForSelector('.ann'); await page.waitForTimeout(400); });
await browser.close();
console.log('telas:', done.length, done.join(' '));
if (failed.length) console.log('falharam:', failed.join(' | '));
