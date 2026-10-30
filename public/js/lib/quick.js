// Purchase sent by the iPhone shortcut (Apple Pay): amount as Shortcuts sends it ("R$ 45,90", "45.9", 45.9)
// and the transaction row. Pure functions, tested in tests/lib.test.mjs.
import { cycleMonth } from './format.js';

export function parseBRL(v) {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
  let s = String(v || '').replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');           // 1.234,56 -> 1234.56
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); // 1.234 -> 1234
  const n = Math.abs(parseFloat(s));
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

// today: 'AAAA-MM-DD' in Brazil. Returns the row or {error}.
export function quickRow({ valor, loja, cartao }, { household, user, today, closeDay = 24, category = null }) {
  const amount = parseBRL(valor);
  if (!(amount > 0) || amount >= 1e6) return { error: 'valor' };
  const store = String(loja || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Compra com Apple Pay';
  return {
    household_id: household, source: 'cartao', month: cycleMonth(today, closeDay), date: today, day: today.slice(8, 10) + '/' + today.slice(5, 7),
    description: store, amount, category: category || 'A classificar', card: cartao ? String(cartao).trim().slice(0, 40) : null, manual: true, created_by: user,
  };
}
