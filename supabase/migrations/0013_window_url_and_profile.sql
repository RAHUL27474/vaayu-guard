-- Browser context on the general activity log, plus a way to silence a
-- whole browser profile.
--
-- Two new, nullable columns on window_activity:
--   * url            — the active browser tab's site (hostname, e.g.
--                      "mail.google.com"), reported by the VaayuGuard browser
--                      extension and correlated by the agent to the foreground
--                      browser window. Null for non-browser windows, or when
--                      the extension isn't installed/running. We deliberately
--                      store the host only, not the full path/query.
--   * browser_profile — which browser profile the window belongs to (e.g.
--                      "Person 2"), parsed by the agent from the window title.
--                      Null for the default/only profile or non-browsers.
--
-- Both are additive and nullable, so existing rows and older agents (which
-- never send them) keep working unchanged.

alter table window_activity add column if not exists url text;
alter table window_activity add column if not exists browser_profile text;

-- New hide-list target: a developer can switch a whole browser profile off,
-- so nothing from that profile is ever stored. Matched (case-insensitively)
-- against window_activity.browser_profile at ingestion. 'tab'/'email'/
-- 'whatsapp' already exist from 0009.
alter type filter_target add value if not exists 'profile';
