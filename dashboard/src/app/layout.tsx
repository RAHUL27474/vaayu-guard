import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VaayuGuard",
  description: "Company-PC identity monitoring for VaayuTrip",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {session ? (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <span className="font-semibold">VaayuGuard</span>
              <nav className="flex gap-4 text-sm">
                <Link href="/devices" className="hover:underline">
                  Devices
                </Link>
                <Link href="/alerts" className="hover:underline">
                  Alerts
                </Link>
                <Link href="/activity" className="hover:underline">
                  Activity
                </Link>
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
                <span>
                  {session.email} · {session.profile.role}
                </span>
                <LogoutButton />
              </div>
            </div>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
