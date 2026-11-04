// Several files at once (all the card bills and the bank statement): read one at a time, each with its own
// review, and a summary at the end. Pure module, tested in tests/lib.test.mjs.

export const QUEUE_MAX = 10;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// files: [{name}] -> { items: [{name, status: 'espera'|'lendo'|'salvo'|'descartado'|'pulado'|'erro', label}], i }
export function makeQueue(files) {
  return { items: [...files].slice(0, QUEUE_MAX).map(f => ({ name: String(f.name || 'arquivo'), status: 'espera', label: '' })), i: 0, extra: Math.max(0, files.length - QUEUE_MAX) };
}
// The current file finished (saved, discarded, skipped or failed): mark it and move on. Returns the queue.
export function advance(q, status, label = '') {
  const it = q.items[q.i]; if (it) { it.status = status; if (label) it.label = label; }
  q.i++; if (q.items[q.i]) q.items[q.i].status = 'lendo';
  return q;
}
export const isDone = q => q.i >= q.items.length;
export const position = q => `${Math.min(q.i + 1, q.items.length)} de ${q.items.length}`;

// "Pronto: 2 salvos e 1 pulado." plus one line per file.
export function queueSummary(q) {
  const n = s => q.items.filter(x => x.status === s).length;
  const parts = [[n('salvo'), 'salvo', 'salvos'], [n('descartado'), 'descartado', 'descartados'], [n('pulado'), 'pulado', 'pulados'], [n('erro'), 'não lido', 'não lidos']]
    .filter(([k]) => k).map(([k, a, b]) => plural(k, a, b));
  const head = parts.length ? 'Pronto: ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : parts[0]) + '.' : 'Pronto.';
  return { head: head + (q.extra ? ` ${plural(q.extra, 'arquivo ficou', 'arquivos ficaram')} de fora (máximo de ${QUEUE_MAX} por vez).` : ''), lines: q.items.map(x => ({ name: x.name, status: x.status, label: x.label })) };
}
export const STATUS_LABEL = { espera: 'na fila', lendo: 'agora', salvo: 'salvo', descartado: 'descartado', pulado: 'pulado', erro: 'não deu para ler' };

// How far the reading got, from the step being shown ("Lendo a parte 2 de 5..."), for the progress pop-up.
// null = unknown: the bar keeps creeping on its own.
export function progressOf(text = '') {
  const t = String(text), m = t.match(/(?:parte|página) (\d+) de (\d+)/i);
  if (m) return 15 + 60 * (Math.max(1, +m[1]) - 1) / Math.max(1, +m[2]);
  if (/Pedindo sugestão|categoria/i.test(t)) return 82;
  if (/lid[oa]:|conferem|confere|fecham/i.test(t)) return 78;
  if (/leitura inteligente|Lendo a imagem|Vendo o que/i.test(t)) return 12;
  if (/^(Lendo|Abrindo) /i.test(t)) return 5;
  return null;
}

// What the person has to do now, in one line (shown on top of the queue).
export function nowHint(what) {
  return ({
    revisao: 'Agora: confira a revisão abaixo e toque em Salvar. Se não for para entrar, toque em Descartar.',
    senha: 'Agora: este PDF tem senha. Digite a senha abaixo e toque em Abrir.',
    escolher: 'Agora: diga abaixo o que é este documento.',
    lancamento: 'Agora: confira o lançamento abaixo e toque em Salvar.',
    nota: 'Agora: confira a nota abaixo e toque em Salvar nota.',
  })[what] || '';
}
// Files that could not be read, to try again at the end.
export const failedIndexes = q => q.items.map((x, i) => x.status === 'erro' ? i : -1).filter(i => i >= 0);
