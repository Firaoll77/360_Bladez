import { describe, it, expect } from "vitest";
import {
  gregorianToEth,
  ethToGregorian,
  ethToJdn,
  jdnToEth,
  gregorianToJdn,
  daysInEthMonth,
  isEthLeapYear,
} from "./ethiopian";

describe("Ethiopian calendar", () => {
  it("converts known Enkutatash anchors", () => {
    // EC 2000-01-01 = 12 Sep 2007
    expect(gregorianToEth(2007, 9, 12)).toEqual({ year: 2000, month: 1, day: 1 });
    // EC 2016-01-01 = 12 Sep 2023
    expect(gregorianToEth(2023, 9, 12)).toEqual({ year: 2016, month: 1, day: 1 });
    // Day before is still previous EC year
    expect(gregorianToEth(2023, 9, 11).month).toBe(13);
    expect(gregorianToEth(2023, 9, 11).year).toBe(2015);
  });

  it("round-trips EC -> GC -> EC", () => {
    const samples: [number, number, number][] = [
      [2000, 1, 1],
      [2016, 1, 1],
      [2016, 13, 5],
      [2019, 7, 22],
      [2024, 12, 30],
    ];
    for (const [y, m, d] of samples) {
      const g = ethToGregorian(y, m, d);
      expect(gregorianToEth(g.year, g.month, g.day)).toEqual({ year: y, month: m, day: d });
    }
  });

  it("round-trips GC -> EC -> GC", () => {
    for (const [y, m, d] of [
      [2024, 1, 7],
      [2024, 9, 12],
      [2025, 3, 20],
      [2026, 12, 31],
    ] as const) {
      const e = gregorianToEth(y, m, d);
      const g = ethToGregorian(e.year, e.month, e.day);
      expect([g.year, g.month, g.day]).toEqual([y, m, d]);
    }
  });

  it("has 30-day months and Pagume of 5/6", () => {
    expect(daysInEthMonth(2016, 1)).toBe(30);
    expect(daysInEthMonth(2016, 13)).toBe(5); // 2016 % 4 === 0 -> not leap
    expect(daysInEthMonth(2019, 13)).toBe(6); // 2019 % 4 === 3 -> leap
    expect(daysInEthMonth(2023, 13)).toBe(6);
    expect(isEthLeapYear(2023)).toBe(true);
    expect(isEthLeapYear(2024)).toBe(false);
  });

  it("JDN conversions are consistent", () => {
    expect(ethToJdn(1, 1, 1)).toBe(1724221);
    // Same day via Gregorian path
    const g = ethToGregorian(2016, 1, 1);
    expect(gregorianToJdn(g.year, g.month, g.day)).toBe(ethToJdn(2016, 1, 1));
    expect(jdnToEth(gregorianToJdn(g.year, g.month, g.day))).toEqual({
      year: 2016,
      month: 1,
      day: 1,
    });
  });
});
