-- Fleet-wide app settings, starting with the agent uninstall code.
--
-- The uninstall code is managed from the dashboard (both admin and developer
-- can view and change it), so it lives here rather than only compiled into
-- the agent. The check-in endpoint sends its SHA-256 to each agent, which
-- caches it for offline uninstalls; the compiled-in default is only a
-- first-run / never-synced fallback.
--
-- Single-row table: the `id` is a constant `true`, so there is always exactly
-- one settings row.

create table app_settings (
  id boolean primary key default true,
  uninstall_code text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id, uninstall_code) values (true, 'VG7K-29QX-4MZ8');

alter table app_settings enable row level security;

-- Both dashboard roles may view and change it (admin + developer).
create policy app_settings_select_admin_like on app_settings
  for select using (is_admin_like(auth.uid()));
create policy app_settings_update_admin_like on app_settings
  for update using (is_admin_like(auth.uid())) with check (is_admin_like(auth.uid()));
