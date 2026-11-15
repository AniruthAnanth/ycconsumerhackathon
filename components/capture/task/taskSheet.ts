import type { Href } from "expo-router";

import type { Task } from "@/lib/backend";

import { proofCameraHref, verdictHref, type ProofTarget } from "../proofRoute";

export function findTask(rows: Task[], taskId: string): Task | undefined {
  return rows.find((row) => row.taskId === taskId);
}

export function toProofTarget(task: Task): ProofTarget {
  return {
    taskId: task.taskId,
    title: task.title,
    points: task.points,
    proofType: task.proofType,
    place: task.place,
    slot: task.slot,
  };
}

/** A verified or held task has been ruled on; an open or failed one can be submitted again. */
export function canSubmitProof(status: Task["status"]): boolean {
  return status === "open" || status === "failed";
}

/** A Canvas task has nothing to photograph: the backend reads the submission itself. */
export function submitProofHref(task: Task): Href {
  const target = toProofTarget(task);
  return task.proofType === "canvas" ? verdictHref(target, { mediaType: "canvas" }) : proofCameraHref(target);
}
