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
## Central do produto (separada do app)
- Login próprio: a Central guarda a sessão dela, à parte. Entrar no app não abre a Central; sair do app não fecha a Central, e sair da Central não tira ninguém do app. O e-mail e a senha são os da mesma conta (dono em ADMIN_EMAILS).
- Ajustes próprios em Central → Sua conta → Acesso e segurança: tempo para desconectar (30 minutos, 1 hora de fábrica, 2 ou 4 horas) e digital ou rosto, só para a Central.
- O mesmo aviso de 30 s e a mesma tela de entrada, com o texto da Central.
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

// Study of the main pains in personal finance tracking (web research, nov/2026): what hooks people and backlog ideas.
export const DOC_DORES = { id: 'pesquisa_dores', title: 'Pesquisa: as dores de quem tenta controlar o dinheiro', body: `Estudo feito em novembro de 2026 em pesquisas da CNDL/SPC Brasil, Serasa, Lina Open X/MindMiners, blogs de educação financeira e reclamações de apps. Serve para a comunicação e para o backlog.
## Os números
| Dor | Dado | Fonte |
| Quase ninguém controla o cartão | 58% dos usuários de cartão não fazem nenhum controle ativo; 14% só descobrem quanto gastaram quando a fatura fecha. Média de 2 cartões por pessoa | CNDL/SPC Brasil, jan/2026 (publicada abr/2026) |
| Controlar dá trabalho e a pessoa desiste | Quem controla usa caderno (18%) ou planilha (14%). Entre inadimplentes, quem não controla diz que já tentou e não ajudou (18%), falta disciplina (15%), falta tempo (15%), não sabe como (13%) | CNDL/SPC Brasil, 2026 e 2024 |
| Apps de finanças são pouco usados | Só 18,9% usam app de orçamento; 31,6% anotam à mão e 16,1% não controlam nada. 75,2% gostariam de ver todas as contas num app só | Lina Open X/MindMiners, dez/2025 |
| Medo de dar acesso ao banco | 76,8% conhecem o Open Finance, mas só 37,1% já compartilharam dados; 56,3% citam segurança e medo de golpe como maior preocupação | Lina Open X/MindMiners, dez/2025 |
| O mês acaba antes do salário | 53% dos trabalhadores terminam o mês sem dinheiro para todas as contas | Serasa Experian, jun/2026 |
| Juros invisíveis | 78% não sabem a taxa do rotativo; 26% já pagaram só o mínimo | CNDL/SPC Brasil, jan/2026 |
| Impulso, não falta de informação | 53% gastam mais do que o orçamento permite; 46% cedem ao impulso; 38% compram para se sentir melhor | CNDL/SPC Brasil, 2024 (inadimplentes) |
| Dinheiro vivo some do controle | 19,4% dizem que esquecem as compras em dinheiro, que não aparecem no extrato | SPC Brasil (pesquisa antiga, 2015) |
| Dinheiro gera briga em casa | 48% dos casados discutem por dinheiro: um gasta além do que pode (46%), prioridades diferentes (32%) | SPC Brasil/CNDL, citada pelo blog do Nubank (2021) |
- Apps concorrentes: as reclamações (Reclame Aqui, Mobills) falam de saldo que não bate e de conexão com o banco que cai depois do Open Finance. Em geral os apps de finanças retêm pouca gente depois de 30 dias (artigos de mercado citam cerca de 7%; dado sem fonte independente).
- Blogs de finanças: anotar o passado não muda comportamento; o que ajuda é olhar para frente (quanto ainda dá para gastar, metas) e aceitar imprevistos.
## O que isso diz sobre o Pra Onde Foi
- A dor número 1 é o trabalho de anotar. O nosso diferencial ataca isso direto: manda o PDF da fatura e do extrato, de qualquer banco, e o app separa tudo. Ninguém digita gasto por gasto.
- A dor número 2 é a confiança. Não pedimos senha do banco nem conexão (Open Finance); o arquivo é lido no celular e descartado. Isso tem de aparecer cedo e sempre.
- "Todas as faturas de todos os cartões num lugar só" responde aos 2 cartões por pessoa e aos 75% que querem tudo num app.
- Fisgar = mostrar valor em minutos: "descubra para onde foi o dinheiro de outubro em 10 minutos".
## Frases para a comunicação
- "Sem anotar nada: mande o PDF da fatura e do extrato e veja para onde foi o dinheiro."
- "Funciona com qualquer banco e nunca pede a senha do banco."
- "Todas as faturas de todos os cartões num lugar só, e o quanto sobrou no mês."
- "Quanto dá para gastar por dia até a fatura fechar."
## Feito a partir do estudo
- v88: selo "sem senha do banco" na página inicial, na tela de entrar e em Lançar.
## Ordem do backlog (aprovada em 04/11/2026)
- Agora: lembrete para mandar a fatura, pesquisa no app, saúde do servidor, histórico de outros apps, saques e dinheiro vivo.
- Próximo: retrospectiva do ano (começo de dezembro), parcelas comprometidas, juros da fatura, previsão do fim do mês, caixa a revisar, gastos anuais (antes de janeiro), resultado antes da conta, meu-seu-nosso, revisão de custos.
- Depois: e-mail próprio (antes de abrir ao público), notificações do banco, e-mail do banco, WhatsApp, Open Finance, lojas, versão web, plano pago, cobrança honesta, parcerias.
## Ideias que foram para o backlog
Lembrete para mandar a fatura quando ela fecha; juros e tarifas da fatura em destaque; saques e dinheiro vivo; ver o resultado antes de criar a conta; selo de confiança na entrada; trazer o histórico de outros apps. As parcelas já comprometidas (já no backlog) ganharam peso com a pesquisa.` };

export const DOC_PATRIMONIO = { id: 'patrimonio_doc', title: 'Patrimônio: financiamentos que diminuem sozinhos', body: `O patrimônio líquido é investimentos + bens − o que falta pagar. Até a v88, o "faltam" era só o número digitado (e ficava em dois lugares: no bem e no financiamento); nem parcelas nem amortizações abatiam. Bug relatado pelo Luiz (amortização de R$ 130 mil da casa de Guaratuba).
## Como funciona agora
- O bem é ligado ao financiamento (coluna Financiamento em Bens). O "faltam" vem sempre do financiamento. Bens antigos se ligam sozinhos pelo nome ou pelo mesmo saldo.
- Bem com "quanto falta pagar" e sem financiamento: ao salvar, o app cria o financiamento e pede juros, parcela e tipo de parcela.
- Saldo informado + data: a cada mês o app tira a parte da parcela que paga a dívida. Price (parcelas iguais): parcela − juros do mês. SAC (parcelas que diminuem): saldo ÷ meses que faltam. Os juros mensais saem dos anuais: (1 + taxa)^(1/12) − 1. Mostra "(estimado)".
- Amortização: (1) comprovante em Lançar: a revisão pergunta "Isso abate um financiamento?" (pagamento da conta com palavras como amortização ou financiamento, ou de R$ 1.000 para cima; escolhe sozinho pelo nome); (2) pagamento já salvo: "Pagamentos que parecem amortização" no Início e em Patrimônio (só os bem maiores que uma parcela); (3) à mão, em Registrar uma amortização.
- Ao abater: o saldo cai na hora, o patrimônio líquido sobe e o lançamento vai para a categoria "Amortização de financiamento" (não conta na sobra: o dinheiro virou patrimônio). "Não é" não pergunta de novo.
- Saldo digitado de novo (pelo extrato do banco) vale a partir daquele dia; amortizações registradas antes já estão nele.
- Histórico em Patrimônio e dívidas: saldo informado, amortizações e parcelas estimadas.
- Investimentos: o Início mostra o valor de hoje estimado pelo rendimento de Metas e pede o extrato novo para o valor real.
- O assistente (Perguntar) usa o saldo de hoje.
## Ainda não
- Ler o PDF do extrato do financiamento (hoje o saldo real é digitado). Item no backlog.` };
