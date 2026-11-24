"use client";

import { usePathname } from "next/navigation";
import { todayEat } from "@/lib/time";
import { gregorianToEth, formatEthDate } from "@/lib/ethiopian";

export function SiteFooter() {
  const pathname = usePathname();
  const [y, m, d] = todayEat().split("-").map(Number);
  const eth = formatEthDate(gregorianToEth(y, m, d));

  // On all internal pages, render the discreet slim 1-line footer (full marketing footer only on homepage)
  if (pathname !== "/") {
    return (
      <footer className="mt-auto border-t border-ink/10 bg-bg py-5 text-center text-xs text-ink-soft">
        <div className="mx-auto flex max-w-3xl flex-col sm:flex-row items-center justify-between gap-2 px-6">
          <span className="font-display tracking-wider text-ink text-sm">
            360<span className="text-accent">_</span>BLADEZ
          </span>
          <span className="tabular-nums">
            © {new Date().getFullYear()} 360_Bladez · Addis Ababa
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-dark text-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-3xl">
            360<span className="text-accent">_</span>BLADEZ
          </p>
          <p className="mt-4 max-w-xs text-sm text-bg/60">
            The Art of the Cut. Premium grooming in the heart of Addis Ababa.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Visit</p>
          <p className="mt-4 text-sm text-bg/70">
            Bole Road, Addis Ababa
            <br />
            Open daily · 9:00 AM – 7:00 PM (EAT)
          </p>
        </div>
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
        © {new Date().getFullYear()} 360_Bladez. All rights reserved.
      </div>
    </footer>
  );
}
