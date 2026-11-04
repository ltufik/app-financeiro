// Documentation sections for Central → Documentação, shipped by release r80 (addDocs) and kept in the seed of DOCS.
// What each feature does and the rules behind it, in plain words.
export const DOC_LANCAR = { id: 'lancar_documentos', title: 'Lançar: faturas, extratos e planilhas', body: `Tudo entra por Lançar → Fatura ou extrato: PDF, foto, print ou planilha, um ou vários de uma vez (até 10). O arquivo é lido no celular e nunca fica guardado.
## Como a pessoa descobre que pode mandar vários
- O botão Fatura ou extrato traz o selo "Vários de uma vez" e diz "PDF, foto ou planilha".
- Ao abrir, a caixa "O que dá para mandar" mostra os 4 casos: faturas de todos os cartões, extrato da conta (mesmo dividido), planilha Excel ou CSV, foto ou print.
- O botão diz "Escolher arquivos (um ou vários)" e "Como marcar vários arquivos no celular?" explica o iPhone (Selecionar) e o Android (segurar o dedo).
## O que é cada arquivo
- O app decide pelo conteúdo, nunca pela extensão: fatura, extrato, comprovante, nota fiscal ou investimentos.
- PDF com senha: o app pede a senha e não guarda.
- Fatura longa é lida em partes; uma parte que falha é tentada de novo.
## Vários arquivos de uma vez
- Uma fila no topo: "Arquivo 2 de 3", o que já foi salvo e o que vem depois.
- "Agora: …" diz o que fazer; a área de envio sai da frente e a revisão fica logo abaixo.
- Cada arquivo tem a sua revisão, com Salvar e Descartar sempre à vista. Salvou ou descartou, o próximo começa sozinho.
- Arquivo que não dá para ler mostra o motivo; no fim há "Tentar de novo".
- Enquanto lê: pop-up com o símbolo do app se montando, o passo e o percentual.
## Mesmo documento, outra parte ou outro cartão
| Situação | O que acontece |
| O mesmo arquivo de novo (quase todos os lançamentos batem nos dois sentidos) | Substitui o anterior |
| Outra parte do mesmo extrato (o banco dividiu em dois arquivos) | Entra só o que é novo; nada é apagado |
| Fatura de outro cartão no mesmo mês | Entra junto |
| Tudo do arquivo já está no app | Avisa que não há nada novo |
- Dois lançamentos são o mesmo quando têm o mesmo valor e o mesmo dia. Pix de mesmo valor em dias diferentes são lançamentos diferentes.
## Planilha (Excel ou CSV)
- Lê todas as abas, mesmo com título em cima; acha data, descrição, valor, categoria e conta ou cartão.
- A revisão mostra as colunas (dá para trocar) e para onde vai cada categoria da planilha: uma do app, criar ou deixar "a classificar".
- O que já está no app (mesmo valor, data até 3 dias) fica de fora. Se o extrato daquele mês chegar depois, ele substitui as linhas da planilha.
- O Excel é lido pela biblioteca SheetJS (jsDelivr, versão fixa); o robô confere a cada mudança que ela continua no ar.` };

export const DOC_CATEGORIAS = { id: 'categorias_doc', title: 'Categorias e como juntar', body: `Toda categoria é receita ou despesa: fixa, variável ou extra (fora da sobra), ou "não conta".
## Categorias parecidas
- O app sugere juntar quando: o nome é o mesmo (acento, plural), um nome está dentro do outro com no máximo uma palavra a mais e do mesmo tipo ("Saúde" e "Saúde e terapia"), há erro de digitação, ou são sinônimos comuns ("Farmácia" e "Remédios").
- Só despesa com despesa e receita com receita. Sugere manter a mais usada; dá para escolher a outra.
- "Manter separadas" não pergunta de novo. "Juntar com…" junta qualquer uma.
- Juntar move lançamentos, regras, partes de nota fiscal e orçamento, de uma vez (função merge_category no banco).
- O Início avisa quando há categorias parecidas.
## Extrato por categoria
- O filtro mostra cada categoria do mês com a quantidade; o total passa a ser só da escolhida.` };

export const DOC_AVISOS = { id: 'notificacoes_doc', title: 'Notificações: do servidor ao celular', body: `## Quem recebe o quê
| Quando | Quem recebe |
| Versão com novidade | Todos com notificação ligada (com o nome); quem pediu o item recebe só o recado personalizado |
| Item pedido ficou pronto | Quem pediu: recado no app e no celular (bug: pede para tentar de novo) |
| Avisos do dia | Fatura fechando, mês acabando, gasto alto, resumo de domingo, lembrete das 21h (um por dia no máximo) |
| Família | Alguém entrou, importou ou fechou o mês |
- Horário silencioso: nenhum push automático entre 22h e 8h (Brasília). Uma versão publicada à noite sai na primeira abertura do app depois das 8h, ou na rotina das 9h.
## Ligar
- O app nunca liga sozinho: convida (1 vez por dia, até 7, ao abrir ou ao voltar do bloqueio) e leva para Notificações.
- Depois de permitir, manda um teste e pergunta se apareceu; se não, mostra os ajustes do celular (iPhone, Samsung, outros Android).
## Tocar na notificação
- Leva ao lugar certo: novidade e recado abrem inteiros; teste abre Notificações; avisos do dia abrem a tela do assunto.
## Conferir
- Central → Avisos no celular: seus aparelhos, quem recebe e o push de teste.
- Central → Versões: para quantos aparelhos o push de cada versão chegou e quantos recados saíram.
- Se o push não sair, o motivo aparece em vermelho e a novidade fica livre para mandar de novo.` };

export const DOC_TESTES = { id: 'caderno_doc', title: 'Caderno de testes', body: `- Planejar → Caderno de testes lista o que testar num celular de verdade, por funcionalidade: passos e o que deve acontecer.
- "Robô também testa": o teste automático já confere a cada mudança (navegador do computador e Safari do iPhone).
- Antes de testar, confira a versão no fim do menu ☰ do celular ("versão v85"). Ela tem de ser a mesma da versão em teste; se for anterior, toque em "Tem versão nova: atualizar agora" ou feche o app de vez e abra de novo. A Central mostra a versão no topo, ao lado do e-mail.
- Marque Passou ou Falhou. Falhou vira bug no backlog, em Agora, com o que aconteceu.
- Toda versão com algo visível precisa trazer seus casos (Definição de pronto; o teste automático bloqueia a publicação sem eles).` };

export const DOC_SEGURANCA = { id: 'seguranca_doc', title: 'Segurança: desconectar por inatividade e entrar de novo', body: `Como nos apps de banco: o app não fica aberto com os números da família à vista.
## A jornada
| Momento | O que aparece |
| Parado, 30 s antes do tempo | Aviso "Ainda está aí? Por segurança, vamos desconectar em 30 segundos", com a contagem: Continuar no app ou Desconectar agora. Qualquer toque no app também conta como uso. |
| Passou o tempo (ou abriu o app depois dele) | Tela de entrada: símbolo do app, "Olá, Nome", "Você foi desconectado por inatividade" e o tempo. |
| Quem ligou a digital ou o rosto | Botão Entrar: só ao tocar o celular pede a digital ou o rosto. Nada aparece sozinho. "Entrar com a senha" fica embaixo. |
| Quem não ligou | Campo da senha e Entrar. Depois de entrar, o app oferece ligar a digital (até 3 vezes, uma por semana). |
| Não é a pessoa | "Não é você? Sair da conta" sai de vez e mostra a mensagem de segurança. |
## Regras
- Tempo no app: 1, 3, 5 (de fábrica), 15 ou 30 minutos, em menu ☰ → Dados e conta → Conta; vale para o aparelho. Não existe "nunca".
- Central do produto: 1 hora fixa (não tem números da família).
- A conta continua conectada por baixo (o login não cai): entrar de novo é só confirmar que é a pessoa. A digital e o rosto ficam no celular; o app guarda só a identificação da chave do aparelho.` };

export const NEW_DOCS = [DOC_LANCAR, DOC_CATEGORIAS, DOC_AVISOS, DOC_TESTES];

export const DOC_SONHO = { id: 'sonho_doc', title: 'O sonho e quanto a família guarda', body: `## De onde vêm os números
- Sobra do mês = receitas fixas e variáveis menos despesas fixas e variáveis (conta e cartão). Extras ficam fora.
- O sonho (valor e idade) é de cada família: menu ☰ → Família e metas → Metas.
## Cenários do sonho, no Início
| Cenário | De onde vem |
| Média dos últimos 3 meses | Calculada sempre: a média da sobra dos 3 últimos meses completos (com o extrato da conta, antes do mês atual). Se der negativa, conta como zero. Os meses aparecem ao lado. |
| O plano de vocês | O que a família disse em Metas que consegue guardar por mês, mais o extra por ano (13º, PLR, bônus). |
| + R$ 1.000 por mês | A média mais R$ 1.000. |
| Cenários salvos | Os que vieram de antes (por exemplo, do backup); dá para remover em Metas. |
- Um "Ritmo atual" com número fixo, vindo de planilha ou backup antigo, é trocado pela média calculada.
## Ver quanto guardaram
- Início: escolha o mês no topo para ver a sobra e a porcentagem guardada; o gráfico de barras mostra a taxa de cada mês.
- Gráficos prontos: "Quanto sobrou em cada mês", "Quanto já guardamos no ano" (acumulado) e "Quanto guardamos da renda".` };
