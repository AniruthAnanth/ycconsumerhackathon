import { PROOF_LABEL, type ProofType, type Slot } from "./slots";

/**
 * What a TaskRow needs to draw itself. It is the overlap of the backend's
 * TaskRow (a task in play) and DraftTask (a task still being edited in Voice
 * Draft), so both can be passed straight in.
 */
export type TaskRowData = {
  slot: Slot;
  title: string;
  points: number;
  proofType: ProofType;
  place?: { name: string };
  status?: "open" | "verified" | "held" | "failed";
  score?: number | null;
  verifiedAt?: number;
  thumbUrl?: string;
  dueLabel?: string;
};

/** Scores always show one decimal, like a fantasy box score; unscored shows a dash. */
export function formatScore(value: number | null | undefined): string {
  return value == null ? "--" : value.toFixed(1);
}

/** "2:14 PM" in the phone's own time zone. */
export function formatClock(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/** Line 2 of a row: how the task is proved and where it stands. */
export function taskStatusLine(task: TaskRowData): string {
  const proof = PROOF_LABEL[task.proofType];
  switch (task.status) {
    case "verified":
      return task.verifiedAt == null ? "Verified" : `Verified ${formatClock(task.verifiedAt)}`;
    case "held":
      return "Challenged | Points on hold";
    case "failed":
      // A failed proof never closes the task: it can be retried until the week ends.
      return `${proof} | Not verified, try again`;
    default:
      return task.dueLabel ? `${proof} | ${task.dueLabel}` : proof;
  }
}

/** Line 3 of a row: where the task happens, when it is pinned to a place. */
export function taskPlaceLine(task: TaskRowData): string | undefined {
  return task.place ? `@ ${task.place.name}` : undefined;
}
