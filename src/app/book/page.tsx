import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { todayEat, addDays, minutesNowEat } from "@/lib/time";
import { BookingWizard } from "@/components/booking-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book an Appointment — 360_Bladez",
};

export default async function BookPage() {
  const [services, barbers] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { priceETB: "asc" } }),
    prisma.barber.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const today = todayEat();
  const nowMin = minutesNowEat();

  return (
    <section className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-24">
        <h1 className="font-display text-5xl text-ink md:text-6xl">Book a Chair</h1>
        <p className="mt-3 text-ink-soft">
          Select your date and time, choose your barber, and enter your details.
          All times are East Africa Time (Addis Ababa).
        </p>
        <div className="mt-8">
          <BookingWizard
            services={services}
            barbers={barbers}
            today={today}
            nowMin={nowMin}
            maxDate={addDays(today, 60)}
          />
        </div>
      </div>
    </section>
  );
}
