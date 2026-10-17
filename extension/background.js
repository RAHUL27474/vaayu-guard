// Posts two things to the VaayuGuard agent's local-loopback-only listener
// (see agent/src/WhatsAppIdentityServer.cs):
//   1. the signed-in WhatsApp Web number, relayed from inject.js/content.js;
//   2. the active browser tab's site (hostname only) whenever focus or the
//      page changes, so the agent can label the foreground browser window
//      with the site it's on.
// If the agent isn't running right now (not installed yet, mid-restart, etc.)
// every fetch just fails silently — the next event or alarm tries again.
const AGENT_BASE = "http://127.0.0.1:8737";
const WA_ENDPOINT = `${AGENT_BASE}/whatsapp-identity`;
const TAB_ENDPOINT = `${AGENT_BASE}/active-tab`;
const PROFILE_ENDPOINT = `${AGENT_BASE}/profile-windows`;

// The account signed in to THIS browser profile (each profile runs its own
// copy of the extension). Several profiles can share a display name, so this
// — not the name in the window title — is what tells the agent which email a
// window belongs to. Empty if the profile isn't signed in.
async function profileEmail() {
  try {
    const info = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
    return info?.email || "";
  } catch {
    return "";
  }
}

// This profile's email plus the active-tab title of each of its windows —
// enough for the agent to match every open browser window (not just the
// focused one) to the account it's signed in as. Titles only, no URLs.
async function reportProfileWindows() {
  try {
    const email = await profileEmail();
    if (!email) return;
    const tabs = await chrome.tabs.query({ active: true });
    const titles = tabs.map((t) => t.title || "").filter((t) => t.length > 0);
    await fetch(PROFILE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, titles }),
    });
  } catch {
    // Agent not reachable — next event or alarm retries.
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "wa-number" || !msg.number) return;

  fetch(WA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number: msg.number }),
  }).catch(() => {
    // Agent not reachable right now — fine, next cycle retries.
  });
});

// Only real web pages have a site worth reporting. chrome://, edge://,
// extension pages, file:// and the new-tab page return null and are skipped,
// so internal pages never show up as "sites".
function hostOf(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

async function reportActiveTab() {
  try {
    // The active tab of whichever window the user last focused — i.e. what
    // they're actually looking at. We send the host only, never the path or
    // query string.
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const host = tab ? hostOf(tab.url || "") : null;
    if (!host) return;

    await fetch(TAB_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, title: tab.title || "" }),
    });
  } catch {
    // Agent not reachable, or no permission for this tab — next event retries.
  }
}

// Both reports, on every signal that a page or window changed.
function reportAll() {
  reportActiveTab();
  reportProfileWindows();
}

chrome.tabs.onActivated.addListener(reportAll);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.status === "complete")) {
    reportAll();
  }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  // Focus left all browser windows (user switched to another app) — nothing
  // to report; the agent only labels the foreground window anyway.
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  reportAll();
});

// A tab left focused but idle fires no events, so a periodic re-report keeps
// the agent's recent-report window fresh. 0.5 min is Chrome's alarm floor.
chrome.alarms.create("vg-active-tab", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "vg-active-tab") reportAll();
});

// And once when the service worker first spins up.
reportAll();
