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
