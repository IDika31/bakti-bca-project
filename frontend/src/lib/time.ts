// Restaurant operates on Jakarta time (WIB = UTC+7, no daylight saving).
// Compute day-of-week and minute-of-day in Asia/Jakarta regardless of the
// visitor's device timezone, so the open/closed banner matches what the
// backend (server-side) computes.

const WEEKDAY_DOW: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface WibClock {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  minutes: number;   // minutes since 00:00 in WIB
}

export function wibClock(now: Date = new Date()): WibClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dow = WEEKDAY_DOW[get("weekday")] ?? 0;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  return { dayOfWeek: dow, minutes: hour * 60 + minute };
}
