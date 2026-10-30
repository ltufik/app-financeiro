# Pra Onde Foi

App de controle financeiro familiar. Ele permite:

- lançar gastos falando ou escrevendo;
- ler faturas e extratos em PDF, conferindo os totais;
- acompanhar a sobra e a taxa de poupança;
- pedir projeções, simulações de quitação e estudos de redução de custo ao Claude.

Funciona no navegador e pode ser instalado no celular como app (PWA). Cada família só enxerga os próprios dados.

## Como está montado

| Parte | O que é |
|---|---|
| `public/` | O app: HTML, CSS e JavaScript puro (módulos ES), sem etapa de build |
| `public/js/lib/` | Regras de negócio sem interface: leitura de PDF, cálculos, classificação |
| `api/ai.js` | Função na Vercel que chama o Claude; a chave da Anthropic fica só no servidor |
| `api/config.js` | Entrega ao app o endereço e a chave pública do Supabase |
| `supabase/schema.sql` | Banco de dados, regras de acesso por família e funções |
| `tests/` | Testes das regras, do banco e do app no navegador |

## Colocar no ar (uma vez)

### 1. Supabase (banco de dados e login)

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard), na região **South America (São Paulo)**.
2. Abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / public**.

### 2. Vercel (hospedagem)

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `app-financeiro`.
2. Em **Framework Preset**, deixe **Other**. Não precisa mudar build nem output: o `vercel.json` já cuida disso.
3. Em **Environment Variables**, adicione:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | Project URL do Supabase |
   | `SUPABASE_ANON_KEY` | chave anon / public do Supabase |
   | `ANTHROPIC_API_KEY` | chave da API do Claude ([console.anthropic.com](https://console.anthropic.com)) |
   | `ALLOWED_EMAILS` | opcional: e-mails liberados para usar o Claude, separados por vírgula |

4. Clique em **Deploy** e anote o endereço, por exemplo `https://app-financeiro.vercel.app`.

### 3. Ligar o login ao endereço do app

No Supabase, em **Authentication → URL Configuration**:

- coloque o endereço da Vercel em **Site URL**;
- em **Redirect URLs**, adicione o endereço seguido de `/**`, por exemplo `https://app-financeiro.vercel.app/**`. O `/**` permite que o link de confirmação de quem foi convidado volte com o convite.

É isso que faz os links de confirmação de e-mail e de nova senha voltarem para o app.

### 4. Usar

1. Abra o endereço, crie a conta, confirme o e-mail e crie a família.
2. Para trazer dados antigos, use **Ajustes → Importar backup**.
3. Para chamar outra pessoa, use **Ajustes → Convidar alguém**: o convite vai pelo WhatsApp com um link que já leva a pessoa para a família.

**Instalar no celular:**

- iPhone: no Safari, **Compartilhar → Adicionar à Tela de Início**.
- Android: no Chrome, **menu → Instalar app**.

## Observações

- **Voz:** usa o reconhecimento de fala do próprio navegador (Chrome, Edge e Safari). Onde não houver, o app orienta a usar o microfone do teclado.
- **PDFs:** são lidos no aparelho e não ficam guardados. Senhas de PDF nunca são salvas.
  - Faturas e extratos do Santander têm leitor próprio, que confere os totais.
  - Os de outros bancos são lidos pelo Claude, e o app confere com os totais do documento.
- **Custo do Claude:** a função `api/ai.js` só atende usuários logados e tem um limite simples por minuto. Use `ALLOWED_EMAILS` para restringir durante os testes.
- **E-mails de login:** o envio padrão do Supabase tem limite baixo por hora. Para mais usuários, configure um SMTP próprio em **Authentication → Emails**.

## Desenvolvimento

```bash
npm test                                   # regras de negócio (node --test)
psql ... -f tests/db/supabase_shim.sql     # num Postgres local: simula o Supabase
psql ... -f supabase/schema.sql
psql ... -f tests/db/test_rls.sql          # isolamento entre famílias, convites, importação
node tests/e2e/run.mjs --playwright <playwright/index.mjs> --pdfjs <pdfjs-dist/legacy/build>   # app no navegador com Supabase e Claude simulados
```

Não coloque PDFs nem backups reais no repositório: o `.gitignore` já bloqueia `*.pdf` e `*backup*.json`.

## Notificações push

Uma vez por dia (09:00 de Brasília, pelo Vercel Cron em `vercel.json`), `api/push-cron.js` calcula os avisos de cada família e envia no máximo um por aparelho. O botão de teste usa `api/push-test.js`. A criptografia do Web Push está em `api/_webpush.js`, sem dependências.

Variáveis no Vercel (Settings → Environment Variables):

| Nome | O que é |
|---|---|
| `VAPID_PUBLIC_KEY` | Chave pública dos avisos (pode ser vista pelo navegador) |
| `VAPID_PRIVATE_KEY` | Chave privada dos avisos (secreta) |
| `CRON_SECRET` | Senha que o Vercel manda ao chamar a rotina diária (secreta) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase (Settings → API Keys → Secret keys). Só o servidor usa |

Gerar um novo par de chaves: `node -e "import('./api/_webpush.js').then(m => console.log(m.generateVapidKeys()))"`.

No iPhone, os avisos só funcionam com o app instalado na tela de início (iOS 16.4 ou mais novo).
