// "Install the app" sheet. Browsers do not let a site install itself, so we ask at the right moments:
// Android gets the native install dialog in one tap; iPhone gets the Safari steps; in-app browsers
// (Instagram, Facebook...) are told to open the link in Safari or Chrome first.
import { S } from './state.js';
import { $, toast } from './ui.js';
import { pendingInvite } from './onboarding.js';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const ua = navigator.userAgent;

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(ua);
export const isMobile = () => isIOS() || isAndroid();
const inAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Twitter|TikTok|Snapchat|; wv\)/i.test(ua);
const iosNotSafari = () => isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);

if (isStandalone()) lsSet('fin.installed', '1');

// The app was uninstalled: Chrome offers to install it again (beforeinstallprompt), or the installed-apps
// check comes back empty. Forget the old "installed" mark and start asking again.
export function markNotInstalled() {
  if (isStandalone()) return false;
  const was = lsGet('fin.installed') === '1';
  if (was) { lsSet('fin.installed', '0'); lsSet('fin.install.n', '0'); lsSet('fin.install.t', '0'); lsSet('fin.install.never', '0'); try { sessionStorage.removeItem('fin.install.asked'); } catch (e) { /* storage blocked */ } }
  return was;
}
export async function checkStillInstalled() {
  if (isStandalone() || lsGet('fin.installed') !== '1' || !navigator.getInstalledRelatedApps) return;
  try { const apps = await navigator.getInstalledRelatedApps(); if (!apps.length) return markNotInstalled(); } catch (e) { /* not supported */ }
  return false;
}

// Asks once per visit until the app is installed, unless the person chose "Não mostrar mais".
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
export function shouldAskInstall() {
  if (!isMobile() || isStandalone() || lsGet('fin.installed') === '1' || lsGet('fin.install.never') === '1') return false;
  return ssGet('fin.install.asked') !== '1';
}

const ICON_SHARE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-label="Compartilhar"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
const ICON_ADD = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

// note: extra line shown under the steps (e.g. "depois entre com seu e-mail").
export function askInstall({ note = '' } = {}) {
  if ($('.isheet')) return;
  lsSet('fin.install.n', String(+(lsGet('fin.install.n') || 0) + 1)); lsSet('fin.install.t', String(Date.now())); ssSet('fin.install.asked', '1');
  let body;
  if (inAppBrowser() || iosNotSafari()) {
    body = `<p>${iosNotSafari() ? 'No iPhone, o app só pode ser instalado pelo <strong>Safari</strong>.' : 'Você abriu o link dentro de outro app.'} Para instalar:</p>
      <ol class="isteps"><li><span class="sn">1</span><span>Toque em <strong>Copiar link</strong> abaixo.</span></li>
      <li><span class="sn">2</span><span>Abra o <strong>${isIOS() ? 'Safari' : 'Chrome'}</strong>, cole o link e siga as instruções que vão aparecer.</span></li></ol>
      <button class="btn primary" type="button" data-copy style="width:100%">Copiar link</button>`;
  } else if (isAndroid() && S.installEvt) {
    body = `<button class="btn primary" type="button" data-install style="width:100%;padding:14px">Instalar agora</button>
      <p class="tiny muted" style="text-align:center">O Android vai pedir para confirmar.</p>`;
  } else if (isAndroid()) {
    body = `<ol class="isteps"><li><span class="sn">1</span><span>Toque no menu <span class="ico">${ICON_MENU}</span> no canto de cima do Chrome. Não use o ícone de download: ele só salva a página.</span></li>
      <li><span class="sn">2</span><span>Role a lista e toque em <strong>Adicionar à tela inicial</strong> (em alguns celulares aparece <strong>Instalar app</strong>).</span></li>
      <li><span class="sn">3</span><span>Escolha <strong>Instalar</strong> (não "Criar atalho") e confirme.</span></li></ol>
      <p class="tiny muted"><strong>Não aparece a opção?</strong> Se estiver numa aba anônima, abra o endereço numa aba normal: a aba anônima não deixa instalar. Precisa ser o Chrome.</p>`;
  } else {
    body = `<ol class="isteps"><li><span class="sn">1</span><span>Toque em <span class="ico">${ICON_SHARE}</span> <strong>Compartilhar</strong>, na barra de baixo do Safari.</span></li>
      <li><span class="sn">2</span><span>Role e toque em <span class="ico">${ICON_ADD}</span> <strong>Adicionar à Tela de Início</strong>.</span></li>
      <li><span class="sn">3</span><span>Toque em <strong>Adicionar</strong>, no canto de cima.</span></li></ol>
      <div class="iarrow" aria-hidden="true">↓</div>`;
  }
  const el = document.createElement('div');
  el.className = 'isheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Instalar o app');
  el.innerHTML = `<div class="isheet-card">
    <div class="ihead"><img src="/icons/icon-192.png" alt="" width="52" height="52"><div><h3>Instale o Pra Onde Foi</h3><p class="small muted">Fica com ícone na tela do celular, abre em tela cheia e é mais rápido. Leva 10 segundos.</p></div></div>
    ${body}${note ? `<p class="tiny muted">${note}</p>` : ''}
    <div class="ilater"><button class="tour-skip" type="button" data-later>Agora não</button><button class="tour-skip" type="button" data-never>Não mostrar mais</button></div></div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('[data-later]').onclick = close;
  el.querySelector('[data-never]').onclick = () => {
    lsSet('fin.install.never', '1'); close();
    toast('Tudo bem! Quando quiser instalar, toque em "Instalar o app no celular" na tela de entrada ou no menu ☰ → Ajuda.', 'info');
  };
  const ib = el.querySelector('[data-install]');
  if (ib) ib.onclick = async () => {
    const evt = S.installEvt; if (!evt) return close();
    evt.prompt(); const r = await evt.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') lsSet('fin.installed', '1');
    S.installEvt = null; close();
  };
  const cb = el.querySelector('[data-copy]');
  if (cb) cb.onclick = async () => { try { await navigator.clipboard.writeText(location.origin + '/' + (pendingInvite() ? '?convite=' + pendingInvite() : '')); cb.textContent = 'Link copiado'; } catch (e) { cb.textContent = location.origin; } };
}

window.addEventListener('appinstalled', () => { lsSet('fin.installed', '1'); $('.isheet')?.remove(); });
