-- =====================================================================
-- App financeiro: banco de dados (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- Ele pode ser rodado de novo: usa "if not exists" / "create or replace".
-- =====================================================================

create extension if not exists pgcrypto;

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

create table if not exists public.invites (
  code         text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid,
  used_at      timestamptz
);

-- Grupo da categoria:
--   renda   = renda recorrente (entra na taxa de poupança)
--   entrada = outras entradas do dia a dia (ex.: reembolsos)
--   pontual = entrada pontual, fora da sobra (13º, venda de um bem)
--   dia     = gasto do dia a dia
--   fora    = gasto fora do dia a dia (obra, compra pontual grande)
--   neutro  = não é receita nem gasto (transferência, investimento, pagamento da fatura, empréstimo)
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

  insert into categories(household_id, name, grp, financing) values
    (h, 'Salário', 'renda', false),
    (h, 'Renda extra', 'renda', false),
    (h, 'Reembolsos', 'entrada', false),
    (h, 'Outras entradas', 'entrada', false),
    (h, 'Entrada pontual (13º, férias, bônus)', 'pontual', false),
    (h, 'Mercado', 'dia', false),
    (h, 'Restaurantes e delivery', 'dia', false),
    (h, 'Moradia e contas', 'dia', false),
    (h, 'Financiamento imobiliário', 'dia', true),
    (h, 'Escola e cursos', 'dia', false),
    (h, 'Saúde', 'dia', false),
    (h, 'Transporte', 'dia', false),
    (h, 'Combustível', 'dia', false),
    (h, 'Lazer', 'dia', false),
    (h, 'Compras', 'dia', false),
    (h, 'Vestuário', 'dia', false),
    (h, 'Assinaturas', 'dia', false),
    (h, 'Seguros', 'dia', false),
    (h, 'Pets', 'dia', false),
    (h, 'Presentes', 'dia', false),
    (h, 'Serviços domésticos', 'dia', false),
    (h, 'Impostos e taxas', 'dia', false),
    (h, 'Tarifas bancárias', 'dia', false),
    (h, 'Outros', 'dia', false),
    (h, 'A classificar', 'dia', false),
    (h, 'Gasto pontual (fora do dia a dia)', 'fora', false),
    (h, 'Investimentos e transferências', 'neutro', false),
    (h, 'Pagamento da fatura do cartão', 'neutro', false),
    (h, 'Empréstimos a terceiros', 'neutro', false);

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

-- Gera um código de convite (válido por 7 dias).
create or replace function public.create_invite(p_household uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  c := upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', 'x'), 1, 8));
  c := regexp_replace(c, '[^A-Z0-9]', 'K', 'g');
  insert into invites(code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

-- Entra numa família com um código de convite.
create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_not_found'; end if;
  if inv.used_by is not null then raise exception 'invite_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;
  insert into members(household_id, user_id, role, display_name) values (inv.household_id, auth.uid(), 'member', p_display_name)
    on conflict (household_id, user_id) do nothing;
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.household_id;
end $$;

-- Salva uma fatura ou um extrato importado, substituindo o que já havia no mês (atômico).
-- p_rows: [{date, day, description, amount, category, installment, card, pending}]
-- p_reconcile: ids de lançamentos manuais que já aparecem no documento (serão apagados)
create or replace function public.replace_month(p_household uuid, p_source text, p_month text, p_rows jsonb,
  p_reconcile uuid[] default '{}', p_label text default null, p_file text default null, p_info jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare imp uuid;
begin
  if not public.is_member(p_household) then raise exception 'not_member'; end if;
  if p_source not in ('conta', 'cartao') then raise exception 'bad_source'; end if;
  insert into imports(household_id, source, month, label, file_name, info, created_by)
    values (p_household, p_source, p_month, coalesce(p_label, p_source || ' ' || p_month), p_file, coalesce(p_info, '{}'::jsonb), auth.uid())
    returning id into imp;
  delete from transactions where household_id = p_household and source = p_source and month = p_month and manual = false;
  delete from transactions where household_id = p_household and manual = true and id = any(coalesce(p_reconcile, '{}'));
  insert into transactions(household_id, source, month, date, day, description, amount, category, installment, card, manual, pending, import_id, created_by)
  select p_household, p_source, p_month,
         nullif(r->>'date', '')::date, r->>'day', coalesce(r->>'description', ''), (r->>'amount')::numeric,
         r->>'category', nullif(r->>'installment', ''), nullif(r->>'card', ''), false,
         coalesce((r->>'pending')::boolean, false), imp, auth.uid()
  from jsonb_array_elements(p_rows) r;
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
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.replace_month(uuid, text, text, jsonb, uuid[], text, text, jsonb) to authenticated;
grant execute on function public.learn_rule(uuid, text, text, text) to authenticated;
