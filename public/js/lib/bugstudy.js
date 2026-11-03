// "Estudo dos bugs" (Central → Documentação): what went wrong in the alpha, why, and what changed in the
// process so it does not happen again. Shipped by release r72 (addDocs) and kept in the seed of DOCS.
export const BUG_STUDY = {
  id: 'estudo_bugs',
  title: 'Estudo dos bugs',
  body: `Os bugs do teste com família e amigos (até 03/11/2026): o que aconteceu, a causa de fundo e o que mudou no jeito de trabalhar.
## Os bugs
| Bug | Versão | Quem achou | Causa de fundo |
| Comprovante em PDF lido como extrato | v42 | Teste em uso | Decidir pelo sinal errado (extensão do arquivo) |
| Duas faturas no mesmo mês: pedia para apagar a outra | v55 | Luiz | Decidir pelo sinal errado (só o mês) |
| Central registrava a tela anterior | v49 | Luiz, nos números | Ordem errada (registrava antes de trocar de tela) |
| Importar backup trocava todos os ajustes | v51 | Luiz | Gravar por cima do que já existia |
| Importar backup parava no meio (regras repetidas) | v52 | Luiz, com o arquivo real | Teste com dados de mentira mais "limpos" que os reais |
| Pedir ao Claude não aparecia no celular | v56 | Luiz | Tela pensada só para o computador |
| Central desfazia o que as versões mudavam | v57 | Luiz | Gravar por cima do que já existia |
| Fatura longa não era lida | v57 | Paty | Limite de tempo do servidor não testado com arquivo grande |
| Convite das notificações nunca aparecia | v64 | Luiz | Ordem errada (app abria bloqueado e o convite desistia) |
| Dois pop-ups seguidos depois do desbloqueio | v64 | Teste automático | Ordem errada (a mesma ação disparada duas vezes) |
| Central: "sem internet" com o login vencido | v67 | Luiz | Mensagem igual para erros diferentes |
| Nenhum push saía (servidor sem permissão no banco) | v68 | Luiz | Erro escondido em silêncio + teste que não usava o papel do servidor |
## O que os bugs têm em comum
- **Quem achou:** quase todos foram achados pelo Luiz ou por quem testa, não pelos testes. Os testes cobriam o caminho feliz com dados de mentira e o navegador do computador.
- **Erro escondido:** o pior bug (nenhum push saía) ficou semanas sem ninguém ver porque as rotinas trocavam o erro por "lista vazia".
- **Mensagem genérica:** "verifique a internet" para tudo fez o problema parecer outro.
- **Gravar por cima:** salvar a cópia inteira apagava o que outra parte do app tinha mudado.
- **Sinal fraco:** decidir pela extensão do arquivo ou só pelo mês, em vez do conteúdo.
- **Ordem e tempo:** coisas que dependem de "antes ou depois" (trocar de tela, bloqueio, abrir o app).
## O que já mudou no processo
- O app decide pelo conteúdo do documento, nunca pela extensão.
- A Central salva só o que mudou, e cada versão confere e repõe o que é dela.
- Toda tabela que o servidor usa tem permissão no schema e teste no banco com o papel do servidor.
- Cada erro diz o motivo certo (sem internet, login vencido, sem acesso, erro do servidor com o código).
- Bug corrigido é fechado na versão da correção: quem avisou recebe o recado pedindo para tentar de novo.
- Teste automático no Safari do iPhone a cada publicação, e simulação que cobra as mesmas regras do banco real.
- Todo aviso no celular diz para onde leva.
## Próximos passos propostos
- **Saúde do servidor na Central:** uma checagem que roda depois de cada publicação e mostra no Painel se o banco, as notificações e a leitura inteligente estão funcionando de verdade (item "saude_do_servidor" no backlog).
- **Erros do servidor na Central:** quando uma rotina automática falhar (avisos do dia, recados, novidades), registrar em Erros em vez de calar (item "erros_do_servidor_na_central").
- **Teste em aparelho real antes de chamar a turma:** notificação, compartilhar e instalar, num Android e num iPhone, a cada mudança nesses pontos.`,
};
