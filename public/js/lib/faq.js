// "Dúvidas": starting questions and answers, the guide the assistant uses to answer new questions,
// and the search. The published list (edited in the product console) replaces FAQ when it exists.
// Pure module, tested in tests/lib.test.mjs.

export const FAQ_TOPICS = { comeco: 'Primeiros passos', lancar: 'Lançar gastos', numeros: 'Entender os números', familia: 'Família', seguranca: 'Segurança e dados' };

export const FAQ = [
  { id: 'comecar', t: 'comeco', q: 'Por onde eu começo?', a: 'Baixe no app do seu banco o PDF da última fatura do cartão e o extrato da conta do mês inteiro. Depois toque em Lançar → Fatura ou extrato e envie os dois. Pronto: o Início já mostra quanto sobrou. A régua "Seu app está X% pronto", no Início, mostra o próximo passo.' },
  { id: 'sobra', t: 'numeros', q: 'O que é a "sobra"?', a: 'É o que entrou menos o que saiu no mês: salário e outras receitas menos todas as despesas (cartão, pix, boletos, débito). Se for positiva, vocês guardaram dinheiro. Gastos marcados como "extra" (ex.: uma viagem) aparecem separados para não esconder como foi o mês normal.' },
  { id: 'metas', t: 'numeros', q: 'O que são as metas?', a: 'São três combinados da família, no menu ☰ → Metas: 1) o limite do cartão, até quanto a fatura pode chegar por mês (se passar, o app avisa); 2) quanto guardar, a parte da renda que vocês querem que sobre (20% = guardar R$ 20 de cada R$ 100); 3) o sonho de vocês, quanto querem ter investido e com que idade. Nenhum é obrigatório.' },
  { id: 'pdf', t: 'lancar', q: 'Como baixo o PDF da fatura ou do extrato?', a: 'No app ou site do seu banco, procure "Fatura" (no cartão) ou "Extrato" (na conta) e a opção "Baixar PDF" ou "Exportar". No extrato, escolha o mês inteiro, do dia 1 ao último dia. Funciona com qualquer banco.' },
  { id: 'senha', t: 'seguranca', q: 'A fatura pede senha. É seguro digitar?', a: 'Sim. A senha é usada só para abrir o PDF no seu próprio celular e é esquecida em seguida. O app nunca guarda a senha nem o arquivo do PDF: guarda só os lançamentos (data, descrição, valor e categoria).' },
  { id: 'banco', t: 'seguranca', q: 'O app pede a senha do meu banco?', a: 'Nunca. O app não se conecta ao seu banco. Você mesmo baixa o PDF e envia. Se alguém pedir a senha do banco em nome do app, não é o app.' },
  { id: 'falar', t: 'lancar', q: 'Como lanço um gasto falando?', a: 'Toque em Lançar → Falar ou escrever, toque no microfone e fale como numa conversa: "gastei 45 na padaria no pix". O app entende o valor, o lugar e a forma de pagamento e pergunta antes de salvar. Bom para pix e dinheiro, que só apareceriam no extrato do fim do mês.' },
  { id: 'applepay', t: 'lancar', q: 'Dá para lançar sem abrir o app?', a: 'No iPhone, sim: menu ☰ → Atalhos do iPhone. Com o atalho do Apple Pay, cada compra por aproximação entra sozinha; com o da Siri, você diz "E aí Siri, gastei" e fala o gasto. Com o terceiro atalho, o comprovante do banco vai pelo botão Compartilhar → Pra Onde Foi. No Android não precisa de atalho: segure o ícone do app para abrir direto o microfone, ou toque em Compartilhar no comprovante e escolha o app.' },
  { id: 'iphone', t: 'lancar', q: 'Por que no iPhone o app não aparece no Compartilhar nem abre opções ao segurar o ícone?', a: 'Porque a Apple não permite isso para apps instalados pelo navegador (no Android pode). No iPhone, o mesmo papel é feito pelos atalhos do app Atalhos: menu ☰ → Atalhos do iPhone. O atalho Compartilhar põe o Pra Onde Foi no botão Compartilhar do banco, e o atalho da Siri pode virar um ícone na tela de início que já abre o ditado.' },
  { id: 'arquivo', t: 'lancar', q: 'Posso mandar foto ou print em vez do PDF?', a: 'Pode. O app lê o que está escrito e descobre sozinho se é fatura, extrato, comprovante de Pix ou boleto, ou nota fiscal, seja PDF, foto ou print. Se você usar o botão "errado" (por exemplo, um comprovante em Fatura ou extrato), ele leva para o lugar certo. O PDF da fatura ainda é o mais preciso, porque vem com todas as páginas.' },
  { id: 'nota', t: 'lancar', q: 'Para que serve a foto da nota?', a: 'Numa compra de mercado vem de tudo: comida, limpeza, remédio. Em Lançar → Foto da nota, o app lê a nota fiscal e separa cada item na categoria certa, em vez de jogar tudo em "Mercado".' },
  { id: 'duplicado', t: 'lancar', q: 'Lancei um gasto falando e depois ele veio na fatura. Fica duplicado?', a: 'Não. Quando a fatura ou o extrato chega, o app procura os lançamentos parecidos que você fez à mão e junta os dois.' },
  { id: 'classificar', t: 'lancar', q: 'O que é "A classificar"?', a: 'São lançamentos que o app não soube em qual categoria colocar. Toque neles no Extrato e escolha a categoria. O app aprende: da próxima vez, o mesmo lugar já vem com a categoria certa.' },
  { id: 'categorias', t: 'numeros', q: 'Como funcionam as categorias?', a: 'Cada categoria é uma receita ou despesa, fixa (todo mês), variável (muda) ou extra (fora do comum), ou "Não conta" (ex.: transferência entre as suas contas). Dá para criar e renomear no menu ☰ → Categorias.' },
  { id: 'cartao_mes', t: 'numeros', q: 'Por que a compra do cartão aparece em outro mês?', a: 'O cartão conta no mês em que a fatura é paga, porque é quando o dinheiro sai da conta. Uma compra do dia 28 pode entrar na fatura do mês seguinte, dependendo do dia em que a fatura fecha (ajuste em Metas → Dia em que a fatura fecha).' },
  { id: 'fechar', t: 'numeros', q: 'O que é fechar o mês?', a: 'É uma conferência de 2 minutos no começo do mês: o app mostra o que falta (fatura, extrato, lançamentos sem categoria), um resumo de como foi e quem deve passar quanto para quem. Depois de fechado, o mês fica guardado como estava. Aparece um cartão no Início quando há um mês para fechar.' },
  { id: 'exemplo', t: 'comeco', q: 'Que família é essa no Início?', a: 'É uma família de exemplo, fictícia, para mostrar o que o app faz: a sobra do mês, para onde foi o dinheiro e o que ele percebe. Some assim que vocês mandarem a primeira fatura ou lançarem o primeiro gasto. Nada dela é salvo.' },
  { id: 'mais', t: 'numeros', q: 'Onde vejo assinaturas, patrimônio e quem paga o quê?', a: 'No fim do Início, toque em "Mais detalhes". Lá ficam as assinaturas (e os aumentos de preço), quem pagou o quê, quanto guardaram mês a mês, o patrimônio e o sonho de vocês.' },
  { id: 'convite', t: 'familia', q: 'Como coloco minha esposa, meu marido ou outra pessoa?', a: 'Menu ☰ → Família e convites → Convidar alguém. O convite vai pelo WhatsApp com um link; a pessoa toca, cria a conta e já entra na família vendo os mesmos números.' },
  { id: 'quem_paga', t: 'familia', q: 'Como funciona "quem paga o quê"?', a: 'No menu ☰ → Quem paga o quê, diga de quem é cada cartão e a conta. O app soma o que cada um pagou das despesas da casa e mostra quem deve passar quanto para o outro, na divisão que vocês escolherem (meio a meio ou outra).' },
  { id: 'privacidade', t: 'seguranca', q: 'Quem vê os meus números?', a: 'Só as pessoas da sua família no app. Para mostrar o app para alguém sem mostrar valores, toque no olho no topo da tela: todos os valores viram ••••.' },
  { id: 'perguntar', t: 'comeco', q: 'O que dá para perguntar na aba Perguntar?', a: 'Perguntas sobre o dinheiro de vocês, em português: "quanto gastamos com delivery em setembro?", "se cortarmos o delivery pela metade, quanto sobra no ano?", "quando quitamos o financiamento se pagarmos R$ 500 a mais?". O assistente usa os seus lançamentos para responder.' },
  { id: 'avisos', t: 'comeco', q: 'Que avisos o app manda?', a: 'No máximo um por dia: fatura fechando, mês acabando sem dados, gasto acima do normal, orçamento perto de estourar e um resumo da semana no domingo. Ligue ou escolha quais em menu ☰ → Notificações.' },
  { id: 'bloqueio', t: 'seguranca', q: 'Por que o app bloqueou sozinho?', a: 'Para proteger os números da família: depois de alguns minutos sem uso, o app cobre a tela e pede a digital, o rosto ou a senha. O tempo (1 a 30 minutos) fica em menu ☰ → Conta → Segurança. Não existe a opção de nunca bloquear.' },
  { id: 'biometria', t: 'seguranca', q: 'Dá para desbloquear com a digital ou o rosto?', a: 'Sim. O próprio app oferece ligar (é só tocar em "Sim, usar" e confirmar no celular). Se preferir, em menu ☰ → Conta → Segurança, toque em "Usar a digital ou o rosto para desbloquear" e confirme no celular. A digital e o rosto ficam no próprio celular: o app nunca recebe. Dá para desligar quando quiser, no mesmo lugar. Vale para aquele aparelho; no primeiro acesso de um aparelho novo, entre com e-mail e senha.' },
  { id: 'excluir', t: 'seguranca', q: 'Como apago minha conta?', a: 'Menu ☰ → Conta → Excluir conta. Antes, o app oferece baixar um backup. Se você é o único da família, os dados da família são apagados; se há outras pessoas, os dados continuam para elas.' },
];

// Facts the assistant uses besides the FAQ, so new questions get answers that match the app.
export const GUIDE = `O app "Pra Onde Foi" organiza o dinheiro da família.
Abas: Início (sobra do mês, avisos, régua de preenchimento, orçamento, para onde foi o dinheiro, próxima fatura e, no fim, "Mais detalhes"), Lançar (Falar ou escrever, Foto da nota, Fatura ou extrato em PDF, foto ou print, Preencher à mão; o app reconhece pelo conteúdo se é fatura, extrato, comprovante ou nota e leva para o lugar certo), Gráficos (gráficos personalizados), Perguntar (assistente sobre os números da família), Extrato (lista de lançamentos, filtros e categorias).
Menu ☰ (canto de cima): Família e convites, Quem paga o quê, Metas (limite do cartão, quanto guardar, o sonho de vocês, orçamento por categoria), Patrimônio e dívidas (investimentos, bens, financiamentos, dinheiro que alguém está devolvendo, dinheiro que vai entrar numa data, contas fixas no cartão), Categorias, Notificações, O que o assistente sabe, Ajuda (apresentação, tour, instalar, aparência), Dúvidas, Dar opinião, Backup, Sobre o app, Conta.
O ícone de olho no topo esconde os valores. O app não se conecta ao banco, não guarda senha nem arquivo de PDF.`;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
const STOP = new Set('a o as os e de da do das dos em no na nos nas um uma uns umas que para pra por com como eu meu minha se ser e é ou qual quais onde quando porque por que o que isso esse essa'.split(' '));
const words = s => norm(s).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

// Questions ordered by how well they match `query` (words in the question count double). Empty query = all.
export function searchFaq(items, query, limit = 50) {
  const qw = words(query); if (!qw.length) return items.slice(0, limit);
  return items.map(it => {
    const q = norm(it.q), a = norm(it.a);
    const score = qw.reduce((s, w) => s + (q.includes(w) ? 2 : 0) + (a.includes(w) ? 1 : 0) + (q.split(' ').some(x => x.startsWith(w.slice(0, 5)) && w.length > 4) ? 1 : 0), 0);
    return { it, score };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map(x => x.it);
}

// System prompt for answering a new question.
export const answerPrompt = items => `Você responde dúvidas sobre como usar o app de finanças da família. Responda em português do Brasil, em até 4 frases curtas, com o caminho exato na tela (ex.: menu ☰ → Metas). Use só o guia e as perguntas abaixo. Se a resposta não estiver aqui, diga que não sabe ainda e que a dúvida foi enviada para a equipe. Não invente funções. Não fale de valores da família.

GUIA
${GUIDE}

PERGUNTAS FREQUENTES
${items.map(x => `P: ${x.q}\nR: ${x.a}`).join('\n\n')}`;
