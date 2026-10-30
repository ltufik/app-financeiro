// Definição de pronto: a version only goes out with its "O que mudou" note, its entry in the release
// manifest and the product console up to date (screens, names of screens and buttons). See CLAUDE.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { RELEASES } from '../public/js/lib/releases.js';
import { FEATURE_LABELS, screenLabel, SERVICES } from '../public/js/admin/content.js';
import { SCREENS } from '../public/js/admin/flows.js';
import { APP_VERSION } from './helpers/app-version.mjs';

const ROOT = new URL('../public/', import.meta.url).pathname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const VERSION = /const VERSION = '(v\d+)'/.exec(read('sw.js'))[1];

test('versão: a do app e a do service worker são a mesma', () => {
  assert.equal(APP_VERSION, VERSION, 'mude APP_VERSION em public/js/usage.js junto com VERSION em public/sw.js');
});

test('versão: tem entrada no arquivo de versões, com novidade para o pop-up (ou o motivo de não ter)', () => {
  const r = RELEASES.find(x => x.version === VERSION);
  assert.ok(r, `falta a entrada da versão ${VERSION} em public/js/lib/releases.js`);
  assert.ok(r.news ? r.news.title && r.news.items?.length : typeof r.semNovidade === 'string' && r.semNovidade.length > 10, 'escreva a novidade (news) ou explique em semNovidade por que não tem');
  assert.ok(!isNaN(Date.parse(r.at)));
});

test('versões: ids únicos, datas válidas, sem citar o nome da IA para o usuário', () => {
  assert.equal(new Set(RELEASES.map(r => r.id)).size, RELEASES.length);
  const news = RELEASES.filter(r => r.news).map(r => r.news.id); assert.equal(new Set(news).size, news.length);
  for (const r of RELEASES) {
    assert.ok(!isNaN(Date.parse(r.at)), r.id);
    if (r.news) assert.ok(!/claude|anthropic/i.test(JSON.stringify(r.news)), r.id);
    const ids = (r.addBacklog || []).map(i => i.id); assert.equal(new Set(ids).size, ids.length, r.id);
  }
});

test('Central: cada página do menu tem nome, foto nos Fluxos e nome no Uso', () => {
  const keys = [...read('js/menu.js').matchAll(/\{ key: '(\w+)'(, admin: true)?/g)].map(m => ({ key: m[1], admin: !!m[2] }));
  assert.ok(keys.length >= 10);
  for (const { key, admin } of keys) {
    assert.notEqual(screenLabel('menu.' + key), 'Menu: ' + key, `falta o nome de menu.${key} em content.js (MENU)`);
    assert.ok(FEATURE_LABELS['menu.' + key], `falta FEATURE_LABELS['menu.${key}']`);
    if (admin) continue;
    assert.ok(SCREENS['menu_' + key], `falta a tela menu_${key} em flows.js`);
    assert.ok(fs.existsSync(path.join(ROOT, 'flows', `menu_${key}.jpg`)), `falta a foto flows/menu_${key}.jpg (inclua em tests/local/flow-screens.mjs)`);
  }
});

test('Central: toda tela dos Fluxos tem foto', () => {
  for (const id of Object.keys(SCREENS)) assert.ok(fs.existsSync(path.join(ROOT, 'flows', id + '.jpg')), `falta flows/${id}.jpg`);
});

test('Central: tudo o que o app registra tem nome legível', () => {
  const files = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(f => f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.js') && files.push(path.join(d, f.name)));
  walk(path.join(ROOT, 'js'));
  const lits = new Set(files.flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/track\('([a-z_]+(?:\.[a-z_]+)?)'\)/g)].map(m => m[1])));
  const dyn = ['lancar.falar', 'lancar.nota', 'lancar.pdf', 'lancar.mao', 'atalho.voz', 'atalho.nota', 'atalho.pdf', 'atalho.compartilhar', 'opiniao.erro', 'opiniao.ideia', 'opiniao.critica',
    ...['inicio', 'lancar', 'graficos', 'perguntar', 'extrato', 'menu', 'fechar'].map(t => 'aba.' + t)];
  for (const k of [...lits, ...dyn]) assert.ok(FEATURE_LABELS[k], `falta FEATURE_LABELS['${k}'] em public/js/admin/content.js`);
});

test('Central: a matriz de serviços só aponta para medidas que existem', () => {
  for (const s of SERVICES) for (const k of s.keys || []) assert.ok(FEATURE_LABELS[k], `${s.id}: ${k}`);
});
