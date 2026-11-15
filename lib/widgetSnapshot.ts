import type { Id } from "@/convex/_generated/dataModel";

import type { Standing, Task } from "./backend";

/**
 * What the home-screen widget draws: where I stand in one league this week and what to do next.
 *
 * It crosses to the widget extension as JSON and is decoded by the Swift struct of the same
 * name in targets/widget/LineupHomeWidget.swift, whose number fields are Int. So every key is
 * always present and every number is rounded: one fraction or one missing key and the widget
 * rejects the whole snapshot and shows its placeholder. Change a key and that file changes
 * with it.
 */
export type WidgetSnapshot = {
  leagueName: string;
  /** 1-based place in the league this week. */
  rank: number;
  memberCount: number;
  points: number;
  /** Of the five lineup slots, how many are verified. */
  slotsCleared: number;
  slotsTotal: number;
  /** Empty when every task is done or nothing is drafted. */
  nextTaskTitle: string;
  nextTaskPoints: number;
};

const SLOTS_TOTAL = 5;

/**
 * Builds the snapshot from the rows the League and Roster screens already read:
 * standings.table for the league and my own lineup.roster.
 *
 * Null when I have no row in the table (I am not a member of this league), because there is
 * no rank to show; the caller then leaves the widget as it is.
 */
export function widgetSnapshot({
  leagueName,
  table,
  meId,
  roster,
}: {
  leagueName: string;
  table: readonly Pick<Standing, "rank" | "userId" | "slotsCleared" | "points">[];
  meId: Id<"users">;
  roster: readonly Pick<Task, "title" | "points" | "upNext">[];
}): WidgetSnapshot | null {
  const mine = table.find((row) => row.userId === meId);
  if (!mine) {
    return null;
  }
  // The server marks the one open task to do next; no mark means nothing is open.
  const next = roster.find((task) => task.upNext);
  return {
    leagueName,
    rank: Math.round(mine.rank),
    memberCount: table.length,
    points: Math.round(mine.points),
    slotsCleared: Math.round(mine.slotsCleared),
    slotsTotal: SLOTS_TOTAL,
    nextTaskTitle: next?.title ?? "",
    nextTaskPoints: Math.round(next?.points ?? 0),
  };
}
