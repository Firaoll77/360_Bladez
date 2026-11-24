import type { Metadata } from "next";
import { BookingsManager } from "@/components/bookings-manager";

export const metadata: Metadata = {
  title: "My Bookings — 360_Bladez",
};

export default function BookingsPage() {
  return (
    <section className="flex-1 bg-bg">
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-24">
        <h1 className="font-display text-5xl text-ink md:text-6xl">My Bookings</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Enter your reference code and phone number to check your appointment.
        </p>
        <div className="mt-8">
          <BookingsManager />
        </div>
      </div>
    </section>
  );
}
