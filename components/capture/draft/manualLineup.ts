import { shapeDraft } from "@/convex/lib/lineupRules";
import { SLOT_ORDER, type Slot } from "@/lib/slots";

import type { DraftTask } from "../backend";

/**
 * Nothing rates a title typed here, so every row is worth the same: the 20 points the server
 * gives a flex task typed on Roster before the model has looked at it (convex/lineup.ts).
 */
export const MANUAL_TASK_POINTS = 20;

/** Light, provable with one photo, and short enough to show whole on the one line a row has. */
const SUGGESTIONS: Record<Slot, string> = {
  body: "Walk for 20 minutes",
  mind: "Study for 30 minutes",
  recharge: "Read for 20 minutes",
  chores: "Tidy your room",
  people: "Call a friend",
  flex: "Cook dinner at home",
};

/**
 * The lineup a player starts from when they skip the voice note: one suggestion for each of the
 * five slots and one flex task, all theirs to rename.
 *
 * It goes through the server's own shaping rule (shapeDraft), the one a model's draft goes
 * through, so what the player edits is already a lineup that lineup.lock accepts.
 */
export function manualLineup(): DraftTask[] {
  return shapeDraft(
    SLOT_ORDER.map((slot) => ({ slot, title: SUGGESTIONS[slot], points: MANUAL_TASK_POINTS, proofType: "photo" as const })),
  );
}
