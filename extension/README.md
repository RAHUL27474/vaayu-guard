# VaayuGuard WhatsApp Identity Helper

A small Manifest V3 browser extension that reads which WhatsApp account is
signed in on `web.whatsapp.com` and reports it to the VaayuGuard agent
running on the same PC, over `http://127.0.0.1:8737` (loopback only — never
leaves the machine except via the agent's own check-in, same as everything
else VaayuGuard collects).

## How it works

- `inject.js` runs in the page's own JS context and calls WhatsApp Web's
  internal `window.require(...)` module loader to read the signed-in
  account's own number — the same technique open-source WhatsApp Web
  automation libraries (e.g. `whatsapp-web.js`) use, since there's no public
  API for this.
- `content.js` relays that number to `background.js` via `postMessage`
  (the only channel between the page's "MAIN" world and the extension's
  "ISOLATED" world).
- `background.js` POSTs it to the agent, which compares it against the
  device's assigned WhatsApp number the same way it already does for email.

**This will occasionally break.** WhatsApp renames these internal module
names when they ship updates, since they were never meant to be a public
API. When that happens, the extension just stops finding a number (falls
back silently to the old "WhatsApp Web is open" signal) rather than
breaking anything — but the module name list in `inject.js` will need an
update to restore number detection. This is expected, ongoing maintenance,
not a one-time build.

## Installing it (pilot — one browser at a time)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. **Load unpacked** → select this `extension/` folder.

That's it — no build step, no packaging.

## Rolling out to more PCs later

For the pilot (1-2 PCs) "Load unpacked" by hand is fine. Rolling out to the
full fleet without repeating that by hand on every PC needs the
`ExtensionInstallForcelist` registry policy (works via local policy, not
just Active Directory) pointing at a self-hosted signed `.crx` + update
manifest XML — not set up yet. Revisit once the pilot confirms the
number-detection technique itself is reliable enough to be worth the
packaging/signing/hosting work.
