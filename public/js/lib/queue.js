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
