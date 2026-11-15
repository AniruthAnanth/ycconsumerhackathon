import type { Href } from "expo-router";

import type { Slot } from "@/lib/slots";

import { proofCameraHref, verdictHref, type ProofTarget, type ProofType } from "../proofRoute";

export type TaskStatus = "open" | "verified" | "held" | "failed";

/** One roster row, as lineup.roster returns it. */
export type RosterTask = {
  taskId: string;
  slot: Slot;
  title: string;
  points: number;
  proofType: ProofType;
  place?: { name: string; lat: number; lng: number };
  status: TaskStatus;
  source: string;
  score: number | null;
  verifiedAt?: number;
  thumbUrl?: string;
  dueLabel: string;
  upNext: boolean;
};

export function findTask(rows: RosterTask[], taskId: string): RosterTask | undefined {
  return rows.find((row) => row.taskId === taskId);
}

export function toProofTarget(task: RosterTask): ProofTarget {
  return {
    taskId: task.taskId,
    title: task.title,
    points: task.points,
    proofType: task.proofType,
    place: task.place,
  };
}

/** A verified or held task has been ruled on; an open or failed one can be submitted again. */
export function canSubmitProof(status: TaskStatus): boolean {
  return status === "open" || status === "failed";
}

/** A Canvas task has nothing to photograph: the backend reads the submission itself. */
export function submitProofHref(task: RosterTask): Href {
  const target = toProofTarget(task);
  return task.proofType === "canvas" ? verdictHref(target, { mediaType: "canvas" }) : proofCameraHref(target);
}
