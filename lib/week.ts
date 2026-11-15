import { pacificDay, startOfPacificDay } from "@/convex/lib/week";

/**
 * The Monday 00:00 in Los Angeles that is `weeks` weeks away from `weekStart`,
 * itself such a Monday. Negative moves back.
 *
 * A week that spans a daylight-saving change is 167 or 169 hours long, so
 * this counts Pacific calendar days instead of adding 7 x 24 hours.
 */
export function shiftWeekStart(weekStart: number, weeks: number): number {
  return startOfPacificDay(pacificDay(weekStart) + 7 * weeks);
}
