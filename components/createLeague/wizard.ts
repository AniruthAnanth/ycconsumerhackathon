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
export const RECOMMENDED_SETTINGS: LeagueSettings = { payout: "season", seasonWeeks: 8, format: "double_round_robin" };

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

/**
 * Whether leaving now would throw away answers the player gave: any field moved off what the
 * walkthrough started with. Untouched defaults cost nothing to lose, so they leave without asking.
 */
export function hasUnsavedWork(draft: Draft, start: Draft): boolean {
  return (
    draft.name !== start.name ||
    draft.kind !== start.kind ||
    draft.stakeUsd !== start.stakeUsd ||
    draft.settings.payout !== start.settings.payout ||
    draft.settings.seasonWeeks !== start.settings.seasonWeeks ||
    draft.settings.format !== start.settings.format
  );
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
  // The field caps typing, but a paste can still get past it on the web.
  if (draft.name.trim().length > MAX_NAME_LENGTH) return `Keep the name to ${MAX_NAME_LENGTH} characters`;
  // Only from the stakes step on: before it, Next is how the player gets there to fix the amount.
  const stakeAsked = step !== "name" && step !== "kind";
  if (stakeAsked && draft.stakeUsd === null) return `Enter a whole-dollar buy-in from $1 to ${usd(MAX_STAKE_USD)}`;
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

function usd(dollars: number): string {
  return `$${dollars.toLocaleString("en-US")}`;
}

/** The fourth stake choice: it opens a field for any other amount. */
export const CUSTOM_STAKE_CHOICE = { label: "Custom", explanation: `Any whole-dollar buy-in from $1 to ${usd(MAX_STAKE_USD)}.` };

/**
 * Where the money goes, in one sentence. Each week the pot splits evenly among everyone tied for the
 * most slots cleared; winnings stay in league escrow and cash out on the payout the league picked.
 */
export function potExplanation(payout: Payout): string {
  const cashout = payout === "season" ? "at the end of the season" : "after each week";
  return `Everyone pays in. Each week, whoever clears the most of their week splits the pot, held in escrow until cashout ${cashout}.`;
}

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
  { value: "weekly", label: "Weekly", explanation: "Winnings cash out after each week.", example: "Split week 3's pot, cash out after week 3." },
  {
    value: "season",
    label: "End of season",
    explanation: "Winnings stay in escrow until the last week, then cash out.",
    example: "Split three weekly pots, cash out all of it when the season ends.",
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
  const stake = draft.stakeUsd === null ? "Not set" : draft.stakeUsd === 0 ? "Free" : usd(draft.stakeUsd);
  return [
    { label: "Name", value: draft.name.trim() },
    { label: "Who's playing", value: labelOf(KIND_CHOICES, draft.kind) },
    { label: "Buy-in", value: stake },
    { label: "Season", value: labelOf(SEASON_WEEKS_CHOICES, draft.settings.seasonWeeks) },
    { label: "Format", value: labelOf(FORMAT_CHOICES, draft.settings.format) },
    { label: "Payout", value: labelOf(PAYOUT_CHOICES, draft.settings.payout) },
  ];
}
