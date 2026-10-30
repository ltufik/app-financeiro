// Side menu (hamburger): the settings live here, one page per subject.
import { S } from './state.js';
import { $ } from './ui.js';
import { esc } from './lib/format.js';

const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const SECTIONS = [
  { key: 'familia', title: 'Família e convites', desc: 'Nome da família, quem participa, convidar', icon: I('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0"/>') },
  { key: 'divisao', title: 'Quem paga o quê', desc: 'Cartões e conta de cada pessoa, e o acerto do mês', icon: I('<path d="M7 7h13M7 7l3-3M7 7l3 3M17 17H4M17 17l-3-3M17 17l-3 3"/>') },
  { key: 'metas', title: 'Metas', desc: 'Limite do cartão, quanto guardar e o sonho de vocês', icon: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>') },
  { key: 'patrimonio', title: 'Patrimônio e dívidas', desc: 'Investimentos, bens, dívidas e dinheiro a receber', icon: I('<path d="M3 10l9-6 9 6M5 10v9h14v-9M10 19v-5h4v5"/>') },
  { key: 'categorias', title: 'Categorias', desc: 'Criar categorias e decidir como contam', icon: I('<path d="M4 6h16M4 12h10M4 18h7"/>') },
  { key: 'avisos', title: 'Notificações', desc: 'Avisos no celular: fatura, gastos, resumo', icon: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>') },
  { key: 'contexto', title: 'O que o assistente sabe', desc: 'Fatos da família para respostas melhores', icon: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>') },
  { key: 'ajuda', title: 'Ajuda', desc: 'Apresentação, tour guiado, instalar, aparência', icon: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>') },
  { key: 'duvidas', title: 'Dúvidas', desc: 'Perguntas frequentes e pergunte o que quiser', icon: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4M12 15.8h.01"/>') },
  { key: 'opiniao', title: 'Dar opinião', desc: 'Conte um erro, uma ideia ou uma crítica', icon: I('<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>') },
  { key: 'backup', title: 'Backup', desc: 'Baixar ou importar os dados', icon: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>') },
  { key: 'sobre', title: 'Sobre o app', desc: 'O que o app guarda, privacidade e créditos', icon: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>') },
  { key: 'metricas', admin: true, title: 'Métricas do produto', desc: 'Funil, retenção e uso (só para você)', icon: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>') },
  { key: 'conta', title: 'Conta', desc: 'Sair, sair da família, excluir conta', icon: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
];

let lastFocus = null;
export function initMenu() {
  const btn = $('#menuBtn'), dr = $('#drawer'), bg = $('#drawerBg');
  btn.onclick = () => openMenu();
  bg.onclick = () => closeMenu();
  dr.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

export function openMenu() {
  const dr = $('#drawer'), bg = $('#drawerBg');
  const me = S.user?.user_metadata?.display_name || '';
  dr.innerHTML = `<div class="drawer-h"><div><div class="tiny muted">${esc(me)}</div><div class="drawer-fam">${esc(S.hh?.name || 'Pra Onde Foi')}</div></div>
      <button class="iconbtn" type="button" id="drawerX" aria-label="Fechar menu">${I('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
    <ul class="drawer-list">${SECTIONS.filter(s => !s.admin || S.isAdmin).map(s => `<li><button type="button" data-sec="${s.key}" ${S.tab === 'ajustes' && S.sec === s.key ? 'aria-current="page"' : ''}>
      <span class="di">${s.icon}</span><span><strong>${s.title}</strong><br><span class="tiny muted">${s.desc}</span></span></button></li>`).join('')}</ul>
    <p class="tiny muted drawer-foot">Pra Onde Foi · versão de teste</p>`;
  lastFocus = document.activeElement;
  dr.hidden = bg.hidden = false; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { dr.classList.add('open'); bg.classList.add('open'); });
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  $('#drawerX').onclick = () => closeMenu();
  dr.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { S.sec = b.dataset.sec; closeMenu(false); S.go('ajustes'); });
  (dr.querySelector('[aria-current]') || dr.querySelector('[data-sec]')).focus();
}

export function closeMenu(restore = true) {
  const dr = $('#drawer'), bg = $('#drawerBg');
  if (dr.hidden) return;
  dr.classList.remove('open'); bg.classList.remove('open'); document.body.style.overflow = '';
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  setTimeout(() => { dr.hidden = bg.hidden = true; }, 220);
  if (restore && lastFocus) lastFocus.focus?.();
}
