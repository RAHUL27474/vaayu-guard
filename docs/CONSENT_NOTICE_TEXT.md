# Employee Consent Notice — VaayuGuard

Shown on first run of the agent on a company PC (as a Windows message box),
and again whenever the notice version changes (see
`ConsentNotice.CurrentNoticeVersion` in `agent/src/ConsentNotice.cs`) — a
widened scope must be re-acknowledged, not just implied by the first ever
install. Only an explicit "OK" click counts as acknowledgment.

## Notice text (version 2, current)

> **VaayuTrip Monitoring Notice**
>
> This is a company-owned computer. VaayuTrip monitors this PC to check
> that the company email account assigned to this desktop is the one in
> use, to detect when WhatsApp Web is open, and to log which apps and
> browser tabs (by title only) are open during working hours.
>
> This tool does **not** record keystrokes, screenshots, or the content of
> your messages, emails, or documents — only window/tab titles and which
> account is signed in.
>
> By clicking OK, you acknowledge this notice.
>
> [OK]

## Version history

- **v1** (initial pilot): email/WhatsApp identity-mismatch detection only.
- **v2**: widened to log every open app/browser window's title (not just
  Gmail/WhatsApp) — still titles only, never content/screenshots/keystrokes.
  Existing installs are re-prompted with this notice automatically the next
  time the agent runs.

## Notes for HR / director sign-off

- This wording is a starting draft, not legal text — have HR/counsel
  confirm it before rollout past the pilot PCs.
- Pair this with a written policy communicated separately (offer letter
  clause, internal memo, or a signed acknowledgment form) — the on-screen
  notice is a technical confirmation, not a substitute for that.
- Update this file if the wording changes, bump
  `ConsentNotice.CurrentNoticeVersion`, and keep this file's "Notice text"
  section in sync with whatever text is finally approved.
