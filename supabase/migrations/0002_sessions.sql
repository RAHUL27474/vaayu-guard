-- Session-based tracking: when a mismatched identity's window was opened
-- and closed, how many times, and how much of that time it was the
-- foreground (active) window vs. sitting in the background.

alter table activity_events add column is_foreground boolean not null default false;

create table sessions (
  id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade,
  detected_identity text not null,
  channel activity_channel not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  ended_at timestamptz,
  total_hits integer not null default 1,
  foreground_hits integer not null default 0
);

-- Fast lookup of "the currently-open session for this (device, identity)",
-- used by the check-in route on every request.
create unique index idx_sessions_open_identity
  on sessions (device_id, detected_identity)
  where ended_at is null;

create index idx_sessions_device_started
  on sessions (device_id, started_at desc);

alter table sessions enable row level security;

create policy sessions_select_admin_like on sessions
  for select using (is_admin_like(auth.uid()));

-- Daily rollup per (device, identity): total time open, how many separate
-- sessions, and how much of that was foreground. security_invoker so the
-- view is subject to the same RLS as `sessions` itself, not the view
-- owner's privileges.
create view daily_identity_activity
with (security_invoker = true) as
select
  device_id,
  detected_identity,
  channel,
  date_trunc('day', started_at) as activity_date,
  count(*) as session_count,
  sum(extract(epoch from (coalesce(ended_at, now()) - started_at)))::bigint as total_duration_seconds,
  sum(foreground_hits) as foreground_hits,
  sum(total_hits) as total_hits
from sessions
group by device_id, detected_identity, channel, date_trunc('day', started_at);
