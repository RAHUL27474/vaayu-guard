-- VaayuGuard initial schema: profiles (RBAC), devices, activity_events, alerts.
-- Two roles only: admin (director, read-mostly) and superadmin (full control).

create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'superadmin');
create type activity_channel as enum ('email', 'whatsapp');
create type event_confidence as enum ('high', 'low');
create type device_status as enum ('pending', 'active', 'disabled');
create type alert_status as enum ('open', 'acknowledged', 'dismissed');

-- One row per authenticated dashboard user, keyed by their auth.users id.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'admin',
  created_at timestamptz not null default now()
);

-- `is_admin_like` returns true for either role — mirrors vaayutrip-crm's
-- isAdminLike() rule that superadmin is always a superset of admin.
create or replace function is_admin_like(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and role in ('admin', 'superadmin')
  );
$$;

create or replace function is_superadmin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = uid and role = 'superadmin'
  );
$$;

-- One row per company PC being monitored.
create table devices (
  id uuid primary key default gen_random_uuid(),
  hostname text,
  device_label text,
  assigned_email text not null,
  assigned_phone text,
  assigned_to_user text,
  enrollment_token_hash text not null,
  enrollment_token_used_at timestamptz,
  active_token_hash text,
  status device_status not null default 'pending',
  last_seen_at timestamptz,
  consent_acknowledged_at timestamptz,
  registered_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create index idx_devices_status on devices (status);

-- Raw scan events from the agent (audit trail / debugging).
create table activity_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  captured_at timestamptz not null,
  process_name text not null,
  window_title text not null,
  channel activity_channel not null,
  detected_identity text,
  is_mismatch boolean not null default false,
  confidence event_confidence not null default 'high',
  created_at timestamptz not null default now()
);

create index idx_activity_events_device_time
  on activity_events (device_id, captured_at desc);
create index idx_activity_events_mismatch
  on activity_events (device_id) where is_mismatch;

-- Denormalized alert surface: one live "open" row per (device, identity),
-- so the dashboard reads this instead of aggregating raw events each load.
create table alerts (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  detected_identity text not null,
  channel activity_channel not null,
  occurrence_count integer not null default 1,
  status alert_status not null default 'open',
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz
);

create unique index idx_alerts_open_identity
  on alerts (device_id, detected_identity)
  where status = 'open';

-- RLS: agent never talks to Postgres directly (it only hits Next.js route
-- handlers using the service-role key), so these policies only govern the
-- two dashboard-authenticated roles.

alter table profiles enable row level security;
alter table devices enable row level security;
alter table activity_events enable row level security;
alter table alerts enable row level security;

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy devices_select_admin_like on devices
  for select using (is_admin_like(auth.uid()));
create policy devices_write_superadmin on devices
  for insert with check (is_superadmin(auth.uid()));
create policy devices_update_superadmin on devices
  for update using (is_superadmin(auth.uid()));
create policy devices_delete_superadmin on devices
  for delete using (is_superadmin(auth.uid()));

create policy activity_events_select_admin_like on activity_events
  for select using (is_admin_like(auth.uid()));

create policy alerts_select_admin_like on alerts
  for select using (is_admin_like(auth.uid()));
create policy alerts_update_admin_like on alerts
  for update using (is_admin_like(auth.uid()));
