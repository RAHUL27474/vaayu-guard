// Posts the reported number to the VaayuGuard agent's local-loopback-only
// listener (see agent/src/WhatsAppIdentityServer.cs). If the agent isn't
// running right now (not installed yet, mid-restart, etc.) this just fails
// silently — the next report cycle (every ~15s from inject.js) tries again.
const AGENT_ENDPOINT = "http://127.0.0.1:8737/whatsapp-identity";

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "wa-number" || !msg.number) return;

  fetch(AGENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number: msg.number }),
  }).catch(() => {
    // Agent not reachable right now — fine, next cycle retries.
  });
});
