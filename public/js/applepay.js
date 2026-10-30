// "Compras com Apple Pay": a personal code and the steps to create the iPhone automation
// (Atalhos → Automação → Transação) that sends each Wallet purchase to /api/quick.
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './lib/format.js';
import { $, toast, confirmInline } from './ui.js';
import { track } from './usage.js';

const newCode = () => { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const sha256 = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(x => x.toString(16).padStart(2, '0')).join('');
const copyBtn = (label, value) => `<div class="apcopy"><code>${esc(value)}</code><button class="chip" type="button" data-copy="${esc(value)}">Copiar ${label}</button></div>`;

export async function renderApplePay(box, fresh = null) {
  const { data: st } = await db.sb.rpc('quick_token_status', { p_household: S.hh.id });
  const url = location.origin + '/api/quick';
  box.innerHTML = `<p class="small">No iPhone, cada compra que você fizer por aproximação (Apple Pay) pode entrar sozinha no app: valor, lugar e data. Leva uns 5 minutos para configurar, uma vez só.</p>
    <p class="tiny muted">Funciona só para compras feitas com o iPhone ou o relógio (Apple Pay). As outras continuam vindo pela fatura. Quando a fatura chegar, o app junta as duas, sem duplicar.</p>
    ${fresh ? `<div class="status ok stack" style="display:block"><strong>Seu código</strong><p class="tiny" style="margin:4px 0 8px">Ele aparece só agora. Copie e use no passo 7. Se perder, é só gerar outro.</p>${copyBtn('código', 'Bearer ' + fresh)}</div>`
      : st ? `<p class="status ok">Atalho ligado desde ${new Date(st.created_at).toLocaleDateString('pt-BR')}. ${st.uses ? `${st.uses} ${st.uses === 1 ? 'compra recebida' : 'compras recebidas'}, a última em ${new Date(st.last_used).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Nenhuma compra recebida ainda: faça uma compra por aproximação para testar.'}</p>` : ''}
    <div class="rowbtn"><button class="btn primary" type="button" id="apGen">${st || fresh ? 'Gerar um código novo' : 'Gerar meu código'}</button>${st || fresh ? '<button class="btn danger" type="button" id="apDel">Desligar</button>' : ''}</div>
    <details class="help"${fresh ? ' open' : ''}><summary>Como montar o atalho no iPhone</summary><ol>
      <li>Abra o app <strong>Atalhos</strong> (já vem no iPhone) e toque em <strong>Automação</strong>, embaixo.</li>
      <li>Toque em <strong>+</strong> (ou <strong>Nova Automação</strong>) e escolha <strong>Transação</strong>, o ícone da Carteira.</li>
      <li>Em <strong>Cartão</strong>, escolha os seus cartões. Deixe as categorias todas marcadas. Marque <strong>Executar Imediatamente</strong> e toque em <strong>Avançar</strong>.</li>
      <li>Toque em <strong>Novo Atalho em Branco</strong>.</li>
      <li>Busque a ação <strong>Obter Conteúdo da URL</strong> e toque nela.</li>
      <li>No lugar de "URL", cole este endereço: ${copyBtn('endereço', url)}</li>
      <li>Toque na setinha ao lado da ação para abrir as opções:
        <br>• <strong>Método</strong>: POST
        <br>• <strong>Cabeçalhos</strong> → Adicionar: chave <code>Authorization</code> e, no valor, cole o seu código (começa com "Bearer").
        <br>• <strong>Corpo da Solicitação</strong>: JSON. Adicione três campos de texto: <code>valor</code>, <code>loja</code> e <code>cartao</code>. Em cada valor, toque e escolha a variável <strong>Entrada do Atalho</strong>, depois toque nela de novo e escolha, na ordem: <strong>Valor</strong>, <strong>Comerciante</strong> e <strong>Cartão ou Passe</strong>.</li>
      <li>Opcional: adicione a ação <strong>Mostrar Notificação</strong> com a variável <strong>Conteúdo da URL</strong>. Assim, a cada compra aparece "Lançado no Pra Onde Foi: ...".</li>
      <li>Toque em <strong>OK</strong>. Pronto: faça uma compra por aproximação e veja aqui o contador subir.</li>
    </ol><p class="tiny muted">Os nomes podem mudar um pouco de uma versão do iPhone para outra. Travou? Mande uma opinião pelo balão no topo com um print.</p></details>`;
  box.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copiado.'); } catch (e) { const c = b.previousElementSibling; const r = document.createRange(); r.selectNodeContents(c); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selecionei: copie com o menu do celular.', 'info'); }
  });
  $('#apGen').onclick = async e => {
    if (!await confirmInline(e.target, { text: st ? 'Gerar um código novo? O antigo para de funcionar e você precisa trocar no atalho do iPhone.' : 'Gerar o seu código para o atalho do iPhone?', yes: 'Sim, gerar' })) return;
    const code = newCode();
    const { error } = await db.sb.rpc('save_quick_token', { p_household: S.hh.id, p_hash: await sha256(code) });
    if (error) return toast('Não foi possível gerar o código. Tente de novo.');
    track('applepay.codigo'); toast('Código gerado. Copie e siga o passo a passo.');
    renderApplePay(box, code);
  };
  const del = $('#apDel');
  if (del) del.onclick = async e => {
    if (!await confirmInline(e.target, { text: 'Desligar o atalho? As próximas compras com Apple Pay não entram mais sozinhas. O que já entrou continua.', yes: 'Sim, desligar', danger: true })) return;
    const { error } = await db.sb.rpc('delete_quick_token', { p_household: S.hh.id });
    if (error) return toast('Não foi possível desligar. Tente de novo.');
    toast('Atalho desligado.'); renderApplePay(box);
  };
}
