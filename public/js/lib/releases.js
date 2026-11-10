// Release manifest: one entry per version of the app (`version` = VERSION in public/sw.js).
// Each entry has the "O que mudou" note shown to everyone in a pop-up (or `semNovidade` with the reason),
// the backlog ids it finishes (they get the personal message) and new backlog items.
// The server applies each entry once, at the first app opening after the deploy.
// tests/release.test.mjs blocks a release without its entry (Definição de pronto, see CLAUDE.md).
import { BUG_STUDY } from './bugstudy.js';
import { NEW_DOCS, DOC_AVISOS, DOC_SONHO, DOC_SEGURANCA, DOC_LANCAR, DOC_TESTES, DOC_DORES, DOC_PATRIMONIO, DOC_PARCELAS, DOC_TARIFAS, DOC_RETRO_INICIO, DOC_HISTORIAS, DOC_GASTOS_ANO, DOC_PREVISAO, DOC_INICIO, DOC_ENTREGAS, DOC_SAUDE, DOC_CSP, DOC_LIMITES, DOC_ROBO_BACKLOG, DOC_SAQUES, DOC_REGRAS, DOC_REPETIDOS, DOC_PESQUISA, DOC_PRIVADO, DOC_MENSAGENS, DOC_MISSOES } from './docsections.js';

export const RELEASES = [
  { id: 'r27', version: 'v26', at: '2026-10-30T15:00:00Z', backlog: [], news: { id: 'n20261030', title: 'Sua opinião agora tem lugar no app', items: [
    'Toque no balão no topo para mandar um erro, uma ideia ou uma crítica, falando ou escrevendo.',
    'Menu ☰ → Dúvidas: as perguntas mais comuns e um assistente que responde as outras.',
    'Metas mais claras: limite do cartão, quanto guardar e o sonho de vocês.',
    'Quem paga o quê, assinaturas e modo privacidade (o olho no topo).',
  ] } },
  { id: 'r33', version: 'v33', semNovidade: 'Testando o atalho do Apple Pay; a novidade sai junto com a da Siri (v35).', at: '2026-10-30T22:30:00Z', backlog: [], addBacklog: [
    { id: 'notificacoes_do_banco_android', title: 'Lançamento automático pelas notificações do banco (Android)', status: 'proximo', origin: 'Equipe', effort: 'G', problem: 'Todo mundo esquece de lançar; o banco já avisa cada compra, Pix e TED no celular', cost: true, notes: 'Exige o app na Play Store (US$ 25 uma vez) e a permissão Acesso a notificações. Pegar prints das notificações dos bancos dos testadores.', from: [], where: '' },
    { id: 'compras_com_apple_pay_atalho_do_iphone', title: 'Compras com Apple Pay entram sozinhas (atalho do iPhone)', status: 'feito', origin: 'Equipe', effort: 'M', problem: 'iPhone não deixa ler notificações de outros apps', cost: false, notes: '', from: [], where: 'Menu ☰ → Compras com Apple Pay' },
  ] },
  { id: 'r34', version: 'v34', semNovidade: 'Saiu na v35, junto com o resto do pacote.', at: '2026-10-30T23:30:00Z', backlog: [], addBacklog: [
    { id: 'siri_gastei', title: 'Lançar falando com a Siri ("E aí Siri, gastei")', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Lançar sem abrir o app', cost: false, notes: '', from: [], where: 'Menu ☰ → Atalhos do iPhone' },
    { id: 'atalhos_no_icone_android', title: 'Atalhos no ícone do app (falar, nota, PDF)', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Lançar em um toque', cost: false, notes: '', from: [], where: 'Segurar o ícone do app (Android)' },
    { id: 'lembrete_fim_do_dia', title: 'Lembrete do fim do dia (21h, só se não lançou nada)', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Todo mundo esquece o pix e o dinheiro', cost: false, notes: '', from: [], where: 'Menu ☰ → Notificações' },
    { id: 'compartilhar_comprovante', title: 'Compartilhar comprovante de Pix/TED com o app (Android)', status: 'feito', origin: 'Equipe', effort: 'M', problem: 'Transferências pequenas ficam de fora até o extrato', cost: false, notes: '', from: [], where: 'Botão Compartilhar do app do banco' },
    { id: 'macrodroid_teste_notificacoes', title: 'Teste das notificações do banco com MacroDroid (Android, sem loja)', status: 'ideia', origin: 'Equipe', effort: 'P', problem: 'Validar o formato das notificações de cada banco antes do app da Play Store', cost: false, notes: '', from: [], where: '' },
    { id: 'lancar_pelo_email_do_banco', title: 'Lançar pelo e-mail que o banco manda a cada compra e Pix', status: 'depois', origin: 'Equipe', effort: 'M', problem: 'Muitos bancos avisam por e-mail', cost: false, notes: 'Precisa do domínio e do e-mail próprio', from: [], where: '' },
    { id: 'whatsapp_lancar', title: 'Lançar pelo WhatsApp (áudio, texto ou comprovante)', status: 'depois', origin: 'Equipe', effort: 'G', problem: 'Canal que o brasileiro mais usa', cost: true, notes: 'Configuração da Meta é burocrática; custo baixo em conversas iniciadas pela pessoa', from: [], where: '' },
  ] },
  { id: 'r35', version: 'v35', at: '2026-10-30T23:50:00Z', backlog: [], news: { id: 'n20261030b', title: 'Lançar sem abrir o app', items: [
    'iPhone: com o atalho do Apple Pay, cada compra por aproximação entra sozinha. Configure em menu ☰ → Atalhos do iPhone.',
    'iPhone: diga "E aí Siri, gastei" e fale o gasto, como "45 na padaria no pix".',
    'Android: segure o ícone do app para abrir direto o microfone, a foto da nota ou o PDF.',
    'Android: no app do banco, toque em Compartilhar comprovante e escolha o Pra Onde Foi.',
    'Às 21h, se você não lançou nada no dia, o app lembra. Dá para desligar em Notificações.',
  ] } },
  { id: 'r36', version: 'v36', at: '2026-10-31T00:00:00Z', backlog: [], semNovidade: 'Ajuste técnico: o app passa a aparecer no Compartilhar de bancos que mandam o comprovante em formato genérico (ex.: Santander). A novidade do compartilhamento já saiu na v35.' },
  { id: 'r37', version: 'v37', at: '2026-10-31T00:30:00Z', backlog: [], news: { id: 'n20261031', title: 'Endereço novo: praondefoi.app.br', items: [
    'O app agora tem endereço próprio: praondefoi.app.br. O link antigo continua funcionando e leva para o novo.',
    'Se o app pedir, entre de novo com o seu e-mail e senha. Seus dados continuam todos lá.',
    'Instalou o app no celular? Apague o ícone antigo e instale de novo pelo endereço novo. As notificações e os atalhos do iPhone continuam funcionando.',
  ] } },
  { id: 'r38', version: 'v38', at: '2026-10-31T00:45:00Z', backlog: [], semNovidade: 'Ajuste no passo a passo de instalação no Android (aba anônima, ícone de download, "Instalar" em vez de "Criar atalho"); não muda o uso do app.' },
  { id: 'r39', version: 'v39', at: '2026-10-31T00:50:00Z', backlog: [], semNovidade: 'Botão "Instalar o app no celular" na tela de entrada, para quem não está logado; quem já usa não vê diferença.' },
  { id: 'r40', version: 'v40', at: '2026-10-31T00:55:00Z', backlog: [], semNovidade: 'O convite para instalar volta a cada visita até a pessoa instalar, com a opção "Não mostrar mais"; muda só para quem ainda não instalou, então não vale pop-up para todos.' },
  { id: 'r41', version: 'v41', at: '2026-10-31T00:40:00Z', backlog: [], news: { id: 'n20261031b', title: 'Sininho de novidades', items: [
    'Toque no sino no topo para ver tudo o que mudou no app, os recados para você e o que a família fez nos últimos 30 dias.',
    'O número no sino mostra o que você ainda não viu. Ao abrir o app aparece no máximo um aviso; o resto fica no sininho.',
    'Comprovante em PDF compartilhado pelo banco agora entra como um lançamento só, sem os avisos de extrato.',
  ] } },
  { id: 'r42', version: 'v42', at: '2026-10-31T01:15:00Z', backlog: [], news: { id: 'n20261031c', title: 'O app entende o que você enviou', items: [
    'Pode mandar PDF, foto ou print: o app lê o que está escrito e descobre sozinho se é fatura, extrato, comprovante ou nota fiscal.',
    'Foto ou print da fatura agora também é importado, com a soma conferida.',
    'Enviou pelo botão errado? Sem problema: um comprovante em "Fatura ou extrato" vira um lançamento, e uma fatura em "Foto da nota" vai para a importação.',
  ] } },
  { id: 'r43', version: 'v43', at: '2026-10-31T02:45:00Z', backlog: [], semNovidade: 'Central do produto boa de usar no celular e no tablet (menu no botão ☰, tabelas em cartões); só o dono do produto vê, então não vale pop-up para as famílias.' },
  { id: 'r44', version: 'v44', at: '2026-10-31T12:40:00Z', backlog: [], news: { id: 'n20261031d', title: 'Comprovante pelo Compartilhar, agora no iPhone', items: [
    'No iPhone, monte o atalho em menu ☰ → Atalhos do iPhone → Atalho 3. Depois é só abrir o comprovante no banco, tocar em Compartilhar e escolher Pra Onde Foi.',
    'Vale PDF, print ou foto. Se for fatura, extrato ou nota fiscal, o atalho avisa para enviar pelo app.',
    'Dica: o atalho da Siri pode virar um ícone na tela de início que já abre o ditado.',
  ] } },
  { id: 'r45', version: 'v45', at: '2026-10-31T15:05:00Z', backlog: [], semNovidade: 'Só itens novos no backlog (biometria e bloqueio por tempo); nada muda no app.', addBacklog: [
    { id: 'entrar_com_biometria', title: 'Entrar com a digital ou o rosto (biometria)', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Digitar e-mail e senha toda vez é chato, e o app lida com os números da família', cost: false, notes: 'Chaves de acesso (passkeys/WebAuthn): Face ID e Touch ID no iPhone, digital no Android. O Supabase já tem suporte a MFA/WebAuthn; ver se dá para usar como login principal ou como desbloqueio rápido. Junto com o bloqueio por tempo, o desbloqueio vira a biometria.', from: [], where: 'Tela de entrada; menu ☰ → Conta' },
    { id: 'bloqueio_por_tempo', title: 'Bloquear o app depois de um tempo parado (timeout)', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'O app mostra números da família e não pode ficar aberto se o celular ficar largado', cost: false, notes: 'Depois de X minutos sem uso (ou ao voltar para o app depois de X minutos), cobre a tela e pede biometria ou senha para continuar. Tempo ajustável em menu ☰ → Conta (ex.: 1, 5, 15 min). A Central do produto também.', from: [], where: 'Todo o app; menu ☰ → Conta' },
  ] },
  { id: 'r46', version: 'v46', at: '2026-10-31T16:00:00Z', backlog: ['entrar_com_biometria', 'bloqueio_por_tempo'], news: { id: 'n20261031e', title: 'Mais segurança: bloqueio automático e digital', items: [
    'Depois de 5 minutos sem uso, o app se bloqueia sozinho e esconde os números da família. Para voltar, use a senha.',
    'Melhor ainda: em menu ☰ → Conta → Segurança, ligue a digital ou o rosto e desbloqueie com um toque. A digital fica no seu celular; o app nunca recebe.',
    'Lá também dá para escolher o tempo (de 1 a 30 minutos) e bloquear na hora.',
  ] } },
  { id: 'r47', version: 'v47', at: '2026-10-31T16:37:00Z', backlog: [], semNovidade: 'O próprio app passa a oferecer a digital ou o rosto, num pop-up que já explica e diz como desligar (até 3 vezes, uma por semana). Uma novidade a mais seria um segundo aviso sobre o mesmo assunto da v46.' },
  { id: 'r48', version: 'v48', at: '2026-10-31T17:07:00Z', backlog: [], semNovidade: 'A oferta da digital passa a aparecer também logo depois de criar a conta, no cadastro; só quem se cadastra a partir de agora vê, e quem já usa recebe a oferta ao abrir o app (v47).' },
  { id: 'r49', version: 'v49', at: '2026-11-01T17:02:00Z', backlog: [], semNovidade: 'Correção da medição da Central: telas e toques ficavam na tela anterior, blocos de Lançar com o exemplo junto e o funil da nota contando lançamentos falados. Nada muda para as famílias.' },
  { id: 'r50', version: 'v50', at: '2026-11-01T17:15:00Z', backlog: ['mes_de_exemplo_antes_do_primeiro_pdf'], news: { id: 'n20261101a', title: 'Um mês de exemplo para começar', items: [
    'Enquanto o app de vocês está vazio, o Início mostra um mês de uma família de exemplo: a sobra, para onde foi o dinheiro e o que o app percebeu.',
    'Logo abaixo, um toque leva para enviar a última fatura (PDF, foto ou print) ou para lançar um gasto falando.',
    'E o lembrete da noite, para quem ainda não mandou nada, passa a lembrar do primeiro passo: a fatura do cartão.',
  ] }, addBacklog: [
    { id: 'pesquisa_no_app', title: 'Pesquisa de uso dentro do app', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'Saber por que as pessoas usam pouco ou param, sem perguntar por fora do app', cost: false, notes: 'Depois de estimular o uso (mês de exemplo, lembrete do primeiro passo). Poucas perguntas, uma por tela, no máximo uma vez por pessoa; resultado na Central. Respeitar o limite de um pop-up por abertura.', from: [], where: 'Pop-up ao abrir o app; resultados na Central' },
    { id: 'revisao_de_custos_planos', title: 'Revisão de custos: TV, internet, celular e streaming', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Planos e assinaturas sobem de preço e se acumulam sem ninguém rever', cost: false, notes: 'O app já acha cobranças repetidas e aumentos de preço (Assinaturas e aumentos). Próximo passo: juntar por tipo (TV, internet, celular, streaming), mostrar o total do ano e sugerir como reduzir (serviços repetidos, plano mais barato, combo, cancelar o que não usa). Sem vender nada nesta etapa.', from: [], where: 'Início → Mais detalhes; um aviso quando houver economia possível' },
    { id: 'parcerias_e_servicos', title: 'Serviços e parcerias com base nos dados (cross-sell)', status: 'ideia', origin: 'Luiz', effort: 'G', problem: 'Gerar receita ajudando a família com ofertas que fazem sentido para ela', cost: false, notes: 'Ex.: plano de internet mais barato, seguro, portabilidade de crédito. Só com consentimento explícito (LGPD), oferta claramente marcada como parceria, nunca compartilhar dados sem a pessoa pedir. Depende da revisão de custos e de definir o modelo de negócio (preço e canvas na Central).', from: [], where: 'A definir' },
  ] },
  { id: 'r51', version: 'v51', at: '2026-11-03T01:11:00Z', backlog: [], semNovidade: 'Importar backup passa a manter os outros ajustes da família (quem paga o quê, meses fechados, gráficos); só metas, patrimônio e investimentos do arquivo substituem os atuais. Muda só para quem importa backup.' },
  { id: 'r52', version: 'v52', at: '2026-11-03T01:24:00Z', backlog: [], semNovidade: 'Correção: importar um backup com duas regras para o mesmo texto (com faixas de valor diferentes) parava no meio. Muda só para quem importa backup.' },
  { id: 'r53', version: 'v53', at: '2026-11-03T01:39:00Z', backlog: [], semNovidade: 'Botão "Zerar os lançamentos" em menu ☰ → Conta, só para quem criou a família, para começar do zero e importar um backup; está nas Dúvidas e não vale pop-up para todos.' },
  { id: 'r54', version: 'v54', at: '2026-11-03T02:06:00Z', backlog: [], news: { id: 'n20261103a', title: 'Escolher a categoria ficou fácil', items: [
    'Ao tocar na categoria de um lançamento, abre uma lista com o nome do lançamento e o valor, para você saber o que está classificando.',
    'Tem busca do jeito que a gente fala: escreva "estacionamento" ou "farmácia" e o app acha a categoria certa. Também aparecem sugestões para aquele lançamento.',
    'Não existe a categoria? Crie ali mesmo. E na revisão da fatura pelo celular, cada lançamento aparece inteiro, sem cortar o nome.',
  ] } },
  { id: 'r55', version: 'v55', at: '2026-11-03T02:41:00Z', backlog: [], news: { id: 'n20261103b', title: 'Mais de um cartão no mesmo mês', items: [
    'Mandou a fatura de outro cartão? Ela entra junto com a que já está no mês, sem apagar nada.',
    'O app só pergunta se pode trocar quando é a mesma fatura enviada de novo, e diz qual é (os números finais do cartão).',
    'Vale também para extratos de contas de bancos diferentes.',
  ] }, addBacklog: [
    { id: 'duas_faturas_no_mesmo_mes', title: 'Duas faturas (ou extratos) no mesmo mês sem uma apagar a outra', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'Ao mandar a fatura do Mastercard (só anuidade), o app achou que era a do Visa e perguntou se podia apagar a outra', cost: false, notes: 'Solução: antes de perguntar, o app compara os números finais dos cartões (ou o banco, no extrato) e os lançamentos com o que já está no mês. Mesma fatura reenviada: troca só ela. Outro cartão: entra junto, sem perguntar nada. Faturas antigas sem número do cartão (backup) são reconhecidas pelos lançamentos. No banco: função replace_statement (precisa rodar o schema.sql).', from: [], where: 'Lançar → Fatura ou extrato' },
  ] },
  { id: 'r56', version: 'v56', at: '2026-11-03T02:54:00Z', backlog: [], semNovidade: 'Central do produto: "Pedir ao Claude" também nos cards do quadro do backlog (antes só na lista) e botão "Resumo p/ Claude" no celular. Só o dono do produto vê.' },
  { id: 'r57', version: 'v57', at: '2026-11-03T03:33:00Z', backlog: [], news: { id: 'n20261103c', title: 'Faturas longas e um cadastro mais claro', items: [
    'Faturas com muitas páginas agora são lidas em partes, e o app tenta de novo sozinho se uma parte demorar.',
    'Na tela de entrada ficou um botão só para entrar, e o aceite dos termos no cadastro ficou maior e mais fácil de marcar.',
  ] }, updateBacklog: [
    { id: 'duas_faturas_no_mesmo_mes', set: { tipo: 'bug' } },
  ], addBacklog: [
    { id: 'bug_comprovante_pdf_lido_como_extrato', tipo: 'bug', title: 'Comprovante em PDF compartilhado era lido como extrato', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Um comprovante de Pix do Santander virava um extrato com avisos', cost: false, notes: 'Causa: o tipo do documento era decidido pela extensão e por contagem de datas. Solução: ler o conteúdo (lib/classify.js) (corrigido na v42)', from: [], where: 'Compartilhar e Lançar' },
    { id: 'bug_medicao_tela_anterior', tipo: 'bug', title: 'Central registrava telas e toques na tela anterior', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Os números de navegação ficavam todos no Início', cost: false, notes: 'Causa: a tela era registrada antes da troca de aba. Solução: registrar depois e testar o toque na tela certa (corrigido na v49)', from: [], where: 'Central → Navegação' },
    { id: 'bug_backup_apagava_ajustes', tipo: 'bug', title: 'Importar backup trocava todos os ajustes da família', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Quem paga o quê e meses fechados seriam perdidos ao importar', cost: false, notes: 'Causa: o arquivo substituía os ajustes inteiros. Solução: só metas, patrimônio e investimentos são trocados (corrigido na v51)', from: [], where: 'Menu → Backup' },
    { id: 'bug_backup_regras_repetidas', tipo: 'bug', title: 'Importar backup parava no meio (regras repetidas)', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Erro ON CONFLICT ao importar o controle de 2026', cost: false, notes: 'Causa: duas regras para o mesmo texto com faixas de valor diferentes; o banco aceita uma por texto. Solução: as duas entram, e o teste passou a cobrar essa regra do banco (corrigido na v52)', from: [], where: 'Menu → Backup' },
    { id: 'bug_pedir_ao_claude_no_celular', tipo: 'bug', title: 'Pedir ao Claude não aparecia no celular', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'O botão só existia na visão de lista do backlog', cost: false, notes: 'Causa: a Central abre no quadro no celular. Solução: botão também nos cards do quadro (corrigido na v56)', from: [], where: 'Central → Backlog' },
    { id: 'bug_central_desfazia_versoes', tipo: 'bug', title: 'Salvar na Central desfazia o que as versões tinham mudado no backlog', status: 'feito', origin: 'Equipe', effort: 'P', problem: 'Itens novos das versões sumiam e itens feitos voltavam para Ideia (ex.: Mês de exemplo)', cost: false, notes: 'Causa: a Central salvava a cópia que tinha aberto, por cima do que mudou depois. Solução: a Central salva só o que mudou nela, e cada versão confere e repõe o que for das versões anteriores (corrigido na v57)', from: [], where: 'Central → Backlog' },
    { id: 'bug_fatura_longa_nao_lida', tipo: 'bug', title: 'Fatura não era lida ("Não deu para responder agora")', status: 'agora', origin: 'Erro de Paty', effort: 'M', problem: 'A fatura de setembro da Paty não era lida pela leitura inteligente', cost: false, notes: 'Causa provável: fatura longa lida de uma vez passava do tempo do servidor (60 s). Corrigido na v57: leitura em partes de algumas páginas e nova tentativa quando uma parte falha. Falta a Paty testar de novo; quando confirmar, marque como Feito e ela recebe o recado sozinha.', from: [2], where: 'Lançar → Fatura ou extrato' },
    { id: 'um_botao_de_entrar', title: 'Tela inicial com um botão só para entrar', status: 'feito', origin: 'Ideia de Rafael', effort: 'P', problem: 'Na tela inicial estavam redundantes "Entrar" e "Já tenho conta"', cost: false, notes: 'Ficou o Entrar no topo e o Criar conta grátis no meio.', from: [4], where: 'Tela de entrada' },
    { id: 'aceite_dos_termos_maior', title: 'Aceite dos termos maior no cadastro', status: 'feito', origin: 'Ideia de Rafael', effort: 'P', problem: 'A caixinha de aceitar os termos era pequena e passava despercebida', cost: false, notes: 'Agora é um bloco inteiro que dá para tocar, e fica verde quando marcado.', from: [5], where: 'Cadastro' },
    { id: 'estudo_dos_bugs', title: 'Estudo dos bugs (o que aconteceu, causa e o que muda no processo)', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'Aprender com os bugs do teste e evitar que se repitam', cost: false, notes: 'Base: itens com a etiqueta bug no backlog.', from: [], where: 'Central → Documentação' },
  ] },
  { id: 'r58', version: 'v58', at: '2026-11-03T12:34:00Z', backlog: [], semNovidade: 'Só itens novos no backlog (versão web e push a cada novidade); nada muda no app.', addBacklog: [
    { id: 'push_de_novidade_para_todos', title: 'Push para todos a cada novidade (personalizado para quem pediu)', status: 'proximo', origin: 'Luiz', effort: 'P', problem: 'Quem não abre o app não fica sabendo do que mudou', cost: false, notes: 'Toda versão com novidade manda um push para todos com os avisos ligados. Quem pediu o que ficou pronto recebe só o push personalizado (com o nome e o pedido dele), não os dois. Respeitar uma opção "Novidades do app" em menu ☰ → Notificações. Entra na Definição de pronto.', from: [], where: 'Notificações no celular' },
    { id: 'versao_web_mais_simples', title: 'Versão web, com menos funções (o app continua mobile first)', status: 'ideia', origin: 'Luiz', effort: 'M', problem: 'Às vezes é melhor ver os números e mandar a fatura pelo computador', cost: false, notes: 'O app já abre no navegador do computador, mas desenhado para o celular. Ideia: um layout para tela grande com o essencial (Início, Extrato, Gráficos, enviar fatura e extrato, Perguntar) e o resto só no celular (voz, foto da nota, atalhos, compartilhar). Mesmo endereço e mesmo login; nada de site de divulgação.', from: [], where: 'praondefoi.app.br no computador' },
  ] },
  { id: 'r59', version: 'v59', at: '2026-11-03T12:44:00Z', backlog: [{ id: '90seczvt', where: 'Extrato → Anotar' }, { id: 'push_de_novidade_para_todos', where: 'Menu ☰ → Notificações → Novidades do app' }], news: { id: 'n20261103d', title: 'Anote o que foi cada gasto', items: [
    'No Extrato, toque em "Anotar" e escreva o que o lançamento realmente foi, como "cabeleireiro Lily" para um nome estranho da fatura.',
    'O app lembra: na próxima fatura, o mesmo lançamento já chega anotado. A anotação entra na busca e o assistente também vê.',
    'E agora as novidades do app também chegam como notificação no celular (dá para desligar em Notificações).',
  ] } },
  { id: 'r60', version: 'v60', at: '2026-11-03T13:40:00Z', backlog: ['push_de_teste_na_central'], semNovidade: 'Central do produto: página "Avisos no celular" com os seus aparelhos, quem recebe push e um botão de push de teste. Só o dono do produto vê.', addBacklog: [
    { id: 'push_de_teste_na_central', title: 'Push de teste e lista de quem recebe avisos na Central', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Não dava para saber se o push estava ligado nem testar sem esperar uma versão nova', cost: false, notes: 'Central → Acompanhar → Avisos no celular: seus aparelhos com notificação ligada, quem recebe e botão "Enviar push de teste para mim". Aparelhos que não existem mais saem da lista no teste.', from: [], where: 'Central → Avisos no celular' },
  ] },
  { id: 'r61', version: 'v61', at: '2026-11-03T14:30:00Z', backlog: ['avisar_notificacao_desligada'], news: { id: 'n20261103e', title: 'Fique sabendo do que importa', items: [
    'Se as notificações estiverem desligadas no seu celular, o app agora avisa e leva direto para ligar. É só tocar em Ativar e depois em Permitir.',
    'Com elas ligadas, chegam as novidades do app, a resposta quando o que você pediu ficar pronto e os avisos de fatura e gastos.',
    'No menu ☰, Notificações mostra se estão desligadas neste celular.',
  ] }, addBacklog: [
    { id: 'avisar_notificacao_desligada', title: 'Avisar quando as notificações estão desligadas e levar para ligar', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Ninguém procura ligar as notificações sozinho; sem elas, a pessoa não fica sabendo das novidades nem das respostas', cost: false, notes: 'Não força: o celular só pede permissão depois de um toque. O app avisa (pop-up com o nome, a cada 3 dias, até 4 vezes por celular, só quando não há outro pop-up), leva para menu ☰ → Notificações com o botão em destaque, e o menu mostra "Desligadas neste celular". Bloqueadas nos ajustes: mostra como liberar.', from: [], where: 'Ao abrir o app; menu ☰ → Notificações' },
  ] },
  { id: 'r62', version: 'v62', at: '2026-11-03T14:05:00Z', backlog: [], semNovidade: 'Só o texto do aviso de notificações desligadas ficou mais convidativo ("que tal o app te avisar do que importa?"); a novidade já foi contada na v61.' },
  { id: 'r63', version: 'v63', at: '2026-11-03T14:40:00Z', backlog: [{ id: 'bug_fatura_longa_nao_lida', where: 'Lançar → Fatura ou extrato' }], semNovidade: 'Recado de erro corrigido agora pede para tentar de novo; o bug da fatura longa (corrigido na v57) é fechado e quem avisou recebe o recado. Para o dono do produto: botão para rever os convites de abertura.' },
  { id: 'r64', version: 'v64', at: '2026-11-03T14:55:00Z', backlog: [], semNovidade: 'Convite das notificações: agora 1 vez por dia (até 7) e também ao voltar do bloqueio; antes o app aberto bloqueado nunca mostrava o convite. Nenhuma função nova para contar.', updateBacklog: [
    { id: 'avisar_notificacao_desligada', set: { notes: 'Não força: o celular só pede permissão depois de um toque. O app convida (pop-up com o nome, 1 vez por dia, até 7 vezes por celular, ao abrir ou ao voltar do bloqueio, só quando não houve outro pop-up naquela abertura), leva para menu ☰ → Notificações com o botão em destaque, e o menu mostra "Desligadas neste celular". Bloqueadas nos ajustes: mostra como liberar.' } },
  ] },
  { id: 'r65', version: 'v65', at: '2026-11-03T15:40:00Z', backlog: ['conferir_se_o_aviso_chegou'], semNovidade: 'Melhoria no momento de ligar as notificações (o app confere se o aviso apareceu e, se não, mostra os ajustes do celular); quem liga vê na hora, sem precisar de pop-up de novidade.', addBacklog: [
    { id: 'conferir_se_o_aviso_chegou', title: 'Conferir se o aviso apareceu e guiar pelos ajustes do celular', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Permitir no navegador não basta: o celular pode continuar segurando os avisos, e o app web não abre os ajustes do sistema', cost: false, notes: 'Ao ligar, o app manda um aviso de teste e pergunta "Ele apareceu na tela do celular?". "Não apareceu" abre o passo a passo do celular da pessoa (iPhone, Samsung, outros Android): notificações do app ou do Chrome, Não perturbe ou Foco, economia de bateria. A Central conta quantos disseram que não apareceu.', from: [], where: 'Menu ☰ → Notificações' },
  ] },
  { id: 'r66', version: 'v66', at: '2026-11-03T16:30:00Z', backlog: ['push_manual_pela_central'], semNovidade: 'Central do produto: publicar uma novidade também como notificação no celular (com o nome de cada pessoa). Para quem usa, o push de novidade agora vem com o nome; nada novo para contar no app.', addBacklog: [
    { id: 'push_manual_pela_central', title: 'Mandar uma novidade como notificação pela Central', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Não havia como avisar todo mundo de melhorias fora de uma versão nova', cost: false, notes: 'Central → Novidades → Nova novidade: "Mandar também como notificação no celular" (marcado), com prévia do push e quantas pessoas recebem. Quem está com as notificações desligadas vê o pop-up ao abrir o app. Cada novidade vai no celular uma vez só; novidades antigas têm "Mandar no celular".', from: [], where: 'Central → Novidades' },
  ] },
  { id: 'r67', version: 'v67', at: '2026-11-03T16:40:00Z', backlog: ['bug_central_login_vencido'], semNovidade: 'Correção na Central do produto (só o dono vê): com a página aberta por mais de uma hora, o login vencia e tudo dizia "sem internet". Agora o login é renovado sozinho e cada erro diz o motivo certo.', addBacklog: [
    { id: 'bug_central_login_vencido', tipo: 'bug', title: 'Central: push de teste dizia "sem internet" (login vencido)', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'A Central guardava o login de quando a página abriu; depois de cerca de 1 hora ele vencia e todo envio falhava, sempre com a mesma mensagem de internet', cost: false, notes: 'Causa: token do Supabase guardado na abertura da página (vence em 1 hora) e mensagem de erro genérica para qualquer falha. Correção: cada chamada pega o login renovado (e renova uma vez se o servidor recusar) e cada erro diz o motivo: sem internet, login vencido, sem acesso, notificações não configuradas, ou erro do servidor com o código. Lição para o estudo dos bugs: nunca usar a mesma mensagem para erros diferentes.', from: [], where: 'Central → Avisos no celular' },
  ] },
  { id: 'r68', version: 'v68', at: '2026-11-03T17:05:00Z', backlog: ['bug_push_sem_permissao_no_banco'], semNovidade: 'Correção no servidor: as notificações no celular passam a sair (o banco não deixava o servidor ler a lista de aparelhos). Exige rodar o SQL da v68 no Supabase.', addBacklog: [
    { id: 'bug_push_sem_permissao_no_banco', tipo: 'bug', title: 'Nenhum push saía: o servidor não tinha permissão no banco', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'Push de teste da Central dava "erro 500: db"; nenhuma pessoa recebia notificações (novidades, recados, avisos do dia) e o atalho do iPhone provavelmente não salvava', cost: false, notes: 'Causa: o schema dava permissão ao servidor (service_role) só nas tabelas da Central; aparelhos, membros, famílias, categorias, regras e lançamentos ficaram sem. As outras rotinas escondiam o erro (devolviam lista vazia), então ninguém via. Correção: grants no schema + teste no banco local + erro da Central diz a tabela e o motivo. Regra nova no CLAUDE.md. Lição para o estudo dos bugs: erro engolido em silêncio esconde falha geral; o teste do banco precisa testar o papel do servidor.', from: [], where: 'Notificações no celular' },
  ] },
  { id: 'r69', version: 'v69', at: '2026-11-03T18:20:00Z', backlog: [], semNovidade: 'O teste de notificação agora sabe se o aviso chegou ao celular e explica o caso certo (ajustes do celular, bateria ou internet); quem testa vê na hora.', updateBacklog: [
    { id: 'conferir_se_o_aviso_chegou', set: { notes: 'Ao ligar, o app manda um aviso de teste e o próprio app percebe se ele chegou ao celular. Pergunta se apareceu na tela; "Não apareceu" explica o caso certo (chegou mas o celular não mostrou = ajustes de notificação; não chegou = bateria ou internet; bloqueado) e abre o passo a passo do celular da pessoa (iPhone, Samsung, outros Android). A Central conta cada caso.' } },
  ] },
  { id: 'r70', version: 'v70', at: '2026-11-03T19:40:00Z', backlog: ['tocar_no_aviso_leva_ao_lugar'], semNovidade: 'Tocar numa notificação agora abre a mensagem inteira ou a tela certa; quem recebe percebe na hora, sem pop-up de novidade.', addBacklog: [
    { id: 'tocar_no_aviso_leva_ao_lugar', title: 'Tocar na notificação leva direto à mensagem ou à tela certa', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Tocar na notificação abria o app na última tela usada, sem a mensagem', cost: false, notes: 'Novidade e recado abrem inteiros (e contam como vistos), o teste abre Notificações, os avisos do dia abrem a tela do assunto (Lançar, Metas, Orçamento...). Funciona com o app fechado, aberto ou bloqueado (depois do desbloqueio). Regra no CLAUDE.md: nada de url "/" em push.', from: [], where: 'Notificações no celular' },
  ] },
  { id: 'r71', version: 'v71', at: '2026-11-03T21:50:00Z', backlog: [], semNovidade: 'Central do produto (só o dono vê): a novidade mandada no celular mostra para quantos aparelhos chegou; se não chegou a nenhum, fica livre para mandar de novo.', addBacklog: [
    { id: 'varios_arquivos_de_uma_vez', title: 'Enviar vários arquivos de uma vez (faturas de todos os cartões e o extrato)', status: 'proximo', origin: 'Luiz (pedido de quem testa)', effort: 'M', problem: 'Quem tem mais de um cartão manda uma fatura por vez, repetindo o caminho', cost: false, notes: 'Escolher ou compartilhar vários PDFs, fotos ou prints de uma vez. O app reconhece cada um pelo conteúdo (fatura, extrato, comprovante), lê todos em sequência e mostra a revisão de um por vez ("2 de 3"), com o comparativo que já existe (mesma fatura de novo ou outro cartão). No fim, um resumo do que entrou. Arquivo com senha pede a senha só dele.', from: [], where: 'Lançar → Fatura ou extrato' },
  ] },
  { id: 'r72', version: 'v72', at: '2026-11-04T00:30:00Z', backlog: [{ id: 'varios_arquivos_de_uma_vez', where: 'Lançar → Fatura ou extrato (escolha vários)' }, { id: 'exportar_tudo_em_csv', where: 'Menu ☰ → Backup → Baixar planilha' }, { id: 'conta_fora_do_normal_luz_condominio_acim', where: 'Início, nos avisos' }, { id: 'quanto_ainda_da_para_gastar_por_dia', where: 'Início, nos avisos (com limite do cartão em Metas)' }, { id: 'perguntas_sugeridas_no_assistente', where: 'Perguntar' }, { id: 'dominio_proprio', where: 'praondefoi.app.br' }, { id: 'estudo_dos_bugs', where: 'Central → Documentação → Estudo dos bugs' }],
    news: { id: 'n20261104', title: 'Todas as faturas de uma vez', items: [
      'Em Lançar → Fatura ou extrato, escolha as faturas de todos os cartões e o extrato juntos. O app lê um por vez e você só confere e salva.',
      'Novo no Início: quanto ainda dá para gastar por dia no cartão até ele fechar, e um aviso quando uma conta fixa, como luz ou condomínio, vem acima do normal.',
      'Em menu ☰ → Backup, baixe todos os lançamentos numa planilha que abre no Excel.',
    ] },
    addDocs: [BUG_STUDY],
    addBacklog: [
      { id: 'saude_do_servidor', title: 'Saúde do servidor na Central', status: 'proximo', origin: 'Estudo dos bugs', effort: 'P', problem: 'Banco sem permissão e push parado passaram semanas sem ninguém ver', cost: false, notes: 'Uma checagem que roda depois de cada publicação (e quando a Central abre) e mostra no Painel se o banco responde com o papel do servidor, se as chaves das notificações e da leitura inteligente estão configuradas e quando saiu o último push. Vermelho = avisa o Luiz.', from: [], where: 'Central → Painel' },
      { id: 'erros_do_servidor_na_central', title: 'Erros das rotinas automáticas aparecem na Central', status: 'proximo', origin: 'Estudo dos bugs', effort: 'P', problem: 'As rotinas automáticas (avisos do dia, recados, novidades) trocavam o erro por lista vazia', cost: false, notes: 'Quando uma rotina do servidor falhar, registrar em Central → Erros com o nome da rotina e o motivo, em vez de calar.', from: [], where: 'Central → Erros' },
    ] },
  { id: 'r73', version: 'v73', at: '2026-11-04T01:10:00Z', backlog: [], semNovidade: 'Os avisos na parte de baixo da tela fecham em 3 segundos (antes 5). Na Central, cada versão mostra para quantos aparelhos o push foi e quantos recados personalizados saíram; se o push não sair, a novidade fica livre para mandar de novo.' },
  { id: 'r74', version: 'v74', at: '2026-11-04T02:20:00Z', backlog: [], news: { id: 'n20261104b', title: 'Veja a leitura acontecendo', items: [
    'Enquanto o app lê uma fatura, um extrato ou uma nota, aparece o que ele está fazendo e quanto falta, em porcentagem.',
    'Com vários arquivos, mostra qual está sendo lido: "Arquivo 2 de 3".',
  ] } },
  { id: 'r75', version: 'v75', at: '2026-11-04T03:00:00Z', backlog: [], semNovidade: 'Ajustes no envio de vários arquivos (o que fazer agora, motivo de quem não foi lido, tentar de novo, botões Salvar e Descartar sempre à vista); a novidade dos vários arquivos já foi contada na v72.', updateBacklog: [
    { id: 'varios_arquivos_de_uma_vez', set: { notes: 'Escolher ou compartilhar até 10 PDFs, fotos ou prints. Pop-up de leitura com "Arquivo 2 de 3", o passo e o percentual. No topo, a fila diz o que fazer agora ("confira a revisão abaixo e toque em Salvar") e a área de envio sai da frente. A revisão tem um passo a passo curto e Salvar/Descartar sempre à vista. Arquivo que não dá para ler mostra o motivo, a fila segue sozinha e no fim há "Tentar de novo", com a dica de mandar print ou foto.' } },
  ] },
  { id: 'r76', version: 'v76', at: '2026-11-04T03:40:00Z', backlog: [{ id: 'menu_em_grupos', where: 'Menu ☰' }], news: { id: 'n20261104c', title: 'Menu mais organizado', items: [
    'O menu ☰ agora tem 4 grupos: Família e metas, Organizar o app, Ajuda e opinião, Dados e conta. Toque num grupo para abrir.',
    'O grupo da página em que você está já abre sozinho.',
  ] }, addBacklog: [
    { id: 'menu_em_grupos', title: 'Menu ☰ em grupos, como a Central', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Com 15 itens, o menu ficou comprido e confuso', cost: false, notes: '4 grupos que abrem ao tocar (um por vez); o da página atual abre sozinho; ponto colorido no grupo quando as notificações estão desligadas.', from: [], where: 'Menu ☰' },
    { id: 'importar_planilha', title: 'Trazer os lançamentos de uma planilha (Excel ou Google Planilhas)', status: 'proximo', origin: 'Ideia da Paty (parte 2) e Luiz', effort: 'M', problem: 'Quase todo mundo já controla os gastos numa planilha; recomeçar do zero afasta', cost: false, notes: 'Enviar o arquivo .xlsx ou .csv em Lançar. O app acha sozinho as colunas de data, descrição, valor e categoria (e pergunta só se tiver dúvida), mostra a revisão como numa fatura, usa as categorias da pessoa (cria as que faltam, com confirmação) e não duplica o que já veio pela fatura ou pelo extrato. A planilha não fica guardada.', from: [], where: 'Lançar → Fatura ou extrato (ou planilha)' },
  ] },
  { id: 'r77', version: 'v77', at: '2026-11-04T04:10:00Z', backlog: [], semNovidade: 'Só o robô que tira as telas da Central: ele abre o grupo certo do menu novo antes de tocar no item.' },
  { id: 'r78', version: 'v78', at: '2026-11-04T05:00:00Z', backlog: [{ id: 'importar_planilha', where: 'Lançar → Fatura ou extrato (escolha o Excel ou CSV)' }],
    news: { id: 'n20261104d', title: 'Traga a sua planilha para o app', items: [
      'Já controlava os gastos no Excel? Em Lançar → Fatura ou extrato, escolha a planilha (Excel ou CSV). O app lê todas as abas, acha as colunas sozinho e não duplica o que já está aqui.',
      'No Extrato, filtre por categoria e veja quanto foi só para ela.',
      'Categorias repetidas ou parecidas? Em menu ☰ → Organizar o app → Categorias, o app sugere juntar, e dá para juntar qualquer uma com "Juntar com…".',
    ] },
    addBacklog: [
      { id: 'filtro_categoria_extrato', title: 'Extrato: filtrar por categoria', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Para ver os gastos de uma categoria era preciso rolar o mês inteiro', cost: false, notes: 'Lista de categorias do mês com a quantidade de cada uma; o total mostra só a categoria escolhida (partes de nota fiscal contam).', from: [], where: 'Extrato → Categoria' },
      { id: 'juntar_categorias_parecidas', title: 'Sugerir juntar categorias parecidas', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'Com o tempo e com planilhas trazidas, surgem categorias repetidas ("Mercado" e "Mercados", "Saúde" e "Saúde e terapia")', cost: false, notes: 'O app acha pares pelo nome (mesmo nome, um dentro do outro com no máximo uma palavra a mais e do mesmo tipo, erro de digitação, sinônimos comuns como Farmácia e Remédios), só despesa com despesa ou receita com receita, e sugere manter a mais usada. "Manter separadas" não pergunta de novo. Também "Juntar com…" em cada categoria e um aviso no Início. No banco: função merge_category (rodar o SQL da v78).', from: [], where: 'Menu ☰ → Organizar o app → Categorias' },
      { id: 'bug_extrato_conta_como_cartao', tipo: 'bug', title: 'Extrato mostrava "cartão @santander" em lançamentos da conta', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'Lançamentos do extrato da conta apareciam como se fossem de cartão', cost: false, notes: 'Causa: o extrato guarda o banco como "@santander" no mesmo campo do final do cartão, e o Extrato escrevia "cartão" na frente de tudo. Correção: "conta Santander" para conta e "cartão 4388" para cartão (também na planilha baixada).', from: [], where: 'Extrato' },
    ] },
  { id: 'r79', version: 'v79', at: '2026-11-04T05:40:00Z', backlog: [], semNovidade: 'Correção: extrato ou fatura dividido em mais de um arquivo não pede mais para substituir a parte que já estava; entra só o que é novo.', addBacklog: [
    { id: 'bug_extrato_em_duas_partes', tipo: 'bug', title: 'Extrato dividido em dois arquivos pedia para substituir a primeira parte', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'O banco dividiu o extrato do mês em dois arquivos pelo tamanho; ao mandar a segunda parte, o app dizia que ia substituir o extrato que já estava (e apagaria a primeira parte)', cost: false, notes: 'Causa: o app achava que era o mesmo documento só porque era a mesma conta no mesmo mês, sem olhar os lançamentos; e considerava iguais dois Pix de mesmo valor para a mesma pessoa em dias diferentes. Correção: só é o mesmo documento quando quase todos os lançamentos batem nos dois sentidos (mesmo valor e mesmo dia). Outra parte do mesmo extrato entra junto, só com o que é novo, e nada é apagado; um arquivo que já está todo no app avisa que não há nada novo. Lição para o estudo dos bugs: decidir pelos dados, não pelo rótulo.', from: [], where: 'Lançar → Fatura ou extrato' },
  ] },
  { id: 'r80', version: 'v80', at: '2026-11-04T06:30:00Z', backlog: [], semNovidade: 'Só a Central do produto (o dono vê): caderno de testes, documentação das funcionalidades, telas e fluxo de categorias e os projetos feitos que faltavam na lista.',
    addDocs: NEW_DOCS,
    addBacklog: [
      { id: 'pop_up_de_leitura', title: 'Pop-up de leitura com o símbolo do app, o passo e o percentual', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Só uma frase pequena embaixo: não ficava claro que o app estava lendo', cost: false, notes: 'Entrou na v74: o símbolo se monta barra por barra, a frase diz o passo e o percentual sobe; com vários arquivos, "Arquivo 2 de 3".', from: [], where: 'Lançar, enquanto lê' },
      { id: 'registro_do_push_por_versao', title: 'Central mostra para quantos aparelhos o push de cada versão chegou', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Não dava para saber se o push da versão saiu', cost: false, notes: 'Entrou na v73: Versões mostra aparelhos e recados; se não sair, o motivo e a novidade fica livre para mandar de novo.', from: [], where: 'Central → Versões' },
      { id: 'avisos_fecham_em_3s', title: 'Avisos de baixo fecham em 3 segundos', status: 'feito', origin: 'Luiz', effort: 'P', problem: '5 segundos era tempo demais', cost: false, notes: 'Entrou na v73.', from: [], where: 'Todo o app' },
      { id: 'checagem_das_bibliotecas_cdn', title: 'Robô confere se as bibliotecas do CDN continuam no ar', status: 'feito', origin: 'Estudo dos bugs', effort: 'P', problem: 'Se uma biblioteca sumir do CDN, o app quebra no celular sem aviso', cost: false, notes: 'Entrou na v78: a cada mudança, o robô testa os endereços do pdf.js, supabase-js e SheetJS.', from: [], where: 'GitHub → Testes' },
      { id: 'caderno_de_testes', title: 'Caderno de testes na Central', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Não havia lugar para registrar o que testar num celular de verdade e o resultado', cost: false, notes: 'Casos por funcionalidade, com passos e o que deve acontecer; Passou ou Falhou; Falhou vira bug no backlog. Entra na Definição de pronto.', from: [], where: 'Central → Planejar → Caderno de testes' },
      { id: 'documentacao_das_funcionalidades', title: 'Documentação de Lançar, Categorias, Notificações e Caderno de testes', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'As regras novas estavam só no código e na conversa', cost: false, notes: 'Seções novas em Central → Documentação.', from: [], where: 'Central → Documentação' },
    ] },
  { id: 'r81', version: 'v81', at: '2026-11-04T13:40:00Z', backlog: [], news: { id: 'n20261104e', title: 'Extrato em mais de um arquivo', items: [
    'Se o banco dividir o extrato do mês em dois arquivos, mande os dois: o segundo completa o primeiro, entra só o que é novo e nada é apagado.',
    'O app só diz que vai substituir quando é mesmo o mesmo arquivo de novo, conferindo os lançamentos um a um.',
    'As novidades do app no celular agora chegam só de dia, a partir das 8h.',
  ] }, updateDocs: [DOC_AVISOS], addBacklog: [
    { id: 'horario_silencioso', title: 'Push automático só de dia (22h às 8h, nada sai)', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'O push de uma versão publicada à noite saiu às 06:58, na primeira abertura do app de alguém', cost: false, notes: 'Entre 22h e 8h (Brasília) a versão não é aplicada: nem novidade, nem recado, nem push. A primeira abertura depois das 8h, ou a rotina das 9h, aplica e manda. Central → Versões mostra o horário em que o push saiu.', from: [], where: 'Notificações no celular' },
    { id: 'regra_correcao_vira_novidade', title: 'Correção que o usuário percebe também vira novidade e push', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'A correção do extrato dividido (v79) saiu sem avisar ninguém', cost: false, notes: 'Regra na Definição de pronto: tudo o que o usuário percebe vai com novidade e push para todos; só versões que ninguém além do dono vê ficam sem push, com o motivo em Versões.', from: [], where: 'Central → Versões' },
  ] },
  { id: 'r82', version: 'v82', at: '2026-11-04T15:31:00Z', backlog: [], news: { id: 'n20261104f', title: 'O app abre mais rápido', items: [
    'As novidades e os recados para você aparecem logo que o app abre, sem espera.',
  ] }, addBacklog: [
    { id: 'bug_novidade_demorava', tipo: 'bug', title: 'Pop-up de novidade demorava uns 10 segundos para aparecer', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'Ao abrir o app depois de uma versão nova, o pop-up só aparecia depois de uns 10 segundos', cost: false, notes: 'Causa: para responder "tem novidade?", o servidor primeiro aplicava a versão nova inteira (backlog, recados e o push para todos, um aparelho por vez), e o app só perguntava quase 1 segundo depois de abrir. Correção: a resposta sai na hora, com as novidades do código; aplicar a versão virou uma chamada à parte que o app não espera (no máximo 1,5 s, só para o recado de quem pediu); os pushes saem 10 de cada vez; novidades e recados começam a carregar junto com os dados. Também corrigido: novidade com data um pouco à frente voltava a aparecer. Teste automático cobra menos de 2 segundos. Lição: o que o usuário espera não pode depender de trabalho pesado do servidor.', from: [], where: 'Ao abrir o app' },
  ] },
  { id: 'r83', version: 'v83', at: '2026-11-04T15:46:00Z', backlog: [], news: { id: 'n20261104g', title: 'O sonho com os seus números', items: [
    'No Início, o ritmo do sonho agora é a média do que sobrou de verdade nos últimos 3 meses, e muda sozinho a cada mês.',
    'Em Metas, digam quanto acham que conseguem guardar por mês e o extra do ano (13º, PLR): vira o cenário "O plano de vocês".',
    'Em Gráficos, modelos prontos: quanto sobrou em cada mês e quanto já guardaram no ano, somando mês a mês.',
  ] }, addDocs: [DOC_SONHO], addBacklog: [
    { id: 'bug_ritmo_fixo_do_sonho', tipo: 'bug', title: 'Ritmo do sonho era um número fixo (R$ 1.000/mês)', status: 'feito', origin: 'Erro de Luiz', effort: 'P', problem: 'O cartão do sonho dizia "Ritmo atual: R$ 1.000/mês" sem relação com o que a família guarda hoje', cost: false, notes: 'Causa: os cenários vieram do backup da planilha antiga, com o "Ritmo atual" escrito à mão, e o app usava os cenários salvos no lugar da conta. Correção: o primeiro cenário é sempre a média real da sobra dos 3 últimos meses completos, com os meses ao lado; o "Ritmo atual" fixo é descartado; os outros cenários salvos continuam e podem ser removidos em Metas. Com os dados da família: R$ 3.600/mês (jul a set).', from: [], where: 'Início → Sonho' },
    { id: 'plano_de_quanto_guardar', title: 'Metas: quanto a família acha que consegue guardar', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Só dava para ver o sonho com cenários fixos', cost: false, notes: 'Campos "por mês" e "extra por ano" em Metas; vira o cenário "O plano de vocês". Valor e idade do sonho já eram de cada família.', from: [], where: 'Menu ☰ → Família e metas → Metas' },
    { id: 'grafico_sobra_acumulada', title: 'Gráfico da sobra acumulada e modelos prontos sempre à mão', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Não havia como ver quanto já guardaram no ano, somando mês a mês', cost: false, notes: 'Novo "Sobra acumulada (soma mês a mês)" e modelos prontos (sobra de cada mês, acumulado no ano, % da renda), que aparecem mesmo para quem já salvou gráficos.', from: [], where: 'Gráficos' },
  ] },
  { id: 'r84', version: 'v84', at: '2026-11-04T16:30:00Z', backlog: [], news: { id: 'n20261104h', title: 'Entrar de novo, como no app do banco', items: [
    'Parado por um tempo, o app avisa antes: "vamos desconectar em 30 segundos". Toque em Continuar no app para seguir.',
    'Depois aparece a tela de entrada. Quem ligou a digital ou o rosto toca em Entrar e só então o celular pede; nada aparece sozinho.',
    'Em Lançar → Fatura ou extrato ficou claro o que dá para mandar, e que dá para escolher vários arquivos de uma vez.',
    'No menu ☰, o grupo de categorias e notificações agora se chama Configurações.',
  ] }, addDocs: [DOC_SEGURANCA], updateDocs: [DOC_LANCAR], addBacklog: [
    { id: 'entrar_como_no_banco', title: 'Desconectar por inatividade e entrar de novo, como nos apps de banco', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'Ao abrir o app ou depois do tempo sem uso, o celular pedia a digital sozinho, sem aviso, e a tela não deixava claro o que tinha acontecido', cost: false, notes: 'Aviso 30 s antes com contagem (Continuar no app / Desconectar agora); tela de entrada com o símbolo, "Olá, Nome", o motivo, Entrar (digital ou rosto só ao tocar e só para quem ligou), Entrar com a senha e "Não é você? Sair da conta". A conta continua conectada por baixo.', from: [], where: 'Todo o app' },
    { id: 'central_uma_hora', title: 'Central do produto desconecta só depois de 1 hora', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'A Central bloqueava em 5 minutos, como o app, mas não tem números da família', cost: false, notes: 'Tempo fixo de 1 hora na Central, com o mesmo aviso antes; o app continua com o tempo escolhido em Conta.', from: [], where: 'Central' },
    { id: 'menu_configuracoes', title: 'Menu: "Organizar o app" passa a ser "Configurações"', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'O nome do grupo não dizia o que tinha dentro', cost: false, notes: 'Grupo com Categorias, Notificações, Atalhos do iPhone e O que o assistente sabe.', from: [], where: 'Menu ☰' },
    { id: 'lancar_varios_claro', title: 'Lançar: deixar claro que dá para mandar vários arquivos e planilha', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'A opção de mandar vários arquivos e a planilha existiam, mas ficavam escondidas num texto pequeno', cost: false, notes: 'Selo "Vários de uma vez" no botão; caixa "O que dá para mandar" com os 4 casos; botão "Escolher arquivos (um ou vários)"; ajuda de como marcar vários no iPhone e no Android.', from: [], where: 'Lançar → Fatura ou extrato' },
  ] },
  { id: 'r85', version: 'v85', at: '2026-11-04T16:46:00Z', backlog: [], news: { id: 'n20261104i', title: 'A versão do app à vista', items: [
    'No fim do menu ☰ aparece a versão do app (por exemplo, "versão v85"). Também está em Sobre o app.',
    'Saiu uma versão nova com o app aberto? O fim do menu mostra "Tem versão nova: atualizar agora".',
    'E, ao voltar para o app depois de um tempo fora, ele já abre na versão nova, sem atrapalhar um envio ou uma revisão.',
  ] }, updateDocs: [DOC_TESTES], addBacklog: [
    { id: 'versao_visivel_e_atualizar', title: 'Versão do app à vista e atualização sem precisar fechar o app', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'No teste da v84 o celular ainda rodava a versão anterior (o app estava aberto quando a nova saiu) e não havia como ver qual versão estava no celular', cost: false, notes: 'Versão no fim do menu, em Sobre o app e no topo da Central. Com versão nova: botão "atualizar agora" no menu e, ao voltar ao app depois de 1 minuto fora sem nada em andamento (fora de Lançar, sem pop-up nem revisão aberta), abre sozinho na nova.', from: [], where: 'Menu ☰' },
  ] },
  { id: 'r86', version: 'v86', at: '2026-11-04T16:56:00Z', backlog: [], semNovidade: 'Só a Central do produto (o dono vê): login e ajustes próprios, separados do app. Para as famílias nada muda.', updateDocs: [DOC_SEGURANCA], addBacklog: [
    { id: 'central_login_proprio', title: 'Central com login e ajustes próprios, separados do app', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'A Central usava a mesma sessão e as mesmas chaves do bloqueio do app, e na prática desconectava junto com o app', cost: false, notes: 'Sessão própria (entrar ou sair de um não mexe no outro, e "Sair da conta" agora só fecha o lugar onde foi tocado). Central → Sua conta → Acesso e segurança: tempo de 30 min a 4 h (1 h de fábrica) e digital só para a Central. O e-mail e a senha continuam os da conta de dono.', from: [], where: 'Central → Sua conta' },
  ] },
  { id: 'r87', version: 'v87', at: '2026-11-04T17:27:00Z', backlog: [], semNovidade: 'Só a Central do produto (o dono vê): pesquisa das dores de quem controla o dinheiro na Documentação e ideias novas no backlog.', addDocs: [DOC_DORES], addBacklog: [
    { id: 'lembrete_mandar_fatura', title: 'Lembrete para mandar a fatura quando ela fecha', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'P', problem: 'Apps de finanças perdem a maioria das pessoas em 30 dias; 14% só olham o cartão quando a fatura fecha', cost: false, notes: 'No dia seguinte ao fechamento de cada cartão, push com o nome: "A fatura do cartão X fechou: mande o PDF e veja para onde foi". Cria o hábito mensal sem pedir anotação.', from: [] },
    { id: 'juros_e_tarifas_da_fatura', title: 'Juros, IOF e tarifas da fatura em destaque', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'M', problem: '78% não sabem a taxa do rotativo e 26% já pagaram só o mínimo (CNDL/SPC 2026)', cost: false, notes: 'Ao ler a fatura, separar juros, IOF, multa, anuidade e pagamento mínimo; mostrar quanto custou no mês e no ano e avisar no Início.', from: [] },
    { id: 'saques_e_dinheiro_vivo', title: 'Saques e dinheiro vivo: no que foi gasto?', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'P', problem: 'Compras em dinheiro somem do controle (19,4% esquecem, SPC)', cost: false, notes: 'Quando o extrato tem saque, perguntar no que foi gasto (falar ou escrever) e dividir por categoria.', from: [] },
    { id: 'resultado_antes_da_conta', title: 'Ver o resultado antes de criar a conta', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'G', problem: 'A primeira barreira é o cadastro antes de ver valor; a promessa é "descubra em 10 minutos"', cost: false, notes: 'Mandar uma fatura na página inicial e ver o resumo (categorias, total, maiores gastos) antes de criar a conta; salvar só se criar.', from: [] },
    { id: 'selo_de_confianca', title: 'Selo de confiança na entrada: sem senha do banco', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'P', problem: 'Só 37% compartilham dados pelo Open Finance; 56% têm medo de golpe (Lina Open X 2025)', cost: false, notes: 'Na página inicial e no primeiro Lançar: "Não pedimos senha do banco nem acesso à conta. O PDF é lido no seu celular e descartado." Com link para Sobre o app.', from: [] },
    { id: 'historico_de_outros_apps', title: 'Trazer o histórico de outros apps (Mobills, Organizze)', status: 'ideia', origin: 'Pesquisa de dores (nov/2026)', effort: 'P', problem: 'Quem desistiu de outros apps leva o histórico consigo', cost: false, notes: 'Testar a planilha com os arquivos que esses apps exportam (CSV ou Excel) e ajustar as colunas; citar na comunicação.', from: [] },
  ] },
  { id: 'r88', version: 'v88', at: '2026-11-04T19:48:00Z', backlog: [], news: { id: 'n20261104j', title: 'Sem senha do banco, sempre', items: [
    'O Pra Onde Foi nunca pede a senha do seu banco nem se conecta à sua conta. Agora isso aparece logo na entrada e em Lançar.',
    'Você mesmo baixa o PDF da fatura ou do extrato no app do banco; ele é lido no seu celular e descartado.',
  ] }, updateDocs: [DOC_DORES], updateBacklog: [
    { id: 'selo_de_confianca', set: { status: 'feito' } },
    { id: 'lembrete_mandar_fatura', set: { status: 'agora', ordem: 1 } },
    { id: 'pesquisa_no_app', set: { status: 'agora', ordem: 2 } },
    { id: 'saude_do_servidor', set: { status: 'agora', ordem: 3, title: 'Saúde do servidor e erros das rotinas automáticas na Central' } },
    { id: 'erros_do_servidor_na_central', set: { status: 'descartado', notes: 'Juntado em "Saúde do servidor e erros das rotinas automáticas na Central".' } },
    { id: 'historico_de_outros_apps', set: { status: 'agora', ordem: 4 } },
    { id: 'saques_e_dinheiro_vivo', set: { status: 'agora', ordem: 5 } },
    { id: 'retrospectiva_do_ano', set: { status: 'proximo', ordem: 1, notes: 'Pronta no começo de dezembro: motivo para voltar e compartilhar.' } },
    { id: 'parcelas_ja_comprometidas_nos_proximos_m', set: { status: 'proximo', ordem: 2 } },
    { id: 'juros_e_tarifas_da_fatura', set: { status: 'proximo', ordem: 3 } },
    { id: 'previsao_do_fim_do_mes_vai_sobrar', set: { status: 'proximo', ordem: 4 } },
    { id: 'caixa_a_revisar_que_chega_a_zero', set: { status: 'proximo', ordem: 5, title: 'Caixa "a revisar" que chega a zero, com a revisão de domingo' } },
    { id: 'revisao_de_domingo_5_minutos', set: { status: 'descartado', notes: 'Juntado em "Caixa a revisar que chega a zero, com a revisão de domingo".' } },
    { id: 'gastos_anuais_previstos_ipva_iptu_matric', set: { status: 'proximo', ordem: 6, notes: 'Antes de janeiro.' } },
    { id: 'resultado_antes_da_conta', set: { status: 'proximo', ordem: 7, notes: 'Depois de ouvir os primeiros testadores.' } },
    { id: 'meu_seu_nosso_lancamentos_e_contas_priva', set: { status: 'proximo', ordem: 8 } },
    { id: 'revisao_de_custos_planos', set: { status: 'proximo', ordem: 9 } },
    { id: 'e_mail_proprio_resend_e_religar_confirma', set: { status: 'depois', ordem: 1, notes: 'Antes de abrir ao público: o limite de e-mails do Supabase impede crescer.' } },
    { id: 'notificacoes_do_banco_android', set: { status: 'depois', ordem: 2, notes: 'Primeiro passo: o teste com o MacroDroid.' } },
    { id: 'lancamento_automatico_pelas_notificacoes', set: { status: 'descartado', notes: 'Duplicado de "Lançamento automático pelas notificações do banco (Android)".' } },
    { id: 'macrodroid_teste_notificacoes', set: { status: 'depois', ordem: 3 } },
    { id: 'lancar_pelo_email_do_banco', set: { status: 'depois', ordem: 4 } },
    { id: 'whatsapp_lancar', set: { status: 'depois', ordem: 5 } },
    { id: 'open_finance_dados_automaticos_do_banco', set: { status: 'depois', ordem: 6 } },
    { id: 'app_nas_lojas_play_store_app_store', set: { status: 'depois', ordem: 7 } },
    { id: 'versao_web_mais_simples', set: { status: 'depois', ordem: 8 } },
    { id: 'plano_pago_modelo_de_negocio', set: { status: 'depois', ordem: 9 } },
    { id: 'cobranca_honesta_teste_sem_cartao_aviso_', set: { status: 'depois', ordem: 10 } },
    { id: 'parcerias_e_servicos', set: { status: 'depois', ordem: 11 } },
    { id: 'encaminhar_a_fatura_por_e_mail', set: { status: 'descartado', notes: 'Arquivado: conflita com a regra de não guardar o PDF e com faturas com senha.' } },
  ] },
  { id: 'r89', version: 'v89', at: '2026-11-04T22:00:00Z', backlog: [], news: { id: 'n20261104k', title: 'Financiamento que diminui sozinho', items: [
    'Pagou uma amortização? Mande o comprovante: o app pergunta "Isso abate um financiamento?", o saldo cai na hora e o patrimônio sobe.',
    'As parcelas também abatem o saldo todo mês, por estimativa, com os juros e o tipo de parcela do financiamento.',
    'Pagamento grande já salvo que parece amortização aparece no Início para você confirmar.',
    'Em Patrimônio e dívidas, cada bem fica ligado ao seu financiamento e dá para ver o histórico do saldo.',
  ] }, addDocs: [DOC_PATRIMONIO], addBacklog: [
    { id: 'bug_patrimonio_nao_abatia', title: 'Patrimônio não abatia amortização nem parcelas do financiamento', tipo: 'bug', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'Mandou o comprovante de R$ 130 mil de amortização do financiamento da casa e o patrimônio continuou dizendo que faltavam R$ 480 mil; o saldo estava digitado em dois lugares e nada o abatia', cost: false, notes: 'Bem ligado ao financiamento (um saldo só); parcelas abatem por estimativa (Price ou SAC); amortização por comprovante, por pagamento já salvo ou à mão; categoria Amortização de financiamento fora da sobra; histórico; investimentos com valor de hoje estimado.', from: [], where: 'Patrimônio e dívidas; Lançar; Início' },
    { id: 'extrato_do_financiamento', title: 'Ler o PDF do extrato do financiamento', status: 'ideia', origin: 'Luiz', effort: 'M', problem: 'Hoje o saldo real do financiamento é digitado; a estimativa das parcelas só é corrigida à mão', cost: false, notes: 'Reconhecer o extrato do financiamento (saldo devedor, data, parcela, taxa, sistema, prazo) e atualizar o financiamento certo, com confirmação.', from: [] },
  ] },
  { id: 'r90', version: 'v90', at: '2026-11-04T23:00:00Z', backlog: ['lembrete_mandar_fatura'], news: { id: 'n20261104l', title: 'Lembrete da fatura', items: [
    'Quando a fatura do cartão fecha, o app avisa no celular para você mandar o PDF, e o aviso já abre o lugar certo para enviar.',
    'O mesmo lembrete aparece no Início até a fatura chegar. Dá para mandar as faturas de todos os cartões de uma vez.',
  ] }, updateDocs: [DOC_AVISOS] },
  { id: 'r91', version: 'v91', at: '2026-11-05T01:05:00Z', backlog: ['parcelas_ja_comprometidas_nos_proximos_m'], news: { id: 'n20261105a', title: 'Parcelas dos próximos meses', items: [
    'No Início, em Próxima fatura, veja quanto dos próximos meses já está comprometido com parcelas e até quando.',
    'Em "As que mais pesam", as compras parceladas com quantas parcelas faltam.',
  ] }, addDocs: [DOC_PARCELAS] },
  { id: 'r92', version: 'v92', at: '2026-11-05T01:19:00Z', backlog: ['juros_e_tarifas_da_fatura'], news: { id: 'n20261105b', title: 'Quanto o banco cobrou', items: [
    'No Início, veja quanto foi de juros, IOF, anuidade e tarifas nos últimos 12 meses, e o que foi cobrado.',
    'Se aparecer juros ou multa na fatura, o app avisa: pagar a fatura inteira, no dia, evita esse custo.',
  ] }, addDocs: [DOC_TARIFAS] },
  { id: 'r93', version: 'v93', at: '2026-11-05T01:58:00Z', backlog: ['retrospectiva_do_ano'], news: { id: 'n20261105c', title: 'Retrospectiva do ano e um Início que mostra o que mudou', items: [
    'A retrospectiva do ano: quanto guardaram, o melhor mês, para onde mais foi o dinheiro e o que o banco cobrou. Em Início → Mais detalhes, e em dezembro num cartão no topo.',
    'Os avisos agora ficam no topo do Início. O que é novo sobe e ganha a marca "Novo".',
    'Lançou algo e surgiu um aviso? O app conta na hora.',
  ] }, addDocs: [DOC_RETRO_INICIO], addBacklog: [
    { id: 'inicio_dinamico', title: 'Início dinâmico: o que é novo sobe para o topo', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'O Início tinha muita coisa e não destacava o que mudou depois de lançar', cost: false, notes: 'Avisos no topo; novo ou mudou desde a última visita sobe com a marca; recado depois de salvar em Lançar.', from: [], where: 'Início' },
    { id: 'risco_meta_do_mes', title: 'Aviso de risco de não bater a meta no mês (olhando para frente)', status: 'ideia', origin: 'Luiz', effort: 'M', problem: 'Hoje os avisos de meta olham o mês que passou; falta prever no meio do mês', cost: false, notes: 'Precisa de uma conta validada com dados reais (renda média, fatura prevista, fixas) antes de ir ao ar.', from: [] },
  ] },
  { id: 'r94', version: 'v94', at: '2026-11-05T02:34:00Z', backlog: [], news: { id: 'n20261105d', title: 'A retrospectiva do ano está no topo', items: [
    'A retrospectiva de 2026 agora aparece no topo do Início até você abrir. Depois, ela fica em Início → Mais detalhes.',
  ] }, updateDocs: [DOC_RETRO_INICIO], addBacklog: [
    { id: 'retro_no_topo', title: 'Retrospectiva aparece no topo do Início até ser aberta', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'A retrospectiva ficava escondida em Mais detalhes e ninguém sabia que existia', cost: false, notes: 'Aviso "A retrospectiva de 2026 está pronta" no topo, com 3 meses completos ou mais, até abrir uma vez.', from: [], where: 'Início' },
  ] },
  { id: 'r95', version: 'v95', at: '2026-11-05T03:11:00Z', backlog: [], news: { id: 'n20261105e', title: 'O ano de vocês, em histórias', items: [
    'A retrospectiva agora é uma sequência de telas: quanto guardaram, o melhor mês, para onde mais foi, o patrimônio e o sonho, os marcos do ano.',
    'E o nível de vocês no ano: bronze, prata ou ouro, pela porcentagem que guardaram. Dá para compartilhar sem mostrar valores.',
  ] }, addDocs: [DOC_HISTORIAS], addBacklog: [
    { id: 'retro_historias_niveis', title: 'Retrospectiva em histórias, com níveis de economia e marcos', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'A retrospectiva era uma página comum; faltava algo chamativo e um motivo para compartilhar', cost: false, notes: 'Telas cheias com uma ideia cada; patrimônio e sonho; marcos que os dados provam; níveis por porcentagem (bronze 0%+, prata 10%+, ouro meta e constância).', from: [], where: 'Início' },
    { id: 'cores_por_nivel', title: 'Cores do app (ou dos banners) pelo nível de economia', status: 'ideia', origin: 'Luiz', effort: 'P', problem: 'O nível poderia aparecer no dia a dia, não só na retrospectiva', cost: false, notes: 'Começar por um selo no Início e nos banners; mudar a cor do app inteiro só depois de ver a reação (vermelho e verde já têm significado nos avisos).', from: [] },
    { id: 'nivel_ao_longo_do_ano', title: 'Aviso "faltam X pontos para o ouro" ao longo do ano', status: 'ideia', origin: 'Luiz', effort: 'P', problem: 'O nível só aparece no fim do ano', cost: false, notes: 'Mostrar no Início o nível até agora e quanto falta para o próximo.', from: [] },
  ] },
  { id: 'r96', version: 'v96', at: '2026-11-05T03:34:00Z', backlog: [], news: { id: 'n20261105f', title: 'A retrospectiva ganhou fotos', items: [
    'Cada tela da retrospectiva do ano tem agora uma foto que combina com o momento de vocês: das conquistas aos meses difíceis.',
  ] }, updateDocs: [DOC_HISTORIAS], addBacklog: [
    { id: 'retro_fotos', title: 'Fotos nas telas da retrospectiva', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'As telas da retrospectiva só tinham texto e cor', cost: false, notes: 'Uma foto por tela, positiva ou de preocupação conforme os números; casais e famílias (o app não sabe o gênero de quem usa).', from: [], where: 'Retrospectiva do ano' },
  ] },
  { id: 'r97', version: 'v97', at: '2026-11-05T04:53:00Z', backlog: [], news: { id: 'n20261105g', title: 'A retrospectiva do ano, mês a mês', items: [
    'A retrospectiva agora se atualiza a cada mês fechado e sobe no Início para vocês verem o ano até ali.',
    'Ganhou a evolução mês a mês e "onde dá para melhorar", com sugestões a partir dos números de vocês.',
    'Em janeiro vem o fechamento do ano, completo.',
  ] }, updateDocs: [DOC_HISTORIAS], addBacklog: [
    { id: 'retro_mensal_fechamento', title: 'Retrospectiva do ano atualizada a cada mês fechado, fechamento do ano e onde melhorar', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'A retrospectiva aparecia uma vez só e não mostrava a evolução nem o que fazer para melhorar', cost: false, notes: 'Edição nova a cada mês fechado (3 meses completos ou mais); fechamento do ano em janeiro; tela de primeira vez; evolução; oportunidades.', from: [], where: 'Início' },
  ] },
  { id: 'r98', version: 'v98', at: '2026-11-05T14:29:00Z', backlog: ['gastos_anuais_previstos_ipva_iptu_matric'], news: { id: 'n20261105h', title: 'Gastos do ano: IPVA, IPTU e escola sem susto', items: [
    'O app acha no histórico o IPVA, o IPTU e outros gastos que voltam todo ano. Vocês confirmam e ele mostra o calendário dos próximos meses.',
    'Diz quanto separar por mês para não apertar e se vale pagar à vista ou parcelar, olhando a situação de vocês.',
    'Fica em menu ☰ → Família e metas → Gastos do ano.',
  ] }, addDocs: [DOC_GASTOS_ANO], addBacklog: [
    { id: 'boleto_ipva_carne_iptu', title: 'Ler o boleto do IPVA e o carnê do IPTU', status: 'ideia', origin: 'Luiz', effort: 'M', problem: 'O valor do ano seguinte é estimado pelo que foi pago; o real só chega no fim do ano', cost: false, notes: 'Foto ou PDF do aviso do estado ou do carnê: troca a estimativa pelo valor de verdade, com as datas.', from: [] },
    { id: 'fipe_automatica', title: 'Valor FIPE automático pela marca e modelo do veículo', status: 'ideia', origin: 'Luiz', effort: 'M', problem: 'Hoje o valor do veículo sai do IPVA pago', cost: false, notes: 'Depende de um serviço de fora; ver custo e termos.', from: [] },
    { id: 'push_gastos_ano', title: 'Aviso no celular 60 dias antes dos gastos do ano', status: 'ideia', origin: 'Luiz', effort: 'P', problem: 'Hoje o aviso aparece no Início, não no celular', cost: false, notes: 'Levar o cálculo dos gastos do ano para a rotina diária do servidor.', from: [] },
  ] },
  { id: 'r99', version: 'v99', at: '2026-11-05T15:14:00Z', backlog: [], news: { id: 'n20261105i', title: 'IPVA pelo carro e pelo estado dele', items: [
    'Em Patrimônio, cada bem agora tem o tipo (imóvel, carro, moto) e o estado. O IPVA é calculado pelo valor do veículo e pela alíquota do estado onde ele é registrado.',
    'Em Gastos do ano aparecem o valor do ano, o à vista com desconto e as parcelas do seu estado. Trocou de carro? É só atualizar o Patrimônio.',
  ] }, updateDocs: [DOC_GASTOS_ANO], addBacklog: [
    { id: 'ipva_pelo_veiculo', title: 'IPVA pelo veículo do patrimônio e pelo estado de registro', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'O IPVA supunha São Paulo; o carro do Luiz é registrado no ES (2%, 15% à vista em abril)', cost: false, notes: 'Tipo e estado de cada bem no Patrimônio (obrigatório para veículo); IPVA = valor × alíquota do estado; "De qual veículo?" no pagamento achado; sugestão de incluir os veículos sem IPVA.', from: [], where: 'Patrimônio; Gastos do ano' },
  ] },
  { id: 'r100', version: 'v100', at: '2026-11-05T15:41:00Z', backlog: [], news: { id: 'n20261105j', title: 'Atualizar sem fechar o app', items: [
    'Quando sair uma versão nova com o app aberto, aparece um aviso com "Atualizar agora". Não precisa mais fechar e abrir o app.',
    'Se o app estiver na tela de entrada, ao entrar ele já abre a versão nova.',
  ] }, updateDocs: [DOC_TESTES], addBacklog: [
    { id: 'atualizar_sem_fechar', title: 'Versão nova sem fechar o app: pop-up e atualização ao entrar', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Para testar cada versão era preciso fechar e abrir o app', cost: false, notes: 'Pop-up "Tem uma versão nova do app" (Atualizar agora/Depois) quando não há nada em andamento; na tela de entrada, aviso e entrar já abre a versão nova.', from: [], where: 'Todo o app' },
  ] },
  { id: 'r101', version: 'v101', at: '2026-11-05T16:04:00Z', backlog: [], news: { id: 'n20261105k', title: 'Financiamento em dia no Patrimônio', items: [
    'Em Patrimônio e dívidas, "Quanto falta hoje" já mostra o saldo com as parcelas e as amortizações descontadas. Antes ficava o valor digitado no começo.',
  ] }, addBacklog: [
    { id: 'saldo_fin_atualizado', title: 'Saldo do financiamento desatualizado na tabela do Patrimônio', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'A tabela mostrava o saldo digitado no começo (R$ 480 mil), não o de hoje', cost: false, notes: 'O campo mostra o saldo de hoje; salvar sem mexer não apaga o histórico; digitar outro valor vale a partir de hoje.', from: [], where: 'Patrimônio e dívidas' },
  ] },
  { id: 'r102', version: 'v102', at: '2026-11-05T17:37:00Z', backlog: ['previsao_do_fim_do_mes_vai_sobrar', 'risco_meta_do_mes'], news: { id: 'n20261105l', title: 'Previsão do mês', items: [
    'No Início, a previsão mostra como o mês deve fechar e quanto cabe por dia nas compras novas para bater a meta.',
    'Para ficar mais certa, informe a fatura aberta: um número só, que aparece no app do banco. Aos domingos, às 19h, o app lembra (dá para desligar em Notificações).',
  ] }, addDocs: [DOC_PREVISAO], addBacklog: [
    { id: 'previsao_checkin_domingo', title: 'Pedido de domingo: a fatura aberta em um número', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'A previsão precisa de dados do mês sem pedir PDF parcial toda semana', cost: false, notes: 'Push domingo 19h com a previsão; a cada 2 semanas para quem não responde. Medir a taxa de resposta (meta: 30% ou mais).', from: [], where: 'Início; notificação' },
    { id: 'previsao_nivel_semanas', title: 'Semanas com a fatura aberta em dia contam para o nível do ano', status: 'ideia', origin: 'Luiz', effort: 'P', problem: 'Dar motivo para manter o hábito de domingo', cost: false, notes: 'Combinado em 05/11.', from: [], where: 'Retrospectiva' },
  ] },
  { id: 'r103', version: 'v103', at: '2026-11-05T19:37:00Z', backlog: [], news: { id: 'n20261105m', title: 'Previsão e amortização acertadas', items: [
    'Quando a fatura do mês já chegou, a previsão agora pede a fatura aberta do mês seguinte e diz quanto ela deve fechar.',
    'Pagamento grande de financiamento (amortização) não pesa mais na previsão do mês. O app pergunta se ele abate o financiamento; confirmando, ele sai das contas do mês e só mexe no patrimônio.',
  ] }, updateDocs: [DOC_PREVISAO], addBacklog: [
    { id: 'previsao_fatura_seguinte', title: 'Previsão sem campo da fatura quando a fatura do mês já estava no app', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Com a fatura de novembro já importada, o bloco não pedia nada', cost: false, notes: 'Pede a fatura aberta do mês seguinte; o dia de fechamento vem da própria fatura.', from: [], where: 'Início' },
    { id: 'amortizacao_nao_reconhecida', title: 'Amortização de R$ 99 mil contada como gasto do mês', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Com dois financiamentos e o texto dizendo Bertioga, o app não perguntava se abatia o de Guaratuba', cost: false, notes: 'Reconhece também pela categoria; se não souber qual, pergunta qual financiamento. A previsão ignora o pagamento até a confirmação.', from: [], where: 'Início; Patrimônio' },
  ] },
  { id: 'r104', version: 'v104', at: '2026-11-06T04:06:00Z', backlog: ['nivel_ao_longo_do_ano', 'previsao_nivel_semanas'], news: { id: 'n20261106a', title: 'Início mais direto e o nível do ano', items: [
    'O Início começa com "Para fazer agora": o que deixa os números de vocês certos hoje, com um botão em cada item.',
    'Logo abaixo, a previsão do mês já pergunta quanto está a fatura aberta.',
    'O resto vem resumido em uma linha (nível do ano, sobra, cartão, banco); toque para abrir.',
    'Novo: o nível do ano (bronze, prata ou ouro) já durante o ano, com quanto falta para o próximo e as regras de cada um.',
  ] }, addDocs: [DOC_INICIO], addBacklog: [
    { id: 'inicio_organizado', title: 'Início organizado: Para fazer agora, previsão e seções que abrem', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'Muita informação e muita rolagem; a pessoa via, mas não agia', cost: false, notes: 'Medir: "Agiram no Início" e dias de volta no Painel da Central.', from: [], where: 'Início' },
  ] },
  { id: 'r105', version: 'v105', at: '2026-11-06T10:49:00Z', backlog: [], news: { id: 'n20261106b', title: 'Desfazer uma amortização', items: [
    'Em Patrimônio e dívidas, cada amortização do histórico do financiamento tem "Desfazer": o valor volta para o saldo e o pagamento volta para a categoria de antes.',
  ] }, addBacklog: [
    { id: 'desfazer_amortizacao', title: 'Desfazer amortização confirmada por engano', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Pagamentos confirmados por engano (R$ 99 mil e R$ 15,9 mil) tiraram R$ 115 mil a mais do saldo de Guaratuba, sem jeito de voltar', cost: false, notes: 'Desfazer no histórico; guarda a categoria anterior; o pagamento não é perguntado de novo.', from: [], where: 'Patrimônio e dívidas' },
  ] },
  { id: 'r106', version: 'v106', at: '2026-11-06T11:12:00Z', backlog: [], news: { id: 'n20261106c', title: 'Um passo de cada vez no Início', items: [
    'O Início mostra uma coisa por vez: o que é novo desde a sua última visita ou o próximo passo. O resto fica em "Depois disso".',
    'Sem nada para fazer, ele mostra o que vale ficar de olho.',
    'Assinaturas e custos fixos, patrimônio, sonho, quanto guardaram e a retrospectiva viraram cartões com o resumo numa linha; toque para abrir.',
  ] }, updateDocs: [DOC_INICIO], addBacklog: [
    { id: 'inicio_um_passo', title: 'Início com um passo de cada vez', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Mesmo organizado, o Início ainda tinha muita coisa e a pessoa se perdia', cost: false, notes: 'Ordem: novidade, decisão (amortização, fechar o mês), atenção (ruim antes de alerta), primeiros passos. Sem nada: "vale ficar de olho" ou "tudo em dia".', from: [], where: 'Início' },
  ] },
  { id: 'r107', version: 'v107', at: '2026-11-06T11:28:00Z', backlog: [], news: { id: 'n20261106d', title: 'IPVA no veículo certo e o que conferir', items: [
    'Em Gastos do ano, o IPVA de um veículo não aparece mais como pago com o pagamento de outro (o do carro aparecia na scooter).',
    '"Lançamentos para conferir" agora abre só os que precisam de você, no mês e no lado certo (cartão ou conta). Se a categoria sugerida estiver certa, é só tocar em "Está certo".',
  ] }, addBacklog: [
    { id: 'conferir_so_pendentes', title: '"Para conferir" abria todos os lançamentos', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'O card dizia 2 para conferir, mas o Extrato mostrava todos e não dava para saber quais', cost: false, notes: 'Abre filtrado (mês e lado com pendências), diz quantos são e tem "Está certo" para confirmar a sugestão.', from: [], where: 'Início; Extrato' },
    { id: 'ipva_pago_veiculo_certo', title: 'IPVA do carro aparecia como pago na scooter', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'A scooter mostrava "pago R$ 2.755 em 2 parcelas" (Detran do Civic e um pagamento à Secretaria da Fazenda)', cost: false, notes: 'Com mais de um IPVA, só conta como pago o que está ligado ao item; IPVA de moto barato passa a contar.', from: [], where: 'Gastos do ano' },
  ] },
  { id: 'r108', version: 'v108', at: '2026-11-06T12:11:00Z', backlog: [], news: { id: 'n20261106e', title: 'Multa não é IPVA', items: [
    'Pagamento de multa (no nome do lançamento ou numa anotação sua) não entra mais como IPVA em Gastos do ano.',
  ] }, addBacklog: [
    { id: 'multa_nao_e_ipva', title: 'PIX de multa à Secretaria da Fazenda contado como IPVA', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'O PIX de R$ 469,91 de multas (agosto) aparecia como IPVA', cost: false, notes: 'Texto ou anotação com "multa" ou "infração" não é imposto do ano.', from: [], where: 'Gastos do ano' },
  ] },
  { id: 'r109', version: 'v109', at: '2026-11-06T14:50:00Z', backlog: [], semNovidade: 'Só na Central e no servidor: registro das entregas dos avisos e dos robôs, com alerta para o dono.', semTeste: 'Só na Central; coberto pelos testes de regra (pushhealth) e do banco (push_log, job_runs).', updateBacklog: [{ id: 'saude_do_servidor', set: { tipo: 'backend' } }], addDocs: [DOC_ENTREGAS], addBacklog: [
    { id: 'push_registro_entregas', title: 'Registro de cada push e de cada rodada dos robôs, com alerta', status: 'feito', tipo: 'backend', origin: 'Luiz', effort: 'M', problem: 'Se um aviso falhava ou um robô não rodava, ninguém ficava sabendo', cost: false, notes: 'push_log e job_runs (90 dias); Central → Avisos no celular → Entregas e robôs; push para o dono às 9h se algo atrasar ou falhar.', from: [], where: 'Central; servidor' },
    { id: 'push_limpeza_aparelhos', title: 'Tirar da lista aparelhos que falham sempre', status: 'proximo', tipo: 'backend', origin: 'Luiz', effort: 'P', problem: 'Aparelho que dá erro toda vez (sem ser 404/410) continua recebendo tentativas', cost: false, notes: 'Contar falhas seguidas; depois de 5, sair da lista. 404/410 já saem.', from: [], where: 'Servidor' },
    { id: 'erros_agrupados', title: 'Erros dos celulares agrupados por tipo e versão', status: 'proximo', tipo: 'backend', origin: 'Luiz', effort: 'P', problem: 'Os erros chegam, mas viram uma lista longa', cost: false, notes: 'Agrupar por mensagem; mostrar os novos desde a última versão.', from: [], where: 'Central' },
    { id: 'csp_navegador', title: 'Proteção do navegador contra código de fora (Content-Security-Policy)', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'P', problem: 'O app não diz ao navegador de onde pode carregar código', cost: false, notes: 'Liberar só o próprio site, jsDelivr/cdnjs fixos, Supabase e Pexels; testar no iPhone e no Android.', from: [], where: 'Todo o app' },
    { id: 'revisao_rls_tabelas', title: 'Revisar quem lê e grava cada tabela, com teste para todas', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'M', problem: 'Uma tabela sem a regra certa pode expor dados de outra família', cost: false, notes: 'Uma linha de teste por tabela em test_rls.sql (membro, outra família, servidor).', from: [], where: 'Banco' },
    { id: 'limite_uso_funcoes', title: 'Limite de uso nas funções do servidor', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'P', problem: 'Sem limite, alguém pode chamar as funções sem parar e gerar custo', cost: false, notes: 'Por pessoa e por minuto; resposta clara quando passar.', from: [], where: 'Servidor' },
    { id: 'logs_sem_dados_sensiveis', title: 'Conferir que nenhum registro guarda dado sensível', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'P', problem: 'Erros e registros podem levar texto de lançamento ou e-mail sem querer', cost: false, notes: 'Revisar app_errors, push_log, usage e os logs da Vercel.', from: [], where: 'Servidor; banco' },
    { id: 'backup_semanal', title: 'Cópia semanal do banco fora do Supabase, com teste de restauração', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'M', problem: 'Se o Supabase perder os dados, não há cópia nossa', cost: false, notes: 'Exportar toda semana para um lugar privado; restaurar num banco de teste para conferir.', from: [], where: 'Banco' },
    { id: 'apagar_conta_revisao', title: 'Apagar a conta apaga tudo (LGPD)', status: 'proximo', tipo: 'seguranca', origin: 'Luiz', effort: 'P', problem: 'O "apagar minha conta" existe; falta garantir que leva todos os dados da pessoa', cost: false, notes: 'Conferir cada tabela (avisos, opiniões, uso, erros, atalhos) e testar.', from: [], where: 'Menu → Sobre o app' },
    { id: 'email_proprio', title: 'E-mail próprio do app para login e avisos', status: 'depois', tipo: 'backend', origin: 'Luiz', effort: 'M', problem: 'O e-mail de login sai do remetente padrão do Supabase', cost: false, notes: 'Domínio praondefoi.app.br; antes de abrir ao público.', from: [], where: 'Login' },
  ] },
  { id: 'r110', version: 'v110', at: '2026-11-06T16:43:00Z', backlog: ['saude_do_servidor'], news: { id: 'n20261106f', title: 'Tela de entrada mais clara', items: [
    'Ao abrir o app, nada pede a digital sozinho: você escolhe "Entrar com a digital ou o rosto" ou "Entrar com a senha".',
    'A tela de entrada mostra como cuidamos dos seus dados (sem senha do banco) e a novidade mais recente do app.',
  ] }, updateBacklog: [{ id: 'saude_do_servidor', set: { tipo: 'backend' } }], addDocs: [DOC_SAUDE], addBacklog: [
    { id: 'tela_entrada_clara', title: 'Tela de entrada com as duas formas de entrar, o selo de segurança e a novidade', status: 'feito', origin: 'Luiz', effort: 'P', problem: 'Quem tem digital abria o app e só via o botão de entrar; perdia o recado de segurança e as novidades', cost: false, notes: 'Duas opções claras; selo "sem senha do banco"; novidade mais recente (nada do dinheiro da família aparece antes de entrar).', from: [], where: 'Tela de entrada' },
  ] },
  { id: 'r111', version: 'v111', at: '2026-11-06T16:58:00Z', backlog: [], semNovidade: 'Só no servidor: a conferência de saúde dava vermelho falso (endereço do banco sem a limpeza que o resto do servidor faz).', semTeste: 'Só no servidor; coberto pelo teste de regra e pela rodada do GitHub logo após publicar.', addBacklog: [
    { id: 'saude_vermelho_falso', title: 'Saúde do servidor dava vermelho falso no banco e no login', status: 'feito', tipo: 'bug', origin: 'Equipe', effort: 'P', problem: 'A primeira conferência do GitHub deu vermelho com o app funcionando', cost: false, notes: 'O endereço do Supabase vem com /rest/v1 no fim; a saúde agora usa a mesma limpeza do resto do servidor e diz o motivo de cada falha.', from: [], where: 'Servidor' },
  ] },
  { id: 'r112', version: 'v112', at: '2026-11-06T18:25:00Z', backlog: [], news: { id: 'n20261106g', title: 'Avisos chegam na hora', items: [
    'Os avisos no celular agora chegam na hora, mesmo com o celular parado. Antes, o Android podia segurar alguns por um bom tempo.',
  ] }, addBacklog: [
    { id: 'push_atrasado_android', title: 'Push de teste não aparecia no celular (Android segurava)', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'O servidor enviou e o Google aceitou, mas o aviso não apareceu na hora', cost: false, notes: 'Envio com prioridade alta (urgency high) e o celular avisa de novo mesmo com a mesma etiqueta (renotify). Na Central, "entregues ao Google/Apple" no lugar de "chegaram".', from: [], where: 'Avisos' },
    { id: 'aparelhos_com_tipo', title: 'Lista de aparelhos com o tipo certo, a data e teste por aparelho', status: 'proximo', tipo: 'backend', origin: 'Luiz', effort: 'P', problem: 'Android e Chrome de computador aparecem iguais; não dá para saber qual aparelho é qual', cost: false, notes: 'Guardar o tipo do aparelho na inscrição (Android, Windows, iPhone, Mac) e testar um por um.', from: [], where: 'Central; Notificações' },
    { id: 'familia_sem_avisos', title: 'Mostrar quem da família não recebe avisos e convidar a ligar', status: 'ideia', tipo: 'backend', origin: 'Equipe', effort: 'P', problem: 'Só um aparelho da família Elias está inscrito para receber avisos', cost: false, notes: 'No Início de quem não ligou, um convite curto; na Central, quem está sem.', from: [], where: 'Início; Central' },
  ] },
  { id: 'r113', version: 'v113', at: '2026-11-07T13:07:00Z', backlog: [], news: { id: 'n20261107a', title: 'Cartão com o valor que você informou', items: [
    'Os avisos do cartão ("dá para gastar por dia", "acima do limite") agora usam a fatura aberta que você informou na previsão do mês, quando ela é mais recente. Antes usavam só a estimativa de parcelas e contas fixas.',
  ] }, addBacklog: [
    { id: 'cartao_valor_informado', title: 'Aviso do cartão ignorava a fatura aberta informada', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Luiz informou R$ 13 mil de fatura aberta, mas o aviso das 9h dizia R$ 8,8 mil (só parcelas e contas fixas)', cost: false, notes: 'O valor informado vale quando é maior que a estimativa; o texto diz que é o valor informado e a data.', from: [], where: 'Início; avisos' },
  ] },
  { id: 'r114', version: 'v114', at: '2026-11-08T21:52:00Z', backlog: [], semNovidade: 'Proteções invisíveis: o navegador observa de onde o app carrega código (fase 1), as funções do servidor ganham limite de uso, os erros registrados ficam sem valores, apagar a conta apaga tudo da pessoa e cada aparelho guarda o tipo e sai da lista depois de 5 falhas.', semTeste: 'Nada muda na tela; coberto pelo e2e (com a política bloqueando) e pelos testes de regra e do banco.', addDocs: [DOC_CSP, DOC_LIMITES], updateBacklog: [
    { id: 'pesquisa_no_app', set: { title: 'Pesquisa de satisfação dentro do app' } },
    { id: 'limite_uso_funcoes', set: { status: 'feito', notes: 'Contagem no banco (rate_hit), comum a todas as instâncias; sem o SQL, conta por instância. Assistente 30/min e 300/dia por pessoa; atalho 20/min e 200/dia por código; avisos da família 10/min; push de teste 5/min. O servidor só envia push para Google, Apple, Mozilla e Microsoft.' } },
    { id: 'logs_sem_dados_sensiveis', set: { status: 'feito', notes: 'Revisados: erros (agora sem valores em reais, sem a parte do endereço depois do "?", sem e-mails nem números longos), cliques (só o nome do botão, números viram #), uso (só o nome da ação), avisos (sem o texto) e os logs do servidor (só código e tipo do erro do assistente).' } },
    { id: 'revisao_rls_tabelas', set: { status: 'feito', notes: 'Testes automáticos para todas as tabelas: toda tabela com RLS; toda tabela acessível tem regra; visitante só consegue ver um convite. Corrigido: um membro conseguia se promover a dono atualizando a própria linha (agora só muda nome e relação). Funções do app fechadas para visitantes.' } },
    { id: 'aparelhos_com_tipo', set: { status: 'feito', notes: 'Cada aparelho guarda o tipo que o próprio celular informa (Android (Chrome), iPhone, Windows (Edge)…) e a data do último aviso entregue; na Central, "Testar só este". O app grava de novo uma vez por versão, então o tipo aparece na próxima abertura.' } },
    { id: 'push_limpeza_aparelhos', set: { status: 'feito', notes: 'Cada rodada marca entregues (zera as falhas) e com erro (soma); com 5 falhas seguidas o aparelho sai da lista. Se o celular ainda tiver a permissão, o app inscreve de novo ao abrir.' } },
    { id: 'apagar_conta_revisao', set: { status: 'feito', notes: 'Apagar a conta agora também apaga as opiniões, os erros registrados, os avisos enviados, os limites de uso e os convites da pessoa, e tira o id dela dos lançamentos e importações da família que continua (a família passa para outro membro). Corrigido: quem criou a família não conseguia apagar a conta se outra pessoa continuasse. Testado no banco.' } },
    { id: 'csp_navegador', set: { status: 'agora', notes: 'Fase 1 no ar (v114): só observa e registra em Erros. Fase 2: bloquear, depois de alguns dias sem registros dos celulares.' } },
  ] },
  { id: 'r115', version: 'v115', at: '2026-11-08T22:35:00Z', backlog: [], semNovidade: 'Só na Central e no GitHub: o Claude passa a ler e mudar o backlog pelo robô do GitHub (sem senha).', semTeste: 'Coberto pelos testes de regra (token do GitHub e mudanças) e pela primeira rodada do robô.', addDocs: [DOC_ROBO_BACKLOG], addBacklog: [
    { id: 'claude_no_backlog', title: 'Claude lê e muda o backlog da Central (robô do GitHub)', status: 'feito', tipo: 'backend', origin: 'Luiz', effort: 'P', problem: 'O Claude não via as mudanças feitas na Central nem conseguia criar ou mudar itens', cost: false, notes: 'Robô do GitHub com token assinado (sem senha); cópia em backlog/BACKLOG.md; mudanças em backlog/ops/.', from: [], where: 'Central; GitHub' },
  ] },
  { id: 'r116', version: 'v116', at: '2026-11-08T22:47:00Z', backlog: ['historico_de_outros_apps'], news: { id: 'n20261108a', title: 'Traga o histórico de outro app', items: [
    'Usava Mobills, Organizze ou outro app? Exporte em Excel ou CSV e mande em Lançar: o app traz despesas e receitas com as suas categorias.',
    'Ficam de fora o que ainda não foi pago, as transferências entre suas contas e o que já está no app.',
  ] } },
  { id: 'r117', version: 'v117', at: '2026-11-08T23:03:00Z', backlog: ['saques_e_dinheiro_vivo', 'regras_que_aprendem_confirmar_antes_de_a'], addDocs: [DOC_SAQUES, DOC_REGRAS], news: { id: 'n20261108b', title: 'Saques e categorias que aprendem', items: [
    'Sacou dinheiro? Em Lançar aparece "No que foi o dinheiro do saque?". Escreva ou fale em poucas palavras, como "200 feira, 100 uber", e o saque passa a contar em cada categoria. Não lembra? Toque em "Não lembro".',
    'Mudou a categoria de um lançamento? O app pergunta se tudo com o mesmo nome vai junto (por exemplo, tudo com IFOOD para Delivery) e mostra antes quantos lançamentos mudam. Dá para desfazer em Categorias.',
  ] } },
  { id: 'r118', version: 'v118', at: '2026-11-09T16:38:00Z', addDocs: [DOC_REPETIDOS], addBacklog: [{ id: 'repetidos_lancado_a_mao', title: 'Lançado à mão + extrato: nunca em dobro, sem perder o que a pessoa escreveu', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'M', problem: 'O pix e a amortização lançados antes do extrato perderam a categoria e a descrição ao juntar, a amortização perguntou de novo e não dava para apagar um lançamento à mão depois do extrato', from: [] }], backlog: ['repetidos_lancado_a_mao'], news: { id: 'n20261109a', title: 'Lançou à mão e depois mandou o extrato? Fica um só', items: [
    'Ao ler o extrato ou a fatura, o app acha o que você já lançou à mão (mesmo que o extrato pegue dois meses) e fica com um só, com a sua categoria e o que você escreveu.',
    'Uma amortização já informada não pergunta de novo. Se algo aparecer duas vezes, o Extrato mostra e você junta com um toque.',
    'Agora dá para apagar no Extrato um lançamento feito à mão, a qualquer momento.',
  ] } },
  { id: 'r119', version: 'v119', at: '2026-11-09T19:13:00Z', backlog: ['pesquisa_no_app'], addDocs: [DOC_PESQUISA], semNovidade: 'A pesquisa aparece sozinha, só para quem está no momento dela; anunciar para todos mudaria quem responde e por quê.' },
  { id: 'r120', version: 'v120', at: '2026-11-09T20:35:00Z', backlog: ['meu_seu_nosso_lancamentos_e_contas_priva'], addDocs: [DOC_PRIVADO], news: { id: 'n20261109b', title: 'Meu, seu, nosso: gastos só seus', items: [
    'Na família, cada um pode deixar um gasto "só meu": no Extrato, ao lançar ou numa fatura inteira (o app lembra o cartão).',
    'O resto da família vê só o total do mês, sem descrição nem categoria, e a sobra continua certa.',
  ] } },
  { id: 'r121', version: 'v121', updateDocs: [DOC_PESQUISA], at: '2026-11-09T21:30:00Z', addBacklog: [{ id: 'entrada_que_pagou_amortizacao', title: 'Entrada que pagou a amortização não é sobra do mês', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Um valor alto que entrou só para amortizar o financiamento contava como ganho, e novembro aparecia guardando 170 mil', from: [] }], backlog: ['entrada_que_pagou_amortizacao'], news: { id: 'n20261109c', title: 'Recebeu e amortizou? A sobra fica certa', items: [
    'Quando entra um valor alto e ele sai para amortizar um financiamento, o app pergunta se o dinheiro foi para isso.',
    'Respondendo "Sim", a entrada sai da sobra do mês (o patrimônio não muda). Antes ela contava como se vocês tivessem guardado.',
  ] } },
  { id: 'r122', version: 'v122', at: '2026-11-09T21:42:00Z', addBacklog: [{ id: 'mes_atual_nao_fechou', title: 'Aviso dizia que o mês atual "fechou no vermelho"', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Com o extrato parcial de novembro, o Início dizia "Novembro fechou no vermelho" no dia 9', from: [] }, { id: 'comunicacoes_personalizadas', title: 'Revisar todas as mensagens: certas, no momento certo e personalizadas', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Mensagem genérica ou errada faz o app ser só mais um; para divulgar em massa cada aviso precisa falar da família, com os números dela e o que fazer agora', notes: 'Passar por cada aviso do Início e cada push: o momento (mês em andamento ou terminado, dia do mês), o nome e a família, os números da própria família comparados com ela mesma, um próximo passo claro e o tom. Inclui testes que cobrem as frases.', from: [] }], backlog: ['mes_atual_nao_fechou'], news: { id: 'n20261109d', title: 'Avisos do mês mais certos', items: [
    'O Início não diz mais que o mês "fechou" antes de ele acabar. Os avisos de resultado falam do último mês que terminou; o mês atual fica na Previsão do mês.',
  ] } },
  { id: 'r123', version: 'v123', at: '2026-11-09T22:35:00Z', addDocs: [DOC_MENSAGENS], semNovidade: 'Só na Central: a página Mensagens, para revisar todos os avisos e pushes antes da reescrita.', semTeste: 'Só a Central muda (coberta pelo teste automático da Central).' },
  { id: 'r124', version: 'v124', at: '2026-11-09T22:56:00Z', updateDocs: [DOC_PREVISAO], addBacklog: [{ id: 'previsao_com_o_que_falta', title: 'Previsão do mês com o que ainda vai entrar e sair', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'M', problem: 'Com o extrato parcial, a previsão e o "quanto dá por dia" ignoravam o salário que ainda vai entrar e as contas fixas e financiamentos que ainda vão sair', from: [] }], backlog: ['previsao_com_o_que_falta'], news: { id: 'n20261109e', title: 'Previsão do mês mais certa', items: [
    'A previsão agora conta o que ainda vai acontecer no mês: o salário que ainda vai entrar e as contas fixas e financiamentos que ainda vão sair, pelo jeito dos seus últimos meses.',
    'Embaixo da previsão aparece o que ela já está contando, e o valor por dia para bater a meta considera esse resto do mês.',
  ] } },
  { id: 'r125', version: 'v125', at: '2026-11-09T23:20:00Z', updateDocs: [DOC_MENSAGENS], backlog: ['comunicacoes_personalizadas'], news: { id: 'n20261109f', title: 'Avisos com a cara de vocês', items: [
    'Os avisos do Início e do celular agora falam com você pelo nome e trazem os números de vocês, comparados com a média de vocês, com um botão que leva direto ao que fazer.',
    'A etiqueta "Sem contar o financiamento" saiu do Início: quando o financiamento é o motivo de ficar abaixo da meta, o aviso do mês mostra quanto vocês guardariam sem ele.',
  ] } },
  { id: 'r126', version: 'v126', at: '2026-11-10T00:01:00Z', addBacklog: [{ id: 'plural_manuais', title: 'Etiqueta dizia "lançamentos manualis"', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Plural errado na etiqueta do Início', from: [] }], backlog: ['plural_manuais'], semNovidade: 'Correção de uma palavra na etiqueta do Início; não muda o uso.', semTeste: 'Coberto pelo teste automático do Início.' },
  { id: 'r127', version: 'v127', at: '2026-11-10T00:49:00Z', updateDocs: [DOC_CSP], backlog: ['csp_navegador'], semNovidade: 'Proteção por trás: o navegador passa a recusar código de fora; nada muda no uso.', semTeste: 'Coberta pelo e2e, que já roda com a política bloqueando.' },
  // From 2.0 on, versions are numbered 2.0.1 (fixes and small changes), 2.x (big features) and x.0 (journey, structure or rebranding).
  { id: 'r2.0.0', version: 'v2.0.0', at: '2026-11-10T01:12:00Z', addDocs: [DOC_MISSOES], news: { id: 'n20261110a', title: 'Pra Onde Foi 2.0: missões e conquistas', items: [
    'O app agora mostra o caminho: missões de começo no Início, uma de cada vez, com o que cada uma destrava e um botão que leva direto.',
    'As missões são cumpridas sozinhas quando vocês fazem, e cada uma é comemorada. Os selos marcam as conquistas de vocês, como 3 meses no azul.',
    'Tudo fica em Menu → Missões e conquistas.',
  ] }, addBacklog: [{ id: 'missoes_de_comeco', title: 'Missões de começo, conquistas e selos (2.0)', status: 'feito', origin: 'Luiz', effort: 'M', problem: 'O app informava, mas não puxava a família para agir; só 36% chegavam ao primeiro mês', from: [] }, { id: 'desafios_do_mes', title: 'Desafios do mês (sugeridos pelos números, aceitos, com prazo e resultado)', status: 'proximo', origin: 'Luiz', effort: 'G', problem: 'Depois do começo, falta o que fazer a cada mês para chegar nas metas', from: [] }, { id: 'sequencia_e_familia', title: 'Sequência de semanas em dia e progresso em família', status: 'proximo', origin: 'Luiz', effort: 'M', problem: 'Conquista vista pelos dois e o hábito semanal', from: [] }], backlog: ['missoes_de_comeco'] },
  { id: 'r2.0.1', version: 'v2.0.1', at: '2026-11-10T02:05:00Z', addBacklog: [{ id: 'faixa_de_selos', title: 'Faixa de selos e próxima missão abaixo do "Olá"', status: 'feito', tipo: 'bug', origin: 'Luiz', effort: 'P', problem: 'Quem já cumpriu as missões de começo não via as missões no Início (a linha ficava escondida no "Depois disso")', from: [] }, { id: 'inicio_enxuto_cards_que_abrem', title: 'Revisão do Início: cards que abrem e banners que levam ao lugar certo', status: 'agora', origin: 'Luiz', effort: 'M', problem: 'Tem muita coisa no Início; nem tudo precisa aparecer inteiro. Os banners dinâmicos ficam em destaque e precisam levar para onde queremos, como as mensagens', notes: 'Cada bloco do Início vira card com uma linha clara e seta para abrir; os banners dinâmicos (retrospectiva, gastos do ano, novidades) passam pelo manual de mensagens (nome, vocês, número, botão que leva ao lugar).', from: [] }], backlog: ['faixa_de_selos'], news: { id: 'n20261110b', title: 'Selos e missões sempre à vista', items: [
    'Quem já cumpriu as missões de começo vê, logo abaixo do "Olá", quantos selos tem e a próxima missão. Um toque abre Missões e conquistas.',
  ] } },
];
