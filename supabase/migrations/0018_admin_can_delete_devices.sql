-- Admins (not only developers) can delete devices from the dashboard.
-- Everything tied to a device (alerts, activity, sessions, timeline, its own
-- hide rules) is removed with it via the existing ON DELETE CASCADE FKs.
drop policy if exists devices_delete_developer on public.devices;
create policy devices_delete_admin_like on public.devices
  for delete
  using (public.is_admin_like((select auth.uid())));
