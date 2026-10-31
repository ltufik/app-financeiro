// What kind of financial document is this? Decided by what is written in it, never by the file
// name or extension: a photo, a screenshot or a PDF of the same bill must end up in the same place.
// Pure module, tested in tests/lib.test.mjs.

export const KINDS = ['fatura', 'extrato', 'comprovante', 'nota', 'investimentos'];
export const KIND_LABEL = { fatura: 'fatura do cartão', extrato: 'extrato da conta', comprovante: 'comprovante', nota: 'nota fiscal', investimentos: 'extrato de investimentos' };

const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const count = (t, re) => (t.match(re) || []).length;

// Each signal is [regex, points]. Words that only one kind of document uses weigh more.
const SIGNALS = {
  comprovante: [
    [/comprovante/, 3],
    [/\b(id|identificador|codigo) da (transacao|operacao)|autenticacao|n[uo]mero de controle|e2e ?id|end ?to ?end/, 2],
    [/\b(pagador|recebedor|favorecido|beneficiario|destinatario|quem (pagou|recebeu)|dados de quem|origem|destino)\b/, 2],
    [/(transferencia|pagamento|pix|ted|doc) (realizad|efetuad|enviad|recebid|agendad|concluid)|pix (enviado|recebido)/, 2],
    [/chave pix|tipo de chave|\bpix\b/, 1],
    [/boleto|codigo de barras|linha digitavel|compra no debito/, 1],
  ],
  fatura: [
    [/\bfatura\b/, 2],
    [/total (desta|da) fatura|valor total da fatura|saldo desta fatura|total a pagar/, 3],
    [/pagamento minimo|valor minimo/, 2],
    [/limite (de credito|disponivel|total|utilizado)/, 2],
    [/melhor dia de compra|data de fechamento|fechamento da fatura|proxima fatura/, 1],
    [/\bvencimento\b/, 1],
    [/anuidade|encargos|rotativo|parcelamento da fatura|\biof\b/, 1],
    [/cartao (de credito|final|titular|adicional|virtual)|xxxx ?xxxx/, 1],
  ],
  extrato: [
    [/\bextrato\b/, 3],
    [/saldo (anterior|inicial|final|do dia|em conta|disponivel)/, 2],
    [/conta corrente|conta poupanca|conta de pagamento/, 1],
    [/\bagencia\b/, 1],
    [/lancamentos (do periodo|futuros)|movimentacao/, 1],
  ],
  nota: [
    [/nfc-?e|nf-?e\b|nota fiscal|cupom fiscal|danfe|documento auxiliar/, 3],
    [/chave de acesso|consulte pela chave|lei 12\.?741|tributos (aproximados|totais)/, 2],
    [/\b(qtde?|quant(idade)?|vl\.? ?unit|valor unit|cod(igo)? ?item)\b/, 2],
    [/\bcnpj\b/, 1],
    [/\btroco\b|forma de pagamento|valor a pagar/, 1],
  ],
  investimentos: [
    [/posicao consolidada|carteira de investimentos|resumo da carteira|extrato\b.{0,20}investimento/, 3],
    [/saldo (bruto|liquido)|provisao de ir|quantidade de cotas|valor da cota|liquidez|carencia|aplicacao|resgate/, 2],
    [/investimento/, 2],
    [/renda fixa|renda variavel|fundos de investimento|tesouro direto/, 2],
    [/rentabilidade|\bcdi\b/, 1],
    [/\b(cdb|lci|lca|cri|cra|debentures?|acoes|fundos?|previdencia)\b/, 1],
  ],
};

// classifyText(text, { pages }) → { kind | null, scores, sure }. kind is null when the text does not say clearly:
// then the caller asks the reading assistant, which looks at the document itself.
export function classifyText(text, { pages = 1 } = {}) {
  const t = plain(text).replace(/\s+/g, ' ');
  const scores = Object.fromEntries(KINDS.map(k => [k, SIGNALS[k].reduce((s, [re, p]) => s + (re.test(t) ? p : 0), 0)]));
  if (t.replace(/\s/g, '').length < 40) return { kind: null, scores, sure: false, empty: true };
  const money = count(t, /\d{1,3}(?:\.\d{3})*,\d{2}\b/g);
  const dated = count(t, /\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g);
  // Many dated amounts is a list of transactions (bill or statement), not a single receipt.
  if (money > 12 || dated > 10 || pages > 2) { scores.comprovante -= 4; scores.fatura += 1; scores.extrato += 1; }
  else if (money <= 6 && pages === 1) scores.comprovante += 1;
  // "Extrato de investimentos" is about investments, not the bank account.
  if (/extrato\b.{0,20}investimento/.test(t)) scores.extrato -= 3;
  // A receipt of paying the card bill mentions "fatura", but it is still a receipt.
  if (scores.comprovante >= 5) scores.fatura -= 2;
  const [[k1, s1], [, s2]] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const sure = s1 >= 3 && s1 - s2 >= 2;
  return { kind: sure ? k1 : null, scores, sure, many: money > 12 || dated > 10 || pages > 1 };
}

// The reading assistant answers with its own word for the type; keep only the kinds the app knows.
export function aiKind(tipo) {
  const t = plain(tipo);
  if (/comprovante|pix|\bted\b|transfer|boleto/.test(t)) return 'comprovante';
  if (/nota|cupom/.test(t)) return 'nota';
  if (/invest/.test(t)) return 'investimentos';
  if (/fatura|cartao/.test(t)) return 'fatura';
  if (/extrato/.test(t)) return 'extrato';
  return null;
}

// Which part of Lançar handles each kind.
export const KIND_MODE = { fatura: 'pdf', extrato: 'pdf', investimentos: 'pdf', comprovante: 'falar', nota: 'nota' };

// Text the assistant gets to say what a document is, when the words alone did not settle it.
export const KIND_RULES = `Tipos: "comprovante" = comprovante de UM pagamento ou recebimento (Pix, TED, transferência, boleto pago, compra no débito ou crédito), mesmo que seja o pagamento de uma fatura; tem palavras como comprovante, pagador, recebedor, autenticação, ID da transação. "fatura" = fatura do cartão de crédito com a lista de compras do mês, vencimento, total da fatura, pagamento mínimo, limite. "extrato" = extrato da conta corrente com vários movimentos e saldos. "nota" = nota fiscal ou cupom de loja com os itens comprados (NFC-e, CNPJ, quantidade, valor unitário). "investimentos" = posição ou extrato de investimentos. "outro" = nada disso. Decida pelo conteúdo, não pela aparência do arquivo: foto, print e PDF do mesmo documento são o mesmo tipo.`;
