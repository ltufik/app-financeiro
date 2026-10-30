-- Testa isolamento entre famílias, convites e replace_month. Rode após o shim e o schema.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@x'), ('00000000-0000-0000-0000-00000000000b', 'b@x'), ('00000000-0000-0000-0000-00000000000c', 'c@x') on conflict do nothing;
set role authenticated;
-- A cria a família
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household('Família A', 'Ana') as ha \gset
select count(*) as cats_a from categories where household_id = :'ha' \gset
\echo categorias A: :cats_a
insert into transactions(household_id, source, month, description, amount, category, manual) values (:'ha', 'conta', '2026-10', 'mercado manual', -230, 'Mercado', true) returning id as man \gset
select public.create_invite(:'ha', 'Caio', 'Filho(a)') as code \gset
reset role;
set role anon;
select public.invite_info(:'code') as info \gset
\echo convite visto sem login: :info
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
-- B cria outra família e não vê a de A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_household('Família B', 'Bia') as hb \gset
select count(*) as b_sees_a from transactions where household_id = :'ha' \gset
\echo B vê lançamentos de A: :b_sees_a
select count(*) as b_hh from households \gset
\echo B vê famílias: :b_hh
-- B tenta inserir na família de A (deve falhar)
do $$ begin
  begin insert into transactions(household_id, source, month, amount) select id, 'conta', '2026-10', 1 from households limit 0; exception when others then null; end;
end $$;
\set ON_ERROR_STOP off
\echo (os dois erros a seguir são esperados: B não pode escrever na família de A)
insert into transactions(household_id, source, month, amount) values (:'ha', 'conta', '2026-10', -1);
select public.replace_month(:'ha', 'conta', '2026-10', '[]'::jsonb);
\set ON_ERROR_STOP on
-- C entra na família A pelo convite
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.accept_invite(:'code') = :'ha' as c_joined \gset
select display_name || ' / ' || relation as c_member from members where user_id = '00000000-0000-0000-0000-00000000000c' \gset
\echo membro criado pelo convite: :c_member
\echo C entrou na família A: :c_joined
select count(*) as c_sees from transactions where household_id = :'ha' \gset
\echo C vê lançamentos de A: :c_sees
-- C importa extrato de outubro conciliando o manual
select public.replace_month(:'ha', 'conta', '2026-10', '[{"date":"2026-10-05","day":"05/10","description":"PIX MERCADO","amount":-230,"category":"Mercado"},{"day":"25/10","description":"SALARIO","amount":10000,"category":"Salário"}]'::jsonb, array[:'man']::uuid[], 'Extrato de outubro', 'x.pdf') as imp \gset
select count(*) as n, sum(amount) as s, bool_or(manual) as any_manual from transactions where household_id = :'ha' \gset
\echo após importar: :n lançamentos, soma :s, sobrou manual: :any_manual
select public.replace_month(:'ha', 'conta', '2026-10', '[{"day":"25/10","description":"SALARIO","amount":10000,"category":"Salário"}]'::jsonb) \gset
select count(*) as n2 from transactions where household_id = :'ha' \gset
\echo reimportar substitui: :n2 lançamento
-- nota fiscal: a divisão por categoria sobrevive a reimportar a fatura
select public.replace_month(:'ha', 'cartao', '2026-10', '[{"date":"2026-10-12","day":"12/10","description":"DROGASIL 123","amount":182.4,"category":"Saúde"}]'::jsonb) \gset
update transactions set splits = '[{"category":"Saúde","amount":62.4},{"category":"Suplementos","amount":120}]', receipt = '{"store":"Drogasil","total":182.4}' where household_id = :'ha' and source = 'cartao';
select public.replace_month(:'ha', 'cartao', '2026-10', '[{"date":"2026-10-12","day":"12/10","description":"DROGASIL 123","amount":182.4,"category":"Saúde"},{"date":"2026-10-13","day":"13/10","description":"PADARIA","amount":20,"category":"Mercado"}]'::jsonb) \gset
select count(*) filter (where splits is not null) as with_splits, max(receipt->>'store') as store from transactions where household_id = :'ha' and source = 'cartao' \gset
\echo nota mantida após reimportar: :with_splits lançamento com divisão, loja :store
-- um gasto manual vindo da nota, conciliado com a fatura, passa a divisão para o lançamento real
insert into transactions(household_id, source, month, date, description, amount, category, manual, splits, receipt)
  values (:'ha', 'cartao', '2026-11', '2026-10-30', 'Nota: Farmácia', 90, 'Saúde', true, '[{"category":"Suplementos","amount":90}]', '{"store":"Farmácia"}') returning id as nman \gset
select public.replace_month(:'ha', 'cartao', '2026-11', '[{"date":"2026-10-30","day":"30/10","description":"RAIA 55","amount":90,"category":"Saúde"}]'::jsonb, array[:'nman']::uuid[]) \gset
select count(*) as n3, max(splits->0->>'category') as sc, bool_or(manual) as m3 from transactions where household_id = :'ha' and month = '2026-11' \gset
\echo conciliado: :n3 lançamento, divisão :sc, manual restante :m3
select public.learn_rule(:'ha', 'cartao', 'PADARIA X', 'Mercado');
select public.learn_rule(:'ha', 'cartao', 'PADARIA X', 'Restaurantes e delivery');
select category from rules where household_id = :'ha' and kind = 'exact' \gset
\echo regra aprendida (atualizada): :category
-- convite já usado
\set ON_ERROR_STOP off
\echo (o erro a seguir é esperado: convite já usado)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.accept_invite(:'code');

-- Excluir conta: C (membro da família A) sai; A continua dona e os dados ficam
\set ON_ERROR_STOP on
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.delete_my_account();
reset role;
select count(*) as a_members from public.members where household_id = :'ha' \gset
select count(*) as c_user from auth.users where id = '00000000-0000-0000-0000-00000000000c' \gset
\echo excluir conta de membro: membros restantes :a_members, usuário apagado: :c_user
-- A exclui a conta: era a única na família A, então a família e os dados somem
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.delete_my_account();
reset role;
select count(*) as hh_a from public.households where id = :'ha' \gset
select count(*) as tx_a from public.transactions where household_id = :'ha' \gset
select count(*) as hh_b from public.households where id = :'hb' \gset
\echo excluir conta de dona única: família A :hh_a, lançamentos A :tx_a, família B intacta :hh_b

-- Renomear categoria leva o nome para lançamentos, divisões e regras
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_household('Família R', 'Rui') as hr \gset
select (select count(*) from categories where household_id = :'hr' and recurring) as fixas, (select count(*) from categories where household_id = :'hr' and name like 'Empréstimos%') as terceiros \gset
\echo despesas fixas semeadas: :fixas, categoria de terceiros: :terceiros
insert into transactions(household_id, source, month, description, amount, category, splits) values (:'hr', 'cartao', '2026-10', 'FARMA', 100, 'Saúde', '[{"category":"Saúde","amount":40},{"category":"Mercado","amount":60}]');
select public.learn_rule(:'hr', 'cartao', 'FARMA', 'Saúde');
select id as cid from categories where household_id = :'hr' and name = 'Saúde' \gset
select public.rename_category(:'cid', 'Saúde e farmácia');
select (select category from transactions where household_id = :'hr') as tc, (select splits->0->>'category' from transactions where household_id = :'hr') as sc, (select splits->1->>'category' from transactions where household_id = :'hr') as sc2, (select category from rules where household_id = :'hr' and pattern = 'FARMA') as rc \gset
\echo renomear: lançamento :tc, divisão :sc / :sc2, regra :rc
\set ON_ERROR_STOP off
\echo (o erro a seguir é esperado: nome repetido)
select public.rename_category(:'cid', 'mercado');

-- Avisos: cada um vê só os próprios aparelhos; o mesmo aparelho troca de dono
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.save_push(:'hr', 'https://push.example/abc', 'k1', 'a1', '{"semanal":false}');
select public.save_push(:'hr', 'https://push.example/abc', 'k2', 'a2', '{}');
select count(*) as np, max(p256dh) as pk from push_subscriptions \gset
\echo aviso salvo sem duplicar: :np registro, chave :pk
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as other from push_subscriptions \gset
\echo outra pessoa vê aparelhos alheios: :other
\set ON_ERROR_STOP off
\echo (o erro a seguir é esperado: A não é da família R)
select public.save_push(:'hr', 'https://push.example/zzz', 'k', 'a', '{}');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.delete_push('https://push.example/abc');
select count(*) as left_ from push_subscriptions \gset
\echo aviso desligado: restam :left_

-- Métricas: registrar o dia de uso e calcular o funil; ninguém logado lê as métricas
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.touch_activity(:'hr');
select public.touch_activity(:'hr');
reset role;
select count(*) as nact from activity \gset
\echo dias de uso registrados (sem duplicar): :nact
update auth.users set created_at = now() - interval '10 days';
insert into activity(user_id, household_id, day) select id, null, (now() at time zone 'America/Sao_Paulo')::date - 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b' on conflict do nothing;
set role service_role;
select public.product_metrics() as pm \gset
\echo métricas: :pm
reset role;
set role authenticated;
\set ON_ERROR_STOP off
\echo (o erro a seguir é esperado: pessoa logada não lê métricas)
select public.product_metrics();
reset role;

-- Central do produto: só o servidor lê e escreve
set role service_role;
insert into product_board(key, data) values ('backlog', '{"items":[]}') on conflict (key) do update set data = excluded.data;
select count(*) as pb from product_board \gset
\echo central do produto gravada pelo servidor: :pb
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\set ON_ERROR_STOP off
\echo (o erro a seguir é esperado: pessoa logada não lê a central do produto)
select * from product_board;
reset role;

-- Opiniões, dúvidas e uso por funcionalidade
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\set ON_ERROR_STOP on
select public.send_feedback(:'hr', 'erro', 'O botão de salvar não respondeu', null, 'lancar', 'Android', 'v25') as fb1 \gset
select public.send_feedback(:'hr', 'duvida', 'O que é a meta?', 'São os combinados da família.', 'ajustes', 'iPhone', 'v25') as fb2 \gset
select public.feedback_helpful(:fb2, true);
select public.track(:'hr', array['lancar.voz', 'lancar.voz', 'inicio', 'Inválido!', null]);
select count(*) as mine from feedback \gset
\echo opiniões que B vê (as suas): :mine
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as others from feedback \gset
\echo opiniões de B que A vê: :others
\set ON_ERROR_STOP off
\echo (os erros a seguir são esperados: tipo inválido, texto curto, ninguém logado lê o uso, nem as opiniões de todos)
select public.send_feedback(:'hr', 'spam', 'texto qualquer');
select public.send_feedback(:'hr', 'ideia', 'a');
select * from usage;
select public.product_feedback();
reset role;
select sum(n) as nvoz from usage where feature = 'lancar.voz' \gset
select count(*) as nbad from usage where feature not in ('lancar.voz', 'inicio') \gset
\echo uso registrado: voz :nvoz vezes, nomes inválidos ignorados: :nbad
select helpful as hf from feedback where id = :fb2 \gset
\echo dúvida marcada como resolvida: :hf
set role service_role;
select jsonb_array_length(public.product_feedback()) as nfb \gset
select public.product_usage(30)->'features'->'lancar.voz'->>'n' as un \gset
\echo central lê opiniões: :nfb e uso de voz: :un
reset role;

-- Resposta personalizada: o servidor responde, só a dona da opinião marca como vista
set role service_role;
update feedback set reply = 'Fizemos o que você pediu!', replied_at = now(), status = 'resolvido' where id = :fb1;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.feedback_reply_seen(:fb1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select reply_seen as rs_before from feedback where id = :fb1 \gset
\echo resposta vista por outra pessoa não conta: :rs_before
select reply as myreply from feedback where id = :fb1 \gset
\echo B lê a resposta da sua opinião: :myreply
select public.feedback_reply_seen(:fb1);
select reply_seen as rs_after from feedback where id = :fb1 \gset
\echo B marcou como vista: :rs_after
reset role;

-- Navegação, toques e erros
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\set ON_ERROR_STOP on
select public.track_nav(:'hr', '{"screens":[{"s":"resumo","v":2,"t":40},{"s":"menu.metas","v":1,"t":15},{"s":"Ruim!","v":1,"t":5}],"flows":[{"f":"resumo","t":"menu.metas","n":1}],"taps":[{"s":"resumo","x":3,"y":10,"n":2},{"s":"resumo","x":30,"y":1,"n":1}],"targets":[{"s":"resumo","t":"Enviar PDF","n":2}]}'::jsonb);
select public.track_nav(:'hr', '{"screens":[{"s":"resumo","v":1,"t":99999}],"targets":[{"s":"resumo","t":"Enviar PDF","n":1}]}'::jsonb);
select public.log_error(:'hr', 'tela', 'Não foi possível salvar.', 'lancar', null, 'Android', 'v31');
select public.log_error(:'hr', 'hack', 'x');
\set ON_ERROR_STOP off
\echo (os erros a seguir são esperados: ninguém logado lê navegação, toques nem erros)
select * from nav;
select * from app_errors;
select public.product_nav(30);
reset role;
select views as rv, seconds as rs from nav where screen = 'resumo' \gset
\echo navegação no início: :rv visitas, :rs segundos (tempo limitado a 2h por envio)
select count(*) as badnav from nav where screen not in ('resumo', 'menu.metas') \gset
select count(*) as ntaps from taps \gset
select n as tn, cardinality(users) as tu from tap_targets where target = 'Enviar PDF' \gset
select count(*) as nerr from app_errors \gset
\echo telas inválidas ignoradas: :badnav, toques válidos: :ntaps, botão "Enviar PDF": :tn toques de :tu pessoa, erros: :nerr
set role service_role;
select public.product_nav(30)->'screens'->0->>'s' as top, jsonb_array_length(public.product_nav(30)->'errors') as perr \gset
\echo central: tela mais vista :top, erros :perr
reset role;

-- Código do atalho do iPhone: só o hash, um por pessoa e família
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\set ON_ERROR_STOP on
select public.save_quick_token(:'hr', repeat('a', 64));
select public.save_quick_token(:'hr', repeat('b', 64));
select (public.quick_token_status(:'hr')->>'uses') as qu \gset
\echo código do atalho salvo, usos: :qu
\set ON_ERROR_STOP off
\echo (os erros a seguir são esperados: código inválido, família de outra pessoa, ninguém logado lê os códigos)
select public.save_quick_token(:'hr', 'curto');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.save_quick_token(:'hr', repeat('c', 64));
select * from quick_tokens;
reset role;
select count(*) as nq from quick_tokens \gset
\echo códigos guardados (o novo substitui o antigo): :nq
