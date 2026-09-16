// Runs in WhatsApp Web's own page context ("MAIN" world — see manifest.json),
// which is required to reach `window.require`, WhatsApp Web's internal
// webpack module loader. This is the same technique open-source WhatsApp
// Web automation libraries (e.g. whatsapp-web.js) use to read the signed-in
// account's own number — there is no public API for it. WhatsApp
// occasionally renames these internal module names when they ship updates,
// which will make this stop finding a number until it's updated; it fails
// silently (falls back to "WhatsApp Web is open" with no number) rather
// than breaking anything.
(function () {
  const REPORT_INTERVAL_MS = 15000;

  function tryGetOwnNumber() {
    try {
      if (typeof window.require !== "function") return null;

      const mod = window.require("WAWebUserPrefsMeUser");
      if (!mod) return null;

      // Confirmed live (2026-09-16): getMaybeMePnUser() returns
      // { user: "919118399683", server: "c.us", _serialized: "919118399683@c.us" }.
      // Falling back to a couple of older/alternate method names in case a
      // future WhatsApp Web version renames this one too.
      const me =
        typeof mod.getMaybeMePnUser === "function" ? mod.getMaybeMePnUser() :
        typeof mod.getMaybeMeUser === "function" ? mod.getMaybeMeUser() :
        typeof mod.getMeUser === "function" ? mod.getMeUser() :
        null;

      if (!me) return null;
      if (typeof me === "string" && me.includes("@")) return me.split("@")[0];
      if (typeof me.user === "string") return me.user;
      if (typeof me._serialized === "string") return me._serialized.split("@")[0];
    } catch {
      // WhatsApp Web internals changed shape — report nothing this cycle.
    }
    return null;
  }

  function report() {
    const number = tryGetOwnNumber();
    if (number) {
      window.postMessage({ source: "vaayuguard-wa-inject", number }, "https://web.whatsapp.com");
    }
  }

  setTimeout(report, 3000);
  setInterval(report, REPORT_INTERVAL_MS);
})();
