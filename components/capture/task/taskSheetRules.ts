import type { Href } from "expo-router";

import type { Task } from "@/lib/backend";

import { proofCameraHref, verdictHref, type ProofTarget } from "../proofRoute";

export function findTask(rows: Task[], taskId: string): Task | undefined {
  return rows.find((row) => row.taskId === taskId);
}

/** Read loosely: the shared Task type gains targetMinutes with the proof-type backend (YCCO-5), and only a timelapse has one. */
function targetMinutesOf(task: Task): number | undefined {
  const value = (task as { targetMinutes?: unknown }).targetMinutes;
  return typeof value === "number" ? value : undefined;
}

export function toProofTarget(task: Task): ProofTarget {
  return {
    targetMinutes: targetMinutesOf(task),
    taskId: task.taskId,
    title: task.title,
    points: task.points,
    proofType: task.proofType,
    place: task.place,
    slot: task.slot,
  };
}

/**
 * Only an open task takes a proof. A rejected proof leaves its task open, so "failed" means a drop
 * closed unproven and the backend refuses any proof for it.
 */
export function canSubmitProof(status: Task["status"]): boolean {
  return status === "open";
}

/** A Canvas task has nothing to film: the backend reads the submission itself. Every other task opens the capture its type names. */
export function submitProofHref(task: Task): Href {
  const target = toProofTarget(task);
  return task.proofType === "canvas" ? verdictHref(target, { mediaType: "canvas" }) : proofCameraHref(target);
}
