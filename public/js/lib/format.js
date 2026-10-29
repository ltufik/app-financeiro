// Formatting and date helpers (pt-BR).
export const brl = v => (v < 0 ? '−' : '') + Math.abs(+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl0 = v => (v < 0 ? '−' : '') + 'R$ ' + Math.round(Math.abs(+v || 0)).toLocaleString('pt-BR');
export const pct = v => Math.round((+v || 0) * 100) + '%';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const round2 = v => Math.round((+v || 0) * 100) / 100;

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mLong = k => { const [y, m] = k.split('-'); return MONTHS[+m - 1] + ' de ' + y; };
export const mShort = k => MONTHS[+k.split('-')[1] - 1].slice(0, 3);
export const addM = (k, n) => { let [y, m] = k.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
export const diffM = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
export const todayISO = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const thisMonth = () => todayISO().slice(0, 7);
export const isoToBr = iso => (iso || '').split('-').reverse().join('/');

// Normalized text for matching: uppercase, no accents, single spaces.
export const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// The card statement a purchase falls in: purchases on or after the closing day go to the next month's statement.
export const cycleMonth = (iso, closeDay = 24) => { const [y, m, d] = iso.split('-').map(Number); const k = y + '-' + String(m).padStart(2, '0'); return d >= closeDay ? addM(k, 1) : k; };
