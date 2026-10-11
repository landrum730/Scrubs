-- Run once in your free Supabase project's SQL Editor.
-- These tables are accessible only through the server's secret/service_role key.
create table if not exists public.scrubs_catalog (
  id text primary key check (id = 'approved'),
  payload jsonb not null
);
create table if not exists public.scrubs_orders (
  id uuid primary key,
  created_at timestamptz not null,
  payload jsonb not null
);
alter table public.scrubs_catalog enable row level security;
alter table public.scrubs_orders enable row level security;
revoke all on public.scrubs_catalog, public.scrubs_orders from anon, authenticated;
grant select, insert, update, delete on public.scrubs_catalog, public.scrubs_orders to service_role;
create index if not exists scrubs_orders_created_at_idx on public.scrubs_orders (created_at desc, id desc);
