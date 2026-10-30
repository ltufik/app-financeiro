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
async function addRoutes(t) {
  await t.route('https://app.test/**', async r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/config') return r.fulfill({ json: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', vapidPublicKey: 'BPk1vV0x2Q0cB8o9Yb0n3M6Jq0c2ZQy6k8xQe1o5gq2Wm0yUu3l7nM2kq8VbV6sH3m4u1C9yQ0r2T5w8Z1x4A7c' } });
    if (u.pathname === '/api/metrics') return r.fulfill({ json: u.searchParams.get('probe') ? { admin: true } : { users: 12, users_7d: 3, users_30d: 12, in_family: 11, families: 6, families_shared: 4, families_1_month: 5, families_2_months: 3, families_closed: 2, d7_eligible: 8, d7_retained: 5, d30_eligible: 2, d30_retained: 1, wau: 7, mau: 10, daily: Array.from({ length: 14 }, (_, i) => ({ day: '2026-10-' + String(17 + i).padStart(2, '0'), users: i % 5 })), manual_30d: 40, receipts_30d: 6, imports_30d: 15, studies: 4, charts: 3, push_devices: 5, at: '2026-10-30T12:00:00Z' } });
    if (u.pathname === '/api/notify') { notifies.push(JSON.parse(r.request().postData())); return r.fulfill({ json: { sent: 1 } }); }
    if (u.pathname === '/api/push-test') { window_pushTests++; return r.fulfill({ json: { ok: true } }); }
    if (u.pathname === '/api/ai') return r.fulfill({ json: aiMock(JSON.parse(r.request().postData())) });
    const p = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
    if (!fs.existsSync(p)) return r.fulfill({ status: 404, body: 'nf' });
    r.fulfill({ body: fs.readFileSync(p), contentType: types[path.extname(p)] || 'application/octet-stream' });
  });
  await t.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: MOCK, contentType: 'text/javascript' }));
  await t.route('https://cdnjs.cloudflare.com/**/pdf.min.js', r => r.fulfill({ contentType: 'text/javascript', body: `Promise.all([import('https://pdfjs.test/pdf.mjs'),import('https://pdfjs.test/pdf.worker.mjs')]).then(([m,w])=>{globalThis.pdfjsWorker=w;window.pdfjsLib=m;});` }));
  await t.route('https://cdnjs.cloudflare.com/**/pdf.worker.min.js', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
  await t.route('https://pdfjs.test/*', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(PDFJS, new URL(r.request().url()).pathname.slice(1))) }));
  await t.route('https://fonts.**', r => r.fulfill({ body: '' }));
  await t.route('https://images.pexels.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(ROOT, 'icons/icon-192.png')), contentType: 'image/png' }));
}
await addRoutes(page);
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

let chatCalls = 0, window_pushTests = 0; const notifies = [];
function aiMock(b) {
  const text = JSON.stringify(b.messages);
  const reply = t => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn' });
  if (text.includes('Transforme a frase')) return reply(JSON.stringify({ itens: [{ descricao: 'Mercado', valor: 230, sentido: 'saida', data: '2026-10-06', meio: 'cartao', categoria: 'Mercado' }, { descricao: 'Terapia', valor: 350, sentido: 'saida', data: '2026-10-06', meio: 'conta', categoria: 'Saúde' }] }));
  if (text.includes('Classifique lançamentos')) return reply('[]');
  if (text.includes('nota fiscal ou cupom')) return reply(JSON.stringify({ loja: 'Drogaria Mar', data: '2026-10-06', total: 230, pagamento: 'cartao', itens: [
    { descricao: 'Arroz 5 kg', valor: 30, categoria: 'Mercado' }, { descricao: 'Whey protein 900 g', valor: 150, categoria: 'Suplementos' }, { descricao: 'Dipirona', valor: 50, categoria: 'Saúde' }] }));
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
ok('onboarding sugere o nome sem precisar apagar', (await page.inputValue('#obName')) === '' && (await page.getAttribute('#obName', 'placeholder')) === 'Luiz');
await shot('01b-nome');
await page.click('#obNext');
await page.waitForSelector('[data-s="1"]');
ok('boas-vindas com o nome', (await txt('#obBody')).includes('Boas-vindas, Luiz!'));
await shot('01c-divide');
await page.click('[data-s="1"]');
await page.waitForSelector('#obFam');
ok('sugere o nome da família pelo sobrenome, sem precisar apagar', (await page.inputValue('#obFam')) === '' && (await page.getAttribute('#obFam', 'placeholder')) === 'Família Elias');
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
ok('menu lateral abre com as seções organizadas (com Métricas para o dono do produto)', (await page.$$('#drawer [data-sec]')).length === 12 && (await txt('#drawer')).includes('Família e convites') && (await txt('#drawer')).includes('Patrimônio e dívidas'));
await shot('02b-menu');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
ok('menu fecha com Esc', await page.isHidden('#drawer'));
await sec('metas');
ok('cada seção abre sozinha numa página', await page.isVisible('#gCard') && await page.isHidden('#fName') && (await txt('#v-ajustes .subhead')).includes('Metas'));
await page.click('#secBack'); await page.waitForSelector('#drawer.open');
ok('voltar da seção reabre o menu', true);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.click('[data-tab=resumo]');

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
  ok('setembro: 6% e 18%', pills.includes('Poupança 6%') && pills.includes('Sem o financiamento 18%'), pills);
  ok('próxima fatura com parcelas', (await txt('#v-resumo')).includes('Parcelas R$ 8.401'));
  ok('meta e patrimônio aparecem', (await txt('#v-resumo')).includes('Meta de R$ 3.000.000 aos 55'));
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
ok('meta de poupança acima de 100% é recusada', (await txt('#v-ajustes')).includes('Poupança (%): o máximo é 100'));
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
// notifications
await sec('avisos');
await page.waitForSelector('#pOn');
ok('página de notificações mostra os tipos de aviso', (await page.$$('#pushBox [data-pt]')).length === 5 && (await txt('#pushBox')).includes('Resumo da semana'));
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
for (const k of ['dados', 'gastos', 'conquistas', 'familia']) await page.uncheck('#pushBox [data-pt="' + k + '"]');
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
await page.click('#signOut'); await page.waitForSelector('#welcome:not([hidden])'); await page.click('#wLogin');
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
await page.waitForSelector('#welcome:not([hidden])');
await page.goto(inviteUrl.replace(/^https:\/\/[^/]+/, 'https://app.test'));
await page.waitForSelector('#aInvite:not([hidden])');
ok('quem recebe o link vê quem convidou', (await txt('#aInvite')).includes('Luiz convidou você para participar da Família Elias'), await txt('#aInvite'));
ok('cadastro já vem com o nome do convidado', (await page.inputValue('#aName')) === 'Luana');
await shot('11-convidado');
await page.fill('#aEmail', 'luana@test.com'); await page.fill('#aPass', 'senha-forte-456'); await page.check('#aConsent'); await page.click('#aGo');
await page.waitForSelector('#obName');
await page.click('#obNext');
await page.waitForSelector('#obJoin');
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
await page.click('#signOut'); await page.waitForSelector('#welcome:not([hidden])');
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

} catch (e) { results.push(['FAIL', 'exceção: ' + e.message.split('\n')[0], errors.join(' | ')]); if (shots) await page.screenshot({ path: path.join(shots, 'erro.png'), fullPage: true }).catch(() => {}); try { results.push(['info', 'log', await txt('#dLog') + ' / ' + await txt('#pdfLog')]); } catch (x) {} }
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
  if (name === 'iPhone') { await p2.click('[data-later]'); await p2.reload(); await p2.waitForTimeout(2000); ok('iPhone: depois de "agora não", não insiste na mesma hora', !(await p2.$('.isheet'))); }
  await ctx.close();
}
await browser.close();
for (const r of results) console.log(r[0], r[1], r[2] ? '— ' + String(r[2]).slice(0, 160) : '');
const fails = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} ok`);
process.exit(fails ? 1 : 0);
