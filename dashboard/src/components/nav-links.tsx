"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Main navigation. Highlights the current section, and on narrow screens
 * becomes a single horizontally scrollable row instead of overflowing.
 */
export function NavLinks({ showFilters }: { showFilters: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/devices", label: "Devices" },
    { href: "/alerts", label: "Alerts" },
    { href: "/activity", label: "Activity" },
    { href: "/timeline", label: "Timeline" },
    ...(showFilters ? [{ href: "/filters", label: "Filters" }] : []),
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 transition-colors ${
              active
                ? "bg-surface-2 font-medium text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
