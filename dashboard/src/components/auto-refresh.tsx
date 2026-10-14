"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-fetches the current page's server data on an interval, so a
 * dashboard feels "live" without the admin having to hit F5. Renders a
 * small "Live · updated Xs ago" indicator so it's clear data is current,
 * not stale.
 */
export function AutoRefresh({ intervalSeconds = 15 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      lastRefresh.current = Date.now();
    };

    // Skip refreshes while the tab is in the background — no one is looking,
    // and each one costs a full server render. Catch up as soon as the tab
    // is visible again if the data has gone stale meanwhile.
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalSeconds * 1000);

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefresh.current >= intervalSeconds * 1000
      ) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const tickTimer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalSeconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      Live · updated {secondsAgo}s ago
    </span>
  );
}
