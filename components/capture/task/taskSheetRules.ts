import type { Href } from "expo-router";

import type { Task } from "@/lib/backend";

import { proofCameraHref, type ProofTarget } from "../proofRoute";

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

/** Every task, a Canvas one included, is proven with a timelapse (owner's call, Nov 16). */
export function submitProofHref(task: Task): Href {
  return proofCameraHref(toProofTarget(task));
}
