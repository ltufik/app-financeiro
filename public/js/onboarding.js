// First-run onboarding (name, welcome, family, invites) and WhatsApp invites with the code in the link.
import * as db from './db.js';
import { S } from './state.js';
import { $, toast, validate, clearInvalid } from './ui.js';
import { checkName, parsePhoneBR, formatPhoneBR } from './lib/validate.js';
import { esc } from './lib/format.js';

export const RELATIONS = ['Cônjuge ou companheiro(a)', 'Namorado(a)', 'Filho(a)', 'Pai ou mãe', 'Irmão ou irmã', 'Outro parente', 'Amigo(a)'];
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } };

// ---------- invites ----------
// A link like https://app/?convite=ABCD1234 is remembered until the person signs in and accepts it.
export function captureInviteFromUrl() {
  const u = new URL(location.href), c = u.searchParams.get('convite');
  if (c) { lsSet('fin.invite', c.trim().toUpperCase()); u.searchParams.delete('convite'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
  return lsGet('fin.invite');
}
export const pendingInvite = () => lsGet('fin.invite');
export const clearInvite = () => lsDel('fin.invite');
export async function inviteInfo(code) {
  try { const { data, error } = await db.sb.rpc('invite_info', { p_code: code }); return error ? null : data; } catch (e) { return null; }
}
export const inviteLink = code => `${location.origin}/?convite=${encodeURIComponent(code)}`;
const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
export function inviteText(name, code) {
  return `Oi${name ? ', ' + firstName(name) : ''}! Estou usando o Pra Onde Foi para organizar as nossas contas e quero você junto. Toque no link para entrar na ${S.hh.name} (vale por 7 dias):\n${inviteLink(code)}`;
}
// With a phone the conversation opens directly; without it WhatsApp asks which contact to send to.
const waUrl = (text, phone) => `https://wa.me/${phone || ''}?text=` + encodeURIComponent(text);

// Invite form + list of invites already sent. Used in onboarding and in Ajustes.
export function renderInviter(box) {
  box.innerHTML = `<div class="stack">
    <div class="grid2"><label class="f">Nome<input type="text" id="ivName" autocomplete="off" maxlength="40" placeholder="Ex.: Ana"></label>
    <label class="f">Parentesco<select id="ivRel">${RELATIONS.map(r => `<option>${r}</option>`).join('')}</select></label></div>
    <label class="f">WhatsApp (opcional)<input type="tel" id="ivPhone" inputmode="tel" autocomplete="off" placeholder="(11) 98765-4321"></label>
    <p class="tiny muted" style="margin-top:-6px">Com o número, o WhatsApp abre direto na conversa da pessoa. Sem ele, você escolhe o contato no WhatsApp.</p>
    <div><button class="btn primary" type="button" id="ivGo">Criar convite</button></div>
    <div id="ivReady"></div>
    <div id="ivList"></div></div>`;
  $('#ivPhone', box).onblur = e => { const p = parsePhoneBR(e.target.value); if (p.phone) e.target.value = formatPhoneBR(p.phone); };
  $('#ivGo', box).onclick = async () => {
    clearInvalid(box);
    const nameEl = $('#ivName', box), phoneEl = $('#ivPhone', box);
    const name = nameEl.value.trim(), rel = $('#ivRel', box).value, ph = parsePhoneBR(phoneEl.value);
    if (!validate([[nameEl, checkName(name, 'o nome de quem você vai convidar', 2, 40)], [phoneEl, ph.error]])) return;
    $('#ivGo', box).disabled = true;
    try {
      const code = await db.createInvite(S.hh.id, name, rel, ph.phone);
      showReady($('#ivReady', box), name, code, ph.phone);
      nameEl.value = ''; phoneEl.value = '';
      drawList(box);
    } catch (e) { $('#ivReady', box).innerHTML = `<p class="status err">Não foi possível criar o convite. ${db.errorText(e)}</p>`; }
    finally { $('#ivGo', box).disabled = false; }
  };
  drawList(box);
}

function showReady(el, name, code, phone) {
  const text = inviteText(name, code);
  el.innerHTML = `<div class="confirm" style="border-color:var(--accent)">
    <p class="small">Convite para <strong>${esc(name)}</strong> pronto. Envie pelo WhatsApp: a pessoa toca no link e já entra na família, sem digitar código.</p>
    <div class="rowbtn" style="margin-top:10px"><a class="btn wa" href="${waUrl(text, phone)}" target="_blank" rel="noopener">${WA_ICON}Enviar pelo WhatsApp${phone ? ' para ' + esc(formatPhoneBR(phone)) : ''}</a><button class="btn" type="button" data-copy>Copiar link</button></div>
    <p class="tiny muted" style="margin-top:8px">Código, se precisar: <span class="code" style="font-size:15px">${esc(code)}</span></p></div>`;
  el.querySelector('[data-copy]').onclick = async e => {
    try { await navigator.clipboard.writeText(text); e.target.textContent = 'Link copiado'; }
    catch (err) { const i = document.createElement('input'); i.readOnly = true; i.value = inviteLink(code); i.style.marginTop = '8px'; e.target.closest('.confirm').append(i); i.select(); }
  };
}

async function drawList(box) {
  const el = $('#ivList', box); let list = [];
  try { list = await db.listInvites(S.hh.id); } catch (e) { return; }
  if (!list.length) { el.innerHTML = ''; return; }
  const now = Date.now();
  el.innerHTML = `<h3 style="margin-top:6px">Convites enviados</h3><ul class="list small">${list.map(i => {
    const st = i.used_by ? 'entrou' : new Date(i.expires_at).getTime() < now ? 'venceu' : 'aguardando';
    return `<li><span>${esc(i.invitee_name || 'Sem nome')}<br><span class="tiny muted">${esc([i.relation, i.invitee_phone ? formatPhoneBR(i.invitee_phone) : ''].filter(Boolean).join(' · '))}</span></span><span class="rowbtn"><span class="pill ${st === 'entrou' ? 'ok' : st === 'venceu' ? 'no' : 'at'}">${st}</span>${st === 'aguardando' ? `<a class="chip" href="${waUrl(inviteText(i.invitee_name, i.code), i.invitee_phone ? (i.invitee_phone.startsWith('55') ? i.invitee_phone : '55' + i.invitee_phone) : '')}" target="_blank" rel="noopener">Reenviar</a>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

const WA_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" style="margin-right:6px;vertical-align:-3px"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.4 11.4 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

// ---------- onboarding wizard ----------
const O = { step: 'name', share: null, onDone: null };
export const displayName = () => S.user?.user_metadata?.display_name || '';
const signupName = () => S.user?.user_metadata?.name || '';
// Family surname from the full name, skipping Brazilian suffixes (Elias Neto -> Elias).
const lastName = () => {
  const p = signupName().trim().split(/\s+/).filter(w => !/^(neto|neta|filho|filha|j[uú]nior|jr\.?|sobrinho|segundo|terceiro)$/i.test(w));
  return p.length > 1 ? p[p.length - 1] : '';
};

// mode 'full' (no family yet) or 'existing' (already in a family: only the missing name or a pending invite).
const after = () => pendingInvite() ? go('invited') : O.mode === 'existing' ? O.onDone() : go('share');
export function startOnboarding(mode, onDone) {
  O.mode = mode; O.onDone = onDone; O.share = null;
  if (!displayName()) go('name'); else after();
}

function go(step) { O.step = step; draw(); }

async function draw() {
  const b = $('#obBody'), n = esc(firstName(displayName()));
  if (O.step === 'name') {
    b.innerHTML = `<div class="brandbig">Olá!</div><p class="muted">Antes de começar: como você quer ser chamado no app?</p>
      <div class="panel stack"><label class="f">Seu nome ou apelido<input type="text" id="obName" autocomplete="given-name" placeholder="${esc(firstName(signupName()) || 'Seu nome')}"></label>
      ${firstName(signupName()) ? `<p class="tiny muted">Se deixar em branco, fica "${esc(firstName(signupName()))}".</p>` : ''}
      <button class="btn primary" type="button" id="obNext">Continuar</button></div>`;
    $('#obName').focus();
    const next = async () => {
      const v = $('#obName').value.trim() || firstName(signupName()); if (!validate([[$('#obName'), checkName(v, 'como você quer ser chamado', 2, 40)]])) return;
      $('#obNext').disabled = true;
      try { const { data } = await db.sb.auth.updateUser({ data: { display_name: v } }); if (data?.user) S.user = data.user; else S.user.user_metadata = { ...S.user.user_metadata, display_name: v }; } catch (e) { S.user.user_metadata = { ...S.user.user_metadata, display_name: v }; }
      db.updateMyMemberName(S.user.id, v).catch(() => {});
      after();
    };
    $('#obNext').onclick = next; $('#obName').onkeydown = e => { if (e.key === 'Enter') next(); };
    return;
  }
  if (O.step === 'invited') {
    const code = pendingInvite(); b.innerHTML = '<p class="muted">Carregando o convite...</p>';
    const info = await inviteInfo(code);
    if (!info || info.status !== 'ok') {
      clearInvite();
      b.innerHTML = `<div class="brandbig">Boas-vindas, ${n}!</div><div class="banner at">${!info ? 'Não encontramos este convite.' : info.status === 'used' ? 'Este convite já foi usado.' : 'Este convite venceu.'} Peça um novo a quem convidou você, ou crie a sua própria família.</div><div><button class="btn primary" type="button" id="obNext">Continuar</button></div>`;
      $('#obNext').onclick = () => after(); return;
    }
    b.innerHTML = `<div class="brandbig">Boas-vindas, ${n}!</div>
      <div class="panel stack"><p><strong>${esc(info.inviter || 'Alguém')}</strong> convidou você para participar da <strong>${esc(info.family)}</strong>.</p>
      <p class="small muted">Vocês vão ver os mesmos números e poderão lançar gastos juntos.</p>
      <button class="btn primary" type="button" id="obJoin">Entrar na ${esc(info.family)}</button>
      <button class="btn" type="button" id="obNo">Agora não</button><p class="err" id="obErr"></p></div>`;
    $('#obJoin').onclick = async () => {
      $('#obJoin').disabled = true;
      try { const h = await db.acceptInvite(code, displayName()); clearInvite(); lsSet('fin.hh', h); O.onDone(); }
      catch (e) { $('#obErr').textContent = 'Não foi possível entrar. ' + (/used/.test(e.message) ? 'O convite já foi usado.' : /expired/.test(e.message) ? 'O convite venceu.' : 'Tente de novo.'); $('#obJoin').disabled = false; }
    };
    $('#obNo').onclick = () => { clearInvite(); after(); };
    return;
  }
  if (O.step === 'share') {
    b.innerHTML = `<div class="brandbig">Boas-vindas, ${n}!</div>
      <p class="muted">Vamos montar o seu espaço. Você divide as contas da casa com alguém?</p>
      <div class="stack"><button class="btn choice" type="button" data-s="1"><strong>Sim, com a minha família</strong><span class="small muted">Cônjuge, filhos ou quem mora com você. Vocês veem os mesmos números.</span></button>
      <button class="btn choice" type="button" data-s="0"><strong>Não, só eu</strong><span class="small muted">Você pode convidar alguém depois.</span></button></div>
      <details class="help"><summary>Recebi um código de convite</summary><div class="rowbtn" style="margin-top:8px"><input type="text" id="obCode" autocomplete="off" style="text-transform:uppercase;flex:1 1 160px" placeholder="Código"><button class="btn" type="button" id="obCodeGo">Usar código</button></div></details>`;
    b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { O.share = x.dataset.s === '1'; go('famname'); });
    $('#obCodeGo').onclick = () => { const c = $('#obCode').value.replace(/\s/g, '').toUpperCase(); if (!validate([[$('#obCode'), /^[A-Z0-9]{6,12}$/.test(c) ? '' : 'O código tem 8 letras e números, como no convite.']])) return; lsSet('fin.invite', c); go('invited'); };
    return;
  }
  if (O.step === 'famname') {
    const sug = O.share ? (lastName() ? 'Família ' + lastName() : 'Nossa família') : 'Finanças de ' + firstName(displayName());
    b.innerHTML = `<div class="brandbig">${O.share ? 'Como vamos chamar a família?' : 'Como vamos chamar o seu espaço?'}</div>
      <div class="panel stack"><label class="f">Nome<input type="text" id="obFam" placeholder="${esc(sug)}" maxlength="60"></label>
      <p class="tiny muted">Se deixar em branco, fica "${esc(sug)}". Dá para mudar depois no menu ☰.</p>
      <button class="btn primary" type="button" id="obCreate">Criar</button><button class="btn" type="button" id="obBack">Voltar</button><p class="err" id="obErr"></p></div>`;
    $('#obCreate').onclick = async () => {
      const name = $('#obFam').value.trim() || sug; if (!validate([[$('#obFam'), checkName(name, 'um nome para a família', 2, 60)]])) return;
      $('#obCreate').disabled = true;
      try {
        const h = await db.createHousehold(name, displayName()); lsSet('fin.hh', h);
        S.hh = { id: h, name, settings: {} };
        if (O.share) go('invite'); else O.onDone();
      } catch (e) { $('#obErr').textContent = 'Não foi possível criar. ' + db.errorText(e); $('#obCreate').disabled = false; }
    };
    $('#obBack').onclick = () => go('share');
    return;
  }
  if (O.step === 'invite') {
    b.innerHTML = `<div class="brandbig">Quem mais participa?</div>
      <p class="muted">Crie um convite para cada pessoa e mande pelo WhatsApp. Ela toca no link e já entra na ${esc(S.hh.name)}.</p>
      <div class="panel" id="obInviter"></div>
      <button class="btn primary" type="button" id="obDone">Continuar para o app</button>
      <p class="tiny muted">Você também pode convidar depois, pelo menu ☰, em Família e convites.</p>`;
    renderInviter($('#obInviter'));
    $('#obDone').onclick = () => O.onDone();
  }
}
