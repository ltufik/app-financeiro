// Choosing a category: search by name or by everyday words ("estacionamento" finds Transporte), and
// suggestions from the description of the entry. Pure module, tested in tests/lib.test.mjs.
import { kindOf } from './calc.js';

export const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Everyday words (and how they show up on statements) → words found in category names.
const SYN = [
  [/estaciona|estapar|park|valet|zona azul|sem parar|conectcar|veloe|pedagio|uber|99 ?pop|99app|taxi|cabify|metro|onibus|bilhete|recarga top|mobilidade|urentcar|easyjet|bike/, ['transporte', 'estacionamento', 'mobilidade', 'carro']],
  [/posto|combust|gasolina|etanol|shell|ipiranga|petrobras|br mania|auto posto|angra dos reis/, ['combust', 'transporte', 'carro']],
  [/mercad|supermerc|pao de acucar|carrefour|atacad|assai|hortifrut|pomar|padaria|panificadora|emporio|acougue|carnes|hirota|oxxo|minuto|zaffari|st marche|sacolao/, ['mercado', 'supermercado', 'alimenta', 'casa']],
  [/ifood|ifd|restaur|lanchonete|bar |boteco|pizza|burger|lanche|sorvet|cafe|cafeteria|delivery|rappi|ze delivery|esfiha|sushi|temaki|churrasc/, ['restaurante', 'delivery', 'alimentacao fora', 'alimenta', 'lazer']],
  [/farmac|drogas|droga|raia|panvel|pague menos|dentist|odonto|clinica|medic|hospital|laborat|exame|terapia|psico|fisio|totalpass|gympass|academia/, ['saude', 'farmacia', 'medic', 'academia']],
  [/netflix|spotify|apple com|apple bill|google|youtube|prime video|amazon prime|disney|hbo|max |globoplay|deezer|chatgpt|openai|icloud|melimais|assinatura/, ['assinatura', 'streaming', 'servicos digitais']],
  [/vivo|claro|tim |oi |internet|telefone|celular|net |sky/, ['internet', 'telefone', 'celular', 'assinatura', 'contas', 'moradia']],
  [/aluguel|condomin|luz|energia|enel|elektro|cemig|light|sabesp|agua|gas |comgas|iptu|diarista|faxina|empregada/, ['moradia', 'contas', 'casa', 'aluguel']],
  [/escola|colegio|faculdade|curso|livraria|livro|papelaria|material escolar|mensalidade/, ['escola', 'educa', 'curso', 'livro']],
  [/pet|cobasi|petz|petlove|veterin|racao|banho e tosa/, ['pet']],
  [/shopee|mercadolivre|mercado livre|amazon|shein|aliexpress|magalu|americanas|kabum/, ['compras online', 'compras', 'casa', 'outros']],
  [/renner|riachuelo|c a |cea|zara|centauro|netshoes|roupa|calcado|sapato/, ['vestuario', 'roupa', 'compras']],
  [/cinema|ingresso|ticket|show|teatro|viagem|hotel|airbnb|passeio|clube|socio torcedor|parque/, ['lazer', 'viagem', 'clube']],
  [/seguro|prudential|porto seguro|bradesco aut|suhai/, ['seguro']],
  [/barbe|cabelei|salao|manicure|estetica/, ['servicos pessoais', 'cuidados', 'beleza']],
  [/salario|folha|pagto salario|ted conta salario/, ['salario']],
  [/pagamento fatura|pagto fatura|fatura cartao/, ['fatura']],
  [/aplicacao|resgate|invest|cdb|tesouro|poupanca/, ['invest']],
];

// Category names that match the words of a text (a description or what was typed). While typing, the start
// of an everyday word is enough ("estacion" already finds Transporte).
const words = re => re.source.split('|').map(w => w.replace(/[\\^$.*+?()[\]{}]/g, '').trim()).filter(w => w.length >= 3);
function synonymHits(text, categories, typing = false) {
  const t = ' ' + plain(text) + ' ', q = plain(text), out = [];
  for (const [re, stems] of SYN) {
    if (!re.test(t) && !(typing && q.length >= 3 && words(re).some(w => w.startsWith(q)))) continue;
    for (const st of stems) for (const c of categories) if (plain(c.name).includes(st) && !out.includes(c.name)) out.push(c.name);
  }
  return out;
}

// Search: names that start with the query first, then names that contain it, then everyday-word matches.
export function rankCategories(query, categories) {
  const q = plain(query); if (!q) return categories.map(c => c.name);
  const names = categories.map(c => c.name), starts = [], has = [];
  for (const n of names) { const p = plain(n); if (p.startsWith(q) || p.split(' ').some(w => w.startsWith(q))) starts.push(n); else if (p.includes(q)) has.push(n); }
  const syn = q.length >= 3 ? synonymHits(q, categories, true).filter(n => !starts.includes(n) && !has.includes(n)) : [];
  return [...starts, ...has, ...syn];
}

// Up to 4 suggestions for an entry: what its description points to, then the family's most used categories.
export function suggestCategories(description, categories, usage = {}, max = 4) {
  const out = synonymHits(description, categories).slice(0, max);
  const byUse = categories.map(c => c.name).filter(n => usage[n] && n !== 'A classificar').sort((a, b) => usage[b] - usage[a]);
  for (const n of byUse) { if (out.length >= max) break; if (!out.includes(n)) out.push(n); }
  return out;
}

// The list grouped in plain words, alphabetical inside each group.
const GROUPS = [
  ['dvar', 'Gastos do dia a dia'], ['dfixa', 'Contas fixas (todo mês)'], ['dextra', 'Gastos fora do comum'],
  ['rfixa', 'Receitas'], ['rvar', 'Receitas'], ['rextra', 'Receitas extras (13º, férias, bônus)'], ['neutro', 'Não conta (transferências, investimentos, pagamento da fatura)'],
];
export function groupCategories(categories) {
  const out = [];
  for (const [key, title] of GROUPS) {
    const names = categories.filter(c => kindOf(c).key === key).map(c => c.name).sort((a, b) => a.localeCompare(b, 'pt'));
    if (!names.length) continue;
    const g = out.find(x => x.title === title); if (g) g.names.push(...names); else out.push({ title, names });
  }
  return out;
}
