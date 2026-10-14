-- Performance: wrap auth.uid() in a scalar subquery so Postgres evaluates it
-- once per statement (InitPlan) instead of once per row. Behaviour is
-- identical; only the plan changes. Flagged by the Supabase performance
-- advisor (lint 0003_auth_rls_initplan).

alter policy profiles_select_self on public.profiles
  using (id = (select auth.uid()));

alter policy devices_select_admin_like on public.devices
  using (public.is_admin_like((select auth.uid())));
alter policy devices_write_admin_like on public.devices
  with check (public.is_admin_like((select auth.uid())));
alter policy devices_update_admin_like on public.devices
  using (public.is_admin_like((select auth.uid())));
alter policy devices_delete_developer on public.devices
  using (public.is_developer((select auth.uid())));

alter policy activity_events_select_admin_like on public.activity_events
  using (public.is_admin_like((select auth.uid())));

alter policy alerts_select_admin_like on public.alerts
  using (public.is_admin_like((select auth.uid())));
alter policy alerts_update_admin_like on public.alerts
  using (public.is_admin_like((select auth.uid())));

alter policy sessions_select_admin_like on public.sessions
  using (public.is_admin_like((select auth.uid())));

alter policy window_activity_select_admin_like on public.window_activity
  using (public.is_admin_like((select auth.uid())));

alter policy visibility_filters_all_developer on public.visibility_filters
  using (public.is_developer((select auth.uid())))
  with check (public.is_developer((select auth.uid())));

alter policy app_settings_select_admin_like on public.app_settings
  using (public.is_admin_like((select auth.uid())));
alter policy app_settings_update_admin_like on public.app_settings
  using (public.is_admin_like((select auth.uid())))
  with check (public.is_admin_like((select auth.uid())));

-- Covering indexes for foreign keys (lint 0001_unindexed_foreign_keys).
create index if not exists idx_alerts_acknowledged_by on public.alerts (acknowledged_by);
create index if not exists idx_alerts_close_requested_by on public.alerts (close_requested_by);
create index if not exists idx_app_settings_updated_by on public.app_settings (updated_by);
create index if not exists idx_devices_created_by on public.devices (created_by);
create index if not exists idx_visibility_filters_created_by on public.visibility_filters (created_by);
