/* Runs before the app (no module, no defer): kept out of the HTML so the browser's security policy (CSP) does not
   need to allow inline scripts. */
/* Chrome can offer the install before the app's modules load: keep the event for later. */
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__bip = e; });
/* Appearance: light (Mar aberto) by default; "dark" or "auto" (follow the phone) when chosen in the menu. */
try { var t = localStorage.getItem('fin.theme') || 'light'; if (t !== 'auto') document.documentElement.setAttribute('data-theme', t); } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
