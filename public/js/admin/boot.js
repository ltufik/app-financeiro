/* Theme before the Central draws (kept out of the HTML for the security policy, CSP). */
try { var t = localStorage.getItem('fin.theme') || 'light'; if (t !== 'auto') document.documentElement.setAttribute('data-theme', t); } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
