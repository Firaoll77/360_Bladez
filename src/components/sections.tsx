import type { Barber } from "@prisma/client";

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

export function HoursSection() {
  return (
    <section className="bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-5xl text-ink md:text-6xl">Hours & Location</h2>
            <p className="mt-4 max-w-md text-ink-soft">
              Walk-ins welcome, but booking guarantees your chair. All times are
              East Africa Time (Addis Ababa).
            </p>
          </div>
          <div className="space-y-6 text-sm">
            <div className="rounded-lg bg-bg p-8 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-ink">Monday – Sunday</p>
              <p className="mt-1 text-ink-soft">9:00 AM – 7:00 PM</p>
            </div>
            <div className="rounded-lg bg-bg p-8 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-ink">Payment</p>
              <p className="mt-1 text-ink-soft">
                Telebirr · Commercial Bank of Ethiopia · Cash
              </p>
            </div>
            <div className="rounded-lg bg-bg p-8 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-ink">Bole Road, Addis Ababa</p>
              <p className="mt-1 text-ink-soft">
                Show your booking confirmation at the front desk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
