"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "./db";
import {
  cancelBooking as cancelBookingRecord,
  createBooking,
  getAvailableSlots,
  type CreateBookingInput,
} from "./bookings";
import type { BusyInterval } from "./slots";

export async function fetchServices() {
  return prisma.service.findMany({ where: { active: true }, orderBy: { priceETB: "asc" } });
}

export async function fetchBarbers() {
  return prisma.barber.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function fetchSlots(serviceId: string, barberId: string, date: string) {
  return getAvailableSlots(serviceId, barberId, date);
}

export async function fetchDayBusyAppointments(date: string): Promise<BusyInterval[]> {
  try {
    return await prisma.appointment.findMany({
      where: {
        date,
        status: { in: ["pending", "confirmed"] },
      },
      select: { barberId: true, startMin: true, endMin: true },
    });
  } catch (error) {
    console.warn("fetchDayBusyAppointments fallback to empty list:", error);
    return [];
  }
}

export async function fetchDayAppointments(barberId: string, date: string): Promise<BusyInterval[]> {
  const rows = await prisma.appointment.findMany({
    where: {
      barberId,
      date,
      status: { in: ["pending", "confirmed"] },
    },
    select: { startMin: true, endMin: true },
  });
  return rows;
}

export async function submitBooking(input: CreateBookingInput) {
  const result = await createBooking(input);
  if (result.ok) revalidatePath("/bookings");
  return result;
}

export async function cancelBookingAction(id: string, phone: string) {
  const result = await cancelBookingRecord(id, phone);
  if (result.ok) revalidatePath("/bookings");
  return result;
}

export async function lookupBookings(phone: string) {
  const normalized = phone.trim();
  if (!normalized) return [];
  return prisma.appointment.findMany({
    where: { customerPhone: normalized },
    include: { service: true, barber: true },
    orderBy: [{ date: "desc" }, { startMin: "desc" }],
    take: 50,
  });
}

export type PendingBookingData = {
  id: string;
  refCode: string;
  customerName: string;
  customerPhone: string;
  date: string;
  startMin: number;
  endMin: number;
  status: string;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  amountETB: number | null;
  notes: string | null;
  barber: {
    id: string;
    name: string;
    specialty: string;
    photoUrl: string | null;
  };
  service: {
    id: string;
    name: string;
    priceETB: number;
  };
};

export async function lookupPendingBooking(
  refCodeInput: string,
  phoneInput: string
): Promise<{ ok: true; booking: PendingBookingData } | { ok: false; error: string }> {
  const cleanRef = refCodeInput.trim().toLowerCase();
  const cleanPhone = phoneInput.trim();

  if (!cleanRef || !cleanPhone) {
    return { ok: false, error: "Please enter both your Booking Reference and Phone Number." };
  }

  const normalizeDigits = (p: string) => {
    const digits = p.replace(/\D/g, "");
    if (digits.startsWith("251") && digits.length >= 12) {
      return "0" + digits.slice(3);
    }
    return digits;
  };

  const inputDigits = normalizeDigits(cleanPhone);

  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { id: { endsWith: cleanRef } },
        { id: cleanRef },
      ],
    },
    include: { service: true, barber: true },
  });

  if (appointments.length === 0) {
    return { ok: false, error: "No booking found matching that Reference Code." };
  }

  // Dual verification: verify phone matches
  const matching = appointments.find((a) => {
    const storedDigits = normalizeDigits(a.customerPhone);
    return storedDigits === inputDigits || storedDigits.endsWith(inputDigits) || inputDigits.endsWith(storedDigits);
  });

  if (!matching) {
    return { ok: false, error: "Phone number does not match this booking reference." };
  }

  // Strictly Pending Only requirement: once status is changed from pending to other statuses, data must not be fetched
  if (matching.status !== "pending") {
    return {
      ok: false,
      error: "This booking has already been processed or confirmed by the admin and is no longer pending.",
    };
  }

  return {
    ok: true,
    booking: {
      id: matching.id,
      refCode: matching.id.slice(-8).toUpperCase(),
      customerName: matching.customerName,
      customerPhone: matching.customerPhone,
      date: matching.date,
      startMin: matching.startMin,
      endMin: matching.endMin,
      status: matching.status,
      paymentMethod: matching.paymentMethod,
      paymentProofUrl: matching.paymentProofUrl,
      amountETB: matching.amountETB,
      notes: matching.notes,
      barber: {
        id: matching.barber.id,
        name: matching.barber.name,
        specialty: matching.barber.specialty,
        photoUrl: matching.barber.photoUrl,
      },
      service: {
        id: matching.service.id,
        name: matching.service.name,
        priceETB: matching.service.priceETB,
      },
    },
  };
}

// ---------- Admin ----------

const ADMIN_COOKIE = "bladez_admin";

export async function adminLogin(key: string) {
  const expected = process.env.ADMIN_KEY ?? "";
  if (!expected || key !== expected) return { ok: false as const };
  const store = await cookies();
  store.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true as const };
}

export async function adminLogout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === "1" && !!process.env.ADMIN_KEY;
}

export async function fetchAllAppointments() {
  return prisma.appointment.findMany({
    include: { service: true, barber: true },
    orderBy: [{ date: "desc" }, { startMin: "desc" }],
    take: 200,
  });
}

export async function setAppointmentStatus(id: string, status: string) {
  if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
    return { ok: false as const, error: "Invalid status." };
  }
  await prisma.appointment.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function fetchAllBarbersAdmin() {
  return prisma.barber.findMany({
    include: {
      _count: {
        select: { appointments: true },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createBarber(data: {
  name: string;
  specialty?: string;
  bio?: string;
  photoUrl?: string | null;
}) {
  const name = data.name.trim();
  if (!name) {
    return { ok: false as const, error: "Barber name is required." };
  }

  const barber = await prisma.barber.create({
    data: {
      name,
      specialty: data.specialty?.trim() || "Master Barber",
      bio: data.bio?.trim() || "",
      photoUrl: data.photoUrl?.trim() || null,
      active: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/book");
  return { ok: true as const, barber };
}

export async function updateBarber(
  id: string,
  data: {
    name?: string;
    specialty?: string;
    bio?: string;
    photoUrl?: string | null;
    active?: boolean;
  }
) {
  const existing = await prisma.barber.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, error: "Barber not found." };
  }

  const barber = await prisma.barber.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.specialty !== undefined && { specialty: data.specialty.trim() }),
      ...(data.bio !== undefined && { bio: data.bio.trim() }),
      ...(data.photoUrl !== undefined && {
        photoUrl: data.photoUrl ? data.photoUrl.trim() : null,
      }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/book");
  return { ok: true as const, barber };
}

export async function deleteBarber(id: string) {
  const barber = await prisma.barber.findUnique({
    where: { id },
    include: { _count: { select: { appointments: true } } },
  });

  if (!barber) {
    return { ok: false as const, error: "Barber not found." };
  }

  // If barber has appointments, soft-delete to preserve booking records
  if (barber._count.appointments > 0) {
    await prisma.barber.update({
      where: { id },
      data: { active: false },
    });
    revalidatePath("/admin");
    revalidatePath("/book");
    return {
      ok: true as const,
      message: `${barber.name} has existing bookings, so their status was set to Inactive to preserve history.`,
      deactivated: true,
    };
  }

  // If no appointments exist, delete safely
  await prisma.barber.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/book");
  return {
    ok: true as const,
    message: `${barber.name} was successfully removed.`,
    deleted: true,
  };
}

export async function toggleBarberActive(id: string, active: boolean) {
  await prisma.barber.update({
    where: { id },
    data: { active },
  });
  revalidatePath("/admin");
  revalidatePath("/book");
  return { ok: true as const };
}
