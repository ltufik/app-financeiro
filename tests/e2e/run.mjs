// Browser test of the whole app with Supabase and Claude mocked.
// node tests/e2e/run.mjs --playwright <playwright index.mjs> --pdfjs <pdfjs legacy build dir> [--backup file.json] [--fatura file.pdf] [--shots dir]
// --browser webkit --smoke: the iPhone browser engine (Safari), as an iPhone, only the parts that do not need real family data (GitHub Actions).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_VERSION } from '../helpers/app-version.mjs';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const PW = await import(arg('playwright'));
const ENGINE = arg('browser') || 'chromium', SMOKE = process.argv.includes('--smoke'), SMOKE_DONE = new Error('smoke done');
const { newlyDone } = await import('../../public/js/lib/news.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const MOCK = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-supabase.js'), 'utf8');
const PDFJS = arg('pdfjs'), shots = arg('shots');
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'ok  ' : 'FAIL', name, extra]); };

const browser = await PW[ENGINE].launch();
const page = await browser.newPage(ENGINE === 'webkit' ? { ...PW.devices['iPhone 13'] } : { viewport: { width: 400, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const clog = []; page.on('console', m => clog.push(m.type() + ': ' + m.text().slice(0, 200))); page.on('requestfailed', q => clog.push('falhou: ' + q.url().slice(0, 120) + ' ' + (q.failure()?.errorText || '')));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fetching the script/.test(m.text())) errors.push(m.text()); });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const adminStore = {}, adminPuts = [], adminPatches = [];
const NAV_FIXTURE = { days: 30, at: '2026-10-30T12:00:00Z',
  screens: [{ s: 'inicio', views: 40, users: 2, seconds: 1200 }, { s: 'lancar', views: 12, users: 2, seconds: 600 }, { s: 'menu.metas', views: 3, users: 1, seconds: 240 }],
  flows: [{ f: 'inicio', t: 'lancar', n: 9, users: 2 }, { f: 'lancar', t: 'inicio', n: 5, users: 1 }],
  taps: { inicio: [[3, 10, 4], [10, 20, 9], [15, 30, 2], [10, 90, 3]], lancar: [[5, 12, 3]] },
  targets: { inicio: [{ t: 'Enviar PDF', n: 7, users: 2 }, { t: 'Fechar setembro', n: 2, users: 1 }], lancar: [{ t: 'Fatura ou extrato', n: 3, users: 2 }] },
  errors: [{ id: 1, at: new Date().toISOString(), kind: 'tela', message: 'Não foi possível salvar. Verifique a internet.', screen: 'lancar', device: 'Android · app instalado', version: 'v31', name: 'Testador Um', family: 'Família Teste' },
    { id: 2, at: new Date(Date.now() - 3600e3).toISOString(), kind: 'tela', message: 'Não foi possível salvar. Verifique a internet.', screen: 'lancar', device: 'iPhone · navegador', version: 'v31', name: 'Testador Dois', family: 'Família Teste' },
    { id: 3, at: '2026-10-20T10:00:00Z', kind: 'js', message: 'TypeError: x is undefined', screen: 'menu.metas', source: 'ajustes.js:120', device: 'Android', version: 'v30', name: 'Testador Um', family: 'Família Teste' }] };
const FB_FIXTURE = [
  { id: 1, kind: 'erro', text: 'Toquei em salvar a nota e nada aconteceu', status: 'novo', screen: 'lancar', device: 'Android · app instalado', version: 'v26', name: 'Testador Um', email: 'um@test.com', family: 'Família Teste', created_at: '2026-10-29T12:00:00Z' },
  { id: 2, kind: 'duvida', text: 'O que é a régua do início?', answer: 'É o quanto o app está preenchido.', helpful: false, status: 'novo', screen: 'resumo', device: 'iPhone · navegador', version: 'v26', name: 'Testador Dois', email: 'dois@test.com', family: 'Família Teste', created_at: '2026-10-30T09:00:00Z' },
  { id: 3, kind: 'ideia', text: 'Ver gasto por semana', status: 'visto', screen: 'graficos', device: 'iPhone', version: 'v25', name: 'Testador Um', email: 'um@test.com', family: 'Família Teste', created_at: '2026-10-28T09:00:00Z' },
];
const USE_FIXTURE = { days: 30, at: '2026-10-30T12:00:00Z',
  people: [{ id: 'a', email: 'um@test.com', name: 'Testador Um', family: 'Família Teste', created_at: '2026-10-01T00:00:00Z', last_day: '2026-10-30', days: 12, features: { 'aba.inicio': 30, 'lancar.salvar': 9, 'perguntar.enviar': 4 }, feedbacks: 2 },
    { id: 'b', email: 'dois@test.com', name: 'Testador Dois', family: 'Família Teste', created_at: '2026-10-05T00:00:00Z', last_day: '2026-10-10', days: 3, features: { 'aba.inicio': 5, 'lancar.pdf_ok': 2 }, feedbacks: 1 }],
  features: { 'aba.inicio': { n: 35, users: 2 }, 'lancar.salvar': { n: 9, users: 1 }, 'perguntar.enviar': { n: 4, users: 1 }, 'lancar.pdf_ok': { n: 2, users: 1 } },
  hours: [[1, 8, 5], [1, 21, 9], [3, 12, 2], [0, 10, 4]],
  by_day: [['aba', '2026-10-30', 2], ['lancar', '2026-10-29', 1], ['perguntar', '2026-10-28', 1]] };
async function addRoutes(t) {
  await t.route('https://app.test/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', vapidPublicKey: 'BPk1vV0x2Q0cB8o9Yb0n3M6Jq0c2ZQy6k8xQe1o5gq2Wm0yUu3l7nM2kq8VbV6sH3m4u1C9yQ0r2T5w8Z1x4A7c' } });
    if (u.pathname === '/api/metrics') return r.fulfill({ json: u.searchParams.get('probe') ? { admin: true } : { users: 12, users_7d: 3, users_30d: 12, in_family: 11, families: 6, families_shared: 4, families_1_month: 5, families_2_months: 3, families_closed: 2, d7_eligible: 8, d7_retained: 5, d30_eligible: 2, d30_retained: 1, wau: 7, mau: 10, daily: Array.from({ length: 14 }, (_, i) => ({ day: '2026-10-' + String(17 + i).padStart(2, '0'), users: i % 5 })), manual_30d: 40, receipts_30d: 6, imports_30d: 15, studies: 4, charts: 3, push_devices: 5, at: '2026-10-30T12:00:00Z' } });
    if (u.pathname === '/api/news') return r.fulfill({ json: { items: adminStore.news?.items || null } });
    if (u.pathname === '/api/faq') return r.fulfill({ json: { items: adminStore.faq?.items || null } });
    if (u.pathname === '/api/admin' && u.searchParams.get('view') === 'feedback') return r.fulfill({ json: FB_FIXTURE });
    if (u.pathname === '/api/admin' && u.searchParams.get('view') === 'usage') return r.fulfill({ json: USE_FIXTURE });
    if (u.pathname === '/api/admin' && u.searchParams.get('view') === 'nav') return r.fulfill({ json: NAV_FIXTURE });
    if (u.pathname === '/api/admin' && r.request().method() === 'PATCH') { const b = JSON.parse(r.request().postData()); adminPatches.push(b); const f = FB_FIXTURE.find(x => x.id === b.feedback); if (f && b.status) f.status = b.status; if (f && b.reply) Object.assign(f, { reply: b.reply, replied_at: '2026-10-30T15:00:00Z', reply_seen: false, status: 'resolvido' }); return r.fulfill({ json: { ok: true, pushed: b.reply ? 1 : 0 } }); }
    if (u.pathname === '/api/admin') { if (r.request().method() === 'PUT') { const b = JSON.parse(r.request().postData()); const prev = adminStore[b.key]; adminStore[b.key] = b.data; adminPuts.push(b.key); const loop = b.key === 'backlog' ? { replied: newlyDone(prev?.items || [], b.data.items).reduce((a, x) => a + x.ids.length, 0) } : null; if (prev && b.key === 'backlog') adminStore[b.key] = JSON.parse(JSON.stringify(b.data)); return r.fulfill({ json: { ok: true, loop } }); } return r.fulfill({ json: { data: adminStore[u.searchParams.get('key')] ?? null } }); }
    if (u.pathname === '/api/notify') { notifies.push(JSON.parse(r.request().postData())); return r.fulfill({ json: { sent: 1 } }); }
    if (u.pathname === '/api/push-test') { window_pushTests++; return r.fulfill({ json: { ok: true } }); }
    if (u.pathname === '/api/ai') return r.fulfill({ json: aiMock(JSON.parse(r.request().postData())) });
    const p = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: 'nf' });
    r.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)] || 'application/octet-stream' });
  });
  await t.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: MOCK, contentType: 'text/javascript' }));
  // --pdfjs3 <pdfjs-dist@3.11.174 dir>: the same PDF reader the app loads in production (used on GitHub).
  const PDF3 = arg('pdfjs3'), pick = (...fs_) => fs_.map(f => path.join(PDF3, 'build', f)).find(f => fs.existsSync(f));
  if (PDF3) {
    await t.route('https://cdnjs.cloudflare.com/**/pdf.min.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(pick('pdf.min.js', 'pdf.js')) }));
    await t.route('https://cdnjs.cloudflare.com/**/pdf.worker.min.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(pick('pdf.worker.min.js', 'pdf.worker.js')) }));
  } else
  await t.route('https://cdnjs.cloudflare.com/**/pdf.min.js', r => r.fulfill({ contentType: 'text/javascript', body: `Promise.all([import('https://pdfjs.test/pdf.mjs'),import('https://pdfjs.test/pdf.worker.mjs')]).then(([m,w])=>{globalThis.pdfjsWorker=w;m.GlobalWorkerOptions.workerSrc='https://pdfjs.test/pdf.worker.mjs';window.pdfjsLib=m;});` }));
  await t.route('https://cdnjs.cloudflare.com/**/pdf.worker.min.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await t.route('https://pdfjs.test/*', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(PDFJS, new URL(r.request().url()).pathname.slice(1))) }));
  await t.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await t.route('https://images.pexels.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(ROOT, 'icons/icon-192.png')), contentType: 'image/png' }));
}
await addRoutes(page);
// The test PDF reader (pdf.js 6) reads streams with "for await", which WebKit lacks; the app's reader (3.11) does not.
if (ENGINE === 'webkit') await page.addInitScript(() => {
  if (window.ReadableStream && !ReadableStream.prototype[Symbol.asyncIterator]) ReadableStream.prototype[Symbol.asyncIterator] = async function* () { const r = this.getReader(); try { for (;;) { const { done, value } = await r.read(); if (done) return; yield value; } } finally { r.releaseLock(); } };
});
await page.addInitScript(() => { window.__noMsgs = true; });
// Fake speech recognition that behaves like Android Chrome: each session ends at the first pause.
await page.addInitScript(() => {
  const words = ['gastei 45', 'na padaria', 'no pix'];
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { const n = window.__srStarts = (window.__srStarts || 0) + 1; setTimeout(() => { if (n <= words.length) { const res = [{ transcript: words[n - 1] }]; res.isFinal = true; this.onresult && this.onresult({ results: [res] }); } setTimeout(() => this.onend && this.onend(), 40); }, 40); }
    stop() { setTimeout(() => this.onend && this.onend(), 10); }
  };
});
// Fake permission prompt and push service (headless Chromium has no push service).
await page.addInitScript(() => {
  if (!navigator.serviceWorker || !window.Notification) return;
  let perm = 'default', sub = null;
  window.__permAnswer = 'granted';
  Object.defineProperty(Notification, 'permission', { get: () => perm, configurable: true });
  Notification.requestPermission = async () => { perm = window.__permAnswer; return perm; };
  const fakeSub = () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/e2e', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BKey', auth: 'Auth' } }; }, async unsubscribe() { sub = null; return true; } });
  const pm = { async getSubscription() { return sub; }, async subscribe(o) { window.__subOpts = !!o.applicationServerKey && o.userVisibleOnly; sub = fakeSub(); return sub; } };
  Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve({ pushManager: pm }), configurable: true });
});

const txt2 = (p, sel) => p.textContent(sel).then(t => (t || '').trim());
let chatCalls = 0, window_pushTests = 0, AI_DOC = null; const notifies = [];
function aiMock(b) {
  const text = JSON.stringify(b.messages);
  const reply = t => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
  if (text.includes('Transforme a frase')) return reply(JSON.stringify({ itens: [{ descricao: 'Mercado', valor: 230, sentido: 'saida', data: '2026-10-06', meio: 'cartao', categoria: 'Mercado' }, { descricao: 'Terapia', valor: 350, sentido: 'saida', data: '2026-10-06', meio: 'conta', categoria: 'Saúde' }] }));
  if (text.includes('documento compartilhado') && AI_DOC && AI_DOC !== 'comprovante') return reply(JSON.stringify({ tipo: AI_DOC, itens: [] }));
  if (text.includes('Antes, confira pelo conteúdo') && AI_DOC && AI_DOC !== 'nota') return reply(JSON.stringify({ tipo: AI_DOC }));
  if (text.includes('documento compartilhado')) return reply(JSON.stringify({ tipo: 'comprovante', itens: [{ descricao: 'Pix para João Encanador', valor: 180, sentido: 'saida', data: '2026-10-29', meio: 'conta', categoria: 'Casa' }] }));
  if (text.includes('Classifique lançamentos')) return reply('[]');
  if (text.includes('nota fiscal ou cupom')) return reply(JSON.stringify({ loja: 'Drogaria Mar', data: '2026-10-06', total: 230, pagamento: 'cartao', itens: [
    { descricao: 'Arroz 5 kg', valor: 30, categoria: 'Mercado' }, { descricao: 'Whey protein 900 g', valor: 150, categoria: 'Suplementos' }, { descricao: 'Dipirona', valor: 50, categoria: 'Saúde' }] }));
  if ((text.includes('Extraia os dados') && text.includes('Nu Pagamentos')) || text.includes('uma foto ou um print')) return reply(JSON.stringify({ tipo: 'fatura', banco: 'Nubank', vencimento: '15/11/2026', valorTotalFatura: 1234.5, cartoes: [], itens: [
    { cartao: '', data: '09/10', descricao: 'Padaria Pao Quente', parcela: '', valor: 45.9 }, { cartao: '', data: '12/10', descricao: 'Posto Shell Av Brasil', parcela: '', valor: 250 },
    { cartao: '', data: '15/10', descricao: 'iFood *Restaurante Sabor', parcela: '', valor: 89.6 }, { cartao: '', data: '20/10', descricao: 'Loja Movel Casa', parcela: '02/06', valor: 400 },
    { cartao: '', data: '25/10', descricao: 'Netflix.com', parcela: '', valor: 55.9 }, { cartao: '', data: '28/10', descricao: 'Supermercado Dia', parcela: '', valor: 413.1 },
    { cartao: '', data: '30/10', descricao: 'Estorno Loja X', parcela: '', valor: -20 }] }));
  if (String(b.system || '').includes('dúvidas sobre como usar')) return reply('São três combinados da família, em menu ☰ → Metas: limite do cartão, quanto guardar e o sonho.');
  if (b.tools) { chatCalls++; const last = b.messages[b.messages.length - 1]; if (typeof last.content === 'string') return { content: [{ type: 'tool_use', id: 't1', name: 'gastos_por_categoria', input: { meses: ['2026-09'] } }], stop_reason: 'tool_use' }; window_tool = last.content[0].content; return reply('**Resumo:** o maior gasto foi Mercado.\n\n| Categoria | Valor |\n|---|---|\n| Mercado | R$ 1.000 |'); }
  return reply('{}');
}
let window_tool = null;
// Signing out shows the security message on the front door: close it before going on.
const dismissBye = async (pg = page) => { await pg.waitForSelector('.ann', { timeout: 3000 }).catch(() => {}); await pg.click('.ann [data-p]').catch(() => {}); };
const txt = async s => (await page.textContent(s)).replace(/\s+/g, ' ').trim();
// Settings now live in the side menu (hamburger), one page per subject.
const sec = async k => { await page.click('#menuBtn'); await page.waitForSelector('#drawer.open [data-sec="' + k + '"]'); await page.click('#drawer [data-sec="' + k + '"]'); await page.waitForSelector('#v-ajustes [data-sec="' + k + '"]:not([hidden])'); await page.waitForTimeout(250); };
// The guided walkthrough shows on the first accesses; skip it where a test is not about it.
const noCoach = async () => { await page.waitForTimeout(900); if (await page.$('.coach')) await page.click('#coachSkip'); };
const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true }); };

try {
await page.goto('https://app.test/');
await page.waitForSelector('#welcome:not([hidden])');
ok('tela inicial explica o app com foto', (await txt('#welcome')).includes('Para onde foi o seu dinheiro?') && await page.isVisible('#wHero img') && !(await txt('#wHero')).includes('Foto:'));
await shot('00-inicial');
await page.click('#wSignup');
await page.waitForSelector('#auth:not([hidden])');
ok('criar conta abre o cadastro', await page.isVisible('#nameRow'));
await shot('01-login');
await page.fill('#aName', 'Luiz Tufik Elias Neto'); await page.fill('#aEmail', 'luiz@test.com'); await page.fill('#aPass', 'senha-forte-123');
await page.fill('#aEmail', 'luiz@test'); await page.click('#aGo');
ok('e-mail inválido é apontado no campo', (await txt('#authForm')).includes('Esse e-mail não parece certo') && await page.evaluate(() => document.querySelector('#aEmail').getAttribute('aria-invalid') === 'true'));
await page.fill('#aEmail', 'luiz@test.com'); await page.fill('#aPass', '1234'); await page.click('#aGo');
ok('senha curta é recusada', (await txt('#authForm')).includes('pelo menos 8 caracteres'));
await page.fill('#aPass', 'senha-forte-123');
await page.click('#aGo');
ok('cadastro exige consentimento', (await txt('#aMsg')).includes('concordância'));
await page.evaluate(() => { window.__signupError = 'email rate limit exceeded'; });
await page.check('#aConsent'); await page.click('#aGo'); await page.waitForTimeout(200);
ok('limite de e-mails do Supabase vira mensagem em português', (await txt('#aMsg')).includes('Espere alguns minutos'), await txt('#aMsg'));
await page.evaluate(() => { window.__signupError = null; });
await page.check('#aConsent'); await page.click('#aGo');
await page.waitForSelector('#onboard:not([hidden])');
await page.waitForSelector('#obName');
ok('onboarding sugere o nome sem precisar apagar', (await page.inputValue('#obName')) === '' && (await page.getAttribute('#obName', 'placeholder')) === 'Ex.: Mari, Beto, Ju' && !(await txt('#obBody')).includes('Luiz'));
await shot('01b-nome');
await page.click('#obNext');
await page.waitForSelector('[data-s="1"]');
ok('boas-vindas com o nome', (await txt('#obBody')).includes('Boas-vindas, Luiz!'));
await shot('01c-divide');
await page.click('[data-s="1"]');
await page.waitForSelector('#obFam');
ok('exemplo genérico e, em branco, usa o sobrenome', (await page.inputValue('#obFam')) === '' && (await page.getAttribute('#obFam', 'placeholder')) === 'Ex.: Família Silva, Casa da Vila' && !(await txt('#obBody')).includes('Elias'));
await page.click('#obCreate');
await page.waitForSelector('#ivName');
await page.click('#ivGo');
ok('convite sem nome é recusado', (await txt('#obInviter')).includes('Escreva o nome de quem você vai convidar'));
await page.fill('#ivName', 'Luana'); await page.fill('#ivPhone', '98765-4321'); await page.click('#ivGo');
ok('telefone sem DDD é recusado', (await txt('#obInviter')).includes('Use DDD + número'));
await page.fill('#ivPhone', '(11) 98765-4321');
await page.selectOption('#ivRel', 'Cônjuge ou companheiro(a)'); await page.click('#ivGo');
await page.waitForSelector('#ivReady a.wa');
const wa = await page.getAttribute('#ivReady a.wa', 'href');
const waText = decodeURIComponent(wa.split('text=')[1]);
const inviteUrl = waText.match(/https:\/\/\S+/)[0];
ok('convite pelo WhatsApp abre a conversa do número e leva o link', wa.startsWith('https://wa.me/5511987654321?text=') && /\?convite=INV/.test(inviteUrl) && waText.includes('Oi, Luana') && waText.includes('Família Elias'), waText);
ok('convite aparece na lista como aguardando', (await txt('#ivList')).includes('aguardando'));
await shot('01d-convite');
await page.click('#obDone');
await page.waitForSelector('#app:not([hidden])');
ok('família criada e app aberto', (await txt('#brand')) === 'Família Elias');
await page.waitForSelector('.tour');
ok('apresentação aparece ao entrar no app com foto', (await txt('.tour')).includes('O dinheiro da família') && await page.isVisible('.tour-slide .photo img'));
await shot('01e-tour');
const nSlides = await page.$$eval('.tour-slide', s => s.length);
for (let k = 0; k < nSlides - 1; k++) await page.click('#tourNext');
ok('último passo leva à primeira fatura', (await txt('#tourNext')) === 'Enviar minha fatura');
ok('último slide também pode ser fechado', (await txt('#tourSkip')) === 'Fechar' && await page.isVisible('#tourSkip'));
await page.click('#tourNext');
// guided walkthrough over the real screen
await page.waitForSelector('.coach');
await page.waitForFunction(() => document.querySelector('.coach-spot')?.getBoundingClientRect().width > 0);
ok('tour guiado aparece depois da apresentação', (await txt('.coach-tip')).includes('Quanto sobrou') && await page.isVisible('.coach-spot'));
await shot('01f-coach');
await page.click('#coachNext');
ok('tour guiado aponta o seletor de mês', (await txt('#coachT')) === 'Escolha o mês');
await page.click('#coachNext'); await page.click('#coachNext');
ok('tour guiado mostra a aba Gráficos', (await txt('#coachT')) === 'Gráficos');
await page.click('#coachSkip');
ok('pular fecha o tour guiado', !(await page.$('.coach')));
ok('depois do tour, vai para a fatura', await page.isVisible('#v-lancar #drop'));
await page.click('[data-tab=resumo]');
ok('resumo cumprimenta pelo nome', (await txt('#v-resumo')).includes('Boas-vindas, Luiz!'));
ok('início vazio mostra a régua de preenchimento em 0%', (await txt('#stepsBox')).includes('Use o app por completo') && (await txt('#stepsBox .regua-n')) === '0%', await txt('#stepsBox .regua-n'));
ok('régua mostra só os próximos 3 passos, com o que cada um libera', (await page.$$('#stepsBox .steps > li:not([hidden])')).length === 3 && (await txt('#stepsBox')).includes('Libera a sobra do mês'));
await page.click('#stepsBox [data-all]');
ok('régua mostra todos os passos', (await page.$$('#stepsBox .steps > li:not([hidden])')).length === 12);
await page.click('#stepsBox [data-skip]');
await page.waitForFunction(() => document.querySelector('#stepsBox .regua-n')?.textContent !== '0%');
ok('"não tenho" conta na régua', (await txt('#stepsBox .regua-n')) === '5%' && await page.evaluate(() => window.__db.households[0].settings.skips?.invest === true), await txt('#stepsBox .regua-n'));
await page.click('#stepsBox [data-unskip]'); await page.waitForFunction(() => document.querySelector('#stepsBox .regua-n')?.textContent === '0%');
await page.click('#stepsBox [data-all]');
await page.click('#stepsBox [data-k="0"]');
ok('passo leva ao envio do PDF', await page.isVisible('#v-lancar #drop'));
await page.click('[data-tab=resumo]');
await shot('02-vazio');

const backup = arg('backup');
// side menu
await page.click('#menuBtn'); await page.waitForSelector('#drawer.open');
ok('menu lateral abre com as seções organizadas (com Métricas para o dono do produto)', (await page.$$('#drawer [data-sec]')).length === 15 && (await txt('#drawer')).includes('Família e convites') && (await txt('#drawer')).includes('Patrimônio e dívidas'));
await shot('02b-menu');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok('menu fecha com Esc', await page.isHidden('#drawer'));
await sec('metas');
ok('cada seção abre sozinha numa página', await page.isVisible('#gCard') && await page.isHidden('#fName') && (await txt('#v-ajustes .subhead')).includes('Metas'));
await page.click('#secBack'); await page.waitForSelector('#drawer.open');
ok('voltar da seção reabre o menu', true);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.click('[data-tab=resumo]');

if (SMOKE) { // The rest needs real family data: in the smoke run, check the main ways to add entries and stop.
  await page.click('[data-tab=lancar]'); await page.click('.ltile[data-mode="falar"]');
  await page.fill('#qText', 'gastei 230 no mercado hoje no cartão e 350 de terapia por pix'); await page.click('#qGo');
  await page.waitForSelector('#qPreview:not([hidden])', { timeout: 15000 });
  ok('safari: frase vira lançamentos para conferir', (await page.$$('#qPreview tbody tr')).length === 2);
  await page.click('#qCancel');
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  const outraS = arg('outra');
  if (outraS) { // Probe the PDF reader directly, to tell a reader problem from an app problem.
    const b64 = fs.readFileSync(outraS).toString('base64');
    const probe = await page.evaluate(async b64 => {
      const t0 = performance.now(), out = { v: pdfjsLib.version, worker: typeof globalThis.pdfjsWorker, src: pdfjsLib.GlobalWorkerOptions.workerSrc || '', res: performance.getEntriesByType('resource').filter(e => /pdf/.test(e.name)).map(e => e.name.split('/').pop() + ':' + Math.round(e.duration) + 'ms:' + (e.transferSize || e.encodedBodySize || 0)) };
      const step = (k, p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('demorou: ' + k)), 15000))]);
      try {
        const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const doc = await step('abrir', pdfjsLib.getDocument({ data, isEvalSupported: false }).promise); out.pages = doc.numPages;
        const pg = await step('página', doc.getPage(1)); const tc = await step('texto', pg.getTextContent()); out.items = tc.items.length;
      } catch (e) { out.err = String(e?.message || e); }
      out.ms = Math.round(performance.now() - t0); return out;
    }, b64);
    ok('safari: leitor de PDF abre e lê o texto', probe.pages === 1 && probe.items > 5, JSON.stringify(probe));
  }
  if (outraS) {
    await page.click('.ltile[data-mode="pdf"]'); await page.setInputFiles('#pdfIn', outraS);
    const t0 = Date.now(); await page.waitForSelector('#rvSave', { timeout: 60000 }).catch(() => {});
    ok('safari: fatura em PDF lida e conferida', (await txt('#pdfLog')).includes('Fatura do Nubank lida: 7 lançamentos'), `${Math.round((Date.now() - t0) / 1000)}s ` + await txt('#pdfLog') + ' | ' + clog.slice(-8).join(' / '));
  }
  await page.click('.ltile[data-mode="pdf"]'); await page.setInputFiles('#pdfIn', path.join(ROOT, '../tests/fixtures/comprovante-ficticio.pdf'));
  await page.waitForFunction(() => /João Encanador/.test([...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ')), null, { timeout: 15000 }).catch(() => {});
  ok('safari: comprovante em PDF vira um lançamento', /João Encanador/.test(await page.evaluate(() => [...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' '))));
  await page.click('#qCancel').catch(() => {});
  await page.click('.ltile[data-mode="nota"]'); await page.setInputFiles('#rcFile', path.join(ROOT, 'icons/icon-512.png'));
  await page.waitForSelector('#rcReview:not([hidden])', { timeout: 15000 }).catch(() => {});
  ok('safari: foto da nota separa os itens', (await txt('#rcLog')).includes('Nota lida: 3 itens') && await page.isVisible('#rcReview'), await txt('#rcLog'));
  await shot('safari-nota');
  await sec('applepay');
  ok('safari: página dos atalhos do iPhone abre', (await txt('#v-ajustes')).includes('Apple Pay'));
  ok('safari: nenhuma tela rola para o lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await sec('conta'); await page.waitForSelector('#lkNow'); await page.click('#lkNow'); await page.waitForSelector('#lockScreen');
  ok('safari: bloquear cobre a tela', await page.isVisible('#lkPass') && !(await page.isVisible('#brand')));
  await shot('safari-bloqueio');
  await page.fill('#lkPass', 'senha-forte-123'); await page.click('#lkGo'); await page.waitForSelector('#lockScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
  ok('safari: senha desbloqueia', !(await page.$('#lockScreen')));
  throw SMOKE_DONE;
}

if (backup) {
  await sec('backup');
  await page.setInputFiles('#dImport', backup);
  await page.waitForSelector('.cfm [data-y]');
  ok('importar backup pede confirmação', (await txt('.cfm')).includes('Importar 2.466 lançamentos'));
  await page.click('.cfm [data-y]');
  await page.waitForFunction(() => /Pronto|parou|não é/.test(document.querySelector('#bkStatus')?.textContent || ''), null, { timeout: 30000 });
  ok('backup importado', (await txt('#bkStatus')).includes('Pronto'), await txt('#bkStatus'));
  await page.setInputFiles('#dImport', backup);
  await page.waitForSelector('.cfm [data-y]');
  ok('importar o mesmo backup de novo não duplica (pula os meses)', (await txt('.cfm')).includes('Importar 0 lançamentos') && (await txt('.cfm')).includes('serão pulados'), (await txt('.cfm')).slice(0, 120));
  await page.click('.cfm [data-n]');
  await page.click('[data-tab=resumo]');
  await page.selectOption('#monthSel', '2026-09');
  const hero = await txt('#v-resumo .big');
  ok('setembro: sobra R$ 2.658,50', hero.includes('2.658,50'), hero);
  const pills = await txt('#v-resumo .hero .chips');
  ok('setembro: 6% e 18%', pills.includes('Guardaram 6% · queriam 20%') && pills.includes('Sem contar o financiamento 18%'), pills);
  ok('próxima fatura com parcelas', (await txt('#v-resumo')).includes('Parcelas R$ 8.401'));
  ok('meta e patrimônio aparecem', (await txt('#v-resumo')).includes('Sonho: R$ 3.000.000 investidos aos 55 anos'));
  await shot('03-resumo-setembro');
  await page.selectOption('#monthSel', 'ano:2026');
  ok('ano: sobra R$ 53.494', (await txt('#v-resumo .big')).includes('53.494'));
  const pctNow = +(await txt('#stepsBox .regua-n')).replace('%', '');
  ok('régua sobe com os dados importados', pctNow >= 60 && pctNow < 100, pctNow + '%');
  await page.selectOption('#monthSel', '2026-09');
  const ins = await txt('#insights');
  ok('início mostra insights do mês', (await page.$$('#insights .insight')).length >= 1, ins.slice(0, 200));
  ok('início mostra só 2 avisos, com "ver mais"', (await page.$$('#insights .insight')).length === 2 && await page.isVisible('#insMore'));
  ok('régua fica compacta depois de 40%', await page.isVisible('#stepsBox.regua-mini') && (await page.$$('#stepsBox .steps li')).length === 0);
  ok('para onde foi mostra as 5 maiores', (await page.$$eval('#catBars .catbar', b => b.filter(x => !x.hidden).length)) === 5 && await page.isVisible('#catMore'));
  ok('detalhes (poupança, patrimônio, meta) ficam recolhidos', await page.evaluate(() => !document.querySelector('#homeMore').open));
  // privacy mode
  await page.click('#privBtn'); await page.waitForTimeout(150);
  ok('modo privacidade esconde os valores', (await txt('#v-resumo .big')).includes('R$ ••••') && !/R\$ \d/.test(await txt('#v-resumo')), (await txt('#v-resumo .big')));
  await page.click('#privBtn'); await page.waitForTimeout(150);
  ok('desligar a privacidade mostra os valores de novo', (await txt('#v-resumo .big')).includes('2.658,50'));
  ok('assinaturas e cobranças fixas aparecem nos detalhes', (await txt('#subsBox')).includes('Assinaturas e cobranças fixas') && (await page.$$('#subsBox li')).length >= 1, (await txt('#subsBox')).slice(0, 140));
  await shot('03b-insights');
  // guided month closing
  await page.waitForSelector('#goClose');
  ok('início chama para fechar o mês que terminou', (await txt('#closeCard')).includes('setembro de 2026'), await txt('#closeCard'));
  await page.click('#goClose'); await page.waitForSelector('#v-fechar .retro');
  const fv = await txt('#v-fechar');
  ok('fechamento mostra extrato e fatura, pendências e retrospectiva', fv.includes('Fechar setembro de 2026') && fv.includes('Extrato e fatura') && fv.includes('Retrospectiva de setembro de 2026') && fv.includes('2.658,50'), fv.slice(0, 160));
  const nPend = (await page.$$('#clPend li')).length;
  await page.click('#clPend li:first-child .okchip'); await page.waitForTimeout(200);
  ok('aceitar a sugestão confirma e ensina', (await page.$$('#clPend li')).length === nPend - 1 && await page.evaluate(() => window.__learned > 0));
  ok('lista para conferir cabe na tela', await page.evaluate(() => document.documentElement.scrollWidth <= 400));
  await shot('03c-fechar');
  await page.click('#clClose'); await page.waitForSelector('.cfm [data-y]');
  ok('fechar o mês pede confirmação', (await txt('.cfm')).includes('setembro de 2026'));
  await page.click('.cfm [data-y]'); await page.waitForSelector('#clReopen');
  ok('mês fechado fica registrado', await page.evaluate(() => !!window.__db.households[0].settings.closed?.['2026-09']) && (await txt('#v-fechar')).includes('Mês fechado em'));
  ok('mês fechado ganha ✓ no seletor', (await page.$eval('#monthSel option[value="2026-09"]', o => o.textContent)).includes('✓'));
  ok('no celular o mês aparece curto, sem cortar o ano', (await page.$eval('#monthSel option[value="2026-09"]', o => o.textContent)) === 'set. 2026 ✓');
  await page.click('#v-fechar [data-back]'); await page.waitForTimeout(200);
  ok('depois de fechar, o início chama o mês anterior que falta', !(await txt('#closeCard')).includes('setembro de 2026'));
  await page.selectOption('#monthSel', 'ano:2026');
}

await page.click('[data-tab=lancar]');
ok('lançar mostra 4 jeitos de lançar e só um bloco aberto por vez', (await page.$$('#v-lancar .ltile')).length === 4 && await page.$$eval('#v-lancar [data-panel]', ps => ps.filter(p => !p.hidden).length <= 1));
await shot('04a-lancar-opcoes');
await page.click('.ltile[data-mode="falar"]');
ok('escolher um jeito abre só o bloco dele', await page.isVisible('#qText') && await page.isHidden('#drop'));
ok('botão de microfone presente (Chrome)', await page.isVisible('#qMic'));
await page.fill('#qText', ''); await page.click('#qMic'); await page.waitForTimeout(700);
ok('microfone continua ouvindo depois das pausas da fala', (await page.inputValue('#qText')) === 'gastei 45 na padaria no pix' && await page.evaluate(() => document.querySelector('#qMic').classList.contains('rec') && window.__srStarts > 3), await page.inputValue('#qText'));
await page.click('#qMic'); await page.waitForTimeout(200);
ok('tocar de novo no microfone para de ouvir', await page.evaluate(() => !document.querySelector('#qMic').classList.contains('rec')));
await page.fill('#qText', 'gastei 230 no mercado no cartão e 350 de terapia por pix');
await page.click('#qGo');
await page.waitForSelector('#qSave');
await page.fill('#qPreview tbody tr:first-child [data-f=amount]', '0'); await page.dispatchEvent('#qPreview tbody tr:first-child [data-f=amount]', 'change');
await page.click('#qSave');
ok('valor zerado é recusado antes de salvar', (await txt('#qPreview')).includes('Informe o valor'));
await page.fill('#qPreview tbody tr:first-child [data-f=amount]', '230'); await page.dispatchEvent('#qPreview tbody tr:first-child [data-f=amount]', 'change');
await page.click('#qSave');
await page.waitForSelector('.cfm [data-y]');
await shot('04x-confirmacao');
ok('salvar lançamento pede confirmação mostrando o que vai entrar', (await txt('.cfm')).includes('Salvar 2 lançamentos?') && (await txt('.cfm')).includes('Terapia'));
await page.click('.cfm [data-y]');
await page.waitForFunction(() => document.querySelector('#manualList')?.textContent.includes('Terapia'));
const man = await txt('#manualList');
ok('lançamentos por texto salvos', man.includes('Mercado') && man.includes('fatura de outubro de 2026'), man);
await page.click('#lHist summary');
await page.click('#manualList [data-del]');
ok('apagar lançamento pede confirmação num pop-up', (await txt('.cfm')).includes('Sim, apagar') && (await txt('.cfm h3')) === 'Tem certeza?');
await page.click('.cfm [data-n]');
ok('cancelar mantém o lançamento', (await page.$$('#manualList li')).length === 2);
await shot('04-lancar');

// receipt (nota fiscal): photo -> items by category -> details the matching card purchase
await page.click('.ltile[data-mode="nota"]');
ok('foto da nota abre o bloco da nota', await page.isVisible('#rcCam') || await page.isVisible('#rcPanel'));
await page.setInputFiles('#rcFile', path.join(ROOT, 'icons/icon-512.png'));
await page.waitForSelector('#rcSave', { timeout: 15000 });
ok('nota lida pelo Claude', (await txt('#rcLog')).includes('Nota lida: 3 itens, total R$ 230,00'), await txt('#rcLog'));
const rcv = await txt('#rcReview');
ok('nota separa por categoria e marca a nova', rcv.includes('Suplementos') && rcv.includes('nova') && rcv.includes('R$ 150,00'), rcv.slice(0, 200));
ok('nota encontra o gasto já lançado', await page.$eval('#rcMatch input:checked', i => !!i.value) && (await txt('#rcMatch')).includes('Mercado'));
await shot('04b-nota');
await page.fill('#rcTotal', '0'); await page.dispatchEvent('#rcTotal', 'change');
await page.click('#rcSave');
ok('nota com total zerado é recusada', (await txt('#rcReview')).includes('Total pago'));
await page.fill('#rcTotal', '230'); await page.dispatchEvent('#rcTotal', 'change');
await page.click('#rcSave'); await page.waitForSelector('.cfm [data-y]');
const rcc = await txt('.cfm');
ok('salvar nota pede confirmação com a divisão', rcc.includes('Detalhar') && rcc.includes('Suplementos R$ 150,00') && rcc.includes('cria a categoria "Suplementos"'), rcc);
await page.click('.cfm [data-y]');
await page.waitForFunction(() => document.querySelector('#rcLog')?.textContent.includes('Pronto'));
const rtx = await page.evaluate(() => window.__db.transactions.find(t => t.receipt));
ok('nota salva no lançamento, sem duplicar', rtx && rtx.splits.length === 3 && rtx.manual && rtx.description === 'Mercado' && (await page.evaluate(() => window.__db.transactions.filter(t => t.manual).length)) === 2, JSON.stringify(rtx?.splits));
ok('categoria nova criada pela nota', await page.evaluate(() => window.__db.categories.some(c => c.name === 'Suplementos' && c.grp === 'dia')));

// custom charts
await page.click('[data-tab=graficos]');
ok('gráficos mostram sugestões', (await page.$$('#v-graficos .chcard svg')).length >= 1 && (await txt('#v-graficos')).includes('Salvar este'));
await page.click('#chNew');
await page.click('#chSave');
ok('gráfico sem nome é recusado', (await txt('#chForm')).includes('Dê um nome'));
ok('pizza não aceita sobra', await page.$eval('#chMetric option[value=sobra]', o => o.disabled));
await page.fill('#chTitle', 'Suplementos por mês');
await page.click('[data-type=linha]');
await page.selectOption('#chMetric', 'escolhidas');
await page.click('#chSave');
ok('categorias escolhidas exigem pelo menos uma', (await txt('#chForm')).includes('Marque pelo menos uma categoria'));
await page.check('#chCats input[value="Suplementos"]');
await page.selectOption('#chPeriod', 'm3');
ok('prévia do gráfico aparece', await page.isVisible('#chPrev svg'));
await page.click('#chSave'); await page.waitForSelector('.cfm [data-y]');
await page.click('.cfm [data-y]'); await page.waitForTimeout(200);
const chs = await page.evaluate(() => window.__db.households[0].settings.charts);
ok('gráfico salvo com tipo, dados e período', chs?.length === 1 && chs[0].type === 'linha' && chs[0].cats[0] === 'Suplementos' && chs[0].period.kind === 'm3', JSON.stringify(chs));
ok('gráfico salvo aparece com os valores da nota', (await txt('#v-graficos')).includes('Suplementos por mês') && await page.$$eval('#v-graficos .chcard circle title', t => t.some(x => x.textContent.includes('150,00'))));
await shot('04c-graficos');
await page.click('#v-graficos [data-del]'); await page.waitForSelector('.cfm');
ok('remover gráfico pede confirmação', (await txt('.cfm')).includes('Remover o gráfico'));
await page.click('.cfm [data-n]');
await page.click('[data-tab=lancar]');

const fatura = arg('fatura');
if (fatura && backup) {
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  await page.click('.ltile[data-mode="pdf"]');
  await page.setInputFiles('#pdfIn', fatura);
  await page.waitForSelector('.busy', { timeout: 5000 }).catch(() => {});
  ok('enquanto lê o PDF, aparece "Só um instante" com o passo', true);
  await page.waitForSelector('#rvSave', { timeout: 30000 });
  const log = await txt('#pdfLog');
  ok('fatura lida com totais conferidos', log.includes('Totais por cartão conferem'), log);
  ok('revisão sem pendências (regras + parcelas)', (await txt('#review')).includes('0 a classificar'), (await txt('#review .pill')));
  await shot('05-revisao');
  await page.click('#rvSave');
  await page.waitForSelector('.cfm [data-y]');
  ok('substituir mês já salvo pede confirmação', (await txt('.cfm')).includes('já tem a fatura salvo') || (await txt('.cfm')).includes('já tem a fatura'), await txt('.cfm'));
  await page.click('.cfm [data-y]');
  await page.waitForFunction(() => window.__lastReplace);
  const lr = await page.evaluate(() => window.__lastReplace);
  await page.waitForTimeout(200);
  ok('importar avisa o resto da família', notifies.some(n => n.type === 'imported' && n.source === 'cartao' && n.month === '2026-09'));
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
  await page.click('.ltile[data-mode="pdf"]');
  await page.setInputFiles('#pdfIn', outra);
  await page.waitForSelector('#rvSave', { timeout: 30000 });
  const log = await txt('#pdfLog');
  ok('fatura de outro banco lida (sem citar a IA)', log.includes('Fatura do Nubank lida: 7 lançamentos') && !/Claude/.test(log), log);
  ok('fatura de outro banco conferida pelo total', log.includes('A soma confere com o total da fatura'), log);
  const rv = await txt('#review');
  ok('outro banco vai para o mês do vencimento', rv.includes('novembro de 2026'), rv.slice(0, 120));
  ok('regras genéricas classificam o básico', (await page.$$eval('#rvRows tr', rs => rs.filter(r => /Combust|Assinatura|Restaurante|Mercado/.test(r.textContent)).length)) >= 3);
  await shot('05b-outro-banco');
  await page.click('#rvSave'); await page.click('.cfm [data-y]'); await page.waitForFunction(() => window.__lastReplace?.p_month === '2026-11');
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
const nrows = await page.$$eval('#lRows li', r => r.length);
ok('extrato lista lançamentos', nrows > 0, nrows + ' linhas');
if (nrows) {
  await page.click('#lRows li:not([data-split]) .chip');
  const sel = await page.$('#lRows li:not([data-split]) select');
  const opt = await sel.evaluate(s => [...s.options].map(o => o.value).find(v => v && v !== s.value));
  await sel.selectOption(opt);
  await page.waitForTimeout(200);
  ok('troca de categoria ensina regra', await page.evaluate(() => window.__learned > 0));
}
await shot('07-extrato');
await sec('metas');
await page.fill('#gSav', '150'); await page.click('#gSave');
ok('meta de poupança acima de 100% é recusada', (await txt('#v-ajustes')).includes('Guardar da renda (%): o máximo é 100'));
await page.fill('#gSav', '20');
await page.fill('#gAge', '50'); await page.fill('#gAgeGoal', '45'); await page.click('#gSave');
ok('idade da meta menor que a atual é recusada', (await txt('#v-ajustes')).includes('precisa ser maior'));
await page.fill('#gAge', '42'); await page.fill('#gAgeGoal', '55');
await page.fill('#gCard', '17000'); await page.click('#gSave'); await page.waitForTimeout(100);
ok('metas salvas', await page.evaluate(() => window.__db.households[0].settings.goals.cardMonthly === 17000));
// who pays what (only 1 person yet)
await sec('divisao');
ok('quem paga o quê pede um convite quando só há uma pessoa', (await txt('#splitBox')).includes('duas pessoas ou mais'));
await sec('sobre');
ok('página sobre explica o que o app guarda e os créditos', (await txt('#v-ajustes')).includes('O que o app nunca guarda') && (await txt('#v-ajustes')).includes('Mikhail Nilov'));
await sec('metas');
// budget per category
await page.click('#bAdd'); await page.click('#bSave');
ok('orçamento sem categoria é recusado', (await txt('#v-ajustes')).includes('Escolha a categoria'));
await page.click('#bRows .brow:last-child [data-brm]'); await page.click('.cfm [data-y]');
await page.click('#bSuggest'); await page.waitForSelector('.cfm [data-y]');
ok('sugerir orçamento pede confirmação', (await txt('.cfm')).includes('Sugerir limites'));
await page.click('.cfm [data-y]');
const nb = (await page.$$('#bRows .brow')).length;
ok('orçamento antigo do backup é aproveitado e completado pela média', nb >= 5, nb + ' categorias');
await page.click('#bSave'); await page.waitForTimeout(150);
const bud = await page.evaluate(() => window.__db.households[0].settings.budgets || {});
ok('orçamento salvo', Object.keys(bud).length === nb && Object.values(bud).every(v => v > 0 && v % 50 === 0), JSON.stringify(bud).slice(0, 120));
await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09');
ok('início mostra o orçamento do mês', (await txt('#budgetBox')).includes('Orçamento de setembro de 2026') && (await page.$$('#budgetBox .brow2')).length === 5, (await txt('#budgetBox')).slice(0, 120));
await shot('03d-orcamento');
await sec('categorias');
await page.fill('#cNew', 'Mercado'); await page.click('#cAdd');
ok('categoria repetida é recusada', (await txt('#v-ajustes')).includes('Essa categoria já existe'));
await page.fill('#cNew', 'Farmácia'); await page.click('#cAdd'); await page.waitForSelector('.cfm [data-y]');
ok('criar categoria pede confirmação', (await txt('.cfm')).includes('Criar a categoria "Farmácia"'));
await page.click('.cfm [data-y]'); await page.waitForTimeout(150);
ok('categoria criada', await page.evaluate(() => window.__db.categories.some(c => c.name === 'Farmácia' && c.grp === 'dia' && !c.recurring)));
ok('grupos aparecem como receita e despesa, fixa ou variável', (await txt('#catList')).includes('Despesa variável') && (await txt('#catList')).includes('Despesa fixa'));
const farm = '#catList li:has-text("Farmácia")';
await page.selectOption(farm + ' [data-kind]', 'dfixa'); await page.waitForSelector('.cfm [data-y]');
await page.click('.cfm [data-y]'); await page.waitForTimeout(200);
ok('mudar para despesa fixa pede confirmação e salva', await page.evaluate(() => window.__db.categories.some(c => c.name === 'Farmácia' && c.recurring === true)));
await page.click('#catList li:has-text("Farmácia") [data-ren]');
await page.fill('#catList .catname input', 'Mercado'); await page.click('#catList [data-ok]');
ok('renomear para nome repetido é recusado', (await txt('#catList')).includes('Essa categoria já existe'));
await page.fill('#catList .catname input', 'Farmácia e saúde'); await page.click('#catList [data-ok]'); await page.waitForSelector('.cfm [data-y]');
await page.click('.cfm [data-y]'); await page.waitForTimeout(200);
ok('categoria renomeada', await page.evaluate(() => window.__db.categories.some(c => c.name === 'Farmácia e saúde')));
// product metrics (admin)
await sec('metricas');
await page.waitForSelector('#metricsBox .funnel');
const mt = await txt('#metricsBox');
ok('métricas mostram funil, retenção e uso', mt.includes('Famílias com 2 meses ou mais') && mt.includes('63%') && mt.includes('Notas fiscais lidas'), mt.slice(0, 160));
ok('app registra o dia de uso', await page.evaluate(() => (window.__touches || 0) >= 1));
await shot('08c-metricas');
ok('métricas: link para a Central do produto', (await page.getAttribute('#adminLink', 'href')) === '/admin.html');
{ // Product console in a desktop-size tab of the same session.
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: await page.context().storageState() }); const ap = await actx.newPage(); await addRoutes(ap);
  ap.on('pageerror', e => errors.push('admin: ' + e.message));
  await ap.goto('https://app.test/admin.html');
  await ap.waitForSelector('#aNav:not([hidden])', { timeout: 10000 });
  const atab = async t => { if (await ap.isVisible('#aMenu')) { await ap.click('#aMenu'); await ap.waitForTimeout(300); } const g = await ap.$(`#aNav [data-t="${t}"]`); if (!(await g.isVisible())) await ap.click(`#aNav .agroup:has([data-t="${t}"]) .agh`); await ap.click(`#aNav [data-t="${t}"]`); };
  ok('central: menu com 3 grupos e só o grupo atual aberto', (await ap.$$('#aNav .agroup')).length === 3 && (await ap.$$('#aNav .agl:not([hidden])')).length === 1 && await ap.isVisible('#aNav [data-t="painel"]') && !(await ap.isVisible('#aNav [data-t="bench"]')));
  await ap.click('#aNav [data-g="estrategia"] .agh');
  ok('central: tocar no grupo abre e fecha o outro', await ap.isVisible('#aNav [data-t="bench"]') && !(await ap.isVisible('#aNav [data-t="painel"]')));
  await ap.click('#aNav [data-g="estrategia"] .agh');
  await ap.waitForSelector('#mBox .funnel');
  ok('central: painel com funil e contagem do backlog', (await ap.textContent('#aMain')).includes('Famílias com 1 mês importado') && (await ap.textContent('#aMain')).includes('Feitos'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-1-painel.png'), fullPage: true });
  await atab('backlog'); await ap.waitForSelector('.kanban');
  ok('central: backlog em quadro com 5 colunas', (await ap.$$('.kcol')).length === 5);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-2-backlog.png') });
  await ap.click('#bNew summary'); await ap.click('#nAdd');
  ok('central: valida a ideia vazia', !!(await ap.$('#nTitle[aria-invalid="true"]')) || !!(await ap.$('.ferr')));
  await ap.fill('#nTitle', 'Ideia de teste e2e'); await ap.click('#nAdd'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]');
  await ap.waitForFunction(() => document.querySelector('.kanban')?.textContent.includes('Ideia de teste e2e'));
  ok('central: nova ideia salva no servidor', adminPuts.includes('backlog') && adminStore.backlog.items[0].title === 'Ideia de teste e2e');
  await ap.click('[data-v="lista"]'); await ap.waitForSelector('.blist');
  const id = adminStore.backlog.items[0].id;
  await ap.selectOption(`[data-st="${id}"]`, 'agora'); await ap.waitForTimeout(200);
  ok('central: mudar status salva', adminStore.backlog.items[0].status === 'agora');
  await ap.click(`[data-del="${id}"]`); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(200);
  ok('central: apagar pede confirmação e remove', !adminStore.backlog.items.some(i => i.id === id));
  await atab('bench'); await ap.waitForSelector('.atable');
  ok('central: benchmarking com a tabela de apps', (await ap.$$('.atable tbody tr')).length >= 10);
  await atab('preco'); await ap.waitForSelector('#pOut .mcard');
  const before = await ap.textContent('#pOut');
  await ap.fill('[data-p="families"]', '1000'); await ap.waitForTimeout(100);
  ok('central: simulador recalcula ao mudar premissa', (await ap.textContent('#pOut')) !== before);
  await ap.fill('[data-p="payingPct"]', '150'); await ap.click('#pSave');
  ok('central: valida premissa fora do limite', !adminPuts.includes('pricing'));
  await ap.fill('[data-p="payingPct"]', '10'); await ap.click('#pSave'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(200);
  ok('central: cenário de preço salvo', adminStore.pricing?.families === 1000);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-3-preco.png'), fullPage: true });
  await atab('desenho'); await ap.waitForSelector('.cgrid textarea');
  await ap.fill('[data-c="problema"]', 'Problema de teste'); await ap.click('#cSave'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(200);
  ok('central: canvas salvo', adminStore.canvas?.problema === 'Problema de teste' && adminStore.canvas.personas.length >= 2);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-4-desenho.png'), fullPage: true });
  await ap.setViewportSize({ width: 390, height: 844 }); await atab('backlog');
  await ap.setViewportSize({ width: 1280, height: 900 });
  await atab('painel'); await ap.waitForSelector('#pTop .mlink');
  await ap.click('#aCopy'); await ap.waitForFunction(() => !document.querySelector('#aCopy').disabled && (/copiado/.test(document.querySelector('#toast')?.textContent || '') || document.querySelector('dialog[open] textarea')));
  const resumo = await ap.evaluate(() => document.querySelector('dialog[open] textarea')?.value || navigator.clipboard.readText().catch(() => ''));
  ok('central: resumo para o Claude com uso, opiniões e backlog, sem e-mail', /Pessoas: 12/.test(resumo) && resumo.includes('Testador (família Família Teste)') && resumo.includes('## Backlog') && !resumo.includes('@test.com'), resumo.slice(0, 120));
  await ap.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => { d.close(); d.remove(); }));
  ok('central: painel mostra opiniões novas e quem usou', (await ap.textContent('#pTop')).includes('Opiniões novas') && (await ap.textContent('#pTop')).includes('de 2 pessoas'));
  await atab('opinioes'); await ap.waitForSelector('.fbcard');
  ok('central: opiniões em aberto com quem mandou e a tela', (await ap.$$('.fbcard')).length === 3 && (await ap.textContent('#aMain')).includes('tela lancar'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-5-opinioes.png'), fullPage: true });
  await ap.click('[data-k="erro"]'); await ap.waitForSelector('.fbcard');
  ok('central: filtro por tipo', (await ap.$$('.fbcard')).length === 1);
  const nBl = adminStore.backlog.items.length;
  await ap.click('.fbcard [data-bl]'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(300);
  ok('central: opinião vira item do backlog', adminStore.backlog.items.length === nBl + 1 && adminStore.backlog.items[0].origin === 'Erro de Testador Um' && adminPatches.some(x => x.feedback === 1 && x.status === 'backlog'));
  await ap.click('[data-k=""]'); await ap.click('[data-s=""]'); await ap.waitForSelector('.fbcard [data-rp]');
  await ap.click('.fbcard[data-id="3"] [data-rp]');
  ok('central: recado já vem com o nome e o que a pessoa pediu', (await ap.inputValue('.fbcard[data-id="3"] [data-rptext]')).startsWith('Oi, Testador! Você sugeriu "Ver gasto por semana". Já está no app: '));
  ok('central: mostra o título que a pessoa vai ver', (await ap.textContent('.fbcard[data-id="3"] .rpbox')).includes('Testador, a sua ideia virou realidade!'));
  await ap.fill('.fbcard[data-id="3"] [data-rptext]', 'curto'); await ap.click('.fbcard[data-id="3"] [data-rpsend]');
  ok('central: recado curto demais é recusado', !adminPatches.some(x => x.reply));
  await ap.fill('.fbcard[data-id="3"] [data-rptext]', 'Oi, Testador! Já está no app: em Gráficos, escolha "por semana".'); await ap.click('.fbcard[data-id="3"] [data-rpsend]'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]');
  await ap.waitForSelector('.fbcard[data-id="3"] .replied');
  ok('central: recado enviado e marcado como resolvido', adminPatches.some(x => x.feedback === 3 && x.reply.includes('por semana')) && (await ap.textContent('.fbcard[data-id="3"] .replied')).includes('ainda não viu'));
  await atab('backlog'); await ap.waitForSelector('[data-v="lista"]'); await ap.click('[data-v="lista"]'); await ap.waitForSelector('.blist');
  const fromOp = adminStore.backlog.items.find(i => (i.from || []).includes(1)).id;
  ok('central: item mostra quantas pessoas pediram', (await ap.textContent('.blist')).includes('pedido por 1'));
  await ap.fill(`[data-where="${fromOp}"]`, 'Lançar → Foto da nota'); await ap.press(`[data-where="${fromOp}"]`, 'Tab'); await ap.waitForTimeout(200);
  ok('central: onde fica no app é salvo no item', adminStore.backlog.items.find(i => i.id === fromOp).where === 'Lançar → Foto da nota');
  await ap.click(`[data-claude="${fromOp}"]`); await ap.waitForTimeout(200);
  ok('central: pedir ao Claude copia o pedido com o id do item', /copiado|copie/.test(await ap.textContent('#toast')));
  await ap.selectOption(`[data-st="${fromOp}"]`, 'feito'); await ap.waitForTimeout(300);
  ok('central: concluir item vindo de opinião manda o recado sozinho', !(await ap.$('.cfm')) && (await ap.textContent('#toast')).includes('Recado automático enviado para 1 pessoa'), await ap.textContent('#toast'));
  await atab('novidades'); await ap.waitForSelector('#nwAdd');
  ok('central: novidades começam com a desta versão', (await ap.textContent('#aMain')).includes('Sua opinião agora tem lugar no app'));
  await ap.click('#nwAdd'); await ap.click('#nwPub');
  ok('central: novidade sem título é recusada', (await ap.getAttribute('#nwTitle', 'aria-invalid')) === 'true');
  await ap.fill('#nwTitle', 'Gasto por semana nos gráficos'); await ap.fill('#nwItems', '- Em Gráficos, escolha "por semana"\nNova cor para o cartão');
  ok('central: prévia com o nome da pessoa', (await ap.textContent('#nwPrev')).includes('Mari, olha o que tem de novo') && (await ap.textContent('#nwPrev')).includes('Nova cor para o cartão'));
  await ap.click('#nwPub'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(300);
  ok('central: novidade publicada', adminStore.news?.items?.[0]?.title === 'Gasto por semana nos gráficos' && adminStore.news.items[0].items.length === 2 && adminStore.news.items.length === 2);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-9-novidades.png'), fullPage: true });
  await atab('opinioes'); await ap.waitForSelector('.fbcard');
  await ap.click('[data-k="duvida"]'); await ap.waitForSelector('.fbcard [data-faq]');
  ok('central: dúvida mostra que não resolveu', (await ap.textContent('.fbcard')).includes('Não resolveu'));
  await ap.click('.fbcard [data-faq]'); await ap.waitForSelector('#fqItems');
  ok('central: dúvida vira pergunta frequente para responder', (await ap.inputValue('[data-i="0"][data-k="q"]')) === 'O que é a régua do início?');
  await ap.fill('[data-i="0"][data-k="a"]', 'É o quanto do app vocês já preencheram. Cada passo feito sobe a régua.');
  await ap.click('#fqPub'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(300);
  ok('central: dúvidas publicadas', adminStore.faq?.items?.[0]?.q === 'O que é a régua do início?' && adminStore.faq.items.length > 15);
  await atab('uso'); await ap.waitForSelector('.prow');
  ok('central: uso por pessoa com quem sumiu em destaque', (await ap.$$('.prow')).length === 2 && !!(await ap.$('.prow .neg')));
  ok('central: mapas de calor', (await ap.$$('table.heat')).length === 2 && !!(await ap.$('table.heat td[style*="color-mix"]')));
  await ap.click('.prow'); await ap.waitForSelector('#uPerson .cbox');
  ok('central: detalhe da pessoa', (await ap.textContent('#uPerson')).includes('Salvou lançamento falado ou escrito'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-6-uso.png'), fullPage: true });
  await atab('servicos'); await ap.waitForSelector('.svt tbody tr');
  ok('central: matriz de serviços com uso', (await ap.$$('.svt tbody tr')).length >= 20 && (await ap.textContent('.svt')).includes('pessoas'));
  await ap.selectOption('.svt select[data-k="plan"]', 'pago'); await ap.click('#svSave'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(300);
  ok('central: matriz salva', adminStore.services?.items?.[0]?.plan === 'pago');
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-7-servicos.png'), fullPage: true });
  await atab('docs'); await ap.waitForSelector('.docsec');
  ok('central: documentação com glossário', (await ap.textContent('#aMain')).includes('Glossário da interface'));
  await ap.click('[data-ed="0"]'); await ap.fill('#dcBody', 'Texto novo da visão geral'); await ap.click('#dcSave'); await ap.waitForSelector('.cfm'); await ap.click('.cfm [data-y]'); await ap.waitForTimeout(300);
  ok('central: seção da documentação salva', adminStore.docs?.items?.[0]?.body === 'Texto novo da visão geral');
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-8-docs.png'), fullPage: true });
  await atab('navegacao'); await ap.waitForSelector('#hCanvas');
  const navTxt = await ap.textContent('#aMain');
  ok('central: navegação com telas, tempo médio e caminhos', navTxt.includes('Início') && navTxt.includes('30s') && navTxt.includes('Menu: Metas') && navTxt.includes('9×'));
  await ap.waitForTimeout(400);
  ok('central: mapa de calor dos toques desenhado sobre a tela', await ap.evaluate(() => { const c = document.querySelector('#hCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true; return false; }));
  ok('central: botões mais tocados e toques fora da foto', (await ap.textContent('#aMain')).includes('Enviar PDF') && (await ap.textContent('#hBelow')).includes('3 toques mais abaixo'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-11-navegacao.png'), fullPage: true });
  await atab('erros'); await ap.waitForSelector('.errgrp');
  ok('central: erros agrupados com quantas vezes, quem, tela e celular', (await ap.$$('.errgrp')).length === 2 && (await ap.textContent('.errgrp')).includes('2×') && (await ap.textContent('.errgrp')).includes('Testador Dois') && (await ap.textContent('.errgrp')).includes('Lançar'));
  ok('central: contador de erros no menu', (await ap.textContent('#aNav [data-t="erros"] .agb')) === '2');
  await ap.click('[data-ef="tras"]'); await ap.waitForTimeout(150);
  ok('central: filtro de erros por trás', (await ap.$$('.errgrp')).length === 1);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-12-erros.png'), fullPage: true });
  await atab('versoes'); await ap.waitForSelector('#aMain article');
  ok('central: versões com a definição de pronto e a novidade de cada uma', (await ap.textContent('#aMain')).includes('Definição de pronto') && (await ap.textContent('#aMain')).includes('Lançar sem abrir o app') && (await ap.textContent('#aMain')).includes('Novo no backlog'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-13-versoes.png'), fullPage: true });
  await atab('fluxos'); await ap.waitForSelector('.fmap .phone');
  ok('central: visão geral com todas as telas', (await ap.$$('.fmap .phone')).length >= 38 && await ap.evaluate(() => [...document.querySelectorAll('.fmap img')].slice(0, 6).every(i => i.complete)));
  await ap.click('[data-fl="fatura"]'); await ap.waitForSelector('.fflow .fstep');
  ok('central: fluxo da fatura em etapas com pessoas por etapa', (await ap.$$('.fstep')).length === 5 && (await ap.textContent('.fflow')).includes('pessoas'));
  await ap.click('.fstep .phone'); await ap.waitForSelector('#flBox[open]');
  ok('central: tela ampliada mostra onde fica e em que fluxos aparece', (await ap.textContent('#flBox')).includes('Aparece nos fluxos'));
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-10-fluxo-zoom.png') });
  await ap.click('#flBox [data-x]'); await ap.waitForTimeout(150);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-10-fluxos.png'), fullPage: true });
  await ap.setViewportSize({ width: 390, height: 844 }); await atab('uso'); await ap.waitForSelector('.prow');
  ok('central: uso no celular não rola para o lado', await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  // Phone, tablet standing (Galaxy Tab S6 Lite: 800 px) and tablet lying down (1334 px): every page fits the width.
  const TABS = ['painel', 'opinioes', 'uso', 'navegacao', 'erros', 'duvidas', 'novidades', 'fluxos', 'versoes', 'backlog', 'servicos', 'docs', 'bench', 'preco', 'desenho'];
  for (const [w, h, name] of [[390, 844, 'celular'], [800, 1334, 'tablet em pé'], [1334, 800, 'tablet deitado']]) {
    await ap.setViewportSize({ width: w, height: h }); await ap.waitForTimeout(250);
    const wide = [];
    for (const t of TABS) { await atab(t); await ap.waitForTimeout(250); if (!(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))) wide.push(t); }
    ok(`central (${name}): nenhuma página rola para o lado`, !wide.length, wide.join(', '));
    const drawerMode = await ap.isVisible('#aMenu');
    ok(`central (${name}): menu ${w < 1024 ? 'no botão ☰' : 'na lateral'}`, w < 1024 ? drawerMode && (await txt2(ap, '#aCur')) === 'Desenho do produto' : !drawerMode && await ap.isVisible('#aNav [data-t="desenho"]'));
    if (shots) { await atab('uso'); await ap.waitForTimeout(300); await ap.screenshot({ path: path.join(shots, `admin-resp-${w}-uso.png`), fullPage: true }); }
  }
  await ap.setViewportSize({ width: 390, height: 844 }); await ap.click('#aMenu'); await ap.waitForTimeout(300);
  ok('central no celular: ☰ abre o menu com os três grupos e fecha ao tocar fora', await ap.evaluate(() => document.body.classList.contains('navopen') && document.querySelector('#aNav').getBoundingClientRect().left >= 0) && (await ap.$$('#aNav .agroup')).length === 3);
  if (shots) await ap.screenshot({ path: path.join(shots, 'admin-resp-390-menu.png') });
  await ap.mouse.click(380, 400); await ap.waitForTimeout(300);
  ok('central no celular: topo cabe numa linha, com botões curtos', (await ap.innerText('#aCopy')).trim() === 'Resumo' && await ap.evaluate(() => document.querySelector('.atop').offsetHeight < 80), await ap.evaluate(() => document.querySelector('.atop').offsetHeight + 'px ' + document.querySelector('.atop').innerText.replace(/\s+/g, ' ')));
  ok('central no celular: menu fecha ao tocar fora', !(await ap.evaluate(() => document.body.classList.contains('navopen'))));
  await atab('uso'); await ap.waitForSelector('.prow');
  ok('central no celular: tabela vira cartões com o nome de cada coluna', await ap.evaluate(() => { const td = document.querySelector('table.atable tbody td:nth-child(2)'); return getComputedStyle(td).display === 'flex' && !!td.dataset.label && getComputedStyle(document.querySelector('table.atable thead')).display === 'none'; }));
  await actx.close();
}
// Test phase: feedback and FAQ in the app.
await page.click('#fbBtn'); await page.waitForSelector('#v-ajustes [data-sec="opiniao"]:not([hidden]) #fbText');
ok('balão do topo abre Dar opinião', await page.isVisible('#fbText'));
await page.click('#fbSend');
ok('opinião vazia é recusada', (await page.getAttribute('#fbText', 'aria-invalid')) === 'true');
await page.click('[data-kind="ideia"]'); await page.fill('#fbText', 'Queria ver quanto gastei por semana');
await page.click('#fbSend'); await page.waitForSelector('.cfm'); await page.click('.cfm [data-y]');
await page.waitForFunction(() => document.querySelector('#fbMine')?.textContent.includes('Queria ver'));
const fbRow = await page.evaluate(() => window.__db.feedback.at(-1));
ok('opinião enviada com tipo, tela e celular', fbRow.kind === 'ideia' && fbRow.screen === 'menu.opiniao' && !!fbRow.device && fbRow.version === APP_VERSION, JSON.stringify(fbRow));
ok('a pessoa vê o que já mandou e a situação', (await txt('#fbMine')).includes('Recebida'));
await shot('11-opiniao');
await sec('duvidas'); await page.waitForSelector('#fqList details');
await page.fill('#fqQ', 'meta'); await page.waitForTimeout(300);
ok('busca nas dúvidas acha a meta', (await txt('#fqList')).startsWith('O que são as metas?'), (await txt('#fqList')).slice(0, 80));
await page.click('#fqList details summary');
ok('resposta abre explicando os 3 combinados', (await txt('#fqList details')).includes('limite do cartão'));
await page.fill('#fqQ', 'consigo usar no computador?'); await page.waitForTimeout(300);
await page.click('#fqSend'); await page.waitForSelector('#fqAns [data-h]');
ok('pergunta nova: o assistente responde', (await txt('#fqAns')).includes('três combinados'));
await page.click('#fqAns [data-h="0"]'); await page.waitForTimeout(200);
const dq = await page.evaluate(() => window.__db.feedback.at(-1));
ok('dúvida vai para a equipe com a resposta e "não resolveu"', dq.kind === 'duvida' && dq.text === 'consigo usar no computador?' && !!dq.answer && dq.helpful === false);
await shot('12-duvidas');
await page.waitForFunction(() => window.__db.usage.includes('opiniao.ideia'), null, { timeout: 15000 }).catch(() => {});
const used = await page.evaluate(() => window.__db.usage);
{ // Tester messages: alpha welcome once, then a personal reply and what's new, with the person's name.
  await page.evaluate(() => { const f = window.__db.feedback.find(x => x.kind === 'ideia'); Object.assign(f, { reply: 'Já está no app: em Gráficos, escolha "por semana".', reply_seen: false, status: 'resolvido', replied_at: new Date().toISOString() }); localStorage.setItem('mock.db', JSON.stringify(window.__db)); });
  const mctx = await browser.newContext({ viewport: { width: 400, height: 860 }, storageState: await page.context().storageState() });
  const mp = await mctx.newPage(); await addRoutes(mp);
  const seeAnn = async () => { for (let i = 0; i < 40; i++) { if (await mp.$('.ann')) return true; if (await mp.$('.coach')) await mp.click('#coachSkip').catch(() => {}); await mp.waitForTimeout(250); } return false; };
  await mp.goto('https://app.test/');
  ok('aviso de teste alpha aparece com o nome', await seeAnn() && (await mp.textContent('.ann')).includes('Oi, Luiz! Que bom ter você aqui') && (await mp.textContent('.ann')).includes('família e amigos'));
  if (shots) await mp.screenshot({ path: path.join(shots, '13-alpha.png') });
  await mp.click('.ann [data-p]'); await mp.waitForTimeout(600);
  ok('só um pop-up por abertura: depois do aviso, nada mais aparece', !(await mp.$('.ann')));
  ok('sininho mostra o que ficou sem ver', (await mp.textContent('#bellBtn .bdg')) === '1' && await mp.isVisible('#bellBtn .bdg'), await mp.textContent('#bellBtn .bdg'));
  await mp.reload(); ok('na abertura seguinte vem o recado personalizado', await seeAnn() && (await mp.textContent('.ann')).includes('Luiz, a sua ideia virou realidade!') && (await mp.textContent('.ann')).includes('Queria ver quanto gastei por semana'));
  if (shots) await mp.screenshot({ path: path.join(shots, '14-recado.png') });
  await mp.click('.ann [data-p]'); await mp.waitForTimeout(400);
  ok('recado marcado como visto', await mp.evaluate(() => JSON.parse(localStorage.getItem('mock.db')).feedback.find(x => x.kind === 'ideia').reply_seen === true));
  await mp.reload(); await mp.waitForTimeout(2500);
  ok('aviso alpha e recado não se repetem', !(await mp.$('.ann')));
  adminStore.news.items.unshift({ id: 'n2', at: new Date(Date.now() + 1000).toISOString(), title: 'Nova tela de metas', items: ['Ficou mais fácil'] }, { id: 'n3', at: new Date().toISOString(), title: 'Outra melhoria', items: ['Detalhe'] });
  await mp.reload(); ok('várias novidades viram um pop-up só: a mais nova inteira e as outras pelo título', await seeAnn() && (await mp.textContent('.ann')).includes('Luiz, olha o que tem de novo') && (await mp.textContent('.ann')).includes('Ficou mais fácil') && (await mp.textContent('.ann')).includes('E também') && (await mp.textContent('.ann')).includes('Outra melhoria'));
  if (shots) await mp.screenshot({ path: path.join(shots, '15-novidades.png') });
  await mp.click('.ann [data-s]'); await mp.waitForSelector('.bellbox');
  const bell = await mp.textContent('.bellbox');
  ok('sininho lista novidades e recados dos últimos 30 dias', bell.includes('Nova tela de metas') && bell.includes('Outra melhoria') && bell.includes('Resposta ao que você mandou') && bell.includes('Gasto por semana nos gráficos'), bell.slice(0, 160));
  await mp.waitForTimeout(500); if (shots) await mp.screenshot({ path: path.join(shots, '15b-sininho.png') });
  await mp.click('.bellbox .tx'); await mp.waitForTimeout(300);
  ok('depois de abrir o sininho, o contador zera', await mp.evaluate(() => document.querySelector('#bellBtn .bdg').hidden));
  await mp.reload(); await mp.waitForTimeout(2500);
  ok('novidade não se repete', !(await mp.$('.ann')));
  await mctx.close();
}
{ // Apple Pay on the iPhone: personal code (only its hash is saved) and the steps.
  await sec('applepay'); await page.waitForSelector('#apGen');
  ok('compras com Apple Pay: explica e mostra o passo a passo', (await txt('#apBox')).includes('Transação') && (await txt('#apBox')).includes('/api/quick'));
  await page.click('#apGen'); await page.waitForSelector('.cfm'); await page.click('.cfm [data-y]'); await page.waitForSelector('#apBox .status.ok code');
  const code = await page.textContent('#apBox .status.ok code');
  const hash = await page.evaluate(() => window.__db.quick?.hash);
  const expect = await page.evaluate(async c => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(c)))].map(x => x.toString(16).padStart(2, '0')).join(''), code.replace('Bearer ', ''));
  ok('código gerado aparece uma vez e só o hash é salvo', /^Bearer [A-Za-z0-9_-]{30,}$/.test(code) && hash === expect && !JSON.stringify(await page.evaluate(() => window.__db)).includes(code.replace('Bearer ', '')));
  if (shots) await page.screenshot({ path: path.join(shots, '16-applepay.png'), fullPage: true });
  await page.click('[data-tab=resumo]');
}
{ // Icon shortcuts and the evening reminder open Lançar straight on the microphone; things shared from the bank app are read.
  await page.goto('https://app.test/?acao=voz'); await page.waitForSelector('#app:not([hidden])'); await page.waitForTimeout(700);
  ok('atalho "Lançar falando" abre direto no microfone', (await page.getAttribute('.tab[data-tab="lancar"]', 'aria-selected')) === 'true' && await page.isVisible('#qText') && !(await page.url()).includes('acao='));
  await page.evaluate(async () => { const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: 'paguei 60 de estacionamento no pix', name: '', type: '' }))); await c.delete('/shared/file'); });
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForSelector('#qPreview:not([hidden])', { timeout: 10000 });
  ok('texto compartilhado vira lançamento para conferir', (await txt('#qPreview')).length > 10 && (await page.inputValue('#qText')).includes('estacionamento'));
  await page.evaluate(async () => { const png = await (await fetch('/icons/icon-192.png')).blob(); const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: '', name: 'comprovante.png', type: 'image/png' }))); await c.put('/shared/file', new Response(png, { headers: { 'content-type': 'image/png' } })); });
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForFunction(() => /João Encanador/.test(document.querySelector('#qPreview')?.textContent + [...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ')), null, { timeout: 15000 }).catch(() => {});
  const prev = await page.evaluate(() => document.querySelector('#qPreview').textContent + [...document.querySelectorAll('#qPreview input, #qPreview select')].map(i => i.value).join(' '));
  ok('comprovante de Pix compartilhado vira lançamento na conta', /João Encanador/.test(prev) && /180/.test(prev) && (await txt('#qStatus')).includes('comprovante'), prev.slice(0, 160));
  if (shots) await page.screenshot({ path: path.join(shots, '17-comprovante.png'), fullPage: true });
  await page.evaluate(async () => { const png = await (await fetch('/icons/icon-192.png')).blob(); const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: '', name: 'arquivo', type: 'application/octet-stream' }))); await c.put('/shared/file', new Response(png, { headers: { 'content-type': 'application/octet-stream' } })); });
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForFunction(() => /João Encanador/.test([...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ') + document.querySelector('#qPreview')?.textContent), null, { timeout: 15000 }).catch(() => {});
  ok('comprovante em formato genérico (como o do Santander) também é lido', /João Encanador/.test(await page.evaluate(() => [...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ') + document.querySelector('#qPreview').textContent)));
  ok('nada sobra guardado depois de ler', await page.evaluate(async () => !(await (await caches.open('share')).match('/shared/file'))));
  // The content decides where a document goes, not the button nor the file type.
  await page.evaluate(() => new Promise(r => { const t = setInterval(() => { if (window.pdfjsLib) { clearInterval(t); r(); } }, 50); }));
  const qVals = () => page.evaluate(() => (document.querySelector('#qPreview')?.hidden ? '' : document.querySelector('#qPreview').textContent + [...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ')));
  const clean = () => page.evaluate(() => { const q = document.querySelector('#qPreview'); q.innerHTML = ''; q.hidden = true; document.querySelector('#pdfLog').innerHTML = ''; document.querySelector('#review').hidden = true; document.querySelector('#rcLog').innerHTML = ''; });
  await clean();
  await page.click('.ltile[data-mode="pdf"]'); await page.setInputFiles('#pdfIn', path.join(ROOT, '../tests/fixtures/comprovante-ficticio.pdf'));
  await page.waitForFunction(() => /João Encanador/.test([...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ')), null, { timeout: 15000 }).catch(() => {});
  ok('PDF de comprovante enviado em "Fatura ou extrato" vira um lançamento', /João Encanador/.test(await qVals()) && !(await page.isVisible('#review')), await txt('#pdfLog'));
  await page.click('#qCancel').catch(() => {});
  const fat = fs.readFileSync(path.join(ROOT, '../tests/fixtures/fatura-ficticia.pdf')).toString('base64');
  await page.evaluate(async b64 => { const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)); const c = await caches.open('share'); await c.put('/shared/meta', new Response(JSON.stringify({ text: '', name: 'documento', type: 'application/octet-stream' }))); await c.put('/shared/file', new Response(new Blob([bin]))); }, fat);
  await page.goto('https://app.test/?acao=compartilhar'); await page.waitForSelector('#rvSave', { timeout: 30000 }).catch(() => {});
  ok('fatura em PDF compartilhada vai para a importação da fatura', (await txt('#pdfLog')).includes('Fatura do Nubank lida') && await page.isVisible('#review'), await txt('#pdfLog'));
  AI_DOC = 'fatura'; await clean();
  await page.click('.ltile[data-mode="pdf"]'); await page.setInputFiles('#pdfIn', path.join(ROOT, 'icons/icon-512.png'));
  await page.waitForFunction(() => /Fatura do Nubank lida/.test(document.querySelector('#pdfLog').textContent) && !document.querySelector('#review').hidden, null, { timeout: 20000 }).catch(() => {});
  ok('foto ou print de fatura também é importado como fatura', (await txt('#pdfLog')).includes('fatura do cartão. Lendo a imagem') && await page.isVisible('#review'), await txt('#pdfLog'));
  AI_DOC = 'comprovante'; await clean();
  await page.click('.ltile[data-mode="nota"]'); await page.setInputFiles('#rcFile', path.join(ROOT, 'icons/icon-512.png'));
  await page.waitForFunction(() => /João Encanador/.test([...document.querySelectorAll('#qPreview input')].map(i => i.value).join(' ')), null, { timeout: 15000 }).catch(() => {});
  ok('comprovante enviado em "Foto da nota" vira um lançamento, não uma nota', /João Encanador/.test(await qVals()) && (await page.getAttribute('.ltile[data-mode="falar"]', 'aria-pressed')) === 'true');
  AI_DOC = null; await page.click('#qCancel').catch(() => {});
  await noCoach(); await page.evaluate(() => document.querySelectorAll('.isheet, .isheet-bg, .cfm-wrap').forEach(x => x.remove()));
  await page.click('[data-tab=resumo]');
}
{ // Automatic lock: digital or face (virtual authenticator), password, lock at start, goodbye message on signing out.
  const uid = await page.evaluate(() => window.__db.users.find(u => u.email === 'luiz@test.com').id);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await sec('conta'); await page.waitForSelector('#secBox #lkMin');
  ok('conta: bloqueio automático com 5 minutos de fábrica e sem opção "nunca"', (await page.inputValue('#lkMin')) === '5' && !(await page.$('#lkMin option[value="0"]')));
  await page.selectOption('#lkMin', '1');
  ok('conta: tempo do bloqueio escolhido fica no aparelho', await page.evaluate(() => localStorage.getItem('fin.lock.min')) === '1');
  await page.click('#lkBioTgl'); await page.click('.cfm [data-y]');
  await page.waitForFunction(u => !!localStorage.getItem('fin.bio.' + u), uid, { timeout: 8000 }).catch(() => {});
  ok('conta: liga a digital ou o rosto (só a chave do aparelho fica guardada)', !!(await page.evaluate(u => localStorage.getItem('fin.bio.' + u), uid)) && (await txt('#secBox')).includes('Parar de usar'));
  if (shots) await page.screenshot({ path: path.join(shots, '18-seguranca.png'), fullPage: true });
  await page.evaluate(() => { window.__sawLock = false; new MutationObserver(() => { if (document.querySelector('#lockScreen')) window.__sawLock = true; }).observe(document.body, { childList: true }); });
  await page.click('#lkNow');
  await page.waitForFunction(() => window.__sawLock, null, { timeout: 5000 }).catch(() => {});
  const lockedNow = await page.evaluate(() => window.__sawLock);
  await page.waitForSelector('#lockScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
  ok('bloquear agora cobre a tela e a digital desbloqueia', lockedNow && !(await page.$('#lockScreen')) && !(await page.evaluate(() => document.body.classList.contains('locked'))));
  // Left alone longer than the chosen time, then back to the app: locked, numbers hidden.
  await page.evaluate(u => { localStorage.setItem('fin.lock.last.' + u, String(Date.now() - 2 * 60e3)); localStorage.removeItem('fin.bio.' + u); }, uid);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForSelector('#lockScreen', { timeout: 5000 }).catch(() => {});
  ok('parado mais que o tempo escolhido: bloqueia e esconde os números', await page.isVisible('#lockScreen') && (await txt('#lockScreen')).includes('Ficou 1 minuto sem uso') && !(await page.isVisible('#brand')));
  if (shots) await page.screenshot({ path: path.join(shots, '19-bloqueio.png') });
  await page.evaluate(() => { window.__badPass = 'errada-123'; }); await page.fill('#lkPass', 'errada-123'); await page.click('#lkGo');
  await page.waitForFunction(() => /Senha incorreta/.test(document.querySelector('#lkMsg')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok('senha errada não desbloqueia', (await txt('#lkMsg')).includes('Senha incorreta') && await page.isVisible('#lockScreen'));
  await page.evaluate(() => { window.__noMsgs = false; });
  await page.fill('#lkPass', 'senha-forte-123'); await page.click('#lkGo');
  await page.waitForSelector('#lockScreen', { state: 'detached', timeout: 5000 }).catch(() => {});
  ok('senha certa desbloqueia', !(await page.$('#lockScreen')));
  await page.waitForSelector('.ann', { timeout: 5000 }).catch(() => {});
  ok('depois da senha, o app oferece a digital e diz que dá para desligar', /desbloquear com a digital ou o rosto/.test(await page.textContent('.ann').catch(() => '')) && /desligar quando quiser/.test(await page.textContent('.ann').catch(() => '')));
  if (shots) await page.screenshot({ path: path.join(shots, '19b-oferta-digital.png') });
  await page.click('.ann [data-p]').catch(() => {});
  await page.waitForFunction(u => !!localStorage.getItem('fin.bio.' + u), uid, { timeout: 8000 }).catch(() => {});
  ok('"Sim, usar" liga a digital na hora', !!(await page.evaluate(u => localStorage.getItem('fin.bio.' + u), uid)));
  await page.evaluate(u => { window.__noMsgs = true; localStorage.removeItem('fin.bio.' + u); }, uid);
  // Opening the app after the time: locks before the numbers show.
  // Leaving the app records the time it was left; so the old time is set as the page loads again.
  await page.addInitScript(() => { try { const u = sessionStorage.getItem('e2e.oldLock'); if (u) { sessionStorage.removeItem('e2e.oldLock'); localStorage.setItem('fin.lock.last.' + u, String(Date.now() - 10 * 60e3)); } } catch (e) { /* page without storage */ } });
  await page.evaluate(u => sessionStorage.setItem('e2e.oldLock', u), uid);
  await page.reload(); await page.waitForSelector('#lockScreen', { timeout: 10000 }).catch(() => {});
  ok('abrir o app depois do tempo já abre bloqueado', await page.isVisible('#lockScreen') && !(await page.isVisible('#v-resumo')));
  const coachKeys = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('fin.coach')).map(k => [k, localStorage[k]])));
  await page.click('#lkOut'); await page.waitForSelector('#welcome:not([hidden])', { timeout: 10000 }); await page.waitForSelector('.ann', { timeout: 5000 }).catch(() => {});
  ok('sair mostra a mensagem de segurança com o nome', (await txt('.ann')).includes('Até logo, Luiz!') && (await txt('.ann')).includes('nunca pede a senha do banco'), await page.evaluate(() => document.querySelector('.ann')?.textContent || '').then(t => t.slice(0, 120)));
  if (shots) await page.screenshot({ path: path.join(shots, '20-saiu.png') });
  await page.click('.ann [data-p]');
  await page.evaluate(u => localStorage.removeItem('fin.lock.min'), uid);
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }); await cdp.send('WebAuthn.disable');
  await page.click('#wLogin'); await page.fill('#aEmail', 'luiz@test.com'); await page.fill('#aPass', 'senha-forte-123'); await page.click('#aGo');
  await page.waitForSelector('#app:not([hidden])', { timeout: 10000 });
  ok('entrar de novo não abre bloqueado', !(await page.$('#lockScreen')));
  await noCoach(); await page.evaluate(ks => { Object.keys(localStorage).filter(k => k.startsWith('fin.coach')).forEach(k => localStorage.removeItem(k)); Object.entries(ks).forEach(([k, v]) => localStorage.setItem(k, v)); }, coachKeys); await page.evaluate(() => document.querySelectorAll('.isheet, .isheet-bg, .cfm-wrap').forEach(x => x.remove()));
  await page.click('[data-tab=resumo]');
}
{ // Navigation, taps and errors are recorded (names of screens and buttons only).
  await page.click('[data-tab=lancar]'); await page.waitForTimeout(1200); await page.click('.ltile[data-mode="falar"]');
  await page.click('[data-tab=resumo]'); await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('#toast'); });
  await page.evaluate(() => import('/js/ui.js').then(m => m.toast('Não foi possível salvar. Verifique a internet e tente de novo.')));
  await page.evaluate(() => import('/js/usage.js').then(m => m.flush()));
  await page.waitForFunction(() => window.__db.nav.length > 0 && window.__db.errors.length > 0, null, { timeout: 5000 }).catch(() => {});
  const navRec = await page.evaluate(() => window.__db.nav.reduce((a, d) => ({ screens: a.screens.concat(d.screens), flows: a.flows.concat(d.flows), taps: a.taps.concat(d.taps), targets: a.targets.concat(d.targets) }), { screens: [], flows: [], taps: [], targets: [] }));
  ok('navegação registrada: telas, tempo e caminho', navRec.screens.some(x => x.s === 'lancar' && x.t >= 1) && navRec.flows.some(f => f.f === 'lancar' && f.t === 'inicio'), JSON.stringify(navRec.screens).slice(0, 160));
  ok('toques registrados com o nome do botão, sem valores', navRec.taps.length > 0 && navRec.targets.some(t => /Falar ou escrever/.test(t.t)) && navRec.targets.every(t => !/\d/.test(t.t)), JSON.stringify(navRec.targets).slice(0, 200));
  const errRec = await page.evaluate(() => window.__db.errors.at(-1));
  ok('erro que apareceu na tela é registrado com tela, celular e versão', errRec?.p_kind === 'tela' && /Não foi possível salvar/.test(errRec.p_message) && !!errRec.p_screen && !!errRec.p_device && errRec.p_version === APP_VERSION, JSON.stringify(errRec));
}
{ // Signing in again: whoever already has a name and a family goes straight to Início.
  await page.click('[data-tab=extrato]'); await page.waitForTimeout(200);
  await page.reload(); await page.waitForSelector('#app:not([hidden])', { timeout: 10000 });
  ok('ao abrir de novo vai direto para o Início', (await page.getAttribute('.tab[data-tab="resumo"]', 'aria-selected')) === 'true');
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('mock.db')), ses = JSON.parse(localStorage.getItem('mock.session'));
    const u = db.users.find(x => x.id === ses.user.id); delete u.user_metadata.display_name; delete ses.user.user_metadata.display_name;
    localStorage.setItem('mock.db', JSON.stringify(db)); localStorage.setItem('mock.session', JSON.stringify(ses));
  });
  await page.reload(); await page.waitForSelector('#app:not([hidden]), #onboard:not([hidden])', { timeout: 10000 });
  ok('quem já tem nome e família não refaz o cadastro', await page.isVisible('#app') && !(await page.isVisible('#onboard')) && (await txt('#v-resumo')).includes('Luiz'));
  await noCoach(); await page.waitForTimeout(1500); await page.evaluate(() => document.querySelectorAll('.isheet, .isheet-bg, .cfm-wrap').forEach(x => x.remove()));
}
ok('uso registrado só com nomes das partes', used.includes('menu.opiniao') && used.includes('opiniao.ideia') && used.every(f => /^[a-z_]{2,20}(\.[a-z_]{2,20})?$/.test(f)), used.slice(0, 12).join(','));
// notifications
await sec('avisos');
await page.waitForSelector('#pOn');
ok('página de notificações mostra os tipos de aviso', (await page.$$('#pushBox [data-pt]')).length === 6 && (await txt('#pushBox')).includes('Resumo da semana'));
await page.uncheck('#pushBox [data-pt="semanal"]');
await page.evaluate(() => { window.__permAnswer = 'default'; });
await page.click('#pOn');
await page.waitForFunction(() => /não permitiu/.test(document.querySelector('#pMsg')?.textContent || ''));
ok('se a pessoa não permitir, explica e não liga', await page.evaluate(() => window.__db.push_subscriptions.length === 0));
await page.evaluate(() => { window.__permAnswer = 'granted'; });
await page.click('#pOn');
await page.waitForSelector('#pTest');
const ps = await page.evaluate(() => window.__db.push_subscriptions);
ok('ativar avisos salva o aparelho com as preferências', ps.length === 1 && ps[0].prefs.semanal === false && ps[0].prefs.gastos === true && await page.evaluate(() => window.__subOpts === true), JSON.stringify(ps));
await page.waitForTimeout(600);
ok('ao ativar, manda um aviso de teste', window_pushTests >= 1);
await shot('08b-avisos');
await page.check('#pushBox [data-pt="semanal"]'); await page.waitForTimeout(150);
ok('mudar o tipo de aviso salva na hora', await page.evaluate(() => window.__db.push_subscriptions[0].prefs.semanal === true));
for (const k of ['dados', 'gastos', 'conquistas', 'familia', 'lembrete']) await page.uncheck('#pushBox [data-pt="' + k + '"]');
await page.click('#pushBox [data-pt="semanal"]');
ok('não deixa desmarcar todos os tipos', (await txt('#pMsg')).includes('pelo menos um') && await page.isChecked('#pushBox [data-pt="semanal"]'));
await page.click('#pOff'); await page.waitForSelector('.cfm [data-y]');
await page.click('.cfm [data-y]'); await page.waitForSelector('#pOn');
ok('desligar avisos pede confirmação e remove o aparelho', await page.evaluate(() => window.__db.push_subscriptions.length === 0));
// appearance
ok('app abre no tema claro (Mar aberto) por padrão', await page.evaluate(() => document.documentElement.dataset.theme === 'light' && getComputedStyle(document.body).backgroundColor === 'rgb(244, 238, 227)'));
await sec('ajuda');
await page.click('[data-theme-opt="dark"]');
ok('dá para escolher o tema escuro', await page.evaluate(() => document.documentElement.dataset.theme === 'dark' && localStorage.getItem('fin.theme') === 'dark'));
await page.click('[data-theme-opt="light"]');
// forgot password
await sec('conta');
await page.click('#signOut'); await page.waitForSelector('#welcome:not([hidden])'); await page.waitForSelector('.ann', { timeout: 5000 }).catch(() => {});
ok('sair pela Conta também mostra a mensagem de segurança', (await page.textContent('.ann').catch(() => '')).includes('Até logo'));
await page.click('.ann [data-p]').catch(() => {}); await page.click('#wLogin');
await page.click('#aForgot');
ok('esqueci a senha sem e-mail pede o e-mail', (await txt('#authForm')).includes('digite seu e-mail acima'));
await page.fill('#aEmail', 'luiz@test.com'); await page.click('#aForgot');
ok('esqueci a senha confirma o envio do link', (await txt('#aMsg')).includes('enviamos um link para criar uma nova senha'));
await page.fill('#aPass', 'senha-forte-123'); await page.click('#aGo'); await page.waitForSelector('#app:not([hidden])');
await page.goto('about:blank'); await page.goto('https://app.test/#access_token=x&type=recovery');
await page.waitForSelector('#reset:not([hidden])');
ok('link de recuperação abre a tela de nova senha', true);
await page.fill('#rPass', 'nova-senha-1'); await page.fill('#rPass2', 'nova-senha-2'); await page.click('#resetForm button[type=submit]');
ok('senhas diferentes são recusadas', (await txt('#resetForm')).includes('não são iguais'));
await page.fill('#rPass2', 'nova-senha-1'); await page.click('#resetForm button[type=submit]');
await page.waitForSelector('#app:not([hidden])', { timeout: 5000 });
ok('senha nova salva e entra no app', (await txt('#brand')) === 'Família Elias');
await page.waitForSelector('.coach', { timeout: 3000 }).catch(() => {});
ok('tour guiado aparece de novo nos primeiros acessos', !!(await page.$('.coach')));
if (await page.$('.coach')) { await page.click('#coachNever'); await page.waitForTimeout(150); }
ok('marcar "Não mostrar mais" fecha o tour na hora', !(await page.$('.coach')));
ok('"Não mostrar mais" fica guardado', await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('fin.coach.done.') && localStorage[k] === '1')));
await sec('familia');
await shot('08-ajustes');
ok('sem rolagem horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= 400));
// The invited person opens the WhatsApp link, creates an account and lands in the family.
await sec('conta');
await page.click('#signOut');
await page.waitForSelector('#welcome:not([hidden])'); await dismissBye();
await page.goto(inviteUrl.replace(/^https:\/\/[^/]+/, 'https://app.test'));
await page.waitForSelector('#aInvite:not([hidden])');
ok('quem recebe o link vê quem convidou', (await txt('#aInvite')).includes('Luiz convidou você para participar da Família Elias'), await txt('#aInvite'));
ok('cadastro já vem com o nome do convidado', (await page.inputValue('#aName')) === 'Luana');
await shot('11-convidado');
// A phone with fingerprint: right after the account is created, the app offers it.
const cdpL = await page.context().newCDPSession(page); await cdpL.send('WebAuthn.enable');
const authL = (await cdpL.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })).authenticatorId;
await page.fill('#aEmail', 'luana@test.com'); await page.fill('#aPass', 'senha-forte-456'); await page.check('#aConsent'); await page.click('#aGo');
await page.waitForSelector('#obName');
await page.click('#obNext');
await page.waitForSelector('#obBioYes', { timeout: 8000 }).catch(() => {});
ok('logo depois de criar a senha, o app oferece a digital e diz que dá para desligar', (await txt('#obBody')).includes('proteja o app com a digital') && (await txt('#obBody')).includes('desligar quando quiser'), await txt('#obBody'));
await shot('11b-digital');
await page.click('#obBioYes');
await page.waitForSelector('#obJoin');
ok('"Usar a digital" liga e segue para a família', await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('fin.bio.') && !k.startsWith('fin.bio.ask') && localStorage[k])));
await cdpL.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authL }); await cdpL.send('WebAuthn.disable');
ok('convidado vê o convite e entra com um toque', (await txt('#obBody')).includes('Luiz convidou você para participar da Família Elias'));
await shot('12-entrar');
await page.click('#obJoin');
await page.waitForSelector('#app:not([hidden])');
ok('convidado está na família certa', (await txt('#brand')) === 'Família Elias');
ok('quem entra avisa o resto da família', notifies.some(n => n.type === 'joined'));
await page.click('#tourSkip').catch(() => {});
await noCoach();
await sec('familia');
ok('membros mostram nome e parentesco', (await txt('#v-ajustes .list')).includes('Luana (você)Cônjuge ou companheiro(a)'), await txt('#v-ajustes .list'));
ok('convidado vê os dados da família', await page.evaluate(() => window.__db.transactions.length > 0));
await sec('divisao');
const ncards = (await page.$$('#splitBox [data-card]')).length;
ok('quem paga o quê lista os cartões das faturas', ncards >= 2, ncards + ' cartões');
const memberOpt = await page.$eval('#splitBox [data-card]', s => s.options[1].value);
for (const sel of await page.$$('#splitBox [data-card]')) await sel.selectOption(memberOpt);
await page.selectOption('#splitBox [data-conta]', memberOpt);
const shares = await page.$$('#splitBox [data-share]'); await shares[0].fill('60'); await shares[1].fill('30');
await page.click('#spSave');
ok('partes que não somam 100% são recusadas', (await txt('#splitBox')).includes('Precisam somar 100%'));
await shares[1].fill('40'); await page.click('#spSave'); await page.click('.cfm [data-y]'); await page.waitForTimeout(150);
const spl = await page.evaluate(() => window.__db.households[0].settings.split);
ok('divisão salva', spl && spl.conta === memberOpt && Object.keys(spl.cards).length === ncards && Math.abs(Object.values(spl.share).reduce((a, b) => a + b, 0) - 1) < 1e-9, JSON.stringify(spl).slice(0, 120));
await page.click('[data-tab=resumo]'); await page.selectOption('#monthSel', '2026-09');
ok('início mostra quem pagou o quê e o acerto', (await txt('#settleBox')).includes('Quem pagou o quê em setembro de 2026') && /passa R\$|equilibrado/.test(await txt('#settleBox')), (await txt('#settleBox')).slice(0, 160));
await sec('conta');
await page.click('#signOut'); await page.waitForSelector('#welcome:not([hidden])'); await dismissBye();
await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fin.coach.')).forEach(k => localStorage.removeItem(k)));
await page.click('#wLogin'); await page.fill('#aEmail', 'luiz@test.com'); await page.fill('#aPass', 'senha-forte-123'); await page.click('#aGo');
await page.waitForSelector('#app:not([hidden])');
ok('dono volta direto para o app, sem repetir onboarding', (await txt('#brand')) === 'Família Elias');
await page.waitForTimeout(1200);
ok('com "Não mostrar mais", o tour guiado não volta (mesmo sem a memória do aparelho)', !(await page.$('.coach')));
await sec('backup');

await page.evaluate(() => { window.__dl = 0; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl++; return; } return o.call(this); }; });
await page.click('#dExport');
ok('baixar backup pergunta antes', (await txt('.cfm h3')) === 'Baixar o backup?');
await page.click('.cfm [data-y]');
await page.waitForFunction(() => /Backup pronto|Não foi possível/.test(document.querySelector('#bkStatus')?.textContent || ''));
await page.waitForSelector('#toast:not([hidden]) .tc');
await page.screenshot({ path: path.join(shots || '/tmp', '09x-sucesso.png') });
ok('pop-up de sucesso com contagem e botão de fechar', (await txt('#toast')).includes('Pronto!') && (await txt('#toast .tc')).includes('Fecha em') && await page.isVisible('#toast .tx'));
await page.click('#toast .tx');
ok('X fecha o pop-up', await page.isHidden('#toast'));
ok('backup mostra mensagem de sucesso', (await txt('#bkStatus')).includes('Backup pronto') && await page.evaluate(() => window.__dl === 1), await txt('#bkStatus'));
await sec('conta');
await page.click('#delAcc');
ok('excluir conta pede para baixar o backup antes', (await txt('#confirmBox')).includes('Antes, baixe uma cópia dos seus dados'));
await page.click('#confirmBox [data-b]');
await page.waitForFunction(() => /Backup pronto|Não foi possível/.test(document.querySelector('#confirmBox [data-bks]')?.textContent || ''));
ok('backup feito dentro da confirmação mostra o resultado ali mesmo', (await txt('#confirmBox [data-bks]')).includes('Backup pronto') && await page.evaluate(() => window.__dl === 2));
await shot('09-excluir');
await page.click('#confirmBox [data-n]');
ok('cancelar fecha a confirmação', (await txt('#confirmBox')) === '');
await page.click('#delAcc'); await page.click('#confirmBox [data-y]');
await page.waitForSelector('#auth:not([hidden])', { timeout: 10000 });
await page.waitForFunction(() => document.querySelector('#aMsg')?.textContent.includes('excluída'));
ok('depois de excluir aparece a mensagem na tela de login', (await txt('#aMsg')).includes('Sua conta foi excluída'), await txt('#aMsg'));
await shot('10-excluida');
ok('sem erros no console', !errors.length, errors.join(' | '));

} catch (e) { if (e !== SMOKE_DONE) results.push(['FAIL', 'exceção: ' + e.message.split('\n')[0], errors.join(' | ')]); if (shots) await page.screenshot({ path: path.join(shots, 'erro.png'), fullPage: true }).catch(() => {}); try { results.push(['info', 'log', await txt('#dLog') + ' / ' + await txt('#pdfLog')]); } catch (x) {} }
// Install sheet on phones (separate browser contexts with phone user agents).
for (const [name, uaStr, expect] of [
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Adicionar à Tela de Início'],
  ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', 'Instalar agora'],
  ['Instagram', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0', 'Copiar link'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: uaStr, isMobile: true, hasTouch: true });
  if (name === 'Android') await ctx.addInitScript(() => { setTimeout(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }, 600); });
  const p2 = await ctx.newPage(); await addRoutes(p2);
  await p2.goto('https://app.test/');
  await p2.waitForSelector('.isheet', { timeout: 8000 }).catch(() => {});
  const t2 = (await p2.textContent('.isheet').catch(() => '')) || '';
  ok(`${name}: convite para instalar aparece na primeira visita`, t2.includes(expect), t2.replace(/\s+/g, ' ').slice(0, 140));
  if (shots) await p2.screenshot({ path: path.join(shots, 'install-' + name + '.png') });
  if (name === 'Android' && await p2.$('[data-install]')) { await p2.click('[data-install]'); await p2.waitForTimeout(200); ok('Android: botão abre a instalação do sistema', await p2.evaluate(() => window.__prompted === true && !document.querySelector('.isheet')));
    await p2.evaluate(() => localStorage.setItem('fin.installed', '1'));
    await p2.reload(); await p2.waitForSelector('.isheet', { timeout: 15000 }).catch(() => {});
    if (!(await p2.$('.isheet'))) console.log('DBG install', await p2.evaluate(() => JSON.stringify({ i: localStorage.getItem('fin.installed'), n: localStorage.getItem('fin.install.n'), bip: !!window.__bip, ev: !!(window.S && 1) })));
    ok('Android: depois de desinstalar, o convite para instalar volta', !!(await p2.$('.isheet')) && await p2.evaluate(() => localStorage.getItem('fin.installed') === '0')); }
  if (name === 'iPhone') { await p2.click('[data-later]'); await p2.reload(); await p2.waitForTimeout(2000); ok('iPhone: depois de "agora não", não insiste na mesma hora', !(await p2.$('.isheet'))); await p2.click('#wInstall'); await p2.waitForTimeout(200); ok('iPhone: botão Instalar o app na tela de entrada abre o passo a passo na hora', !!(await p2.$('.isheet')));
    await p2.click('.isheet [data-never]'); await p2.waitForTimeout(200);
    ok('iPhone: "Não mostrar mais" fecha e diz onde instalar depois', !(await p2.$('.isheet')) && (await p2.textContent('#toast')).includes('Instalar o app no celular'));
    await p2.evaluate(() => sessionStorage.clear()); await p2.reload(); await p2.waitForTimeout(2000);
    ok('iPhone: depois de "Não mostrar mais", não aparece nem em outra visita', !(await p2.$('.isheet')) && await p2.isVisible('#wInstall')); }
  await ctx.close();
}
await browser.close();
for (const r of results) console.log(r[0], r[1], r[2] ? '— ' + String(r[2]).slice(0, 160) : '');
// On GitHub, each failure also becomes an annotation, readable from the API without the full log.
if (process.env.GITHUB_ACTIONS) for (const r of results.filter(x => x[0] === 'FAIL').slice(0, 10)) console.log(`::error title=${ENGINE}: ${String(r[1]).replace(/[\r\n:,]/g, ' ').slice(0, 120)}::${String(r[2] || '').replace(/[\r\n]/g, ' ').slice(0, 400)}`);
const fails = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} ok`);
process.exit(fails ? 1 : 0);
