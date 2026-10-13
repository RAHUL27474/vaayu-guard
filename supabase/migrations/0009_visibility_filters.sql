-- Developer-controlled ingestion filters ("hide-list").
--
-- A developer curates, per device, which tabs/sites, email addresses or
-- WhatsApp numbers must NEVER be stored. The agent check-in endpoint applies
-- these at ingestion time and drops matching sightings before any insert, so
-- filtered data never reaches the database and the admin (director) never
-- sees it. No rules for a device => everything is stored, same as before.
--
-- Default is visible: this is a hide-list, not an allow-list.

create type filter_target as enum ('tab', 'email', 'whatsapp');

create table visibility_filters (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  target filter_target not null,
  -- For 'tab'/'email': a case-insensitive substring matched against the
  -- window title (and, for email, the detected identity). For 'whatsapp':
  -- digits are compared digits-only, so formatting/+91 differences don't matter.
  pattern text not null,
  note text,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_visibility_filters_device
  on visibility_filters (device_id) where active;

alter table visibility_filters enable row level security;

-- Developer-only: this curation layer belongs to the dev team. The admin
-- never reads or writes it; they simply receive the already-filtered data.
-- (The agent check-in uses the service-role key and bypasses RLS entirely.)
create policy visibility_filters_all_developer on visibility_filters
  for all using (is_developer(auth.uid())) with check (is_developer(auth.uid()));
