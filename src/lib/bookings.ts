import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { addDays, isBreakSlot, isValidDateString, minutesNowEat, todayEat } from "./time";
import { availableSlots, intervalsOverlap, type BusyInterval } from "./slots";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface CreateBookingInput {
  serviceId: string;
  barberId: string;
  date: string; // YYYY-MM-DD (EAT)
  startMin: number;
  customerName: string;
  customerPhone: string;
  paymentMethod?: string;
  paymentProofUrl?: string;
  notes?: string;
}

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed"];

/** Fetch a barber's busy intervals for a given EAT date. */
export async function getBusyIntervals(barberId: string, date: string): Promise<BusyInterval[]> {
  const rows = await prisma.appointment.findMany({
    where: { barberId, date, status: { in: ACTIVE_STATUSES } },
    select: { startMin: true, endMin: true },
  });
  return rows;
}

/** Available start times for a service with a given barber on a date. */
export async function getAvailableSlots(serviceId: string, barberId: string, date: string) {
  if (!isValidDateString(date)) return [];
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) return [];

  const busy = await getBusyIntervals(barberId, date);
  const today = todayEat();
  if (date < today) return [];
  // Allow booking up to 60 days ahead.
  if (date > addDays(today, 60)) return [];

  return availableSlots({
    durationMin: service.durationMin,
    busy,
    isToday: date === today,
    nowMin: minutesNowEat(),
  });
}

/**
 * Create a booking, guarding against double-booking inside a transaction.
 * SQLite serializes writes, so the overlap check + insert is effectively atomic
 * for our concurrency needs.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  if (!name || name.length > 120) return { ok: false, error: "Please enter your name." };
  if (!/^[+\d][\d\s-]{6,19}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid phone number." };
  }
  if (!isValidDateString(input.date)) return { ok: false, error: "Invalid date." };
  if (!Number.isInteger(input.startMin) || input.startMin < 0 || input.startMin > 24 * 60) {
    return { ok: false, error: "Invalid time." };
  }

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  const barber = await prisma.barber.findUnique({ where: { id: input.barberId } });
  if (!service?.active || !barber?.active) {
    return { ok: false, error: "Selected service or barber is unavailable." };
  }

  const endMin = input.startMin + service.durationMin;
  if (endMin > 19 * 60 || input.startMin < 9 * 60) {
    return { ok: false, error: "That time is outside opening hours (9:00 AM – 7:00 PM)." };
  }
  if (isBreakSlot(input.startMin, service.durationMin)) {
    return { ok: false, error: "The shop is on break between 12:30 PM and 2:30 PM." };
  }

  const today = todayEat();
  if (input.date < today) return { ok: false, error: "Cannot book a past date." };
  if (input.date === today && input.startMin <= minutesNowEat()) {
    return { ok: false, error: "That time has already passed." };
  }
  if (input.date > addDays(today, 60)) {
    return { ok: false, error: "Bookings are only allowed up to 60 days ahead." };
  }

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const conflicts = await tx.appointment.findMany({
        where: {
          barberId: input.barberId,
          date: input.date,
          status: { in: ACTIVE_STATUSES },
        },
        select: { startMin: true, endMin: true },
      });
      const candidate = { startMin: input.startMin, endMin };
      if (conflicts.some((c) => intervalsOverlap(candidate, c))) {
        throw new Error("SLOT_TAKEN");
      }
      return tx.appointment.create({
        data: {
          customerName: name,
          customerPhone: phone,
          serviceId: service.id,
          barberId: barber.id,
          date: input.date,
          startMin: input.startMin,
          endMin,
          paymentMethod: input.paymentMethod ?? null,
          paymentProofUrl: input.paymentProofUrl ?? null,
          amountETB: service.priceETB,
          notes: input.notes?.slice(0, 500) ?? null,
        },
      });
    });
    return { ok: true, id: appointment.id };
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return { ok: false, error: "Sorry, that slot was just taken. Please pick another time." };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return { ok: false, error: "Booking failed. Please try again." };
    }
    throw err;
  }
}

export async function cancelBooking(id: string, phone: string) {
  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt || appt.customerPhone !== phone) return { ok: false as const, error: "Booking not found." };
  if (appt.status !== "pending" && appt.status !== "confirmed") {
    return { ok: false as const, error: "This booking can no longer be cancelled." };
  }
  await prisma.appointment.update({ where: { id }, data: { status: "cancelled" } });
  return { ok: true as const };
}
