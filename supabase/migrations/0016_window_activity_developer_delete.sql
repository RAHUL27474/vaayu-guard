-- Developers can delete Timeline (window_activity) records from the
-- dashboard. Admins remain read-only; agents write through the service role.
create policy window_activity_delete_developer on public.window_activity
  for delete
  using (public.is_developer((select auth.uid())));
