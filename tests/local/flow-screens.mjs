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
function ai(b) {
  const text = JSON.stringify(b.messages);
  if (String(b.system || '').includes('dúvidas sobre como usar')) return reply('Sim! Abra o mesmo endereço no navegador do computador e entre com o seu e-mail e senha. Os números são os mesmos do celular.');
  if (text.includes('Transforme a frase')) return reply(JSON.stringify({ itens: [{ descricao: 'Padaria', valor: 45, sentido: 'saida', data: '2026-10-28', meio: 'pix', categoria: 'Mercado' }] }));
  if (text.includes('nota fiscal ou cupom')) return reply(JSON.stringify({ loja: 'Mercado Bom Preço', data: '2026-10-27', total: 186.4, pagamento: 'cartao', itens: [{ descricao: 'Arroz 5 kg', valor: 32.9, categoria: 'Mercado' }, { descricao: 'Detergente', valor: 12.5, categoria: 'Casa' }, { descricao: 'Dipirona', valor: 18, categoria: 'Saúde' }, { descricao: 'Carne', valor: 123, categoria: 'Mercado' }] }));
  if (text.includes('documento compartilhado')) return reply(JSON.stringify({ tipo: 'comprovante', itens: [{ descricao: 'Pix para João Encanador', valor: 180, sentido: 'saida', data: '2026-10-29', meio: 'conta', categoria: 'Casa' }] }));
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
await ctx.addInitScript(() => { window.__noMsgs = !localStorage.getItem('shots.msgs'); window.SpeechRecognition = window.webkitSpeechRecognition = class { start() {} stop() {} }; });
const page = await ctx.newPage();
let news = null;
await page.route('https://app.test/**', r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } });
  if (u.pathname === '/api/ai') return r.fulfill({ json: ai(JSON.parse(r.request().postData())) });
  if (u.pathname === '/api/news') return r.fulfill({ json: { items: news } });
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
const sec = async k => { await page.click('#menuBtn'); await page.waitForSelector('#drawer.open'); await page.click(`#drawer [data-sec="${k}"]`); await page.waitForSelector(`#v-ajustes [data-sec="${k}"]:not([hidden])`); await page.waitForTimeout(300); };

await page.goto('https://app.test/');
await step('boas_vindas', () => page.waitForSelector('#welcome:not([hidden])'));
await step('cadastro', async () => { await page.click('#wSignup'); await page.fill('#aName', 'Ana Souza'); await page.fill('#aEmail', 'ana@exemplo.com'); await page.fill('#aPass', 'senha-forte-123'); await page.check('#aConsent'); });
await page.click('#aGo');
await step('nome', async () => { await page.waitForSelector('#obName'); await page.fill('#obName', 'Ana'); });
await page.click('#obNext');
await step('familia', async () => { await page.click('[data-s="1"]'); await page.waitForSelector('#obFam'); await page.fill('#obFam', 'Família Souza'); });
await page.click('#obCreate'); await page.waitForSelector('#obDone'); await page.click('#obDone');
await step('apresentacao', () => page.waitForSelector('.tour'));
await page.click('#tourSkip');
await step('tour', () => page.waitForSelector('.coach', { timeout: 4000 }));
if (await page.$('.coach')) await page.click('#coachNever');
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelectorAll('.isheet, .isheet-bg, .cfm-wrap').forEach(x => x.remove()));
await page.click('#menuBtn'); await page.click('#drawer [data-sec="backup"]');
await page.setInputFiles('#dImport', arg('demo')); await page.click('.cfm [data-y]');
await page.waitForFunction(() => /Pronto/.test(document.querySelector('#bkStatus')?.textContent || ''));
await page.evaluate(() => document.querySelectorAll('.cfm-wrap').forEach(x => x.remove()));

await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09');
await step('inicio', () => page.waitForSelector('.hero'));
await step('inicio_mais', async () => { await page.evaluate(() => { const d = document.querySelector('#homeMore'); d.open = true; }); }, { scrollTo: '#homeMore' });
await step('fechar', async () => { await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09'); const b = await page.$('#goClose'); if (!b) throw new Error('sem cartão de fechar'); await b.click(); await page.waitForSelector('#v-fechar:not([hidden])'); });
await step('lancar', async () => { await page.click('[data-tab=lancar]'); await page.waitForSelector('.ltiles'); });
await step('lancar_falar', async () => { await page.click('.ltile[data-mode="falar"]'); await page.fill('#qText', 'gastei 45 na padaria no pix'); await page.click('#qGo'); await page.waitForSelector('#qSave'); }, { scrollTo: '.ltiles' });
await step('lancar_salvo', async () => { await page.click('#qSave'); await page.click('.cfm [data-y]'); await page.waitForSelector('#toast:not([hidden])'); }, { keepToast: true });
await step('lancar_nota', async () => { await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="nota"]'); await page.setInputFiles('#rcFile', path.join(ROOT, 'icons/icon-512.png')); await page.waitForSelector('#rcReview:not([hidden])', { timeout: 15000 }); }, { scrollTo: '#rcReview' });
await step('lancar_pdf', async () => { await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="pdf"]'); await page.waitForSelector('#drop'); }, { scrollTo: '.ltiles' });
if (arg('pdf')) await step('lancar_revisao', async () => {
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  await page.setInputFiles('#pdfIn', arg('pdf')); await page.waitForSelector('#rvSave', { timeout: 30000 });
}, { scrollTo: '#review' });
await step('graficos', async () => { await page.click('[data-tab=graficos]'); await page.waitForTimeout(500); });
await step('perguntar', async () => { await page.click('[data-tab=perguntar]'); await page.waitForTimeout(300); });
await step('perguntar_resposta', async () => { await page.fill('#askText', 'quanto gastamos com mercado em setembro?'); await page.click('#askGo'); await page.waitForFunction(() => /R\$ 1\.284/.test(document.querySelector('#v-perguntar')?.textContent || ''), null, { timeout: 8000 }); });
await step('extrato', async () => { await page.click('[data-tab=extrato]'); await page.waitForTimeout(400); });
await step('menu', async () => { await page.click('#menuBtn'); await page.waitForSelector('#drawer.open'); await page.waitForTimeout(300); });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
for (const k of ['familia', 'divisao', 'metas', 'patrimonio', 'categorias', 'avisos', 'applepay', 'contexto', 'duvidas', 'opiniao', 'ajuda', 'backup', 'sobre', 'conta']) await step('menu_' + k, () => sec(k));
await step('lancar_comprovante', async () => {
  await page.evaluate(async () => { const png = await (await fetch('/icons/icon-192.png')).blob(); const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: '', name: 'comprovante.png', type: 'image/png' }))); await c.put('/shared/file', new Response(png, { headers: { 'content-type': 'image/png' } })); });
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForSelector('#qSave', { timeout: 15000 });
}, { scrollTo: '#qPreview' });
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
// Security: the lock screen (left alone longer than the chosen time) and the message after signing out.
await page.evaluate(() => { localStorage.setItem('shots.msgs', ''); document.querySelectorAll('.bellbox, .cfm-wrap').forEach(x => x.remove()); });
await step('bloqueio', async () => { await page.keyboard.press('Escape').catch(() => {}); await sec('conta'); await page.click('#lkNow'); await page.waitForSelector('#lockScreen'); });
await step('saiu', async () => { await page.click('#lkOut'); await page.waitForSelector('#welcome:not([hidden])'); await page.waitForSelector('.ann'); await page.waitForTimeout(400); });
await browser.close();
console.log('telas:', done.length, done.join(' '));
if (failed.length) console.log('falharam:', failed.join(' | '));
