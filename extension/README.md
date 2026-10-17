# VaayuGuard Browser Helper

A small Manifest V3 browser extension that reports two things to the
VaayuGuard agent running on the same PC, over `http://127.0.0.1:8737`
(loopback only — never leaves the machine except via the agent's own
check-in, same as everything else VaayuGuard collects):

1. **Which WhatsApp account is signed in** on `web.whatsapp.com`.
2. **The active tab's site** — the hostname only (e.g. `mail.google.com`),
   never the full URL, path, query string, or page content. The agent uses
   this to label the foreground browser window in the Timeline with the site
   it's showing. Internal pages (`chrome://`, extensions, `file://`, new-tab)
   report nothing.

It uses the `tabs` permission to read the active tab's URL and title, and an
`alarms`-driven heartbeat so a tab left focused but idle keeps the agent's
"current site" fresh.

## How it works

- `inject.js` runs in the page's own JS context and calls WhatsApp Web's
  internal `window.require(...)` module loader to read the signed-in
  account's own number — the same technique open-source WhatsApp Web
  automation libraries (e.g. `whatsapp-web.js`) use, since there's no public
  API for this.
- `content.js` relays that number to `background.js` via `postMessage`
  (the only channel between the page's "MAIN" world and the extension's
  "ISOLATED" world).
- `background.js` POSTs the WhatsApp number to the agent (which compares it
  against the device's assigned number the same way it does for email), and
  separately POSTs the active tab's hostname + title to `/active-tab` on
  every focus/navigation change (and on a 30s alarm). The agent correlates
  that host to the foreground browser window by matching the tab title
  against the window title. See `agent/src/ActiveTabStore.cs`.

**This will occasionally break.** WhatsApp renames these internal module
names when they ship updates, since they were never meant to be a public
API. When that happens, the extension just stops finding a number (falls
back silently to the old "WhatsApp Web is open" signal) rather than
breaking anything — but the module name list in `inject.js` will need an
update to restore number detection. This is expected, ongoing maintenance,
not a one-time build.

## Installing it — automatic (normal path)

The agent installer (both the single-exe one and `install.ps1`) sets the
`ExtensionInstallForcelist` policy for Chrome and Edge automatically, which
silently installs this extension for the CRE — no "Add to Chrome" prompt,
no Developer mode, nothing for them to click. This only works when the
installer runs elevated (HKLM write), which:

- **`install.ps1`** always has (it's meant to be run "as Administrator").
- The **single-exe installer** only has if the CRE happens to be a local
  admin or runs it elevated. When it doesn't, this step is skipped
  silently (same graceful-degradation as the Scheduled Task registration)
  — re-run `install.ps1` once, elevated, to set it retroactively.

The policy takes effect the next time Chrome/Edge restarts.

## Installing it — manual (dev/debugging only)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. **Load unpacked** → select this `extension/` folder.

## How the automatic install works

`dashboard/public/extension/` holds two generated files that make the
force-install policy possible:

- `vaayuguard.crx` — this folder, packaged and signed.
- `update.xml` — the Omaha-format update manifest Chrome/Edge poll,
  pointing at the `.crx` above.

Both are rebuilt with:

```powershell
npx --yes crx3 -p keys\vaayuguard-extension.pem -o dashboard\public\extension\vaayuguard.crx -x dashboard\public\extension\update.xml --appVersion <next-version> --crxURL https://vaayuguard-bice.vercel.app/extension/vaayuguard.crx -- extension
```

`keys/vaayuguard-extension.pem` is the signing key — **never commit it**
(it's gitignored). It must stay the same across rebuilds: the extension ID
(`amkaccikccmobblkcmnndhengmpacfba`, hardcoded into `Installer.cs` and
`install.ps1`) is derived from this key's public half, so losing/rotating
it means every already-deployed policy points at a dead ID and the whole
fleet needs the new ID pushed out again. Back this file up somewhere safe,
outside the repo.

After changing anything in `extension/`, bump `--appVersion`, rebuild, then
redeploy the dashboard (`npx vercel --prod` from `dashboard/`) so the new
`.crx`/`update.xml` go live — Chrome/Edge will pick up the update on their
own periodic policy check, no reinstall needed.
