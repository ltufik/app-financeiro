# Notas para o Claude

- Idioma do produto e dos textos de interface: português do Brasil. Código e comentários em inglês.
- Sem build: `public/` é servido como está. Bibliotecas externas só por CDN com versão fixa (supabase-js 2.45.4 no jsDelivr, pdf.js 3.11.174 no cdnjs). Não adicionar dependências npm ao app.
- Regras de negócio puras ficam em `public/js/lib/` e têm teste em `tests/lib.test.mjs`. Mudou cálculo ou leitura de PDF? Rode `npm test`.
- Toda tabela tem `household_id` e RLS por `is_member`. Mudanças de schema vão em `supabase/schema.sql`, que deve continuar podendo ser rodado de novo, e são testadas com `tests/db/test_rls.sql` num Postgres local.
- Como a sobra é calculada: veja `monthCalc` em `public/js/lib/calc.js`. O grupo da categoria (renda, entrada, pontual, dia, fora, neutro) decide tudo. Cartão conta pelo mês da fatura. Um lançamento detalhado por nota fiscal tem `splits` ([{category, amount}]) e conta como uma linha por parte (`expandSplits`); `replace_month` carrega `splits` e `receipt` para a linha reimportada.
- Nunca guardar senha de PDF nem o arquivo do PDF. Nunca commitar PDFs ou backups reais.
- A chave da Anthropic só existe em `api/ai.js` (variável de ambiente). O navegador nunca a vê.
- Ajustes ficam no menu lateral (`menu.js`), uma página por seção (`S.sec`). Gráficos personalizados ficam em `households.settings.charts`; a lógica está em `lib/charts.js`.
- Fotos: Pexels License (gratuita), carregadas de images.pexels.com (sem crédito na tela por enquanto; rever antes de abrir ao público), cada foto usada uma vez só; se não carregarem, aparece a ilustração SVG equivalente (`photos.js`).
- Telas da Central (Fluxos) e do convite para instalar: geradas no GitHub Actions (`.github/workflows/telas.yml`) com fotos e fontes reais e a família fictícia de `tests/fixtures/`. Não gerar aqui (sem acesso ao Pexels e ao Google Fonts); depois de publicar, buscar o commit do robô.

## Definição de pronto (toda publicação, como numa squad)
Nada sobe sem isto. `tests/release.test.mjs` cobra os itens marcados com (teste).
1. Testes passando: `npm test`, `sh tests/db/run.sh` e o e2e (`tests/e2e/run.mjs`).
2. Versão nova: `VERSION` em `public/sw.js` e `APP_VERSION` em `public/js/usage.js`, iguais (teste).
3. Entrada da versão em `public/js/lib/releases.js` (teste):
   - `news`: a novidade do pop-up "O que mudou", em palavras simples, sem citar a IA. Sempre que houver algo visível para o usuário. Se não houver, `semNovidade` com o motivo.
   - `backlog`: ids dos itens concluídos (o "Pedir ao Claude" traz o id). Quem pediu recebe o recado personalizado automático.
   - `addBacklog`: itens novos combinados na conversa.
4. Central em dia: toda página do menu e toda tela nova em `public/js/admin/flows.js` e em `tests/local/flow-screens.mjs` (teste); nomes legíveis em `content.js` para tudo o que o app registra com `track` (teste); matriz de serviços (teste); FAQ em `lib/faq.js`; documentação quando o processo muda.
5. Privacidade: se mudou o que o app guarda, atualizar a página Sobre o app.
6. Banco: `schema.sql` re-rodável e testado; avisar o Luiz para rodar no Supabase.
7. Depois de publicar: buscar o commit do robô das telas (GitHub Actions) e contar ao Luiz o que mudou, o que ele precisa fazer e o que testar.
