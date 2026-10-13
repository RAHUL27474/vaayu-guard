-- Admin (director) role can now add devices too, not just developer.
-- Update/delete (disable, rotate) stays developer-only.
drop policy if exists devices_write_developer on devices;
create policy devices_write_admin_like on devices
  for insert with check (is_admin_like(auth.uid()));
