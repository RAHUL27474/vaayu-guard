import type { Metadata, Viewport } from "next";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaayuGuard",
  description: "Company-PC identity monitoring for VaayuTrip",
};

// Matches the browser chrome (mobile address bar) to the light/dark theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionUser();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-fg">
        {session ? (
          <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <span className="font-semibold">VaayuGuard</span>
              <div className="order-last w-full sm:order-none sm:w-auto">
                <NavLinks showFilters={session.profile.role === "developer"} />
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-3 text-sm text-muted">
                <span className="hidden truncate md:inline">{session.email}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs capitalize">
                  {session.profile.role}
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
