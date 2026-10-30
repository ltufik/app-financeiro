// "Atalhos do iPhone": a personal code and the steps for two shortcuts that send to /api/quick:
// Apple Pay (Atalhos → Automação → Transação) and Siri ("E aí Siri, gastei" + what was said).
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
  box.innerHTML = `<p class="small">Dois atalhos para lançar sem abrir o app, com um código só:</p>
    <ul class="small" style="margin:0"><li><strong>Apple Pay</strong>: cada compra por aproximação com o iPhone ou o relógio entra sozinha (valor, lugar e data).</li>
    <li><strong>Siri</strong>: diga "E aí Siri, gastei" e fale o gasto, como "45 na padaria no pix". Ótimo para pix e dinheiro.</li></ul>
    <p class="tiny muted">Quando a fatura ou o extrato chegar, o app junta tudo, sem duplicar. Cada atalho leva uns 5 minutos para montar, uma vez só.</p>
    ${fresh ? `<div class="status ok stack" style="display:block"><strong>Seu código</strong><p class="tiny" style="margin:4px 0 8px">Ele aparece só agora. Copie e use nos dois atalhos (campo Authorization). Se perder, é só gerar outro.</p>${copyBtn('código', 'Bearer ' + fresh)}</div>`
      : st ? `<p class="status ok">Atalho ligado desde ${new Date(st.created_at).toLocaleDateString('pt-BR')}. ${st.uses ? `${st.uses} ${st.uses === 1 ? 'lançamento recebido' : 'lançamentos recebidos'}, o último em ${new Date(st.last_used).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Nada recebido ainda: faça uma compra por aproximação ou fale com a Siri para testar.'}</p>` : ''}
    <div class="rowbtn"><button class="btn primary" type="button" id="apGen">${st || fresh ? 'Gerar um código novo' : 'Gerar meu código'}</button>${st || fresh ? '<button class="btn danger" type="button" id="apDel">Desligar</button>' : ''}</div>
    <details class="help"${fresh ? ' open' : ''}><summary>Atalho 1: compras com Apple Pay</summary><ol>
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
    </ol></details>
    <details class="help"><summary>Atalho 2: "E aí Siri, gastei"</summary><ol>
      <li>No app <strong>Atalhos</strong>, na aba <strong>Atalhos</strong>, toque em <strong>+</strong>. Dê o nome <strong>Gastei</strong>: é o que você vai falar para a Siri.</li>
      <li>Adicione a ação <strong>Ditar Texto</strong> (idioma: Português do Brasil).</li>
      <li>Adicione <strong>Obter Conteúdo da URL</strong> e cole este endereço: ${copyBtn('endereço', url + '?formato=texto')}</li>
      <li>Abra as opções da ação: <strong>Método</strong> POST; <strong>Cabeçalhos</strong>: <code>Authorization</code> com o seu código; <strong>Corpo da Solicitação</strong> JSON com um campo de texto <code>texto</code>, e no valor escolha a variável <strong>Texto Ditado</strong>.</li>
      <li>Adicione <strong>Falar Texto</strong> com a variável <strong>Conteúdo da URL</strong>: a Siri confirma o que lançou.</li>
      <li>Toque em <strong>OK</strong>. Teste: "E aí Siri, gastei" → "45 na padaria no pix". Dá para falar mais de um gasto de uma vez.</li>
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
