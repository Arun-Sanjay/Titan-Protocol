-- Titan OS: Domains, Modules, Activities

-- Ensure UUID generator exists (Supabase typically has this available)
create extension if not exists pgcrypto;

-- Enums (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_kind') then
    create type activity_kind as enum ('task', 'session', 'log');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_status') then
    create type activity_status as enum ('active', 'completed', 'skipped');
  end if;
end $$;

-- Tables
create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  icon text null,
  created_at timestamptz not null default now(),
  constraint modules_domain_name_unique unique (domain_id, name)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid null references public.modules(id) on delete set null,
  kind activity_kind not null,
  status activity_status not null default 'active',
  title text not null,
  notes text null,
  xp_reward int not null default 0,
  due_date date null,
  started_at timestamptz null,
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists activities_user_status_idx
  on public.activities (user_id, status);

create index if not exists activities_user_module_idx
  on public.activities (user_id, module_id);

create index if not exists activities_user_due_date_idx
  on public.activities (user_id, due_date);

create index if not exists activities_metadata_gin_idx
  on public.activities using gin (metadata);

-- Seed domains (idempotent)
insert into public.domains (name, sort_order)
values
  ('General', 0),
  ('Mind', 10),
  ('Body', 20),
  ('Money', 30)
on conflict (name) do nothing;

-- Seed modules (idempotent)
insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'General Tasks', 0, null
from public.domains d
where d.name = 'General'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Pomodoro', 0, null
from public.domains d
where d.name = 'Mind'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Meditation', 10, null
from public.domains d
where d.name = 'Mind'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Gym', 0, null
from public.domains d
where d.name = 'Body'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Nutrition', 10, null
from public.domains d
where d.name = 'Body'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Sleep', 20, null
from public.domains d
where d.name = 'Body'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Expenses', 0, null
from public.domains d
where d.name = 'Money'
on conflict (domain_id, name) do nothing;

insert into public.modules (domain_id, name, sort_order, icon)
select d.id, 'Income Missions', 10, null
from public.domains d
where d.name = 'Money'
on conflict (domain_id, name) do nothing;

