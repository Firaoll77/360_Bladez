// Ethiopian (Ge'ez) calendar conversion.
// Epoch: JDN 1724221 = 1 Meskerem, year 1 (Amete Mihret).
// Verified anchors: EC 2000-01-01 = 12 Sep 2007; EC 2016-01-01 = 12 Sep 2023.
// Leap years (6-day Pagume) are years where year % 4 === 3.

export const ETHIOPIC_EPOCH_JDN = 1724221;

export interface EthDate {
  year: number;
  month: number; // 1..13
  day: number;
}

/** Gregorian (proleptic) date -> Julian Day Number (integer, noon convention). */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** JDN -> Gregorian date. */
export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const l = jdn + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l1 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l1 + 1)) / 1461001);
  const l2 = l1 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l2) / 2447);
  const day = l2 - Math.floor((2447 * j) / 80);
  const l3 = Math.floor(j / 11);
  const month = j + 2 - 12 * l3;
  const year = 100 * (n - 49) + i + l3;
  return { year, month, day };
}

/** Ethiopian date -> JDN. Month 13 is Pagume. */
export function ethToJdn(year: number, month: number, day: number): number {
  return (
    ETHIOPIC_EPOCH_JDN +
    365 * (year - 1) +
    Math.floor(year / 4) +
    30 * (month - 1) +
    (day - 1)
  );
}

export function isEthLeapYear(year: number): boolean {
  return year % 4 === 3;
}

export function daysInEthMonth(year: number, month: number): number {
  if (month >= 1 && month <= 12) return 30;
  return isEthLeapYear(year) ? 6 : 5;
}

/** JDN -> Ethiopian date (Amete Mihret). */
export function jdnToEth(jdn: number): EthDate {
  // Initial estimate, then correct by comparing year boundaries.
  let year = Math.floor((jdn - ETHIOPIC_EPOCH_JDN) / 365.2425) + 1;
  while (jdn < ethToJdn(year, 1, 1)) year--;
  while (jdn >= ethToJdn(year + 1, 1, 1)) year++;

  const dayOfYear = jdn - ethToJdn(year, 1, 1); // 0-based
  if (dayOfYear < 360) {
    return { year, month: Math.floor(dayOfYear / 30) + 1, day: (dayOfYear % 30) + 1 };
  }
  return { year, month: 13, day: dayOfYear - 359 };
}

export function gregorianToEth(year: number, month: number, day: number): EthDate {
  return jdnToEth(gregorianToJdn(year, month, day));
}

export function ethToGregorian(year: number, month: number, day: number) {
  return jdnToGregorian(ethToJdn(year, month, day));
}

export const ETH_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
] as const;

export const ETH_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Weekday of a JDN: 0 = Sunday. */
export function jdnWeekday(jdn: number): number {
  return (jdn + 1) % 7;
}

export function formatEthDate(date: EthDate): string {
  return `${date.day} ${ETH_MONTHS[date.month - 1]} ${date.year}`;
}
