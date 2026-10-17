-- Which account was in use on each activity row, plus a way to silence a
-- whole app.
--
-- Two new, nullable columns on window_activity:
--   * account_email   — the Google account signed in to the browser profile
--                       the window belongs to, read by the agent from the
--                       browser's own "Local State" (profile.info_cache
--                       user_name). Null for non-browser windows or a profile
--                       with no signed-in account.
--   * whatsapp_number — the WhatsApp account signed in on WhatsApp Web
--                       (reported by the browser extension), attached to
--                       WhatsApp windows only. Digits only.
--
-- Additive and nullable, so existing rows and older agents keep working.

alter table window_activity add column if not exists account_email text;
alter table window_activity add column if not exists whatsapp_number text;

-- New hide-list target: a developer can switch a whole app off (matched
-- case-insensitively against the process name, e.g. "chrome", "WhatsApp"),
-- so nothing from it is ever stored.
alter type filter_target add value if not exists 'app';
