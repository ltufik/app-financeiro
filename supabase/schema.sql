-- =====================================================================
-- App financeiro: banco de dados (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- Ele pode ser rodado de novo: usa "if not exists" / "create or replace".
-- =====================================================================

-- No extensions needed: gen_random_uuid() and md5() are built into Postgres 13+.

-- ---------- Tabelas ----------

-- Uma família (household). settings guarda metas, patrimônio, dívidas etc.
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  settings    jsonb not null default '{}'::jsonb,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- A family outlives the account that created it (needed to delete an account).
alter table public.households alter column created_by drop not null;

create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);
alter table public.members add column if not exists relation text;

create table if not exists public.invites (
  code         text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid,
  used_at      timestamptz
);

-- Who the invite is for (shown to the person who opens the link) and their relation to the family.
alter table public.invites add column if not exists invitee_name text;
alter table public.invites add column if not exists relation text;
alter table public.invites add column if not exists invitee_phone text;

-- Grupo da categoria:
--   renda   = renda recorrente (entra na taxa de poupança)
--   entrada = outras entradas do dia a dia (ex.: reembolsos)
--   pontual = entrada pontual, fora da sobra (13º, venda de um bem)
--   dia     = gasto do dia a dia
--   fora    = gasto fora do dia a dia (obra, compra pontual grande)
--   neutro  = não é receita nem despesa (transferência, investimento, pagamento da fatura)
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  grp          text not null check (grp in ('renda', 'entrada', 'pontual', 'dia', 'fora', 'neutro')),
  financing    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, name)
);

-- Lançamentos. Conta: valor com sinal (negativo = saída). Cartão: positivo = compra, negativo = crédito.
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null check (source in ('conta', 'cartao')),
  month        text not null check (month ~ '^\d{4}-\d{2}$'),
  date         date,
  day          text,
  description  text not null default '',
  amount       numeric(14, 2) not null,
  category     text,
  installment  text,
  card         text,
  manual       boolean not null default false,
  pending      boolean not null default false,
  import_id    uuid,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists tx_household_month_idx on public.transactions(household_id, month);

-- Regras de classificação: exatas (aprendidas) e expressões regulares.
create table if not exists public.rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null check (source in ('conta', 'cartao')),
  kind         text not null check (kind in ('exact', 'regex')),
  pattern      text not null,
  category     text not null,
  min_abs      numeric(14, 2),
  max_abs      numeric(14, 2),
  priority     int not null default 100,
  created_at   timestamptz not null default now()
);
drop index if exists public.rules_exact_uq;
create unique index if not exists rules_uq on public.rules(household_id, source, kind, pattern);

create table if not exists public.imports (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source       text not null,
  month        text,
  label        text not null,
  file_name    text,
  info         jsonb not null default '{}'::jsonb,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

create table if not exists public.studies (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  question     text not null,
  answer       text not null,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------- Segurança: cada família só enxerga os próprios dados ----------

create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid());
$$;

create or replace function public.is_owner(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid() and role = 'owner');
$$;

alter table public.households   enable row level security;
alter table public.members      enable row level security;
alter table public.invites      enable row level security;
alter table public.categories   enable row level security;
-- Despesa fixa (recorrente) ou variável. Só vale para o grupo "dia".
alter table public.categories add column if not exists recurring boolean;
update public.categories set recurring = true where recurring is null and grp = 'dia'
  and name in ('Moradia e contas', 'Financiamento imobiliário', 'Escola e cursos', 'Assinaturas', 'Seguros', 'Serviços domésticos');

-- Nota fiscal: um lançamento pode ser dividido em categorias (splits = [{category, amount}])
-- e guardar o que foi lido da nota (receipt = {store, date, total, items:[{description, amount, category}]}).
-- O arquivo da nota nunca é guardado.
alter table public.transactions add column if not exists splits jsonb;
alter table public.transactions add column if not exists receipt jsonb;

alter table public.transactions enable row level security;
alter table public.rules        enable row level security;
alter table public.imports      enable row level security;
alter table public.studies      enable row level security;

drop policy if exists hh_select on public.households;
create policy hh_select on public.households for select using (public.is_member(id));
drop policy if exists hh_update on public.households;
create policy hh_update on public.households for update using (public.is_member(id)) with check (public.is_member(id));
drop policy if exists hh_delete on public.households;
create policy hh_delete on public.households for delete using (public.is_owner(id));

drop policy if exists mem_select on public.members;
create policy mem_select on public.members for select using (public.is_member(household_id));
drop policy if exists mem_update on public.members;
create policy mem_update on public.members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists mem_delete on public.members;
create policy mem_delete on public.members for delete using (user_id = auth.uid() or public.is_owner(household_id));

drop policy if exists inv_all on public.invites;
create policy inv_all on public.invites for all using (public.is_member(household_id)) with check (public.is_member(household_id));

do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'rules', 'imports', 'studies'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- ---------- Funções chamadas pelo app ----------

-- Cria uma família com categorias e regras iniciais; quem cria vira dono.
create or replace function public.create_household(p_name text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into households(name, created_by, settings) values (p_name, auth.uid(), jsonb_build_object(
    'goals', jsonb_build_object('cardMonthly', 0, 'savings', 0.2, 'savingsNoFin', 0.3, 'patrimonio', 0, 'ageNow', null, 'ageGoal', null, 'ret', 0.05),
    'cardCloseDay', 24))
  returning id into h;
  insert into members(household_id, user_id, role, display_name) values (h, auth.uid(), 'owner', p_display_name);

  insert into categories(household_id, name, grp, financing, recurring) values
    (h, 'Salário', 'renda', false, false),
    (h, 'Renda extra', 'renda', false, false),
    (h, 'Reembolsos', 'entrada', false, false),
    (h, 'Outras entradas', 'entrada', false, false),
    (h, 'Receita extra (13º, férias, bônus)', 'pontual', false, false),
    (h, 'Mercado', 'dia', false, false),
    (h, 'Restaurantes e delivery', 'dia', false, false),
    (h, 'Moradia e contas', 'dia', false, true),
    (h, 'Financiamento imobiliário', 'dia', true, true),
    (h, 'Escola e cursos', 'dia', false, true),
    (h, 'Saúde', 'dia', false, false),
    (h, 'Transporte', 'dia', false, false),
    (h, 'Combustível', 'dia', false, false),
    (h, 'Lazer', 'dia', false, false),
    (h, 'Compras', 'dia', false, false),
    (h, 'Vestuário', 'dia', false, false),
    (h, 'Assinaturas', 'dia', false, true),
    (h, 'Seguros', 'dia', false, true),
    (h, 'Pets', 'dia', false, false),
    (h, 'Presentes', 'dia', false, false),
    (h, 'Serviços domésticos', 'dia', false, true),
    (h, 'Impostos e taxas', 'dia', false, false),
    (h, 'Tarifas bancárias', 'dia', false, false),
    (h, 'Outros', 'dia', false, false),
    (h, 'A classificar', 'dia', false, false),
    (h, 'Despesa extra (reforma, viagem, carro)', 'fora', false, false),
    (h, 'Investimentos e transferências', 'neutro', false, false),
    (h, 'Pagamento da fatura do cartão', 'neutro', false, false);

  insert into rules(household_id, source, kind, pattern, category, priority) values
    (h, 'conta',  'regex', 'PAGAMENTO.*CART|FATURA|DEB AUTOM DE FATURA', 'Pagamento da fatura do cartão', 50),
    (h, 'conta',  'regex', 'SALARIO|FOLHA DE PAG|PROVENTOS', 'Salário', 50),
    (h, 'conta',  'regex', 'APLICACAO|RESGATE|POUPANCA|CDB|TESOURO|INVEST', 'Investimentos e transferências', 60),
    (h, 'conta',  'regex', 'TARIFA|ANUIDADE|PACOTE DE SERV', 'Tarifas bancárias', 60),
    (h, 'conta',  'regex', 'SABESP|ENEL|COMGAS|LIGHT|CEMIG|COPEL|CONDOMINIO|ALUGUEL', 'Moradia e contas', 70),
    (h, 'conta',  'regex', 'CREDITO IMOBILIARIO|FINANCIAMENTO HAB|CAIXA ECONOMICA.*HAB', 'Financiamento imobiliário', 70),
    (h, 'conta',  'regex', 'RECEITA FEDERAL|DARF|IPTU|IPVA|DETRAN|SIMPLES NAC', 'Impostos e taxas', 70),
    (h, 'cartao', 'regex', 'POSTO|SHELL|IPIRANGA|PETROBRAS|COMBUST|AUTO POSTO', 'Combustível', 50),
    (h, 'cartao', 'regex', 'IFOOD|RAPPI|RESTAUR|LANCHONETE|PIZZ|BURGER|MC ?DONALDS|OUTBACK|PADARIA|CAFE', 'Restaurantes e delivery', 60),
    (h, 'cartao', 'regex', 'SUPERMERC|MERCADO|CARREFOUR|PAO DE ACUCAR|ASSAI|ATACAD|HORTIFRUTI|SONDA|EXTRA ', 'Mercado', 60),
    (h, 'cartao', 'regex', 'NETFLIX|SPOTIFY|AMAZON PRIME|PRIMEVIDEO|DISNEY|HBO|MAX\.COM|YOUTUBE|APPLE\.COM|GOOGLE ONE|DEEZER|GLOBOPLAY', 'Assinaturas', 50),
    (h, 'cartao', 'regex', 'UBER|99 ?APP|99POP|CABIFY|ESTACIONAMENTO|ESTAPAR|SEM PARAR|CONECTCAR|VELOE|PEDAGIO', 'Transporte', 60),
    (h, 'cartao', 'regex', 'DROGASIL|DROGARIA|RAIA|PAGUE MENOS|FARMA|LABORAT|CLINICA|HOSPITAL|ODONTO', 'Saúde', 60),
    (h, 'cartao', 'regex', 'SEGURO|PORTO SEGURO|SULAMERICA SEG|PRUDENTIAL|MAPFRE|SUHAI', 'Seguros', 60),
    (h, 'cartao', 'regex', 'PETZ|COBASI|PET ', 'Pets', 70),
    (h, 'cartao', 'regex', 'AMAZON|MERCADOLIVRE|MERCADO LIVRE|SHOPEE|MAGALU|MAGAZINE|ALIEXPRESS|SHEIN', 'Compras', 55),
    (h, 'cartao', 'regex', 'ANUIDADE|IOF', 'Tarifas bancárias', 60);
  return h;
end $$;

-- Gera um código de convite (válido por 7 dias, uso único), opcionalmente para uma pessoa e parentesco.
drop function if exists public.create_invite(uuid);
drop function if exists public.create_invite(uuid, text, text);
create or replace function public.create_invite(p_household uuid, p_name text default null, p_relation text default null, p_phone text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  loop
    -- Built-in functions only (on Supabase, pgcrypto lives outside this function's search_path).
    c := translate(upper(encode(decode(md5(random()::text || clock_timestamp()::text || p_household::text), 'hex'), 'base64')), '+/=O0I1L', '');
    c := substr(c, 1, 8);
    exit when char_length(c) = 8 and not exists (select 1 from invites where code = c);
  end loop;
  insert into invites(code, household_id, created_by, invitee_name, relation, invitee_phone)
    values (c, p_household, auth.uid(), nullif(trim(p_name), ''), nullif(trim(p_relation), ''), nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''));
  return c;
end $$;

-- O que a pessoa convidada vê ao abrir o link (antes mesmo de ter conta): família, quem convidou e para quem é.
create or replace function public.invite_info(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'family', h.name,
    'inviter', (select m.display_name from members m where m.household_id = i.household_id and m.user_id = i.created_by),
    'invitee', i.invitee_name, 'relation', i.relation,
    'status', case when i.used_by is not null then 'used' when i.expires_at < now() then 'expired' else 'ok' end)
  from invites i join households h on h.id = i.household_id
  where i.code = upper(trim(p_code));
$$;

-- Entra numa família com um código de convite.
create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if exists (select 1 from members where household_id = inv.household_id and user_id = auth.uid()) then return inv.household_id; end if;
  if inv.used_by is not null then raise exception 'invite_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;
  insert into members(household_id, user_id, role, display_name, relation)
    values (inv.household_id, auth.uid(), 'member', coalesce(nullif(trim(p_display_name), ''), inv.invitee_name), inv.relation);
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.household_id;
end $$;

-- Salva uma fatura ou um extrato importado, substituindo o que já havia no mês (atômico).
-- p_rows: [{date, day, description, amount, category, installment, card, pending}]
-- p_reconcile: ids de lançamentos manuais que já aparecem no documento (serão apagados)
create or replace function public.replace_month(p_household uuid, p_source text, p_month text, p_rows jsonb,
  p_reconcile uuid[] default '{}', p_label text default null, p_file text default null, p_info jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare imp uuid; keep jsonb;
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  if p_source not in ('conta', 'cartao') then raise exception 'bad_source'; end if;
  insert into imports(household_id, source, month, label, file_name, info, created_by)
    values (p_household, p_source, p_month, coalesce(p_label, p_source || ' ' || p_month), p_file, coalesce(p_info, '{}'::jsonb), auth.uid())
    returning id into imp;
  -- Receipts already attached to rows of this month (or to manual rows being reconciled) carry over
  -- to the re-imported row with the same amount and the same date or description.
  select coalesce(jsonb_agg(jsonb_build_object('d', t.date::text, 's', t.description, 'a', t.amount, 'sp', t.splits, 'rc', t.receipt)), '[]'::jsonb)
    into keep
    from transactions t
    where t.household_id = p_household and (t.splits is not null or t.receipt is not null)
      and ((t.source = p_source and t.month = p_month and t.manual = false) or (t.manual = true and t.id = any(coalesce(p_reconcile, '{}'))));
  delete from transactions where household_id = p_household and source = p_source and month = p_month and manual = false;
  delete from transactions where household_id = p_household and manual = true and id = any(coalesce(p_reconcile, '{}'));
  insert into transactions(household_id, source, month, date, day, description, amount, category, installment, card, manual, pending, import_id, created_by, splits, receipt)
  select p_household, p_source, p_month,
         nullif(r->>'date', '')::date, r->>'day', coalesce(r->>'description', ''), (r->>'amount')::numeric,
         r->>'category', nullif(r->>'installment', ''), nullif(r->>'card', ''), false,
         coalesce((r->>'pending')::boolean, false), imp, auth.uid(),
         coalesce(case when jsonb_typeof(r->'splits') = 'array' then r->'splits' end, k.sp),
         coalesce(case when jsonb_typeof(r->'receipt') = 'object' then r->'receipt' end, k.rc)
  from jsonb_array_elements(p_rows) r
  left join lateral (
    select nullif(x->'sp', 'null'::jsonb) sp, nullif(x->'rc', 'null'::jsonb) rc
    from jsonb_array_elements(keep) x
    where (x->>'a')::numeric = (r->>'amount')::numeric
      and (x->>'d' = nullif(r->>'date', '') or x->>'s' = coalesce(r->>'description', ''))
    order by (x->>'d' = nullif(r->>'date', '') and x->>'s' = coalesce(r->>'description', '')) desc
    limit 1) k on true;
  return imp;
end $$;

-- Ensina uma regra exata (o mesmo lançamento vem com a mesma categoria da próxima vez).
create or replace function public.learn_rule(p_household uuid, p_source text, p_pattern text, p_category text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  insert into rules(household_id, source, kind, pattern, category, priority)
    values (p_household, p_source, 'exact', p_pattern, p_category, 10)
  on conflict (household_id, source, kind, pattern)
    do update set category = excluded.category;
end $$;

-- Notificações push: um registro por aparelho. prefs = tipos de aviso ligados; last_sent = último envio de cada aviso.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  prefs        jsonb not null default '{}'::jsonb,
  last_sent    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for select using (user_id = auth.uid());
grant select on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- Liga os avisos neste aparelho (o mesmo aparelho pode ter sido de outra conta: troca o dono).
create or replace function public.save_push(p_household uuid, p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'bad_endpoint'; end if;
  insert into push_subscriptions(household_id, user_id, endpoint, p256dh, auth, prefs)
    values (p_household, auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(p_prefs, '{}'::jsonb))
  on conflict (endpoint) do update set household_id = excluded.household_id, user_id = excluded.user_id,
    p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs;
end $$;

-- Desliga os avisos deste aparelho.
create or replace function public.delete_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Métricas do produto: um registro por pessoa por dia em que abriu o app (sem nada do que ela fez).
create table if not exists public.activity (
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  day          date not null,
  primary key (user_id, day)
);
alter table public.activity enable row level security;
revoke all on public.activity from anon, authenticated;

create or replace function public.touch_activity(p_household uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into activity(user_id, household_id, day)
    values (auth.uid(), case when public.is_member(p_household) then p_household end, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;
end $$;

-- Números agregados do produto (sem dados de nenhuma família). Só o servidor (service_role) chama.
create or replace function public.product_metrics()
returns jsonb language sql security definer set search_path = public as $$
  with u as (select id, created_at from auth.users),
  fam as (select h.id, h.settings, (select count(*) from members m where m.household_id = h.id) as nmem from households h),
  imp as (select household_id, count(distinct month) as months from transactions where not manual group by household_id),
  act as (select user_id, day from activity)
  select jsonb_build_object(
    'users', (select count(*) from u),
    'users_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'in_family', (select count(distinct user_id) from members),
    'families', (select count(*) from fam),
    'families_shared', (select count(*) from fam where nmem >= 2),
    'families_1_month', (select count(*) from imp where months >= 1),
    'families_2_months', (select count(*) from imp where months >= 2),
    'families_closed', (select count(*) from fam where coalesce(jsonb_typeof(settings->'closed'), '') = 'object' and settings->'closed' <> '{}'::jsonb),
    'd7_eligible', (select count(*) from u where created_at <= now() - interval '7 days'),
    'd7_retained', (select count(*) from u where created_at <= now() - interval '7 days' and exists (select 1 from act where act.user_id = u.id and act.day >= (u.created_at at time zone 'America/Sao_Paulo')::date + 7)),
    'd30_eligible', (select count(*) from u where created_at <= now() - interval '30 days'),
    'd30_retained', (select count(*) from u where created_at <= now() - interval '30 days' and exists (select 1 from act where act.user_id = u.id and act.day >= (u.created_at at time zone 'America/Sao_Paulo')::date + 30)),
    'wau', (select count(distinct user_id) from act where day > current_date - 7),
    'mau', (select count(distinct user_id) from act where day > current_date - 30),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'users', (select count(*) from act where act.day = d::date)) order by d), '[]'::jsonb)
              from generate_series(current_date - 13, current_date, interval '1 day') d),
    'manual_30d', (select count(*) from transactions where manual and created_at > now() - interval '30 days'),
    'receipts_30d', (select count(*) from transactions where receipt is not null and created_at > now() - interval '30 days'),
    'imports_30d', (select count(*) from imports where source in ('conta', 'cartao') and created_at > now() - interval '30 days'),
    'studies', (select count(*) from studies),
    'charts', (select coalesce(sum(jsonb_array_length(settings->'charts')), 0) from fam where jsonb_typeof(settings->'charts') = 'array'),
    'push_devices', (select count(*) from push_subscriptions),
    'at', now()
  );
$$;
revoke all on function public.product_metrics() from public, anon, authenticated;
grant execute on function public.product_metrics() to service_role;

-- Central do produto (página /admin): backlog, precificação e desenho do produto.
-- Ninguém logado lê ou escreve: só o servidor (service_role), depois de conferir ADMIN_EMAILS.
create table if not exists public.product_board (
  key        text primary key check (key ~ '^[a-z_]{2,40}$'),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.product_board enable row level security;
revoke all on public.product_board from anon, authenticated;
grant select, insert, update, delete on public.product_board to service_role;

-- Renomeia uma categoria e leva o novo nome para lançamentos, divisões de nota e regras.
create or replace function public.rename_category(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare c record; n text := nullif(trim(p_name), '');
begin
  select * into c from categories where id = p_id;
  if c is null or not public.is_member(c.household_id) then raise exception 'not_member'; end if;
  if n is null or length(n) > 60 then raise exception 'bad_name'; end if;
  if exists (select 1 from categories where household_id = c.household_id and lower(name) = lower(n) and id <> p_id) then raise exception 'duplicate'; end if;
  update categories set name = n where id = p_id;
  update transactions set category = n where household_id = c.household_id and category = c.name;
  update rules set category = n where household_id = c.household_id and category = c.name;
  update transactions t set splits = (select jsonb_agg(case when x->>'category' = c.name then jsonb_set(x, '{category}', to_jsonb(n)) else x end) from jsonb_array_elements(t.splits) x)
    where t.household_id = c.household_id and t.splits is not null and t.splits @> jsonb_build_array(jsonb_build_object('category', c.name));
end $$;

-- Table access for signed-in users (row-level security above still limits rows to their family).
-- Explicit, so it works even when the project does not expose new tables automatically.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.households, public.members, public.invites, public.categories,
  public.transactions, public.rules, public.imports, public.studies to authenticated;
revoke all on public.households, public.members, public.invites, public.categories,
  public.transactions, public.rules, public.imports, public.studies from anon;

-- Deletes the signed-in person's account (LGPD). Families where they are the only member are deleted
-- with all their data; in shared families another member becomes the owner and the data stays.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.households h
   where exists (select 1 from public.members m where m.household_id = h.id and m.user_id = me)
     and not exists (select 1 from public.members m where m.household_id = h.id and m.user_id <> me);
  update public.members m set role = 'owner'
   where m.household_id in (select household_id from public.members where user_id = me and role = 'owner')
     and m.user_id = (select x.user_id from public.members x where x.household_id = m.household_id and x.user_id <> me order by x.created_at limit 1);
  delete from public.members where user_id = me;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.create_invite(uuid, text, text, text) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.replace_month(uuid, text, text, jsonb, uuid[], text, text, jsonb) to authenticated;
grant execute on function public.learn_rule(uuid, text, text, text) to authenticated;
grant execute on function public.rename_category(uuid, text) to authenticated;
grant execute on function public.save_push(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_push(text) to authenticated;
grant execute on function public.touch_activity(uuid) to authenticated;

-- ============================================================================
-- Fase de testes: opinião dos testadores, dúvidas e uso por funcionalidade.
-- ============================================================================

-- Opiniões (erro, ideia, crítica) e dúvidas. Quem mandou vê as suas; só o servidor vê todas.
create table if not exists public.feedback (
  id           bigint generated by default as identity primary key,
  user_id      uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  kind         text not null check (kind in ('erro', 'ideia', 'critica', 'duvida')),
  text         text not null check (length(text) between 3 and 4000),
  answer       text,
  helpful      boolean,
  screen       text,
  device       text,
  version      text,
  status       text not null default 'novo' check (status in ('novo', 'visto', 'backlog', 'resolvido')),
  note         text,
  created_at   timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;
drop policy if exists feedback_own on public.feedback;
create policy feedback_own on public.feedback for select to authenticated using (user_id = auth.uid());

create or replace function public.send_feedback(p_household uuid, p_kind text, p_text text, p_answer text default null,
  p_screen text default null, p_device text default null, p_version text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; t text := trim(coalesce(p_text, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('erro', 'ideia', 'critica', 'duvida') then raise exception 'bad_kind'; end if;
  if length(t) < 3 then raise exception 'too_short'; end if;
  if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 40 then raise exception 'rate_limited'; end if;
  insert into feedback(user_id, household_id, kind, text, answer, screen, device, version)
    values (auth.uid(), case when public.is_member(p_household) then p_household end, p_kind, left(t, 4000),
            left(p_answer, 8000), left(p_screen, 60), left(p_device, 200), left(p_version, 20))
  returning id into new_id;
  return new_id;
end $$;

-- "Resolveu?" depois da resposta do assistente.
create or replace function public.feedback_helpful(p_id bigint, p_helpful boolean)
returns void language sql security definer set search_path = public as $$
  update feedback set helpful = p_helpful where id = p_id and user_id = auth.uid();
$$;

-- Uso por funcionalidade: quantas vezes cada pessoa usou cada parte do app, por dia e hora.
-- Só o nome da funcionalidade (ex.: "lancar.voz"), nunca valores ou textos.
create table if not exists public.usage (
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  day          date not null,
  hour         smallint not null check (hour between 0 and 23),
  feature      text not null check (feature ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  n            int not null default 1,
  primary key (user_id, day, hour, feature)
);
alter table public.usage enable row level security;
revoke all on public.usage from anon, authenticated;

create or replace function public.track(p_household uuid, p_features text[])
returns void language plpgsql security definer set search_path = public as $$
declare f text; hh uuid; d date := (now() at time zone 'America/Sao_Paulo')::date;
  h smallint := extract(hour from now() at time zone 'America/Sao_Paulo');
begin
  if auth.uid() is null or p_features is null then return; end if;
  hh := case when public.is_member(p_household) then p_household end;
  foreach f in array p_features[1:50] loop
    continue when f is null or f !~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$';
    insert into usage(user_id, household_id, day, hour, feature) values (auth.uid(), hh, d, h, f)
    on conflict (user_id, day, hour, feature) do update set n = usage.n + 1;
  end loop;
end $$;

-- Para a Central do produto: quem usa, o que usa e quando. Só o servidor chama.
create or replace function public.product_usage(p_days int default 30)
returns jsonb language sql security definer set search_path = public, auth as $$
  with w as (select * from usage where day > current_date - greatest(1, least(p_days, 365))),
  people as (
    select u.id, u.email, u.created_at,
      (select m.display_name from members m where m.user_id = u.id order by m.created_at limit 1) as name,
      (select h.name from members m join households h on h.id = m.household_id where m.user_id = u.id order by m.created_at limit 1) as family,
      (select max(day) from activity a where a.user_id = u.id) as last_day,
      (select count(*) from activity a where a.user_id = u.id and a.day > current_date - greatest(1, least(p_days, 365))) as days,
      (select coalesce(jsonb_object_agg(feature, n), '{}'::jsonb) from (select feature, sum(n) as n from w where w.user_id = u.id group by feature) x) as features,
      (select count(*) from feedback f where f.user_id = u.id) as feedbacks
    from auth.users u)
  select jsonb_build_object(
    'days', p_days,
    'people', (select coalesce(jsonb_agg(to_jsonb(people) order by last_day desc nulls last), '[]'::jsonb) from people),
    'features', (select coalesce(jsonb_object_agg(feature, jsonb_build_object('n', n, 'users', users)), '{}'::jsonb)
                 from (select feature, sum(n) as n, count(distinct user_id) as users from w group by feature) x),
    'hours', (select coalesce(jsonb_agg(jsonb_build_array(dow, hour, n)), '[]'::jsonb)
              from (select extract(dow from day)::int as dow, hour, sum(n) as n from w group by 1, 2) x),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_array(feature, day, users)), '[]'::jsonb)
               from (select split_part(feature, '.', 1) as feature, day, count(distinct user_id) as users from w where day > current_date - 28 group by 1, 2) x),
    'at', now());
$$;

create or replace function public.product_feedback()
returns jsonb language sql security definer set search_path = public, auth as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'kind', f.kind, 'text', f.text, 'answer', f.answer, 'helpful', f.helpful, 'screen', f.screen, 'device', f.device,
    'version', f.version, 'status', f.status, 'note', f.note, 'created_at', f.created_at,
    'name', (select m.display_name from members m where m.user_id = f.user_id order by m.created_at limit 1),
    'email', (select u.email from auth.users u where u.id = f.user_id),
    'family', (select h.name from households h where h.id = f.household_id)) order by f.created_at desc), '[]'::jsonb)
  from (select * from feedback order by created_at desc limit 1000) f;
$$;

revoke all on function public.product_usage(int) from public, anon, authenticated;
revoke all on function public.product_feedback() from public, anon, authenticated;
grant execute on function public.product_usage(int) to service_role;
grant execute on function public.product_feedback() to service_role;
revoke all on function public.send_feedback(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.feedback_helpful(bigint, boolean) from public, anon;
revoke all on function public.track(uuid, text[]) from public, anon;
grant execute on function public.send_feedback(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.feedback_helpful(bigint, boolean) to authenticated;
grant execute on function public.track(uuid, text[]) to authenticated;

-- Resposta personalizada: quando algo que a pessoa pediu fica pronto, ela recebe um recado com o nome dela.
alter table public.feedback add column if not exists reply text;
alter table public.feedback add column if not exists replied_at timestamptz;
alter table public.feedback add column if not exists reply_seen boolean not null default false;

create or replace function public.feedback_reply_seen(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update feedback set reply_seen = true where id = p_id and user_id = auth.uid();
$$;
revoke all on function public.feedback_reply_seen(bigint) from public, anon;
grant execute on function public.feedback_reply_seen(bigint) to authenticated;

create or replace function public.product_feedback()
returns jsonb language sql security definer set search_path = public, auth as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'kind', f.kind, 'text', f.text, 'answer', f.answer, 'helpful', f.helpful, 'screen', f.screen, 'device', f.device,
    'version', f.version, 'status', f.status, 'note', f.note, 'created_at', f.created_at,
    'reply', f.reply, 'replied_at', f.replied_at, 'reply_seen', f.reply_seen,
    'name', (select m.display_name from members m where m.user_id = f.user_id order by m.created_at limit 1),
    'email', (select u.email from auth.users u where u.id = f.user_id),
    'family', (select h.name from households h where h.id = f.household_id)) order by f.created_at desc), '[]'::jsonb)
  from (select * from feedback order by created_at desc limit 1000) f;
$$;
revoke all on function public.product_feedback() from public, anon, authenticated;
grant execute on function public.product_feedback() to service_role;

-- ============================================================================
-- Navegação, toques e erros (para a Central do produto). Nunca valores nem o que a pessoa digitou.
-- ============================================================================
create table if not exists public.nav (
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  day          date not null,
  screen       text not null check (screen ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  views        int not null default 0,
  seconds      int not null default 0,
  primary key (user_id, day, screen)
);
create table if not exists public.nav_flow (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  from_screen text not null check (from_screen ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  to_screen   text not null check (to_screen ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  n           int not null default 0,
  primary key (user_id, day, from_screen, to_screen)
);
-- Taps: position on a grid 20 wide (5% of the screen width each), counted per screen and day. No one's id.
create table if not exists public.taps (
  day    date not null,
  screen text not null check (screen ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  cx     smallint not null check (cx between 0 and 19),
  cy     smallint not null check (cy between 0 and 199),
  n      int not null default 0,
  primary key (day, screen, cx, cy)
);
create table if not exists public.tap_targets (
  day    date not null,
  screen text not null check (screen ~ '^[a-z_]{2,20}(\.[a-z_]{2,20})?$'),
  target text not null check (length(target) between 1 and 60),
  n      int not null default 0,
  users  uuid[] not null default '{}',
  primary key (day, screen, target)
);
create table if not exists public.app_errors (
  id           bigint generated by default as identity primary key,
  user_id      uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  at           timestamptz not null default now(),
  kind         text not null check (kind in ('tela', 'js', 'promessa')),
  message      text not null check (length(message) between 1 and 400),
  screen       text,
  source       text,
  device       text,
  version      text
);
create index if not exists app_errors_at on public.app_errors (at desc);
alter table public.nav enable row level security;
alter table public.nav_flow enable row level security;
alter table public.taps enable row level security;
alter table public.tap_targets enable row level security;
alter table public.app_errors enable row level security;
revoke all on public.nav, public.nav_flow, public.taps, public.tap_targets, public.app_errors from anon, authenticated;

-- One call per batch: {screens:[{s,v,t}], flows:[{f,t,n}], taps:[{s,x,y,n}], targets:[{s,t,n}]}
create or replace function public.track_nav(p_household uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); hh uuid; d date := (now() at time zone 'America/Sao_Paulo')::date; x jsonb;
  re text := '^[a-z_]{2,20}(\.[a-z_]{2,20})?$';
begin
  if me is null or p_data is null then return; end if;
  hh := case when public.is_member(p_household) then p_household end;
  for x in select * from jsonb_array_elements(coalesce(p_data->'screens', '[]')) limit 60 loop
    continue when coalesce(x->>'s', '') !~ re;
    insert into nav(user_id, household_id, day, screen, views, seconds)
      values (me, hh, d, x->>'s', least(greatest(coalesce((x->>'v')::int, 0), 0), 500), least(greatest(coalesce((x->>'t')::int, 0), 0), 7200))
    on conflict (user_id, day, screen) do update set views = nav.views + excluded.views, seconds = nav.seconds + excluded.seconds;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_data->'flows', '[]')) limit 100 loop
    continue when coalesce(x->>'f', '') !~ re or coalesce(x->>'t', '') !~ re;
    insert into nav_flow(user_id, day, from_screen, to_screen, n) values (me, d, x->>'f', x->>'t', least(greatest(coalesce((x->>'n')::int, 1), 1), 500))
    on conflict (user_id, day, from_screen, to_screen) do update set n = nav_flow.n + excluded.n;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_data->'taps', '[]')) limit 300 loop
    continue when coalesce(x->>'s', '') !~ re or (x->>'x')::int not between 0 and 19 or (x->>'y')::int not between 0 and 199;
    insert into taps(day, screen, cx, cy, n) values (d, x->>'s', (x->>'x')::int, (x->>'y')::int, least(greatest(coalesce((x->>'n')::int, 1), 1), 500))
    on conflict (day, screen, cx, cy) do update set n = taps.n + excluded.n;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_data->'targets', '[]')) limit 100 loop
    continue when coalesce(x->>'s', '') !~ re or length(coalesce(x->>'t', '')) not between 1 and 60;
    insert into tap_targets(day, screen, target, n, users) values (d, x->>'s', x->>'t', least(greatest(coalesce((x->>'n')::int, 1), 1), 500), array[me])
    on conflict (day, screen, target) do update set n = tap_targets.n + excluded.n,
      users = case when me = any(tap_targets.users) then tap_targets.users else (tap_targets.users || me)[1:200] end;
  end loop;
end $$;

create or replace function public.log_error(p_household uuid, p_kind text, p_message text, p_screen text default null, p_source text default null, p_device text default null, p_version text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_kind not in ('tela', 'js', 'promessa') or coalesce(trim(p_message), '') = '' then return; end if;
  if (select count(*) from app_errors where user_id = auth.uid() and at > now() - interval '1 day') >= 60 then return; end if;
  insert into app_errors(user_id, household_id, kind, message, screen, source, device, version)
    values (auth.uid(), case when public.is_member(p_household) then p_household end, p_kind, left(trim(p_message), 400), left(p_screen, 60), left(p_source, 200), left(p_device, 120), left(p_version, 20));
end $$;

create or replace function public.product_nav(p_days int default 30)
returns jsonb language sql security definer set search_path = public, auth as $$
  with since as (select current_date - greatest(1, least(p_days, 365)) as d)
  select jsonb_build_object(
    'days', p_days,
    'screens', (select coalesce(jsonb_agg(jsonb_build_object('s', screen, 'views', v, 'users', u, 'seconds', t) order by v desc), '[]'::jsonb)
                from (select screen, sum(views) v, count(distinct user_id) u, sum(seconds) t from nav, since where day > since.d group by screen) x),
    'flows', (select coalesce(jsonb_agg(jsonb_build_object('f', from_screen, 't', to_screen, 'n', n, 'users', u) order by n desc), '[]'::jsonb)
              from (select from_screen, to_screen, sum(n) n, count(distinct user_id) u from nav_flow, since where day > since.d group by 1, 2 order by 3 desc limit 60) x),
    'taps', (select coalesce(jsonb_object_agg(screen, cells), '{}'::jsonb) from (select screen, jsonb_agg(jsonb_build_array(cx, cy, n)) cells
              from (select screen, cx, cy, sum(n) n from taps, since where day > since.d group by 1, 2, 3) y group by screen) x),
    'targets', (select coalesce(jsonb_object_agg(screen, list), '{}'::jsonb) from (select screen, jsonb_agg(jsonb_build_object('t', target, 'n', n, 'users', u) order by n desc) list
              from (select screen, target, sum(n) n, (select count(distinct v) from tap_targets t2, unnest(t2.users) v where t2.screen = t.screen and t2.target = t.target and t2.day > (select d from since)) u
                    from tap_targets t, since where day > since.d group by 1, 2) y group by screen) x),
    'errors', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'at', e.at, 'kind', e.kind, 'message', e.message, 'screen', e.screen, 'source', e.source, 'device', e.device, 'version', e.version,
                 'name', (select m.display_name from members m where m.user_id = e.user_id order by m.created_at limit 1), 'email', (select u.email from auth.users u where u.id = e.user_id),
                 'family', (select h.name from households h where h.id = e.household_id)) order by e.at desc), '[]'::jsonb)
               from (select * from app_errors, since where at > since.d order by at desc limit 500) e),
    'at', now());
$$;
revoke all on function public.product_nav(int) from public, anon, authenticated;
grant execute on function public.product_nav(int) to service_role;
revoke all on function public.track_nav(uuid, jsonb) from public, anon;
revoke all on function public.log_error(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.track_nav(uuid, jsonb) to authenticated;
grant execute on function public.log_error(uuid, text, text, text, text, text, text) to authenticated;
