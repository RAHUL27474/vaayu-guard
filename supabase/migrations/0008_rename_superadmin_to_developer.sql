-- Rename the `superadmin` role to `developer` throughout the database.
-- Idempotent and order-independent of the rewritten 0001–0007: a no-op on a
-- fresh DB (where everything was already created as `developer`), and the
-- actual rename on the existing live DB. Also brings the live DB's device
-- update policy in line with 0007 (admin may disable), in case 0007 was not
-- applied on its own.

-- 1. Rename the enum value (only if the old label still exists). This also
--    updates every profiles.role row that held 'superadmin' automatically.
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'superadmin'
  ) then
    alter type user_role rename value 'superadmin' to 'developer';
  end if;
end $$;

-- 2. Drop the policies that depend on is_superadmin() before dropping it.
drop policy if exists devices_update_superadmin on devices;
drop policy if exists devices_delete_superadmin on devices;

-- 3. Repoint the role-check functions at 'developer'. create-or-replace keeps
--    is_admin_like's OID stable, so policies that reference it stay valid.
create or replace function is_admin_like(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role in ('admin', 'developer'));
$$;

create or replace function is_developer(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'developer');
$$;

drop function if exists is_superadmin(uuid);

-- 4. Recreate the device write policies under developer-named rules.
--    Update (disable) is admin-like; delete/rotate stays developer-only.
drop policy if exists devices_update_admin_like on devices;
create policy devices_update_admin_like on devices
  for update using (is_admin_like(auth.uid()));

drop policy if exists devices_delete_developer on devices;
create policy devices_delete_developer on devices
  for delete using (is_developer(auth.uid()));
