-- Admin (director) role can now disable devices too, not just developer.
-- (Close-window writes to alerts, already covered by alerts_update_admin_like.)
-- Delete/rotate of a device row stays developer-only.
drop policy if exists devices_update_developer on devices;
create policy devices_update_admin_like on devices
  for update using (is_admin_like(auth.uid()));
