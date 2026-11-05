// "Quanto o banco cobrou": interest, IOF, fees and annual card fees, from the bill and the statement.
// Interest (juros, multa, rotativo, parcelamento da fatura) is the costly one; the others can often be negotiated.
// Pure module, tested in tests/lib.test.mjs.
const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const KINDS = [
  ['juros', /\bjuros?\b|encargo|rotativo|\bmora\b|\bmulta\b|parcelamento (de|da) fatura|financ\w* (de|da) fatura|\bcet\b/],
  ['iof', /\biof\b/],
  ['anuidade', /anuidade/],
  ['tarifa', /tarifa|pacote (de )?servic|cesta (de )?servic|manutencao (de )?conta|taxa (de )?(manutencao|saque|servico)|\bted\b.*tarifa/],
];
export const FEE_LABEL = { juros: 'Juros e multas', iof: 'IOF', anuidade: 'Anuidade', tarifa: 'Tarifas' };
export function feeKind(description) { const p = plain(description); if (/estorno|devolucao|credito de/.test(p) && !/anuidade|tarifa|iof|juro/.test(p)) return null; for (const [k, re] of KINDS) if (re.test(p)) return k; return null; }
// Cost of a row: money out of the account or a charge on the card (a refund of a fee comes in negative).
const cost = t => t.source === 'conta' ? -(+t.amount || 0) : +t.amount || 0;

// txs of the months to look at -> {total, by: {juros, iof, anuidade, tarifa}, items: [{description, month, value, kind}]}
export function feesOf(txs) {
  const by = { juros: 0, iof: 0, anuidade: 0, tarifa: 0 }, items = [];
  for (const t of txs || []) { const k = feeKind(t.description); if (!k) continue; const v = cost(t); by[k] += v; items.push({ description: t.description, month: t.month, value: Math.round(v * 100) / 100, kind: k }); }
  for (const k in by) by[k] = Math.round(by[k] * 100) / 100;
  const total = Math.round(Object.values(by).reduce((a, b) => a + b, 0) * 100) / 100;
  return { total, by, items: items.filter(x => x.value > 0).sort((a, b) => b.value - a.value) };
}
