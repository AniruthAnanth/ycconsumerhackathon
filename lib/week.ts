const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

/**
 * The Monday 00:00 in Los Angeles that is `weeks` weeks away from `weekStart`,
 * itself such a Monday. Negative moves back.
 *
 * A week that spans a daylight-saving change is 167 or 169 hours long, so
 * adding 7 x 24 hours can land on 23:00 or 01:00; this snaps back to midnight.
 */
export function shiftWeekStart(weekStart: number, weeks: number): number {
  const naive = weekStart + weeks * WEEK_MS;
  const hour = losAngelesHour(naive);
  if (hour === 23) return naive + HOUR_MS;
  if (hour === 1) return naive - HOUR_MS;
  return naive;
}

function losAngelesHour(ms: number): number {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(ms);
  // Midnight is "24" in some engines and "0" in others.
  return Number(text) % 24;
}
