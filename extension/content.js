// Isolated-world content script — relays the number inject.js found (via
// postMessage, since that's the only channel between MAIN and ISOLATED
// worlds) to the background service worker, which is the one actually
// allowed to fetch() the local agent (content scripts are subject to the
// page's own CSP; extension-privileged contexts like the service worker
// are not).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "vaayuguard-wa-inject") return;
  if (!event.data.number) return;

  chrome.runtime.sendMessage({ type: "wa-number", number: event.data.number });
});
