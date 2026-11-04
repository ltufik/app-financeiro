// Side menu (hamburger): the settings live here, one page per subject.
import { S } from './state.js';
import { $ } from './ui.js';
import { esc } from './lib/format.js';
import { menuNote } from './lib/pushask.js';

const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const SECTIONS = [
  { key: 'familia', title: 'Família e convites', desc: 'Nome da família, quem participa, convidar', group: 'fam', icon: I('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0"/>') },
  { key: 'divisao', title: 'Quem paga o quê', desc: 'Cartões e conta de cada pessoa, e o acerto do mês', group: 'fam', icon: I('<path d="M7 7h13M7 7l3-3M7 7l3 3M17 17H4M17 17l-3-3M17 17l-3 3"/>') },
  { key: 'metas', title: 'Metas', desc: 'Limite do cartão, quanto guardar e o sonho de vocês', group: 'fam', icon: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>') },
  { key: 'patrimonio', title: 'Patrimônio e dívidas', desc: 'Investimentos, bens, dívidas e dinheiro a receber', group: 'fam', icon: I('<path d="M3 10l9-6 9 6M5 10v9h14v-9M10 19v-5h4v5"/>') },
  { key: 'categorias', title: 'Categorias', desc: 'Criar categorias e decidir como contam', group: 'app', icon: I('<path d="M4 6h16M4 12h10M4 18h7"/>') },
  { key: 'avisos', title: 'Notificações', desc: 'Avisos no celular: fatura, gastos, resumo', group: 'app', icon: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>') },
  { key: 'applepay', title: 'Atalhos do iPhone', desc: 'Apple Pay e Siri: lançar sem abrir o app', group: 'app', icon: I('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2M9.5 9.5a3.5 3.5 0 0 1 5 0M8 7a6 6 0 0 1 8 0"/>') },
  { key: 'contexto', title: 'O que o assistente sabe', desc: 'Fatos da família para respostas melhores', group: 'app', icon: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>') },
  { key: 'ajuda', title: 'Ajuda', desc: 'Apresentação, tour guiado, instalar, aparência', group: 'ajuda', icon: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>') },
  { key: 'duvidas', title: 'Dúvidas', desc: 'Perguntas frequentes e pergunte o que quiser', group: 'ajuda', icon: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4M12 15.8h.01"/>') },
  { key: 'opiniao', title: 'Dar opinião', desc: 'Conte um erro, uma ideia ou uma crítica', group: 'ajuda', icon: I('<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>') },
  { key: 'backup', title: 'Backup', desc: 'Baixar ou importar os dados', group: 'dados', icon: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>') },
  { key: 'sobre', title: 'Sobre o app', desc: 'O que o app guarda, privacidade e créditos', group: 'dados', icon: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>') },
  { key: 'metricas', admin: true, title: 'Métricas do produto', desc: 'Funil, retenção e uso (só para você)', group: 'dados', icon: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>') },
  { key: 'conta', title: 'Conta', desc: 'Sair, sair da família, excluir conta', group: 'dados', icon: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
];

// The menu in groups, like the product console: tap a group to open it; the group of the page in use opens by itself.
export const GROUPS = [
  { id: 'fam', title: 'Família e metas', icon: I('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0"/>') },
  { id: 'app', title: 'Configurações', icon: I('<path d="M4 6h16M4 12h10M4 18h7"/>') },
  { id: 'ajuda', title: 'Ajuda e opinião', icon: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>') },
  { id: 'dados', title: 'Dados e conta', icon: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
];
let openGroup = null;
let lastFocus = null;
export function initMenu() {
  const btn = $('#menuBtn'), dr = $('#drawer'), bg = $('#drawerBg');
  btn.onclick = () => openMenu();
  bg.onclick = () => closeMenu();
  dr.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

export function openMenu() {
  const dr = $('#drawer'), bg = $('#drawerBg');
  const cur = SECTIONS.find(x => S.tab === 'ajustes' && x.key === S.sec);
  openGroup = cur?.group || openGroup || 'fam';
  const me = S.user?.user_metadata?.display_name || '';
  dr.innerHTML = `<div class="drawer-h"><div><div class="tiny muted">${esc(me)}</div><div class="drawer-fam">${esc(S.hh?.name || 'Pra Onde Foi')}</div></div>
      <button class="iconbtn" type="button" id="drawerX" aria-label="Fechar menu">${I('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div>
    <div class="drawer-groups">${GROUPS.map(g => {
      const items = SECTIONS.filter(x => x.group === g.id && (!x.admin || S.isAdmin)), open = g.id === openGroup;
      const alert = items.some(x => x.key === 'avisos') && menuNote(S.pushStatus);
      return `<div class="mgroup${open ? ' open' : ''}" data-g="${g.id}"><button type="button" class="mgh" aria-expanded="${open}" aria-controls="mg-${g.id}"><span class="di">${g.icon}</span><strong>${g.title}</strong>${alert && !open ? '<span class="mdot" aria-label="Notificações desligadas"></span>' : ''}<span class="mchev" aria-hidden="true">${I('<path d="M9 6l6 6-6 6"/>')}</span></button>
      <ul class="drawer-list" id="mg-${g.id}"${open ? '' : ' hidden'}>${items.map(x => `<li><button type="button" data-sec="${x.key}" ${S.tab === 'ajustes' && S.sec === x.key ? 'aria-current="page"' : ''}>
        <span><strong>${x.title}</strong><br><span class="tiny muted">${x.desc}</span>${x.key === 'avisos' && menuNote(S.pushStatus) ? `<br><span class="tiny dnote">${menuNote(S.pushStatus)}: toque para ligar</span>` : ''}</span></button></li>`).join('')}</ul></div>`; }).join('')}</div>
    <p class="tiny muted drawer-foot">Pra Onde Foi · versão de teste</p>`;
  lastFocus = document.activeElement;
  dr.hidden = bg.hidden = false; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { dr.classList.add('open'); bg.classList.add('open'); });
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  $('#drawerX').onclick = () => closeMenu();
  dr.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { S.sec = b.dataset.sec; closeMenu(false); S.go('ajustes'); });
  // One group open at a time; tapping the open one closes it.
  dr.querySelectorAll('.mgh').forEach(h => h.onclick = () => {
    const id = h.closest('.mgroup').dataset.g; openGroup = openGroup === id ? null : id;
    dr.querySelectorAll('.mgroup').forEach(g => { const on = g.dataset.g === openGroup; g.classList.toggle('open', on); g.querySelector('.mgh').setAttribute('aria-expanded', on); g.querySelector('.drawer-list').hidden = !on; const d = g.querySelector('.mdot'); if (d) d.hidden = on; });
  });
  (dr.querySelector('[aria-current]') || dr.querySelector('.mgh')).focus();
}

export function closeMenu(restore = true) {
  const dr = $('#drawer'), bg = $('#drawerBg');
  if (dr.hidden) return;
  dr.classList.remove('open'); bg.classList.remove('open'); document.body.style.overflow = '';
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  setTimeout(() => { dr.hidden = bg.hidden = true; }, 220);
  if (restore && lastFocus) lastFocus.focus?.();
}
