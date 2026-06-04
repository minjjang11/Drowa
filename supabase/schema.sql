-- Drowa — Supabase schema (Phase 1)
-- Run in Supabase SQL editor. Idempotent-ish: uses IF NOT EXISTS where possible.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- role: 'developer' | 'designer'
create table if not exists project_members (
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('developer', 'designer')),
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  path        text not null,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique (project_id, path)
);

-- one row per project: the single source of truth
create table if not exists context_md (
  project_id  uuid primary key references projects(id) on delete cascade,
  content     text not null default '',
  updated_at  timestamptz not null default now()
);

-- role: 'dev_ai' | 'design_ai'
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null check (role in ('dev_ai', 'design_ai')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Phase 3 (created now so snapshots have a home)
create table if not exists versions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  snapshot    jsonb not null,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_files_project       on files(project_id);
create index if not exists idx_messages_project     on messages(project_id, created_at desc);
create index if not exists idx_members_user         on project_members(user_id);

-- ─────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_updated   on projects;
create trigger trg_projects_updated   before update on projects   for each row execute function set_updated_at();
drop trigger if exists trg_files_updated      on files;
create trigger trg_files_updated      before update on files      for each row execute function set_updated_at();
drop trigger if exists trg_context_updated    on context_md;
create trigger trg_context_updated    before update on context_md for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Membership helper (avoids RLS recursion)
-- ─────────────────────────────────────────────────────────────

create or replace function is_project_member(pid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table projects        enable row level security;
alter table project_members enable row level security;
alter table files           enable row level security;
alter table context_md      enable row level security;
alter table messages        enable row level security;
alter table versions        enable row level security;

-- projects: members can read; owner can write
drop policy if exists projects_select on projects;
create policy projects_select on projects for select
  using (owner_id = auth.uid() or is_project_member(id));
drop policy if exists projects_insert on projects;
create policy projects_insert on projects for insert
  with check (owner_id = auth.uid());
drop policy if exists projects_update on projects;
create policy projects_update on projects for update
  using (owner_id = auth.uid());
drop policy if exists projects_delete on projects;
create policy projects_delete on projects for delete
  using (owner_id = auth.uid());

-- project_members: members can read; project owner manages rows
drop policy if exists members_select on project_members;
create policy members_select on project_members for select
  using (user_id = auth.uid() or is_project_member(project_id));
drop policy if exists members_write on project_members;
create policy members_write on project_members for all
  using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));

-- files / context_md / messages: any member can read+write
drop policy if exists files_all on files;
create policy files_all on files for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

drop policy if exists context_all on context_md;
create policy context_all on context_md for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

drop policy if exists messages_all on messages;
create policy messages_all on messages for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

drop policy if exists versions_all on versions;
create policy versions_all on versions for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

-- ─────────────────────────────────────────────────────────────
-- Auto-add project owner as a member (role: developer) on insert
-- ─────────────────────────────────────────────────────────────

create or replace function add_owner_as_member()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'developer')
  on conflict do nothing;
  insert into context_md (project_id, content)
  values (new.id, '')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_add_owner on projects;
create trigger trg_add_owner after insert on projects
  for each row execute function add_owner_as_member();

-- ─────────────────────────────────────────────────────────────
-- Realtime (Phase 2 preview sync) — add tables to publication
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table files;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table context_md;

-- ─────────────────────────────────────────────────────────────
-- Phase 3-1: Design System tokens
-- ─────────────────────────────────────────────────────────────

create table if not exists design_tokens (
  project_id  uuid primary key references projects(id) on delete cascade,
  tokens      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_tokens_updated on design_tokens;
create trigger trg_tokens_updated before update on design_tokens
  for each row execute function set_updated_at();

alter table design_tokens enable row level security;

drop policy if exists tokens_all on design_tokens;
create policy tokens_all on design_tokens for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

alter publication supabase_realtime add table design_tokens;
