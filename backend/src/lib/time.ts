// Restaurant operates on Central Indonesia time (WITA = UTC+8, no daylight saving).
// Vercel serverless runs in UTC, so naive new Date().getHours()/getDay() would
// compare UTC clock against WITA opening hours and reject valid orders.
// This helper returns the day-of-week and minute-of-day in Asia/Makassar.

const WEEKDAY_DOW: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface WitaClock {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  minutes: number;   // minutes since 00:00 in WITA
}

export function witaClock(now: Date = new Date()): WitaClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dow = WEEKDAY_DOW[get("weekday")] ?? 0;
  let hour = Number(get("hour"));
  // Some engines render midnight as "24"; normalise to 0.
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  return { dayOfWeek: dow, minutes: hour * 60 + minute };
}

