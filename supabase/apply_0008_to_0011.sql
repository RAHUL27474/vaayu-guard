-- Run this once in the vaayu-guard Supabase project's SQL editor to bring the
-- live DB up to date for local testing. Combines migrations 0008–0011 in order.
-- Safe to run as one batch. (Claude could not apply it via MCP — writes were
-- declined — so paste it in Supabase Studio → SQL Editor and Run.)

-- ===== 0008: rename role superadmin -> developer =====
do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'superadmin'
  ) then
    alter type user_role rename value 'superadmin' to 'developer';
  end if;
end $$;

drop policy if exists devices_update_superadmin on devices;
drop policy if exists devices_delete_superadmin on devices;

create or replace function is_admin_like(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = uid and role in ('admin','developer')); $$;

create or replace function is_developer(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where id = uid and role = 'developer'); $$;

drop function if exists is_superadmin(uuid);

drop policy if exists devices_update_admin_like on devices;
create policy devices_update_admin_like on devices for update using (is_admin_like(auth.uid()));

drop policy if exists devices_delete_developer on devices;
create policy devices_delete_developer on devices for delete using (is_developer(auth.uid()));

-- ===== 0009: developer-controlled ingestion filters =====
create type filter_target as enum ('tab', 'email', 'whatsapp');

create table visibility_filters (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  target filter_target not null,
  pattern text not null,
  note text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_visibility_filters_device on visibility_filters (device_id) where active;

alter table visibility_filters enable row level security;
create policy visibility_filters_all_developer on visibility_filters
  for all using (is_developer(auth.uid())) with check (is_developer(auth.uid()));

-- ===== 0010: app_settings + uninstall code =====
create table app_settings (
  id boolean primary key default true,
  uninstall_code text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);
insert into app_settings (id, uninstall_code) values (true, 'VG7K-29QX-4MZ8');

alter table app_settings enable row level security;
create policy app_settings_select_admin_like on app_settings
  for select using (is_admin_like(auth.uid()));
create policy app_settings_update_admin_like on app_settings
  for update using (is_admin_like(auth.uid())) with check (is_admin_like(auth.uid()));

-- ===== 0011: developer-access code column =====
alter table app_settings add column developer_code text not null default 'VGDEV-4K2Q-9MX7';
