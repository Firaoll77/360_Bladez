"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { todayEat } from "@/lib/time";
import { gregorianToEth, formatEthDate } from "@/lib/ethiopian";

export function SiteFooter() {
  const pathname = usePathname();
  const [y, m, d] = todayEat().split("-").map(Number);
  const eth = formatEthDate(gregorianToEth(y, m, d));

  // On internal pages, render discreet slim footer with quick navigation
  if (pathname !== "/") {
    return (
      <footer className="mt-auto border-t border-ink/10 bg-bg py-5 text-center text-xs text-ink-soft">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-center justify-between gap-3 px-6">
          <Link href="/#top" className="font-display tracking-wider text-ink text-sm hover:text-accent transition-colors">
            360°<span className="text-accent">_</span>BLADEZ
          </Link>
          <nav className="flex items-center gap-5 text-xs font-medium text-ink-soft">
            <Link href="/#top" className="hover:text-accent transition-colors">
              Home
            </Link>
            <Link href="/#hours" className="hover:text-accent transition-colors">
              Hours & Location
            </Link>
            <Link href="/bookings" className="hover:text-accent transition-colors">
              My Bookings
            </Link>
          </nav>
          <span className="tabular-nums">
            © {new Date().getFullYear()} 360°_Bladez · Addis Ababa
          </span>
        </div>
      </footer>
    );
  }

  // Full footer on homepage
  return (
    <footer className="bg-dark text-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand info */}
        <div>
          <p className="font-display text-3xl">
            360°<span className="text-accent">_</span>BLADEZ
          </p>
          <p className="mt-4 max-w-xs text-sm text-bg/60">
            The Art of the Cut. Premium grooming in the heart of Addis Ababa.
          </p>
        </div>

        {/* Navigation links */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Links</p>
          <ul className="mt-4 space-y-2.5 text-sm text-bg/70">
            <li>
              <Link href="/#top" className="hover:text-accent transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/#hours" className="hover:text-accent transition-colors">
                Hours & Location
              </Link>
            </li>
            <li>
              <Link href="/bookings" className="hover:text-accent transition-colors">
                My Bookings
              </Link>
            </li>
          </ul>
        </div>

        {/* Studio visit details */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Visit</p>
          <p className="mt-4 text-sm text-bg/70">
            Bole Road, Next to Friendship Center
            <br />
            Addis Ababa, Ethiopia
            <br />
            <span className="text-bg/50">Open Daily · 9:00 AM – 7:00 PM</span>
          </p>
        </div>

        {/* Ethiopian date & time */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Today</p>
          <p className="mt-4 text-sm text-bg/70">
            {eth}
            <br />
            <span className="text-bg/40">Ethiopian calendar · Africa/Addis_Ababa</span>
          </p>
        </div>
      </div>

      <div className="border-t border-bg/10 py-6 text-center text-xs text-bg/40">
        © {new Date().getFullYear()} 360°_Bladez. All rights reserved.
      </div>
    </footer>
  );
}
