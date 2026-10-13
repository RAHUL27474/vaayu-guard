-- Second dashboard-managed secret: the developer-access code that opens the
-- agent's local developer panel (`VaayuGuardAgent.exe --dev <code>`). Managed
-- the same way as the uninstall code — viewable/changeable by both roles on
-- the Settings page and pushed to agents (as a hash) on check-in.

alter table app_settings
  add column developer_code text not null default 'VGDEV-4K2Q-9MX7';
