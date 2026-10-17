-- The agent reports why its last self-update attempt failed (download
-- timeout, hash mismatch, file in use, ...) on every check-in, so a PC that
-- isn't updating can be diagnosed from the dashboard side instead of by
-- reading agent.log on that machine. Null once an update succeeds / when
-- there's nothing to report.
alter table devices add column if not exists agent_update_error text;
