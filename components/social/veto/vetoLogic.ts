import type { Id } from "@/convex/_generated/dataModel";

import type { TaskVeto } from "../contract";

/** The chip's text: the running count, or Struck once the league has struck the task. */
export function chipLabel(
  veto: Pick<TaskVeto, "votes" | "needed" | "struck">,
): string {
  return veto.struck ? "Struck" : `Veto? ${veto.votes}/${veto.needed}`;
}

export function boardByTask(
  board: TaskVeto[] | undefined,
): Map<Id<"tasks">, TaskVeto> {
  return new Map((board ?? []).map((veto) => [veto.taskId, veto]));
}

/** Other players' tasks the league can still vote on: not mine, not struck, not closed. */
export function upForVeto(
  board: TaskVeto[] | undefined,
  myUserId: Id<"users"> | undefined,
  now: number,
): TaskVeto[] {
  return (board ?? []).filter(
    (veto) => veto.ownerId !== myUserId && !veto.struck && veto.closesAt > now,
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
