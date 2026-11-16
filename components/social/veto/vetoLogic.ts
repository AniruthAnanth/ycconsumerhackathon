import type { Id } from "@/convex/_generated/dataModel";

import type { TaskVeto } from "../contract";

/** The chip's text: a plain "Veto" until someone votes, then the running count, then Struck. */
export function chipLabel(
  veto: Pick<TaskVeto, "votes" | "needed" | "struck">,
): string {
  if (veto.struck) return "Struck";
  return veto.votes === 0 ? "Veto" : `Veto ${veto.votes}/${veto.needed}`;
}

/** Nobody has vetoed it yet: the chip stays a quiet text button so an untouched lineup reads clean. */
export function isQuiet(veto: Pick<TaskVeto, "votes" | "struck">): boolean {
  return !veto.struck && veto.votes === 0;
}

/**
 * Whether a Matchup row shows the veto chip: only where there is a vote to show. My side shows it
 * once the league has struck my task (with Swap); the opponent's side once someone has vetoed.
 * Raising the first veto is a long-press on the opponent's task, so idle rows stay clean.
 */
export function showsVeto(side: "mine" | "theirs", veto: Pick<TaskVeto, "struck" | "votes"> | undefined): boolean {
  if (veto === undefined) return false;
  return veto.struck || (side === "theirs" && veto.votes > 0);
}

export function boardByTask(
  board: TaskVeto[] | undefined,
): Map<Id<"tasks">, TaskVeto> {
  return new Map((board ?? []).map((veto) => [veto.taskId, veto]));
}

/** Other players' tasks someone has already vetoed and that are still open: the Feed's live votes. */
export function upForVeto(
  board: TaskVeto[] | undefined,
  myUserId: Id<"users"> | undefined,
  now: number,
): TaskVeto[] {
  return (board ?? []).filter(
    (veto) => veto.ownerId !== myUserId && !veto.struck && veto.closesAt > now && veto.votes > 0,
  );
}

/** My tasks the league struck, which I must swap. */
export function myStruck(
  board: TaskVeto[] | undefined,
  myUserId: Id<"users"> | undefined,
): TaskVeto[] {
  return (board ?? []).filter(
    (veto) => veto.ownerId === myUserId && veto.struck,
  );
}

export function struckBanner(title: string): string {
  return `The league struck ${title}. Swap it on Matchup.`;
}
