import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { CalendarDays, ListTree, Settings, Users } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Demo RIS — ApiBorne contract reference", template: "%s · Demo RIS" },
  description:
    "Reference implementation of the ApiBorne Kiosk Integration Contract: a demo RIS editor with an agenda, backed by SQLite.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background min-h-screen antialiased`}>
        <Providers>
          <header className="bg-card sticky top-0 z-30 border-b">
            <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-6 px-4">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarDays className="text-primary size-5" />
                Demo RIS
                <span className="text-muted-foreground hidden text-xs font-normal sm:inline">
                  — ApiBorne Kiosk Integration Contract reference implementation
                </span>
              </div>
              <nav className="ml-auto flex items-center gap-1 text-sm">
                <Link href="/" className="hover:bg-accent flex items-center gap-1.5 rounded-md px-3 py-1.5">
                  <CalendarDays className="size-4" /> Agenda
                </Link>
                <Link href="/patients" className="hover:bg-accent flex items-center gap-1.5 rounded-md px-3 py-1.5">
                  <Users className="size-4" /> Patients
                </Link>
                <Link href="/referentials" className="hover:bg-accent flex items-center gap-1.5 rounded-md px-3 py-1.5">
                  <ListTree className="size-4" /> Referentials
                </Link>
                <Link href="/settings" className="hover:bg-accent flex items-center gap-1.5 rounded-md px-3 py-1.5">
                  <Settings className="size-4" /> Settings
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
