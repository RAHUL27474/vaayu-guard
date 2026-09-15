-- General app/tab activity log — separate from the identity-mismatch
-- pipeline (activity_events/alerts/sessions). Records every DISTINCT
-- (process, window title) the agent sees, across ALL apps/browser
-- windows, not just Gmail/WhatsApp. Still just titles — no content, no
-- screenshots, no keystrokes.

create table window_activity (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  captured_at timestamptz not null,
  process_name text not null,
  window_title text not null,
  is_foreground boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_window_activity_device_time
  on window_activity (device_id, captured_at desc);

alter table window_activity enable row level security;

create policy window_activity_select_admin_like on window_activity
  for select using (is_admin_like(auth.uid()));

-- Tracks which wording of the employee notice a device has acknowledged,
-- so widening what's monitored (like this migration) can force the notice
-- to be shown again rather than relying on the very first acknowledgment.
alter table devices add column consent_notice_version integer;
