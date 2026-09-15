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
    const refreshTimer = setInterval(() => {
      router.refresh();
      lastRefresh.current = Date.now();
    }, intervalSeconds * 1000);

    const tickTimer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [router, intervalSeconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      Live · updated {secondsAgo}s ago
    </span>
  );
}
