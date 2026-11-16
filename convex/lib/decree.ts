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

/** FNV-1a over the stats in a fixed key order: same numbers, same hash, so the cache holds. */
export function statsHash(stats: DecreeStats): string {
  const keys = Object.keys(stats).sort() as (keyof DecreeStats)[];
  const text = keys.map((key) => `${key}=${String(stats[key])}`).join("|");
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
  "Write a funny, mildly medieval proclamation about one player that opens with \"Hear ye\".",
  "It must be 120 to 180 words and weave in every stat you are given, using the exact numbers.",
  "Tease gently: never mean, never crude. Use plain modern words with a light medieval flavour.",
  "Then give a one line epithet in the form \"Sir <name> the <funny title>\" (or Dame if the name reads as feminine), drawn from the stats, such as \"Sir Aniruth the Unwashed Laundry\".",
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

/** The stats as the herald reads them. */
export function decreePrompt(stats: DecreeStats): string {
  return [
    `Player: ${stats.name}`,
    `Season points: ${Math.round(stats.seasonPoints)}`,
    `Head to head record: ${stats.wins} wins, ${stats.losses} losses`,
    `Current streak: ${stats.streakDays} days`,
    `Best slot: ${stats.bestSlot ?? "none yet"}`,
    `Weakest slot: ${stats.weakestSlot ?? "none yet"}`,
    `Proofs verified: ${stats.proofsVerified}`,
    `Vetoes cast on others: ${stats.vetoesCast}`,
    `Vetoes suffered: ${stats.vetoesSuffered}`,
    `Escrow balance: ${formatUsd(stats.escrowUsd)}`,
    `Leagues: ${stats.leagues}`,
    `Rank: ${stats.rank === null ? "unranked" : `${ordinal(stats.rank)} of ${stats.rankOf}`}`,
  ].join("\n");
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
 * appears once on the screen. A stat counts as mentioned when its number (or slot name) appears
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
      mentioned: hasNumber(Math.round(stats.seasonPoints)),
    },
    {
      stat: { label: "Record", value: `${stats.wins}-${stats.losses}` },
      mentioned: hasNumber(stats.wins) && hasNumber(stats.losses),
    },
    { stat: { label: "Streak", value: `${stats.streakDays}d` }, mentioned: hasNumber(stats.streakDays) },
    {
      stat: { label: "Best slot", value: stats.bestSlot ? (SLOT_LABEL[stats.bestSlot] ?? stats.bestSlot) : "None" },
      mentioned: stats.bestSlot === null || hasWord(stats.bestSlot),
    },
    {
      stat: { label: "Weakest slot", value: stats.weakestSlot ? (SLOT_LABEL[stats.weakestSlot] ?? stats.weakestSlot) : "None" },
      mentioned: stats.weakestSlot === null || hasWord(stats.weakestSlot),
    },
    { stat: { label: "Proofs", value: String(stats.proofsVerified) }, mentioned: hasNumber(stats.proofsVerified) },
    {
      stat: { label: "Vetoes", value: `${stats.vetoesCast} cast, ${stats.vetoesSuffered} taken` },
      mentioned: hasNumber(stats.vetoesCast) && hasNumber(stats.vetoesSuffered),
    },
    {
      stat: { label: "Escrow", value: formatUsd(stats.escrowUsd) },
      mentioned: hasWord(usd.toFixed(2)) || (Number.isInteger(usd) && hasNumber(usd)),
    },
    { stat: { label: "Leagues", value: String(stats.leagues) }, mentioned: hasNumber(stats.leagues) },
    {
      stat: { label: "Rank", value: stats.rank === null ? "Unranked" : `${ordinal(stats.rank)} of ${stats.rankOf}` },
      mentioned: stats.rank === null ? hasWord("unranked") : hasWord(ordinal(stats.rank)) || hasNumber(stats.rank),
    },
  ];
  return rows.filter((row) => !row.mentioned).map((row) => row.stat);
}
