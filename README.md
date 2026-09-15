# VaayuGuard

Company-PC identity-monitoring agent for VaayuTrip. Detects when a
non-assigned (personal) email account is used on a company PC instead of the
one assigned to that desktop, and surfaces it on a dashboard.

Scope is deliberately narrow: identity-mismatch detection on browser window
titles only. No keystrokes, no screenshots, no message content are ever
captured. See `docs/CONSENT_NOTICE_TEXT.md` for the notice shown to
employees on first run.

## Layout

- `agent/` — .NET 8 Worker Service, published as a single self-contained
  Windows exe. Polls open browser windows, extracts email identity, queues
  events locally, syncs to the dashboard backend.
- `dashboard/` — Next.js (App Router) + Supabase. Two roles: `admin`
  (director, view-only) and `superadmin` (full control, manages devices).
- `supabase/migrations/` — schema + RLS for a **separate** Supabase project
  (not the vaayutrip-crm production project).
- `docs/` — consent notice text and other non-code reference docs.

## Status

Pilot phase — see project plan for build order and rollout steps.
