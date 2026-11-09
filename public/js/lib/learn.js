// "Regras que aprendem": when the person changes a category, the app looks for the name behind the description
// (IFOOD, UBER, DROGASIL...) and asks whether everything with that name should go to the same category, showing how
// many entries change before anything is applied. The rule is a regex rule (priority 20: above the app's own rules,
// below what was taught entry by entry). Pure, tested in tests/lib.test.mjs.
import { norm } from './format.js';

export const LEARN_PRIORITY = 20;
// Words that never make a rule alone: how the money moved, not who received it.
const GEN = new Set(('PIX ENVIADO ENVIADA RECEBIDO RECEBIDA TRANSF TRANSFERENCIA TED DOC PAG PAGTO PAGAMENTO PAGAMENTOS COMPRA COMPRAS DEB DEBITO ' +
  'CRED CREDITO BOLETO CARTAO SAQUE TARIFA AUTOMATICO AUT PARC PARCELA QR QRS CODE INTERNET APP ONLINE VISA MASTER MASTERCARD ELO ' +
  'NACIONAL INTERNACIONAL DE DA DO DOS DAS EM COM LTDA EIRELI BR BRASIL SAO PAULO RIO JANEIRO SP RJ MG PR SC RS LOJA LOJAS PGTO ESTORNO ' +
  'CONTA CORRENTE POUPANCA APLICACAO RESGATE ENVIO RECEB DEBAUT DEB.AUT').split(' '));
const tokens = s => norm(s).split(/[^A-Z0-9]+/).filter(Boolean);
const useful = w => w.length >= 3 && !/^\d+$/.test(w) && !GEN.has(w);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The rule for a name typed or suggested ("IFOOD", "posto shell"): the words in order, as whole words.
export function rulePattern(label) {
  const w = tokens(label); if (!w.length) return null;
  return `(^|[^A-Z0-9])${w.map(esc).join('[^A-Z0-9]+')}($|[^A-Z0-9])`;
}
export const ruleLabel = label => tokens(label).join(' ');
const re = p => { try { return new RegExp(p); } catch (e) { return null; } };
export const ruleMatches = (pattern, txs = [], source) => { const r = re(pattern); return !r ? [] : txs.filter(t => !t.virtual && (!source || t.source === source) && !(t.splits || []).length && r.test(norm(t.description))); };

// The names a description may stand for, most general first: the first useful word, then it with the next one.
export function ruleCandidates(description) {
  const w = tokens(description), i = w.findIndex(useful); if (i < 0) return [];
  const out = [w[i]]; if (w[i + 1] && !/^\d+$/.test(w[i + 1])) out.push(`${w[i]} ${w[i + 1]}`);
  return out;
}

/*
  suggestRule(tx, category, txs, rules) -> null or { label, pattern, source, category, change: [entries to move],
    same: n already there, total: n with the name }. Only when some other entry would change, and never twice for
  a rule the family already has. A name that spreads over 3+ categories (too general, like "POSTO" for a city)
  uses the two-word version when there is one.
*/
export function suggestRule(tx, category, txs = [], rules = []) {
  if (!tx || tx.manual || !category || category === 'A classificar' || !['conta', 'cartao'].includes(tx.source)) return null;
  const cands = ruleCandidates(tx.description); if (!cands.length) return null;
  const pick = label => { const pattern = rulePattern(label), all = ruleMatches(pattern, txs, tx.source).filter(t => t.id !== tx.id);
    return { label, pattern, source: tx.source, category, all, change: all.filter(t => t.category !== category), same: all.filter(t => t.category === category).length, total: all.length }; };
  let s = pick(cands[0]);
  if (cands[1]) { const cats = new Set(s.all.map(t => t.category).filter(c => c && c !== 'A classificar')); if (cats.size >= 3) { const s2 = pick(cands[1]); if (s2.change.length) s = s2; } }
  if (!s.change.length) return null;
  if ((rules || []).some(r => r.kind === 'regex' && r.source === tx.source && r.pattern === s.pattern && r.category === category)) return null;
  return s;
}

// What "Desfazer" puts back: the entries the rule moved that still are in its category.
export const undoMoves = (log, txs = []) => (log?.moved || []).filter(([id]) => txs.some(t => t.id === id && t.category === log.category));
