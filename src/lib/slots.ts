import { CLOSE_MIN, OPEN_MIN, SLOT_STEP_MIN, isBreakSlot } from "./time";

export interface BusyInterval {
  startMin: number;
  endMin: number;
}

/** Two appointments overlap iff one starts before the other ends. */
export function intervalsOverlap(a: BusyInterval, b: BusyInterval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/**
 * Generate bookable start times (minutes since midnight EAT) for a service.
 * `busy` are the barber's existing appointments for that date.
 * `nowMin` is used to hide past slots when `isToday` is true.
 * Excludes shop break (12:30 PM - 2:30 PM) by default.
 */
export function availableSlots(opts: {
  durationMin: number;
  busy: BusyInterval[];
  isToday: boolean;
  nowMin: number;
  openMin?: number;
  closeMin?: number;
  stepMin?: number;
  excludeBreak?: boolean;
}): number[] {
  const {
    durationMin,
    busy,
    isToday,
    nowMin,
    openMin = OPEN_MIN,
    closeMin = CLOSE_MIN,
    stepMin = SLOT_STEP_MIN,
    excludeBreak = true,
  } = opts;

  const slots: number[] = [];
  for (let start = openMin; start + durationMin <= closeMin; start += stepMin) {
    if (excludeBreak && isBreakSlot(start, durationMin)) continue;
    if (isToday && start <= nowMin) continue;
    const candidate = { startMin: start, endMin: start + durationMin };
    if (!busy.some((b) => intervalsOverlap(candidate, b))) {
      slots.push(start);
    }
  }
  return slots;
}
