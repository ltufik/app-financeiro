-- Testa isolamento entre famílias, convites e replace_month. Rode após o shim e o schema.
\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@x'), ('00000000-0000-0000-0000-00000000000b', 'b@x'), ('00000000-0000-0000-0000-00000000000c', 'c@x') on conflict do nothing;
set role authenticated;
-- A cria a família
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_household('Família A', 'Ana') as ha \gset
select count(*) as cats_a from categories where household_id = :'ha' \gset
\echo categorias A: :cats_a
insert into transactions(household_id, source, month, description, amount, category, manual) values (:'ha', 'conta', '2026-10', 'mercado manual', -230, 'Mercado', true) returning id as man \gset
select public.create_invite(:'ha') as code \gset
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
insert into transactions(household_id, source, month, amount) values (:'ha', 'conta', '2026-10', -1);
select public.replace_month(:'ha', 'conta', '2026-10', '[]'::jsonb);
\set ON_ERROR_STOP on
-- C entra na família A pelo convite
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.accept_invite(:'code', 'Caio') = :'ha' as c_joined \gset
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
select public.learn_rule(:'ha', 'cartao', 'PADARIA X', 'Mercado');
select public.learn_rule(:'ha', 'cartao', 'PADARIA X', 'Restaurantes e delivery');
select category from rules where household_id = :'ha' and kind = 'exact' \gset
\echo regra aprendida (atualizada): :category
-- convite já usado
\set ON_ERROR_STOP off
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.accept_invite(:'code');
