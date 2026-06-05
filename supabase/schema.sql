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

-- Phase 3-8: snapshot author + what triggered it.
alter table versions add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table versions add column if not exists "trigger"  text not null default 'manual';
create index if not exists idx_versions_project on versions(project_id, created_at desc);

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
alter publication supabase_realtime add table versions;

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

-- ─────────────────────────────────────────────────────────────
-- Phase 3-2: Template library (custom user templates; built-ins live in code)
-- ─────────────────────────────────────────────────────────────

create table if not exists templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade,
  name        text not null,
  category    text not null,
  code        text not null,
  preview_url text,
  is_global   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_templates_owner on templates(owner_id);

alter table templates enable row level security;

-- A user sees global templates + their own; can write only their own.
drop policy if exists templates_select on templates;
create policy templates_select on templates for select
  using (is_global = true or owner_id = auth.uid());
drop policy if exists templates_write on templates;
create policy templates_write on templates for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Phase 3-3: Inspiration library (curated patterns live in code)
-- ─────────────────────────────────────────────────────────────

create table if not exists inspirations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete cascade,
  title        text not null,
  image_url    text,
  tags         jsonb not null default '[]'::jsonb,
  pattern_type text not null,
  is_curated   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_inspirations_owner on inspirations(owner_id);

alter table inspirations enable row level security;

drop policy if exists inspirations_select on inspirations;
create policy inspirations_select on inspirations for select
  using (is_curated = true or owner_id = auth.uid());
drop policy if exists inspirations_write on inspirations;
create policy inspirations_write on inspirations for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Phase 3-4: Quick actions (built-ins live in code; custom per-user)
-- ─────────────────────────────────────────────────────────────

create table if not exists quick_actions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id) on delete cascade,
  label           text not null,
  icon            text,
  prompt_template text not null,
  category        text not null default 'custom',
  order_index     int not null default 0,
  is_global       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_quick_actions_owner on quick_actions(owner_id);

alter table quick_actions enable row level security;

drop policy if exists quick_actions_select on quick_actions;
create policy quick_actions_select on quick_actions for select
  using (is_global = true or owner_id = auth.uid());
drop policy if exists quick_actions_write on quick_actions;
create policy quick_actions_write on quick_actions for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Phase 3-6: GitHub import / sync
-- ─────────────────────────────────────────────────────────────

create table if not exists github_connections (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  github_username        text not null,
  access_token_encrypted text not null,
  created_at             timestamptz not null default now()
);

create table if not exists github_links (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null unique references projects(id) on delete cascade,
  repo_full_name text not null,
  branch         text not null default 'main',
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);

-- Track the remote blob SHA per file for conflict detection.
alter table files add column if not exists github_sha text;

alter table github_connections enable row level security;
alter table github_links        enable row level security;

-- Connections: owner-only. The token is AES-encrypted at rest regardless.
drop policy if exists gh_conn_all on github_connections;
create policy gh_conn_all on github_connections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gh_links_all on github_links;
create policy gh_links_all on github_links for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));
