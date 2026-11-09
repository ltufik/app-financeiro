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
| A fatura do cartão fechou | De 1 a 6 dias depois do fechamento, se a fatura ainda não chegou ao app: "Nome, a fatura do cartão fechou", que abre Lançar já no envio. Vem antes de qualquer outro aviso do dia, uma vez por fatura (preferência "Dados faltando"). Também aparece no Início |
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
- Antes de testar, confira a versão no fim do menu ☰ do celular. Não é preciso fechar o app: com o app aberto, aparece o pop-up "Tem uma versão nova do app" (Atualizar agora); na tela de entrada, o aviso diz que, ao entrar, ela já abre atualizada; e no fim do menu há "Tem versão nova: atualizar agora". A Central mostra a versão no topo, ao lado do e-mail.
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

export const DOC_PARCELAS = { id: 'parcelas_doc', title: 'Parcelas já comprometidas', body: `- Início → Próxima fatura: total das parcelas que ainda vão vir (da última fatura) e até quando; barras dos próximos 6 meses; "As que mais pesam" com valor por mês, quantas faltam e o mês da última.
- Conta como a próxima fatura: compra "03/10" soma nos 7 meses seguintes; a mesma compra repetida na fatura não conta duas vezes.
- Origem: dor da pesquisa (14% só descobrem o gasto quando a fatura fecha).` };

export const DOC_TARIFAS = { id: 'tarifas_doc', title: 'Quanto o banco cobrou', body: `- Início: juros e multas, IOF, anuidade e tarifas dos últimos 12 meses (fatura e extrato), com o total, por tipo, e "O que foi cobrado". Estorno de tarifa desconta.
- Reconhece pelo texto do lançamento: juros, encargos, rotativo, mora, multa, parcelamento de fatura; IOF; anuidade; tarifa, pacote ou cesta de serviços, manutenção de conta.
- Avisos (Início e celular, um de cada vez): juros ou multa no último mês com dados, em vermelho; senão, as tarifas do mês e dos 12 meses (no celular, no máximo a cada 60 dias).
- Origem: dor da pesquisa (78% não sabem a taxa do rotativo).
- Parcelas já comprometidas: validadas com os dados reais; o próximo mês bate (fev e mar exatos) e fica um pouco abaixo quando há compras parceladas novas, o que a tela explica.` };

export const DOC_RETRO_INICIO = { id: 'retro_inicio_doc', title: 'Retrospectiva do ano e Início dinâmico', body: `## Retrospectiva do ano
- Com 3 meses completos ou mais no ano, aparece no topo do Início ("A retrospectiva de 2026 está pronta") até a família abrir uma vez (neste aparelho). Depois, fica em Início → Mais detalhes → Retrospectiva do ano, e volta como cartão no topo em dezembro e janeiro.
- Só meses completos (com o extrato da conta): guardaram (soma das sobras) e a % da renda contra a meta, em quantos meses bateram a meta, receitas, despesas, o que o banco cobrou, melhor e pior mês, maior gasto do dia a dia (sem fixas nem financiamento), lançamentos, meses fechados e as 5 categorias que mais pesaram.
- Validado com os dados reais: a soma bate mês a mês.
- Compartilhar: só a porcentagem guardada e o convite para o app, sem valores (WhatsApp ou copiar).
## Início dinâmico
- Os avisos ficam no topo, antes da sobra. O que é novo ou mudou desde a última visita (neste aparelho) sobe e ganha a marca "Novo", ou "Depois do que vocês lançaram" até 30 minutos depois de salvar. Aparecem até 3 quando há novidade.
- Depois de salvar em Lançar (comprovante, fatura, extrato ou planilha), se surgiu um aviso importante ou bom, o app diz: "<título>. Veja no Início."
- Riscos que já sobem: fatura acima do limite, orçamento estourado ou perto, guardaram menos que a meta, mês no vermelho, juros na fatura. Um aviso de risco de não bater a meta no mês, olhando para frente, ainda precisa de uma conta validada (backlog).` };

export const DOC_HISTORIAS = { id: 'retro_historias_doc', title: 'Retrospectiva em histórias e níveis de economia', body: `## Quando aparece (v97)
- É do ano e se atualiza mês a mês: só com 3 meses completos (extrato da conta) ou mais. Cada mês fechado gera uma edição nova ("A retrospectiva de 2026 até outubro está pronta"), que sobe no topo do Início até ser aberta. Sem nenhum mês fechado, a primeira aparece com 3 meses completos. Ao fechar o mês, o aviso diz que a retrospectiva foi atualizada.
- Em janeiro: "O fechamento de 2026 está pronto", a edição completa e chamativa (fundo especial, confete no nível), com a evolução e onde melhorar para o ano seguinte.
- Primeira vez: uma tela antes dos números explica o que é e que ela se atualiza a cada mês fechado.
## Telas
- A retrospectiva abre em telas cheias, uma ideia por tela (toque à direita ou deslize para avançar; à esquerda volta): abertura, quanto guardaram, melhor e pior mês, para onde mais foi, maior gasto e o que o banco cobrou, patrimônio e o sonho (se o ritmo do ano leva até lá ou quanto precisa por mês), marcos do ano, o nível e compartilhar. "Ver tudo numa página" abre a página.
- Evolução (4 meses ou mais): barras da % guardada em cada mês, com a linha da meta, e a comparação da primeira com a segunda metade do ano.
- Onde dá para melhorar (até 3, para todos; "O caminho para sair do vermelho" para quem fechou no vermelho): meses no vermelho e o limite por categoria; quanto faltou por mês para a meta; a categoria do dia a dia que mais subiu da primeira para a segunda metade (sem fixas, financiamento ou categorias novas); o que o banco cobrou (a partir de R$ 100). Validado com os dados reais: junho no vermelho, R$ 3.330 por mês para a meta de 20%, Transporte de R$ 1.399 para R$ 1.982.
## Níveis (por porcentagem, justo para qualquer renda)
| Nível | Regra |
| Ouro | Guardaram a meta da família (ex.: 20%) ou mais e tiveram sobra em pelo menos 3 de cada 4 meses |
| Prata | Guardaram 10% da renda ou mais |
| Bronze | Fecharam o ano com sobra |
| Ponto de partida | No vermelho: mensagem de incentivo |
- A tela do nível diz quantos pontos faltam para o próximo. Cada nível tem a sua cor na tela.
## Marcos (só o que os dados provam; até 3)
- Amortização do financiamento no ano; dinheiro posto em categoria de investimento (só "começaram" se havia meses antes sem investir; categorias que misturam transferências entre contas ficam de fora); o mês em que saíram do vermelho; o grande gasto extra do ano (R$ 3.000 ou mais, despesa extra); a maior sequência de meses no azul (3 ou mais).
- Validado com os dados reais: Prata (12,8%, 8 de 9 meses no azul), "Em julho, saíram do vermelho" e o maior gasto extra de abril.
- Compartilhar: o nível e a porcentagem, sem valores.
## Fotos (v96)
- Cada tela tem uma foto do Pexels (grátis, cada foto usada uma vez no app) que lembra o que o texto diz: família sorrindo na abertura, cofrinho quando guardaram, família comemorando no melhor mês, família com as chaves da casa no patrimônio, mudança nos marcos, praia no nível e no fim.
- No vermelho, as fotos mudam: casal preocupado com as contas (quanto guardaram, melhor mês negativo) e pessoa preocupada no Ponto de partida.
- O app não sabe se quem está usando é homem ou mulher (não perguntamos e não adivinhamos pelo nome), por isso as fotos mostram casais e famílias.
- Sem internet, aparece a ilustração do app no lugar.` };

export const DOC_GASTOS_ANO = { id: 'gastos_ano_doc', title: 'Gastos do ano: IPVA, IPTU e escola', body: `Menu ☰ → Família e metas → Gastos do ano. O Início avisa quando acha pagamentos que voltam todo ano e, depois, quando os próximos 3 meses têm R$ 500 ou mais deles.
## Veículos e imóveis vêm do Patrimônio (v99)
- Cada bem tem tipo (imóvel, carro, moto, outro; o app sugere pelo nome) e estado (onde o veículo é registrado, onde o imóvel fica). Carro ou moto sem estado não salva: o IPVA depende dele. Trocou de carro ou de casa? Atualiza no Patrimônio e os gastos do ano acompanham.
- IPVA de cada veículo = valor do Patrimônio × alíquota do estado; à vista com o desconto do estado no mês de início; ou nas parcelas do estado. Ex.: Honda Civic de R$ 139 mil no ES (2%): R$ 2.780 no ano, R$ 2.363 à vista em abril (15%), ou 6x de R$ 463.
- Veículos do Patrimônio sem IPVA na lista aparecem como "Incluir nos gastos do ano?" (ou "Não paga IPVA", para isentos). Pagamento ao Detran achado no histórico pergunta "De qual veículo?", já com o mais provável.
- O estado usa a tabela FIPE do fim do ano anterior, por isso o pago pode diferir um pouco do calculado pelo valor de hoje.
## Como o app acha
- Nos últimos 12 meses, pelo recebedor (o banco não escreve "IPVA"): Detran, Sefaz, Secretaria da Fazenda, DARE, GARE = IPVA (só pagamentos de R$ 400 ou mais; os menores são taxas ou multas); licenciamento; IPTU, prefeitura, tributos municipais = IPTU; matrícula, material e uniforme escolar. Ministério da Fazenda, Receita Federal e DAS ficam de fora (impostos federais e de empresa).
- A família confirma: "Sim, volta todo ano" (com o estado do veículo) ou "Não". Valor alto de prefeitura pago uma vez (ex.: ITBI de R$ 18 mil) vem marcado "pode ter sido só uma vez".
- Meses com gasto extra que se repete: só categorias de natureza sazonal (escola, presentes, viagem, férias), porque com um ano de histórico não dá para saber o que se repete.
## Calendário e quanto separar
- Próximos 6 meses com cada pagamento: à vista no mês de início com o desconto; parcelado dividido pelas parcelas a partir do mês de início.
- "Separem R$ X por mês" = o menor valor mensal que, guardado a partir de agora, cobre cada mês quando ele chega.
- Valor do ano seguinte: o que foi pago no último ano, com faixa de ±5% (em SP, os valores dos veículos subiram 2,51% em 2026; não dá para supor que só caem). Valor digitado pela família vale como está.
- Pelo IPVA pago e a alíquota do estado, o app mostra o valor do veículo na tabela do estado (ex.: R$ 2.285 ÷ 4% = R$ 57 mil).
- Pago no ano: ✓ com o valor e o mês, e a diferença do previsto.
## À vista ou parcelado (pela situação da família)
| Situação | Sugestão |
| Juros na fatura nos últimos 3 meses, ou 2+ meses no vermelho nos últimos 6 | Parcelar sem juros (não usar cartão ou cheque especial para pagar à vista) |
| Investimentos cobrem o pagamento e a reserva (3 meses de despesas) continua | À vista se o desconto vale mais que o rendimento até a última parcela; senão, parcelar |
| A sobra média dos últimos 3 meses, até o mês do pagamento, cobre o valor à vista | Separar por mês e pagar à vista |
| Pagar à vista baixaria a reserva | Parcelar |
## Regras do IPVA 2026 (início, parcelas, desconto à vista)
SP jan, 5x, 3% (carro 4%, moto 2%) · RJ jan, 3x, 3% · MG fev, 3x, 3% · PR jan, 5x, 6% (1,9%) · SC jan, 3x · RS jan, 3% · DF fev, 6x, 10% · ES abr, 6x (abr a set), 15% na cota única até a 1ª data (carro 2%, moto 1%; Detran-ES) · BA fev, 5x, 15% · GO jan, 10x, 8% · PE fev, 10x, 7% · CE jan, 5x, 10% · MS jan, 5x, 15% · AM jan, 3x, 10% · AP mar, 6x, 20% · MA fev, 3x, 10% · MT mar, 8x, 5% · PA jan, 6x, 5% · PB mar, 3x, 10% · PI jan, 3x, 15% · RN mar, 7x · RR fev, 10x, 10% · SE mar, 10% · AC 5x, 10% · RO 5%. Fontes: Agência SP (Sefaz-SP), Terra e Exame (dez/2025–jan/2026). Rever todo ano.
- IPTU: depende da cidade; exemplo de São Paulo 2026 (3% à vista, até 10x, a partir de fevereiro), editável.
## Depois
- Ler o boleto do IPVA ou o carnê do IPTU (foto ou PDF) para trocar a estimativa pelo valor de verdade; FIPE automática pela marca e modelo; aviso no celular 60 dias antes.` };
export const DOC_PREVISAO = { id: 'previsao_doc', title: 'Previsão do mês e o pedido de domingo', body: `Início → "Previsão do mês": como o mês deve fechar e quanto cabe por dia para bater a meta.
## Como calcula (lib/monthend.js)
- Base: os últimos 3 meses completos (com extrato e fatura); precisa de pelo menos 2.
- Conta: o extrato do mês, se já veio; senão, a mediana dos meses anteriores (ou o já lançado, se for maior).
- Cartão (conta pelo mês da fatura): a fatura do mês, se já veio; senão, a fatura aberta informada + o ritmo normal de compras novas até o fechamento; sem nada, a mediana das faturas. Só a parte que entra na sobra (o resto é extra ou não conta).
- Meta: o percentual combinado em Metas sobre a renda fixa de sempre.
- Por dia: o ritmo normal de compras novas (cartão, sem parcelas e assinaturas) mais a folga acima da meta dividida pelos dias que faltam. Se não dá para bater a meta, mostra quanto cabe para não fechar no vermelho.
## A fatura aberta
- Se a fatura do mês já está no app, o pedido é da fatura aberta do mês seguinte (dia de fechamento tirado da última compra da fatura) e a previsão mostra quanto ela deve fechar.
- Pagamento que parece amortização e ainda não foi confirmado não entra na previsão.
- Um número só, do app do banco (soma dos cartões). Fica em households.settings.checkins; não vira lançamento.
- Se a fatura do mês já fechou e não veio o PDF, o app pergunta quanto veio.
## Domingo às 19h
- Push "Luiz, quanto está a fatura aberta?" com a previsão; o toque abre o Início no campo.
- Não pede se informou nos últimos 2 dias ou se a fatura do mês já está no app.
- Duas semanas seguidas sem resposta: passa a pedir a cada 2 semanas; respondeu, volta a ser semanal.
- Liga e desliga em Notificações → Previsão do mês.
## Validação com dados reais (abr. a set. de 2026)
- Com a fatura aberta do dia 20, o resultado (acima da meta, abaixo ou no vermelho) bateu em 5 de 6 meses; o erro típico da sobra ficou entre R$ 0,4 mil e R$ 4 mil (abril, com IPVA e extras, errou mais).
## Medir
- Central: "Informou a fatura aberta" contra "Tocou no aviso de domingo". Abaixo de 30% de resposta, mudar o jeito de pedir.` };
export const DOC_INICIO = { id: 'inicio_doc', title: 'Início: para fazer agora, previsão e nível do ano', body: `O Início pede ação, não só mostra números. Medimos se as pessoas agem e se voltam.
## Ordem
1. Seu próximo passo (aberto): UM item por vez. Primeiro o que é novo desde a última visita; senão o que pede decisão (amortização a confirmar, fechar o mês), depois os avisos com ação (ruim antes de alerta) e os primeiros passos. Os outros ficam em "Depois disso". Sem nada para fazer: "Vale ficar de olho" (o aviso ruim ou de alerta mais importante); sem nada: "Tudo em dia" e o próximo passo (domingo, a fatura aberta).
2. Previsão do mês (aberto): com a pergunta "Quanto está a fatura aberta hoje?" e o campo à vista.
3. Seções que abrem, cada uma com uma linha que já diz o principal: Nível do ano, Sobra do mês, Cartão, Quanto o banco cobrou, Outros avisos, Assinaturas e custos fixos, Patrimônio, O sonho de vocês, Quanto guardaram mês a mês, Retrospectiva e Quem pagou o quê. O app lembra quais a pessoa deixou abertas.
## Nível do ano (lib/closing.js, levelProgress)
- Conta os meses do ano com o extrato da conta.
- Bronze: sobra no ano. Prata: 10% da renda guardados. Ouro: a meta (Metas), 3 de cada 4 meses no azul e, a partir do 4º domingo da previsão, a fatura aberta em pelo menos metade dos domingos (uma janela por semana, de quinta a quarta).
- O que falta vem em reais por mês até dezembro, contando a renda de sempre dos meses que faltam (a meta cresce com ela).
- Validado com os números da família Elias: Prata (12,8%); para o Ouro, uns R$ 19,3 mil por mês até dezembro (R$ 57,8 mil no total).
## Medir
- Central → Painel: "Agiram no Início" (quem tocou em Para fazer agora, informou a fatura, confirmou amortização ou fechou o mês, entre quem usou) e quantos dias as pessoas voltam em 30.
- Eventos: inicio.acao, inicio.abriu_* (cada seção), inicio.previsao_checkin.` };
export const DOC_ENTREGAS = { id: 'entregas_doc', title: 'Avisos: registro das entregas e dos robôs', body: `Todo push passa por sendPush (api/_webpush.js), que avisa o registro da rodada em andamento (api/_pushlog.js, AsyncLocalStorage). Nada muda em quem chama.
## O que fica guardado (90 dias, só o servidor lê)
- push_log: quando, robô (diario, versao, lembrete, previsao, familia, teste, recado, novidade, saude), tipo (a tag do aviso), família, pessoa, se chegou, código da resposta e o erro. Nunca o texto nem as chaves do aparelho.
- job_runs: cada rodada dos robôs (quando, se deu certo, quanto tempo, o resumo).
## Robôs e janelas (lib/pushhealth.js)
- Avisos do dia e Novidades: 9h, todo dia (janela de 26 h). Lembrete: 21h (26 h). Previsão: domingo 19h (8 dias).
- Atrasado, última rodada com erro ou menos de 80% entregues (sem contar "aparelho saiu"): alerta.
## Onde ver e o alerta
- Central → Avisos no celular → "Entregas e robôs".
- Às 9h, depois dos robôs, se houver alerta: push para os aparelhos de quem está em ADMIN_EMAILS, abrindo essa página.
## Aparelhos
- Cada inscrição guarda o tipo (o que o celular informa), o último aviso entregue e as falhas seguidas (push_result, só o servidor). 5 falhas seguidas: sai da lista; o app inscreve de novo ao abrir, se tiver permissão (uma vez por versão).
- Central → Avisos no celular → Seus aparelhos: tipo, desde quando, último entregue, falhas e "Testar só este".
## Banco
- Rodar o schema.sql novo no Supabase (cria push_log e job_runs, com grant para o service_role).` };
export const DOC_SAUDE = { id: 'saude_doc', title: 'Saúde do servidor', body: `O app está no ar? api/health.js confere e lib/health.js decide a cor.
## O que é conferido
- Banco de dados (uma leitura simples), Login (saúde do Supabase Auth), Bibliotecas que o celular baixa (pdf.js e supabase-js nas CDNs, versões fixas): se falham, vermelho.
- Chaves dos avisos (VAPID) e do assistente: se faltam, amarelo. Mais de 2,5 s também é amarelo.
## Quando
- A cada hora: GitHub Actions (saude.yml) chama /api/health (resposta pública só com ok por item, sem detalhes). Três tentativas; se ficar vermelho, a rodada falha e o GitHub manda e-mail.
- Todo dia às 9h: o robô registra a conferência (job_runs "servidor"); se vermelho, entra no push de alerta ao dono.
## Onde ver
- Central → Painel, no topo: cor, cada conferência com o tempo e os últimos 7 dias.` };
export const DOC_CSP = { id: 'csp_doc', title: 'Proteção do navegador (CSP)', body: `A política de segurança diz ao navegador de onde o app pode carregar código, estilo, fotos e conexões. Se alguém conseguir injetar um script, o navegador recusa.
## O que é permitido (vercel.json)
- Código: o próprio site, cdnjs (pdf.js 3.11.174) e jsDelivr (supabase-js 2.45.4). Nenhum script dentro do HTML (boot.js no lugar) e nenhum onerror/onclick escrito no HTML.
- Estilos: o próprio site e o Google Fonts (estilos dentro das telas continuam permitidos). Fontes: Google Fonts. Fotos: o site, data:/blob: e Pexels.
- Conexões: o site, o Supabase (https e wss) e as CDNs acima. Nada de iframe nem formulário para fora; o app não pode ser aberto dentro de outro site.
## Em duas fases
1. Só observa (Content-Security-Policy-Report-Only): nada é bloqueado; o que seria bloqueado vira erro "Segurança (CSP) bloquearia …" na Central → Erros.
2. Bloqueia (Content-Security-Policy): depois de alguns dias sem nenhum desses erros nos celulares de verdade.
## Testes
- O e2e serve as páginas com a política valendo (bloqueando), mais o endereço do leitor de PDF de teste; qualquer recusa quebra "sem erros no console".` };
export const DOC_LIMITES = { id: 'limites_doc', title: 'Limite de uso das funções do servidor', body: `Para ninguém chamar as funções sem parar (abuso ou conta alta), cada uma tem limite por pessoa (api/_ratelimit.js).
## Limites
- Assistente (api/ai): 30 por minuto e 300 por dia, por pessoa.
- Atalho de compras (api/quick): 20 por minuto e 200 por dia, por código do atalho.
- Avisos da família (api/notify): 10 por minuto e 100 por dia. Push de teste (api/push-test): 5 por minuto e 30 por dia.
## Como conta
- No banco (rate_hit e rate_limits), comum a todas as instâncias do servidor; só o servidor chama. Sem o SQL rodado, conta por instância (menos preciso, mas limita).
- As chaves são o id da pessoa ou o hash do código, nunca e-mail ou token. Linhas com mais de 2 dias são apagadas aos poucos.
## Push só para serviços conhecidos
- O servidor só envia push para Google (FCM), Apple, Mozilla e Microsoft. Inscrição com outro endereço é recusada (ninguém usa o servidor para postar em endereço inventado).` };
export const DOC_ROBO_BACKLOG = { id: 'robo_backlog_doc', title: 'Claude no backlog (robô do GitHub)', body: `O Claude lê e muda o backlog da Central sem senha nem chave copiada: pelo robô do GitHub.
## Como funciona
- O robô (.github/workflows/backlog.yml) roda a cada 3 horas, quando o Claude manda um arquivo de mudanças e quando é acionado.
- Ele pede ao GitHub um token assinado (OIDC). O servidor (api/admin.js, api/_ghoidc.js) confere a assinatura do GitHub, o repositório (ltufik/app-financeiro), o ramo main e o arquivo do robô. Qualquer outra coisa é recusada.
- Com esse token, só duas coisas: ler o backlog e aplicar mudanças nele.
## Mudanças que o Claude pode fazer
- backlog/ops/AAAA-MM-DD-nome.json: lista de mudanças: incluir item, mudar campos (título, status, tipo, esforço, problema, notas, onde, origem, ordem), mudar status, mudar de posição. Campos desconhecidos são ignorados. Itens não são apagados (usa descartado).
- Item marcado como feito avisa quem pediu, como na Central.
- Depois de aplicado, o arquivo vai para backlog/ops/aplicados/ (fica o histórico).
## Cópia para o Claude ler
- backlog/backlog.json e backlog/BACKLOG.md: o backlog como está na Central (inclusive o que o Luiz mudou lá). Não editar à mão.` };

export const DOC_SAQUES = { id: 'saques_doc', title: 'Saques e dinheiro vivo', body: `Dinheiro sacado some do controle: o extrato só mostra "SAQUE". O app pergunta no que foi e divide o saque por categoria.
## Como funciona
- Lançar mostra "No que foi o dinheiro do saque?" para cada saque da conta dos últimos 70 dias (R$ 20 ou mais) que ainda não foi detalhado. Um por vez, do mais recente.
- A pessoa escreve ou fala em poucas palavras ("200 feira, 100 uber"). O app acha a categoria de cada parte pelas palavras do dia a dia (feira → Mercado, uber → Transporte...) e dá para trocar antes de salvar.
- O que não foi dito continua na categoria do saque. Se as partes passam do valor sacado, o app avisa e não salva.
- Salvo, o saque vira um lançamento dividido (como a nota fiscal): conta uma linha por parte na sobra do mês e nos gráficos.
- "Não lembro" deixa o saque como está e o app não pergunta mais sobre ele (fica em households.settings.cashSkip).
- No Início e no aviso das 9h aparece "R$ … em saques sem detalhe" enquanto houver algum.
- Regras em lib/cash.js (testadas); tela em cash.js.` };

export const DOC_REGRAS = { id: 'regras_aprendem_doc', title: 'Regras que aprendem', body: `Quando a pessoa muda a categoria de um lançamento, o app procura o nome por trás da descrição (IFOOD, UBER, DROGASIL...) e pergunta se tudo com esse nome vai para a mesma categoria.
## Como funciona
- Só pergunta quando outros lançamentos mudariam. Mostra quantos, de quais categorias e até 4 exemplos antes de aplicar.
- O nome é a primeira palavra útil da descrição (sem PIX, PAG, COMPRA, LTDA...). Se essa palavra aparece em 3 ou mais categorias (geral demais, como POSTO), usa as duas primeiras palavras (POSTO SHELL). A pessoa pode ajustar o nome; ele precisa aparecer no lançamento.
- Opções: "Sim, todos" (muda os lançamentos e cria a regra), "Só este" (só o lançamento, como antes).
- A regra vale para os próximos lançamentos, antes das regras do próprio app (prioridade 20); o que foi ensinado lançamento por lançamento continua valendo primeiro.
- Em Categorias, "Regras que vocês ensinaram" lista cada regra com quantos lançamentos ela cobre e "Desfazer": apaga a regra e devolve os lançamentos para a categoria que tinham antes (o app guarda o que mudou em households.settings.ruleLog).
- Regras em lib/learn.js (testadas); tela em learnask.js. Aparece no Extrato e no Fechar o mês.` };

export const DOC_REPETIDOS = { id: 'repetidos_doc', title: 'Lançado à mão + extrato (repetidos)', body: `O que a pessoa lança à mão (voz, texto, comprovante) conta no mês até o extrato ou a fatura chegar. Quando chega, fica um só.
## Na importação
- O app procura os lançamentos à mão da mesma origem (conta ou cartão) no mês em que o documento é salvo e em qualquer mês que as datas do documento cobrem (5 dias de folga), com o mesmo valor e datas até 5 dias de diferença. Cada linha do documento junta com um lançamento só.
- Na revisão aparecem em "Já lançados por você", marcados. Desmarcar mantém os dois.
- Ao salvar, fica a linha do banco, que recebe a categoria do lançamento à mão e a descrição dele como anotação (lib/dups.js mergeInto).
- Se o lançamento à mão abateu um financiamento, o abatimento passa para a linha do banco (não pergunta de novo nem abate duas vezes).
## Depois
- findDups (lib/dups.js) acha pares que sobraram (à mão + banco, mesmo valor, até 5 dias) e amortizações cujo lançamento à mão sumiu e cuja linha do extrato não está ligada. O Extrato mostra "apareceu duas vezes" com Juntar, Juntar todos e "Não é repetido" (households.settings.dupSkip). O Início e o aviso das 9h avisam ("repetidos").
- No Extrato, lançamento feito à mão tem o botão Apagar (com confirmação), a qualquer momento.` };

export const DOC_PESQUISA = { id: 'pesquisa_doc', title: 'Pesquisa de satisfação', body: `Cada pessoa vê no máximo uma pesquisa, escolhida pelo momento dela no app. Aparece como cartão no Início (nunca pop-up), com o nome, e responde uma pergunta por vez.
## Quem vê qual
- **Sem fatura** (sem_fatura): ainda não mandou fatura nem extrato. Pergunta o que impediu (PDF, receio com os dados, trabalho, tempo, senha...).
- **Um mês** (um_mes): mandou um mês, não fechou e entrou há 10 dias ou mais. Pergunta o que faltou para o próximo e se um aviso ajudaria.
- **Família** (familia): entrou por convite, a família já tem fatura e a pessoa usou 3 dias. Pergunta se ajuda a conversar e se quer gastos só seus.
- **Geral** (nps): 2 meses ou um mês fechado e 14 dias de app. Nota de 0 a 10, o que mais ajuda e o que falta.
## Regras
- Nunca para quem acabou de entrar: 3 dias desde a entrada e 2 dias de uso.
- No máximo uma a cada 30 dias. "Agora não" espera 7 dias; depois de 2, aquela pesquisa não aparece mais. Respondida não volta (a geral volta depois de 90 dias).
- Regras em lib/survey.js (testadas); tela em survey.js. Guarda em surveys (mostrou, adiou, respondeu; opções e textos curtos, nunca valores). Resultados em Central → Pesquisas (NPS, contagem por opção, textos).` };

export const DOC_PRIVADO = { id: 'meu_seu_nosso_doc', title: 'Meu, seu, nosso (lançamentos privados)', body: `Na família, cada pessoa pode deixar algo "só meu": um lançamento, ou uma fatura ou extrato inteiro. O resto da família vê só o total do mês, e a sobra continua certa.
## Onde marcar
- **Extrato**: botão "Só meu" no lançamento (e "Voltar para a família"). Só aparece em famílias com 2 pessoas ou mais.
- **Lançar falando ou escrevendo**: caixa "Só meu" antes de salvar.
- **Fatura ou extrato**: caixa "Só meu" na revisão. O app lembra por cartão (households.settings.privateCards) e já deixa marcada da próxima vez. Importação "só meu" não avisa a família.
## Como é garantido
- No banco: transactions.private_to. As regras de acesso (RLS) só mostram, mudam ou apagam um lançamento "só meu" para quem é dono. Ninguém marca como privado de outra pessoa; na importação, só vale dono que é da família.
- A família recebe private_totals: soma por mês, origem (conta ou cartão), pessoa e grupo da categoria, com a quantidade. Nunca descrição, data ou categoria.
- No app, cada total vira uma linha "Pessoal de Luana", só leitura, que conta na sobra pelo grupo (vgrp em monthCalc). Os gráficos mostram "Pessoal de Luana" como uma categoria.
- O robô das 9h lê tudo com a chave do servidor, mas troca o privado pelos totais antes de calcular os avisos (privatize): o detalhe nunca vai num push.
- Regras em lib/privacy.js (testadas, inclusive que a sobra é a mesma com detalhe ou com total) e testes de acesso em test_rls.sql.` };
