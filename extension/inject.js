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

      // Try a few known-good module names across recent WhatsApp Web
      // versions; the first one that resolves to something usable wins.
      const candidates = ["WAWebUserPrefsMeUser", "WAWebMeUser", "UserPrefsMeUser"];
      for (const name of candidates) {
        let mod;
        try {
          mod = window.require(name);
        } catch {
          continue;
        }
        if (!mod) continue;

        const me =
          typeof mod.getMaybeMeUser === "function" ? mod.getMaybeMeUser() :
          typeof mod.getMeUser === "function" ? mod.getMeUser() :
          mod.default ?? mod;

        if (!me) continue;
        if (typeof me === "string" && me.includes("@")) return me.split("@")[0];
        if (typeof me?.user === "string") return me.user;
        if (typeof me?._serialized === "string") return me._serialized.split("@")[0];
      }
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
