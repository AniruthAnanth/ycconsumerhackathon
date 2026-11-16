import { PROOF_LABEL, SLOT_NAME, type ProofType, type Slot } from "./slots";

/**
 * What a TaskRow needs to draw itself. It is the overlap of the backend's
 * TaskRow (a task in play) and DraftTask (a task still being edited in Voice
 * Draft), so both can be passed straight in.
 */
export type TaskRowData = {
  /** Absent on a draft task, which has no row yet. */
  taskId?: string;
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
  /** A timelapse's target length, which the status line names. */
  targetMinutes?: number;
};

/** Scores always show one decimal, like a fantasy box score; unscored shows a dash. */
export function formatScore(value: number | null | undefined): string {
  if (value == null) return "--";
  // A whole number reads as a score ("40"), a fraction keeps one decimal ("12.5").
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
  const proof =
    task.proofType === "timelapse" && task.targetMinutes !== undefined
      ? `${PROOF_LABEL.timelapse} · ${task.targetMinutes} min`
      : (PROOF_LABEL[task.proofType] as string | undefined);
  switch (task.status) {
    case "verified":
      return task.verifiedAt == null ? "Verified" : `Verified ${formatClock(task.verifiedAt)}`;
    case "held":
      // A league vote is reviewing the proof: the row stays as it was, only the label says so.
      return "Reviewing · Points on hold";
    case "failed":
      // A rejected proof leaves a task open. Only a drop that closed with no
      // proof writes "failed", and that task can no longer be played.
      return "Missed";
    default:
      // A proof type the app has no label for (or none) is left out, never read as "undefined".
      return [proof, task.dueLabel].filter(Boolean).join(" · ");
  }
}

/**
 * The line under a task title in a list. An open task shows only how it is proved: the due day is
 * the same for the whole week, so the list says it once instead of on every row.
 */
export function taskRowLine(task: TaskRowData): string {
  if (task.status === "verified" || task.status === "held" || task.status === "failed") return taskStatusLine(task);
  return taskStatusLine({ ...task, dueLabel: undefined });
}

/** Line 3 of a row: where the task happens, when it is pinned to a place. */
export function taskPlaceLine(task: TaskRowData): string | undefined {
  return task.place ? `@ ${task.place.name}` : undefined;
}

/**
 * What a screen reader says for a row that is a button. A button's label
 * replaces the text inside it, so this carries everything the row shows.
 */
export function taskRowLabel(task: TaskRowData, upNext = false): string {
  const points = task.score == null ? `${task.points} points on offer` : `${formatScore(task.score)} points`;
  return [
    task.title,
    upNext ? "Up next" : SLOT_NAME[task.slot],
    // The struck-through title says it on screen; the label says it in words.
    task.status === "verified" ? "done" : undefined,
    taskStatusLine(task).replaceAll(" · ", ", "),
    task.place ? `at ${task.place.name}` : undefined,
    points,
  ]
    .filter(Boolean)
    .join(", ");
}
