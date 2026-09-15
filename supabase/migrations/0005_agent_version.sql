-- Lets the dashboard show which build each device is actually running,
-- instead of guessing from check-in timing gaps.
alter table devices add column agent_version integer;
