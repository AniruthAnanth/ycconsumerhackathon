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
 * Whether a Matchup row shows the veto control. My own tasks can't be vetoed by me, so my side
 * shows it only once the league has struck one (with the Swap button); the opponent's side always.
 */
export function showsVeto(side: "mine" | "theirs", veto: Pick<TaskVeto, "struck"> | undefined): boolean {
  if (veto === undefined) return false;
  return side === "theirs" || veto.struck;
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
