import type { Metadata } from "next";
import type { Barber, Service } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todayEat, addDays, minutesNowEat } from "@/lib/time";
import { BookingWizard } from "@/components/booking-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book an Appointment — 360_Bladez",
};

const DEFAULT_SERVICES: Service[] = [
  {
    id: "svc-standard-appointment",
    name: "Standard Appointment",
    description: "Full haircut, grooming, and style consultation with your barber.",
    durationMin: 30,
    priceETB: 800,
    active: true,
  },
];

const DEFAULT_BARBERS: Barber[] = [
  {
    id: "barber-kaleb-t",
    name: "Kaleb T.",
    specialty: "Fades & Design",
    bio: "Award-winning fade specialist with 8 years behind the chair.",
    photoUrl: "/barbers/kaleb.jpg",
    active: true,
  },
  {
    id: "barber-yonatan-b",
    name: "Yonatan B.",
    specialty: "Classic Cuts",
    bio: "Traditional barbering with a modern edge.",
    photoUrl: "/barbers/yonatan.jpg",
    active: true,
  },
  {
    id: "barber-dawit-m",
    name: "Dawit M.",
    specialty: "Beard & Shave",
    bio: "Hot-towel shaves and beard artistry.",
    photoUrl: "/barbers/dawit.jpg",
    active: true,
  },
  {
    id: "barber-samuel-a",
    name: "Samuel A.",
    specialty: "Kids & Family",
    bio: "Gentle hands, patient spirit — great with kids.",
    photoUrl: "/barbers/samuel.jpg",
    active: true,
  },
];

export default async function BookPage() {
  let services: Service[] = DEFAULT_SERVICES;
  let barbers: Barber[] = DEFAULT_BARBERS;

  try {
    const [dbServices, dbBarbers] = await Promise.all([
      prisma.service.findMany({ where: { active: true }, orderBy: { priceETB: "asc" } }),
      prisma.barber.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    ]);
    if (dbServices.length > 0) services = dbServices;
    if (dbBarbers.length > 0) barbers = dbBarbers;
  } catch (error) {
    console.warn("Database connection unavailable, falling back to default services/barbers:", error);
  }

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
