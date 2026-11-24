// All scheduling is pinned to East Africa Time (Africa/Addis_Ababa, UTC+3).

export const EAT_TIMEZONE = "Africa/Addis_Ababa";

const eatFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EAT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current date in Addis Ababa as YYYY-MM-DD. */
export function todayEat(now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD
  return eatFormatter.format(now);
}

/** Minutes since midnight (EAT) for a Date. */
export function minutesNowEat(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EAT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Parse YYYY-MM-DD + minutes into a comparable EAT timestamp is unnecessary —
 *  bookings store EAT-local date + startMin, which is unambiguous. */

export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export const OPEN_MIN = 9 * 60; // 09:00 EAT
export const CLOSE_MIN = 19 * 60; // 19:00 EAT
export const SLOT_STEP_MIN = 30;

export const BREAK_START_MIN = 12 * 60 + 30; // 12:30 PM EAT (750)
export const BREAK_END_MIN = 14 * 60 + 30; // 2:30 PM EAT (870)

/** Returns true if an appointment or slot interval overlaps the 12:30 PM – 2:30 PM shop break. */
export function isBreakSlot(startMin: number, durationMin: number = 30): boolean {
  const endMin = startMin + durationMin;
  return startMin < BREAK_END_MIN && BREAK_START_MIN < endMin;
}

/** Human-friendly time remaining until an appointment in EAT. */
export function getTimeLeft(dateStr: string, startMin: number): string {
  const today = todayEat();
  const nowMin = minutesNowEat();

  const dNow = new Date(today + "T00:00:00Z");
  const dAppt = new Date(dateStr + "T00:00:00Z");
  const diffDays = Math.round((dAppt.getTime() - dNow.getTime()) / (1000 * 60 * 60 * 24));

  const totalDiffMin = diffDays * 1440 + (startMin - nowMin);

  if (totalDiffMin <= 0) {
    if (totalDiffMin >= -30) return "Starting right now / In progress";
    return "Appointment time has passed";
  }

  if (totalDiffMin < 60) {
    return `Starts in ${totalDiffMin} min${totalDiffMin === 1 ? "" : "s"}`;
  }

  const days = Math.floor(totalDiffMin / 1440);
  const remMinutes = totalDiffMin % 1440;
  const hours = Math.floor(remMinutes / 60);
  const minutes = remMinutes % 60;

  if (days > 0) {
    return `Starts in ${days} day${days > 1 ? "s" : ""}${hours > 0 ? `, ${hours} hr${hours > 1 ? "s" : ""}` : ""}`;
  }

  return `Starts in ${hours} hr${hours > 1 ? "s" : ""}${minutes > 0 ? ` ${minutes} min${minutes > 1 ? "s" : ""}` : ""}`;
}
