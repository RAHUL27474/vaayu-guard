-- Lets an admin/superadmin ask the agent to close the specific mismatched
-- window it flagged (a graceful WM_CLOSE, same as clicking the X — not a
-- forced kill, and not a persistent block; the identity can reopen it).

alter table alerts add column close_requested_at timestamptz;
alter table alerts add column close_requested_by uuid references profiles(id);
