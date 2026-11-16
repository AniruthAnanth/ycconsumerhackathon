import { formatScore } from "@/lib/taskText";
import { SLOT_NAME } from "@/lib/slots";

import type { Matchup } from "../contract";

/** Sunny, the league's capybara commissioner: the one name the agent goes by everywhere. */
export const SUNNY = { name: "Sunny", role: "Commissioner" } as const;

export type SunnyBrief = {
  /** One timely line from the live matchup. */
  line: string;
  /** Two or three questions a tap sends to Sunny's chat. */
  chips: string[];
};

type Week = { endsAt: number; status: "open" | "settled" };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const firstName = (name: string) => name.split(" ")[0] || name;

/** "2 days left", "8h left", "under an hour left": coarse on purpose, Sunny talks like a person. */
export function timeLeft(ms: number): string {
  if (ms >= 2 * DAY) return `${Math.floor(ms / DAY)} days left`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h left`;
  return "under an hour left";
}

/**
 * Sunny's opening line and chips for the current week, built only from what the app already has
 * (the matchup and the week's end), so it is instant and always matches the screens.
 * The swing slot is my open task worth the most: it is what decides the week.
 */
export function sunnyBrief(matchup: Matchup | null | undefined, week: Week | undefined, now: number): SunnyBrief | null {
  if (!matchup || !week) return null;
  const opponent = firstName(matchup.opponent.name);
  const gap = matchup.me.total - matchup.opponent.total;

  if (week.status === "settled" || week.endsAt <= now) {
    const verdict = gap > 0 ? `You beat ${opponent}` : gap < 0 ? `${opponent} took it` : `You and ${opponent} tied`;
    return {
      line: `Week's done. ${verdict}, ${formatScore(matchup.me.total)}–${formatScore(matchup.opponent.total)}.`,
      chips: ["How did my week go?", "Who's on top of the league?"],
    };
  }

  const left = timeLeft(week.endsAt - now);
  const lead =
    gap < 0
      ? `${opponent}'s ${formatScore(-gap)} up with ${left}.`
      : gap > 0
        ? `You're ${formatScore(gap)} up on ${opponent} with ${left}.`
        : `Dead even with ${opponent}, ${left}.`;

  const swing = matchup.rows
    .map((row) => row.mine)
    .filter((task) => task?.status === "open")
    .sort((a, b) => (b?.points ?? 0) - (a?.points ?? 0))[0];
  const slot = swing ? SLOT_NAME[swing.slot] : undefined;
  const swingLine = swing && slot ? ` Your ${slot} slot is the swing: ${formatScore(swing.points)} pts.` : " Every slot of yours is played.";

  // The line already names the opponent and the slot, so the chips stay short verbs instead of repeating them.
  const chips = [gap < 0 ? "How do I catch up?" : "How do I hold on?"];
  if (slot) chips.push("Swap that task");
  chips.push("Trash talk");
  return { line: lead + swingLine, chips };
}

/** Sunny's one line on a passed proof: what it earned and where that leaves my matchup. */
export function verdictLine(points: number, matchup: Matchup | null | undefined): string {
  const earned = `Clean proof. +${formatScore(points)}`;
  if (!matchup) return `${earned}.`;
  const opponent = firstName(matchup.opponent.name);
  const gap = matchup.me.total - matchup.opponent.total;
  if (gap > 0) return `${earned}, you're up ${formatScore(gap)} on ${opponent}.`;
  if (gap < 0) return `${earned}, ${opponent}'s lead is down to ${formatScore(-gap)}.`;
  return `${earned}, you're level with ${opponent}.`;
}

/** A tag Sunny may end a reply with to offer one action, rendered as a button under the reply. */
export type SunnyAction = { kind: "swap" } | { kind: "veto" } | { kind: "nudge"; name: string };

const ACTION_TAG = /\n?\[action:(swap|veto|nudge)(?::([^\]]+))?\]\s*$/;

/** Splits a reply into its text and the action its last line offers, if any. */
export function parseReply(reply: string): { text: string; action?: SunnyAction } {
  const match = ACTION_TAG.exec(reply);
  if (!match) return { text: reply };
  const text = reply.slice(0, match.index).trimEnd();
  const kind = match[1];
  if (kind === "nudge") return match[2] ? { text, action: { kind, name: match[2].trim() } } : { text };
  return { text, action: { kind: kind as "swap" | "veto" } };
}
