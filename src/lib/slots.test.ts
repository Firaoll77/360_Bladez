import { describe, it, expect } from "vitest";
import { availableSlots, intervalsOverlap } from "./slots";
import { formatTime, OPEN_MIN, CLOSE_MIN } from "./time";

describe("intervalsOverlap", () => {
  it("detects overlaps and adjacency correctly", () => {
    expect(intervalsOverlap({ startMin: 600, endMin: 660 }, { startMin: 630, endMin: 690 })).toBe(true);
    expect(intervalsOverlap({ startMin: 600, endMin: 660 }, { startMin: 660, endMin: 720 })).toBe(false); // back-to-back ok
    expect(intervalsOverlap({ startMin: 600, endMin: 660 }, { startMin: 540, endMin: 600 })).toBe(false);
    expect(intervalsOverlap({ startMin: 600, endMin: 660 }, { startMin: 500, endMin: 700 })).toBe(true); // containment
  });
});

describe("availableSlots", () => {
  const base = { durationMin: 30, busy: [], isToday: false, nowMin: 0 };

  it("generates slots within opening hours (excluding lunch break)", () => {
    const slots = availableSlots(base);
    expect(slots[0]).toBe(OPEN_MIN);
    expect(slots[slots.length - 1] + 30).toBe(CLOSE_MIN);
    // 20 total 30-min intervals minus 4 break slots (12:30, 1:00, 1:30, 2:00) = 16 slots
    expect(slots).toHaveLength(16);
    // last start = CLOSE - duration
    expect(slots[slots.length - 1]).toBe(CLOSE_MIN - 30);
  });

  it("excludes slots during lunch break (12:30 PM – 2:30 PM)", () => {
    const slots = availableSlots(base);
    expect(slots).toContain(12 * 60); // 12:00 PM is present (ends at 12:30 PM)
    expect(slots).not.toContain(12 * 60 + 30); // 12:30 PM
    expect(slots).not.toContain(13 * 60); // 1:00 PM
    expect(slots).not.toContain(13 * 60 + 30); // 1:30 PM
    expect(slots).not.toContain(14 * 60); // 2:00 PM
    expect(slots).toContain(14 * 60 + 30); // 2:30 PM
  });

  it("excludes slots overlapping busy intervals", () => {
    const slots = availableSlots({
      ...base,
      busy: [{ startMin: 600, endMin: 660 }], // 10:00-11:00
    });
    expect(slots).not.toContain(600);
    expect(slots).not.toContain(630);
    expect(slots).toContain(540);
    expect(slots).toContain(660);
  });

  it("hides past slots for today", () => {
    const slots = availableSlots({ ...base, isToday: true, nowMin: 10 * 60 + 15 });
    expect(slots.every((s) => s > 10 * 60 + 15)).toBe(true);
    expect(slots[0]).toBe(10 * 60 + 30);
  });

  it("respects service duration at closing time", () => {
    const slots = availableSlots({ ...base, durationMin: 90 });
    expect(slots[slots.length - 1]).toBe(CLOSE_MIN - 90);
  });

  it("formats times for display", () => {
    expect(formatTime(9 * 60)).toBe("9:00 AM");
    expect(formatTime(13 * 60 + 30)).toBe("1:30 PM");
    expect(formatTime(19 * 60 - 30)).toBe("6:30 PM");
  });
});
