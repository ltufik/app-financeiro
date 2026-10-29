// Input validation (pure functions, unit tested). Each returns an error message in Portuguese, or '' when valid.

export const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

export function checkEmail(s) { return !String(s || '').trim() ? 'Informe o e-mail.' : isEmail(s) ? '' : 'Esse e-mail não parece certo. Confira se tem @ e o domínio (ex.: nome@gmail.com).'; }
export function checkPassword(s) { return String(s || '').length >= 8 ? '' : 'A senha precisa ter pelo menos 8 caracteres.'; }
export function checkName(s, what = 'o nome', min = 2, max = 60) {
  const v = String(s || '').trim();
  if (v.length < min) return `Escreva ${what}${min > 1 ? ` (pelo menos ${min} letras)` : ''}.`;
  if (v.length > max) return `Use no máximo ${max} caracteres.`;
  if (/[<>{}]/.test(v)) return 'Use só letras, números e pontuação comum.';
  return '';
}

// Brazilian mobile/landline for WhatsApp. Accepts "(11) 98765-4321", "11987654321", "+55 11 98765-4321".
// Returns { phone: '5511987654321', error: '' } or { phone: null, error }. Empty is allowed (phone is optional).
export function parsePhoneBR(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (!d) return { phone: null, error: '' };
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return { phone: null, error: 'Use DDD + número, por exemplo (11) 98765-4321.' };
  const ddd = +d.slice(0, 2);
  if (ddd < 11 || ddd > 99) return { phone: null, error: 'O DDD não parece certo.' };
  if (d.length === 11 && d[2] !== '9') return { phone: null, error: 'Celular com 11 dígitos começa com 9 depois do DDD.' };
  return { phone: '55' + d, error: '' };
}
export const formatPhoneBR = s => { const d = String(s || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : s; };

export function checkNumber(v, { min = -Infinity, max = Infinity, label = 'O valor', allowEmpty = false, integer = false } = {}) {
  if (v === '' || v == null) return allowEmpty ? '' : `${label}: preencha um número.`;
  const n = +String(v).replace(',', '.');
  if (!isFinite(n)) return `${label}: use só números.`;
  if (integer && !Number.isInteger(n)) return `${label}: use um número inteiro.`;
  if (n < min) return `${label}: o mínimo é ${min.toLocaleString('pt-BR')}.`;
  if (n > max) return `${label}: o máximo é ${max.toLocaleString('pt-BR')}.`;
  return '';
}
export const isMonth = s => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
export function checkMonth(s, { allowEmpty = false, label = 'O mês' } = {}) { return !s ? (allowEmpty ? '' : `${label}: preencha no formato AAAA-MM.`) : isMonth(s) ? '' : `${label}: use o formato AAAA-MM, por exemplo 2026-11.`; }
export function checkDate(iso, { maxYearsAhead = 1 } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return 'Escolha uma data válida.';
  const d = new Date(iso + 'T12:00:00'); if (isNaN(d)) return 'Escolha uma data válida.';
  const now = new Date(); if (d.getFullYear() < 2000) return 'A data parece antiga demais.';
  if (d > new Date(now.getFullYear() + maxYearsAhead, now.getMonth(), now.getDate())) return 'A data está muito no futuro.';
  return '';
}
