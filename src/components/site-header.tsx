"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/book", label: "Book" },
  { href: "/bookings", label: "My Bookings" },
];

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function getScrollSnapshot(): boolean {
  return typeof window !== "undefined" && window.scrollY > 40;
}

function getServerScrollSnapshot(): boolean {
  return false;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const scrolled = useSyncExternalStore(subscribeScroll, getScrollSnapshot, getServerScrollSnapshot);

  // Transparent only at the top of the homepage hero; dark frosted bar everywhere else
  const isHero = pathname === "/" && !scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        isHero
          ? "bg-transparent border-b border-transparent"
          : "bg-[#0e0e0e]/95 backdrop-blur-md border-b border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo3.jpg"
            alt="360_Bladez logo"
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/20"
          />
          <span className="font-display text-2xl tracking-wide text-white drop-shadow-sm">
            360<span className="text-accent">_</span>BLADEZ
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-accent" : "text-white/80 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-[6px] text-white hover:bg-white/10 transition-colors"
          >
            <span
              className={`h-0.5 w-6 bg-current transition-transform duration-200 ${
                open ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`h-0.5 w-6 bg-current transition-opacity duration-200 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`h-0.5 w-6 bg-current transition-transform duration-200 ${
                open ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="mx-4 mt-2 flex flex-col rounded-lg border border-white/15 bg-[#121212]/98 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.7)] backdrop-blur-xl md:hidden">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-4 py-3 text-base font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-accent font-semibold"
                    : "text-white/85 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
