/**
 * The profile decree's pure rules: the stats it is written from, the hash that decides when a
 * cached decree is stale, the prompt, and the footer that lists only what the text left out.
 * No database access, so the app and convex/decree.ts share one definition.
 */
import { withoutDashes } from "./dashes";

export type DecreeStats = {
  name: string;
  seasonPoints: number;
  wins: number;
  losses: number;
  streakDays: number;
  bestSlot: string | null;
  weakestSlot: string | null;
  proofsVerified: number;
  vetoesCast: number;
  vetoesSuffered: number;
  /** Dollars up or down across every league's ledger. */
  escrowUsd: number;
  leagues: number;
  /** Place in the player's first league, 1 is top; null without a league. */
  rank: number | null;
  rankOf: number | null;
};

/** Bump when the prompt changes so every cached decree is rewritten in the new voice. */
const PROMPT_VERSION = 2;

/** FNV-1a over the stats in a fixed key order: same numbers, same hash, so the cache holds. */
export function statsHash(stats: DecreeStats): string {
  const keys = Object.keys(stats).sort() as (keyof DecreeStats)[];
  const text = [`v=${PROMPT_VERSION}`, ...keys.map((key) => `${key}=${String(stats[key])}`)].join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function formatUsd(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const DECREE_INSTRUCTIONS = [
  "You are the royal herald of Lineup, a fantasy league where friends draft real life tasks.",
  "Write a short, witty, mildly medieval proclamation about one player that opens with \"Hear ye\".",
  "Keep it between 90 and 130 words. One sharp joke beats three plain ones.",
  "Use only the facts listed and quote each one exactly as written, such as \"1 day\" or \"2 leagues\". Pick the funniest few; you need not use them all.",
  "Never mention a stat that is not listed and never invent numbers.",
  "Tease gently: never mean, never crude. Plain modern words with a light medieval flavour. No dashes.",
  "Then give a one line epithet in the form \"Sir <name> the <funny title>\" (or Dame if the name reads as feminine), drawn from the facts, such as \"Sir Vee the Unvetoed\". The epithet is required.",
  "Do not repeat the epithet inside the proclamation.",
].join("\n");

export const DECREE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["proclamation", "epithet"],
  properties: {
    proclamation: { type: "string" },
    epithet: { type: "string" },
  },
} as const;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The facts as the herald reads them, already phrased and pluralized so the model quotes
 * "1 day" instead of writing "1 days". Zero or meaningless stats are left out entirely, so the
 * proclamation never narrates "0 vetoes" or "a league of 1".
 */
export function decreeFacts(stats: DecreeStats): string[] {
  const points = Math.round(stats.seasonPoints);
  const played = stats.wins + stats.losses > 0;
  const facts: (string | false)[] = [
    points !== 0 && plural(points, "season point"),
    played && `a head to head record of ${plural(stats.wins, "win")} and ${plural(stats.losses, "loss", "losses")}`,
    stats.streakDays > 0 && `a streak of ${plural(stats.streakDays, "day")}`,
    stats.bestSlot !== null && `strongest at ${stats.bestSlot} tasks`,
    stats.weakestSlot !== null && stats.weakestSlot !== stats.bestSlot && `weakest at ${stats.weakestSlot} tasks`,
    stats.proofsVerified > 0 && `${plural(stats.proofsVerified, "proof")} verified`,
    stats.vetoesCast > 0 && `${plural(stats.vetoesCast, "veto", "vetoes")} cast on rivals`,
    stats.vetoesSuffered > 0 && `${plural(stats.vetoesSuffered, "veto", "vetoes")} suffered`,
    played && stats.vetoesCast + stats.vetoesSuffered === 0 && "never vetoed and never vetoing",
    Math.abs(stats.escrowUsd) >= 0.005 && `${formatUsd(Math.abs(stats.escrowUsd))} ${stats.escrowUsd > 0 ? "up" : "down"} in escrow`,
    stats.leagues > 1 && `playing in ${plural(stats.leagues, "league")}`,
    stats.rank !== null && stats.rankOf !== null && stats.rankOf > 1 && `ranked ${ordinal(stats.rank)} of ${stats.rankOf}`,
  ];
  return facts.filter((fact): fact is string => typeof fact === "string");
}

export function decreePrompt(stats: DecreeStats): string {
  const facts = decreeFacts(stats);
  const lines = facts.length > 0 ? facts.map((fact) => `- ${fact}`) : ["- brand new, with no record yet"];
  return [`Player: ${stats.name}`, "Facts:", ...lines].join("\n");
}

/** A blank epithet from the model falls back, so the bold line under the decree is never missing. */
export function epithetOrFallback(epithet: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] || "Player";
  return epithet.trim() || `Sir ${first} the Yet Undecreed`;
}

/** Model text as stored: no dashes, single spaces, no wrapping quotes. */
export function cleanDecreeText(text: string): string {
  return withoutDashes(text)
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(/^"(.*)"$/s, "$1");
}

export type FooterStat = { label: string; value: string };

const SLOT_LABEL: Record<string, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
  flex: "Flex",
};

/**
 * The "by the numbers" footer: every stat the proclamation does not already state, so each fact
 * appears once on the screen. Zero or meaningless stats (no games, one league) count as stated:
 * there is nothing to report. A stat counts as mentioned when its number (or slot name) appears
 * in the text as a whole word.
 */
export function unmentionedStats(text: string, stats: DecreeStats): FooterStat[] {
  // Words and numbers as tokens: "$12.50" reads as "12.50", "3rd" stays "3rd", "5-3" is "5" and "3".
  const tokens = new Set(text.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? []);
  const hasWord = (word: string) => tokens.has(word.toLowerCase());
  const hasNumber = (n: number) => hasWord(String(n));
  const usd = Math.abs(stats.escrowUsd);
  const rows: { stat: FooterStat; mentioned: boolean }[] = [
    {
      stat: { label: "Season points", value: String(Math.round(stats.seasonPoints)) },
      mentioned: Math.round(stats.seasonPoints) === 0 || hasNumber(Math.round(stats.seasonPoints)),
    },
    {
      stat: { label: "Record", value: `${stats.wins}-${stats.losses}` },
      mentioned: stats.wins + stats.losses === 0 || (hasNumber(stats.wins) && hasNumber(stats.losses)),
    },
    { stat: { label: "Streak", value: `${stats.streakDays}d` }, mentioned: stats.streakDays === 0 || hasNumber(stats.streakDays) },
    {
      stat: { label: "Best slot", value: stats.bestSlot ? (SLOT_LABEL[stats.bestSlot] ?? stats.bestSlot) : "None" },
      mentioned: stats.bestSlot === null || hasWord(stats.bestSlot),
    },
    {
      stat: { label: "Weakest slot", value: stats.weakestSlot ? (SLOT_LABEL[stats.weakestSlot] ?? stats.weakestSlot) : "None" },
      mentioned: stats.weakestSlot === null || hasWord(stats.weakestSlot),
    },
    { stat: { label: "Proofs", value: String(stats.proofsVerified) }, mentioned: stats.proofsVerified === 0 || hasNumber(stats.proofsVerified) },
    {
      stat: { label: "Vetoes", value: `${stats.vetoesCast} cast, ${stats.vetoesSuffered} taken` },
      mentioned: stats.vetoesCast + stats.vetoesSuffered === 0 || (hasNumber(stats.vetoesCast) && hasNumber(stats.vetoesSuffered)),
    },
    {
      stat: { label: "Escrow", value: formatUsd(stats.escrowUsd) },
      mentioned: usd < 0.005 || hasWord(usd.toFixed(2)) || (Number.isInteger(usd) && hasNumber(usd)),
    },
    { stat: { label: "Leagues", value: String(stats.leagues) }, mentioned: stats.leagues <= 1 || hasNumber(stats.leagues) },
    {
      stat: { label: "Rank", value: stats.rank === null ? "Unranked" : `${ordinal(stats.rank)} of ${stats.rankOf}` },
      mentioned: stats.rank === null || (stats.rankOf ?? 0) <= 1 || hasWord(ordinal(stats.rank)) || hasNumber(stats.rank),
    },
  ];
  return rows.filter((row) => !row.mentioned).map((row) => row.stat);
}
