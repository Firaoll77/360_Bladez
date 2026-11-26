"use client";

import { useState, useSyncExternalStore } from "react";
import type { Barber } from "@prisma/client";
import {
  OPEN_MIN,
  CLOSE_MIN,
  BREAK_START_MIN,
  BREAK_END_MIN,
  minutesNowEat,
  todayEat,
} from "@/lib/time";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { formatEthDate, gregorianToEth } from "@/lib/ethiopian";

function subscribeTimer(callback: () => void) {
  const timer = setInterval(callback, 30000);
  return () => clearInterval(timer);
}

function getTimeSnapshot(): string {
  return `${todayEat()}_${minutesNowEat()}`;
}

function getServerTimeSnapshot(): string {
  return `${todayEat()}_${minutesNowEat()}`;
}

export function BarbersSection({ barbers }: { barbers: Barber[] }) {
  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-display text-5xl text-ink md:text-6xl">The Barbers</h2>
        <p className="mt-4 max-w-lg text-ink-soft">
          Four chairs, four specialists. Pick your barber or let us match you.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {barbers.map((b) => (
            <article
              key={b.id}
              className="rounded-lg border border-ink/10 bg-bg-secondary p-8"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-dark font-display text-xl text-accent">
                {b.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <h3 className="font-display mt-6 text-2xl text-ink">{b.name}</h3>
              <p className="text-sm font-semibold text-accent">{b.specialty}</p>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{b.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

interface ScheduleDay {
  day: string;
  hours: string;
  closeMin: number;
}

const SCHEDULE: ScheduleDay[] = [
  { day: "Monday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Tuesday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Wednesday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Thursday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Friday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Saturday", hours: "9:00 AM – 7:00 PM", closeMin: 1140 },
  { day: "Sunday", hours: "9:00 AM – 6:00 PM", closeMin: 1080 },
];

const DAYS_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursSection() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const snapshot = useSyncExternalStore(subscribeTimer, getTimeSnapshot, getServerTimeSnapshot);
  const [datePart, minPart] = snapshot.split("_");
  const nowMin = Number(minPart || 0);

  // Ethiopian calendar date calculation
  const [y, m, d] = datePart.split("-").map(Number);
  const ethDate = formatEthDate(gregorianToEth(y, m, d));

  // Addis Ababa time calculation
  const currentDayIndex = new Date(`${datePart}T12:00:00Z`).getUTCDay();
  const currentDayName = DAYS_ORDER[currentDayIndex];
  const todayRow = SCHEDULE.find((s) => s.day === currentDayName);
  const todayCloseMin = todayRow ? todayRow.closeMin : CLOSE_MIN;

  const isMorning = nowMin >= OPEN_MIN && nowMin < BREAK_START_MIN;
  const isBreak = nowMin >= BREAK_START_MIN && nowMin < BREAK_END_MIN;
  const isAfternoon = nowMin >= BREAK_END_MIN && nowMin < todayCloseMin;
  const isOpen = isMorning || isAfternoon;

  function handleCopy(text: string, key: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  return (
    <>
      {/* JSON-LD for LocalBusiness */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BarberShop",
            name: "360 Bladez Barbershop",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Bole Road, Next to Friendship City Center, 2nd Floor, Suite 204",
              addressLocality: "Addis Ababa",
              postalCode: "1000",
              addressCountry: "Ethiopia",
            },
            telephone: "+251911360360",
            email: "contact@360bladez.com",
            hasMap: "https://www.google.com/maps/search/?api=1&query=Friendship+Business+Center+Bole+Road+Addis+Ababa",
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                opens: "09:00",
                closes: "19:00",
              },
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "Sunday",
                opens: "09:00",
                closes: "18:00",
              },
            ],
          }),
        }}
      />

      <section id="hours" className="border-t border-ink/10 bg-bg py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <div className="border-b border-ink/10 pb-10">
            <h2 className="font-display text-5xl text-ink md:text-6xl tracking-tight">
              Hours & Location
            </h2>
          </div>

          {/* Two-Column Grid */}
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2 items-stretch">
            {/* Column 1: Opening Hours Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-5">
                  <h3 className="font-display text-2xl text-ink tracking-wide">
                    Opening Hours
                  </h3>
                </div>

                {/* 7 Days List — 12hr format, Monday open, no notes */}
                <ol className="divide-y divide-dashed divide-ink/10 text-sm">
                  {SCHEDULE.map((row) => {
                    const isToday = row.day === currentDayName;
                    return (
                      <li
                        key={row.day}
                        className={`flex items-center justify-between py-3.5 first:pt-4 ${
                          isToday ? "rounded-lg px-3 -mx-3 bg-accent/10" : ""
                        }`}
                      >
                        <span className={`font-semibold ${isToday ? "text-accent" : "text-ink"}`}>
                          {row.day}
                          {isToday && (
                            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                              Today
                            </span>
                          )}
                        </span>
                        <span className={`font-medium tabular-nums ${isToday ? "text-accent" : "text-ink"}`}>
                          {row.hours}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Ethiopian Date Badge */}
              <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4 text-xs text-ink-soft">
                <span>Lunch Break: 12:30 PM – 2:30 PM</span>
                <span className="font-medium text-ink/70">ዛሬ: {ethDate}</span>
              </div>
            </div>

            {/* Column 2: Map & Contact Info */}
            <div className="flex flex-col gap-6">
              {/* Map */}
              <div className="relative min-h-[260px] sm:min-h-[280px] w-full overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[var(--shadow-card)]">
                <iframe
                  className="h-full w-full border-0 min-h-[260px] sm:min-h-[280px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=38.7800%2C8.9920%2C38.7920%2C9.0020&layer=mapnik&marker=8.997238%2C38.786512"
                  title="Map showing 360 Bladez on Bole Road"
                />
              </div>

              {/* Contact Card */}
              <div className="flex flex-1 flex-col justify-between rounded-2xl border border-ink/10 bg-white p-6 sm:p-8 shadow-[var(--shadow-card)]">
                <ul className="space-y-4">
                  {/* Address */}
                  <li className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <MapPin size={20} />
                    </span>
                    <address className="not-italic text-sm">
                      <span className="block font-semibold text-ink">360 Bladez Barbershop</span>
                      <span className="block text-ink-soft">Bole Road, Next to Friendship City Center</span>
                      <span className="block text-ink-soft">2nd Floor, Suite 204 · Addis Ababa</span>
                    </address>
                  </li>

                  {/* Phone */}
                  <li className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <Phone size={20} />
                    </span>
                    <a
                      className="text-sm font-semibold text-ink hover:text-accent transition-colors"
                      href="tel:+251911360360"
                    >
                      +251 911 360 360
                    </a>
                  </li>

                  {/* Email */}
                  <li className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <Mail size={20} />
                    </span>
                    <a
                      className="text-sm font-semibold text-ink hover:text-accent transition-colors"
                      href="mailto:contact@360bladez.com"
                    >
                      contact@360bladez.com
                    </a>
                  </li>
                </ul>

                {/* Interactive Action Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                  {/* Google Maps Directions */}
                  <a
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-3 font-display text-base uppercase tracking-wider font-semibold text-dark shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                    href="https://www.google.com/maps/search/?api=1&query=Friendship+Business+Center+Bole+Road+Addis+Ababa"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Get Directions</span>
                  </a>

                  {/* Call Studio */}
                  <a
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink/20 bg-transparent px-4 py-3 font-display text-base uppercase tracking-wider font-semibold text-ink transition-all duration-200 hover:border-ink active:scale-[0.98]"
                    href="tel:+251911360360"
                  >
                    <span>Call Studio</span>
                  </a>

                  {/* 1-Tap Copy for Taxi (Ride / Feres) */}
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        "360 Bladez Barbershop, Bole Road next to Friendship City Center, Addis Ababa",
                        "address"
                      )
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink/20 bg-bg px-4 py-3 font-display text-base uppercase tracking-wider font-semibold text-ink transition-all duration-200 hover:border-accent hover:text-accent active:scale-[0.98]"
                  >
                    {copiedKey === "address" ? (
                      <span className="text-emerald-700">Copied!</span>
                    ) : (
                      <span>Copy Taxi Note</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
