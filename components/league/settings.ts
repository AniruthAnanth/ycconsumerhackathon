import type { LeagueFormat, LeagueSettings, Payout } from "@/convex/lib/schedule";

/** One pill in the settings picker. */
export type Choice<Value> = { value: Value; label: string };

export const PAYOUT_CHOICES: readonly Choice<Payout>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "season", label: "End of season" },
];

export const SEASON_WEEKS_CHOICES: readonly Choice<number>[] = [
  { value: 4, label: "4 weeks" },
  { value: 8, label: "8 weeks" },
  { value: 12, label: "12 weeks" },
];

export const FORMAT_CHOICES: readonly Choice<LeagueFormat>[] = [
  { value: "round_robin", label: "Round robin" },
  { value: "double_round_robin", label: "Double round robin" },
  { value: "bracket", label: "Bracket" },
];

const labelOf = <Value,>(choices: readonly Choice<Value>[], value: Value) =>
  choices.find((choice) => choice.value === value)?.label ?? String(value);

/** Where the season stands: "Week 5 of 8", with the season number from the second season on. */
export function seasonProgress(season: number, currentWeek: number, seasonWeeks: number): string {
  const week = "Week " + currentWeek + " of " + seasonWeeks;
  return season > 1 ? "Season " + season + " · " + week : week;
}

/** How the league runs, in a few words: "Double round robin · Weekly payout". */
export function settingsSummary(settings: Pick<LeagueSettings, "format" | "payout">): string {
  const payout = settings.payout === "season" ? "Season payout" : "Weekly payout";
  return labelOf(FORMAT_CHOICES, settings.format) + " · " + payout;
}
