import type { LeagueFormat, LeagueSettings, Payout } from "@/convex/lib/schedule";

/**
 * The model behind the Create a League walkthrough: its steps, what a new league
 * starts as, and the words that explain each choice. Pure, so the screens stay
 * thin and the rules are tested without rendering.
 */

/** The four decisions, in order. Review follows them and is not a decision. */
export const STEPS = ["name", "kind", "stake", "season"] as const;
export type Step = (typeof STEPS)[number] | "review";

/** A league of friends, or a versus: one friend, one week (convex/versus.ts). */
export type LeagueKind = "league" | "versus";

export type Draft = {
  name: string;
  kind: LeagueKind;
  /** Whole dollars each player pays in; 0 is a free league. Null while a custom amount is not a valid one yet. */
  stakeUsd: number | null;
  settings: LeagueSettings;
};

/** One option on a step: what it is called, what it means, and a short example where one helps. */
export type Choice<Value> = { value: Value; label: string; explanation: string; example?: string };

/** leagues.create rejects a longer name or a larger stake; these keep the fields inside its limits. */
export const MAX_NAME_LENGTH = 40;
export const MAX_STAKE_USD = 1000;

/** The season the walkthrough recommends; the Season step offers it as one tap. */
export const RECOMMENDED_SETTINGS: LeagueSettings = { payout: "weekly", seasonWeeks: 8, format: "double_round_robin" };

/** Every step starts with an answer, so Next works from the first screen to the last. */
export function defaultDraft(playerName: string | undefined): Draft {
  const first = playerName?.trim().split(/\s+/)[0];
  const name = first ? `${first}'s League`.slice(0, MAX_NAME_LENGTH) : "My League";
  return { name, kind: "league", stakeUsd: 0, settings: RECOMMENDED_SETTINGS };
}

export function stepAfter(step: Step): Step {
  const index = STEPS.indexOf(step as (typeof STEPS)[number]);
  return index === -1 ? "review" : (STEPS[index + 1] ?? "review");
}

/** The step Back returns to, or null on the first step, where Back leaves the walkthrough. */
export function stepBefore(step: Step): Step | null {
  if (step === "review") return STEPS[STEPS.length - 1];
  const index = STEPS.indexOf(step);
  return index > 0 ? STEPS[index - 1] : null;
}

/** "Step 2 of 4" and how full the bar is. Review is past the last decision, so its bar is full. */
export function progressOf(step: Step): { label: string; ratio: number } {
  if (step === "review") return { label: "Review", ratio: 1 };
  const number = STEPS.indexOf(step) + 1;
  return { label: `Step ${number} of ${STEPS.length}`, ratio: number / STEPS.length };
}

/** Why Next is unavailable on this step, or null when the step's answer is fine. */
export function blockerOf(step: Step, draft: Draft): string | null {
  if (draft.name.trim().length === 0) return "Give your league a name";
  if (step !== "name" && draft.stakeUsd === null) return `Enter a whole number of dollars from 1 to ${MAX_STAKE_USD}`;
  return null;
}

export const KIND_CHOICES: readonly Choice<LeagueKind>[] = [
  {
    value: "league",
    label: "Private friends league",
    explanation: "You and up to 11 friends, playing every week. Only people you invite can join.",
  },
  {
    value: "versus",
    label: "1v1 versus",
    explanation: "Just you and one friend, head to head for one week.",
  },
];

/** The buy-ins offered as one tap. Any other whole-dollar amount is "Custom". */
export const STAKE_CHOICES: readonly Choice<number>[] = [
  { value: 0, label: "Free", explanation: "No money. You play for points and bragging rights." },
  { value: 5, label: "$5", explanation: "A small buy-in, so showing up matters." },
  { value: 20, label: "$20", explanation: "A bigger pot, so every task counts." },
];

export function isPresetStake(stakeUsd: number | null): boolean {
  return STAKE_CHOICES.some((choice) => choice.value === stakeUsd);
}

/** A typed custom buy-in as whole dollars, or null when it is not one leagues.create would take. */
export function parseStake(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, "");
  if (!/^\d+$/.test(trimmed)) return null;
  const dollars = Number(trimmed);
  return dollars >= 1 && dollars <= MAX_STAKE_USD ? dollars : null;
}

/** How many players the pot example imagines. */
export const EXAMPLE_PLAYERS = 6;

const usd = (dollars: number) => `$${dollars.toLocaleString("en-US")}`;

/** The live example under the stake choices: "6 players × $20 = $120 pot". */
export function potExample(stakeUsd: number | null): string {
  if (stakeUsd === null) return "Enter a buy-in to see the pot.";
  if (stakeUsd === 0) return "Free league: no pot, no payments.";
  return `${EXAMPLE_PLAYERS} players × ${usd(stakeUsd)} = ${usd(EXAMPLE_PLAYERS * stakeUsd)} pot`;
}

export const SEASON_WEEKS_CHOICES: readonly Choice<number>[] = [
  { value: 4, label: "4 weeks", explanation: "A quick season.", example: "A champion in about a month." },
  { value: 8, label: "8 weeks", explanation: "Long enough for a comeback.", example: "A champion in about two months." },
  { value: 12, label: "12 weeks", explanation: "A full season for a committed group.", example: "A champion in about three months." },
];

export const FORMAT_CHOICES: readonly Choice<LeagueFormat>[] = [
  { value: "round_robin", label: "Round robin", explanation: "You play everyone once.", example: "6 players: a new opponent each week for 5 weeks." },
  {
    value: "double_round_robin",
    label: "Double round robin",
    explanation: "You play everyone twice.",
    example: "4 players: 3 opponents, twice each, over 6 weeks.",
  },
  {
    value: "bracket",
    label: "Bracket",
    explanation: "The last weeks of the season are playoffs: win to advance.",
    example: "8 players: quarterfinals, semifinals, then the final.",
  },
];

export const PAYOUT_CHOICES: readonly Choice<Payout>[] = [
  { value: "weekly", label: "Weekly", explanation: "The pot pays out every week, to that week's winner.", example: "Win week 3, get paid after week 3." },
  {
    value: "season",
    label: "End of season",
    explanation: "The pot is held until the last week, then paid on season totals.",
    example: "The best total over the whole season takes the pot.",
  },
];

export function isRecommended(settings: LeagueSettings): boolean {
  return (
    settings.payout === RECOMMENDED_SETTINGS.payout &&
    settings.seasonWeeks === RECOMMENDED_SETTINGS.seasonWeeks &&
    settings.format === RECOMMENDED_SETTINGS.format
  );
}

const labelOf = <Value,>(choices: readonly Choice<Value>[], value: Value) =>
  choices.find((choice) => choice.value === value)?.label ?? String(value);

/** The recommended season in plain words, one line per setting, for the summary card. */
export function recommendedLines(): string[] {
  const { seasonWeeks, format, payout } = RECOMMENDED_SETTINGS;
  const explain = <Value,>(choices: readonly Choice<Value>[], value: Value) =>
    choices.find((choice) => choice.value === value)?.explanation ?? "";
  return [
    `${labelOf(SEASON_WEEKS_CHOICES, seasonWeeks)}. ${explain(SEASON_WEEKS_CHOICES, seasonWeeks)}`,
    `${labelOf(FORMAT_CHOICES, format)}. ${explain(FORMAT_CHOICES, format)}`,
    `${labelOf(PAYOUT_CHOICES, payout)} payout. ${explain(PAYOUT_CHOICES, payout)}`,
  ];
}

/** What Review lists before Create: every answer, in the order it was asked. */
export function reviewRows(draft: Draft): { label: string; value: string }[] {
  const stake = draft.stakeUsd === null ? "Not set" : draft.stakeUsd === 0 ? "Free" : `${usd(draft.stakeUsd)} buy-in`;
  return [
    { label: "Name", value: draft.name.trim() },
    { label: "Who's playing", value: labelOf(KIND_CHOICES, draft.kind) },
    { label: "Stakes", value: stake },
    { label: "Season", value: labelOf(SEASON_WEEKS_CHOICES, draft.settings.seasonWeeks) },
    { label: "Format", value: labelOf(FORMAT_CHOICES, draft.settings.format) },
    { label: "Payout", value: labelOf(PAYOUT_CHOICES, draft.settings.payout) },
  ];
}
