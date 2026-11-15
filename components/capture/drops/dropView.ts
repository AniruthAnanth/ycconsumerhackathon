import type { Id } from "@/convex/_generated/dataModel";
import type { Drop } from "@/lib/backend";

import type { ProofTarget } from "../proofRoute";
import { formatCountdown } from "./countdown";

/** What the banner shows for a drop at a given moment. */
export type DropView =
  | { type: "hidden" }
  | { type: "sealed"; dropId: Id<"drops">; slot: Drop["slot"] }
  | {
      type: "timed";
      countdown: string;
      points: number;
      gesture?: string;
      wager?: number;
      proof?: ProofTarget;
    }
  | { type: "group"; dropId: Id<"drops">; countdown: string; started: boolean; attending: number };

function proofTargetFor(drop: Drop): ProofTarget | undefined {
  if (!drop.taskId) return undefined;
  return {
    taskId: drop.taskId,
    title: drop.title,
    points: drop.points,
    proofType: drop.place ? "photo_location" : "photo",
    place: drop.place,
    gesture: drop.gesture,
  };
}

export function dropView(drop: Drop, now: number): DropView {
  if (now >= drop.closesAt) return { type: "hidden" };

  if (drop.kind === "group") {
    const started = now >= drop.opensAt;
    const attendees = drop.attendees ?? [];
    return {
      type: "group",
      dropId: drop.dropId,
      countdown: formatCountdown((started ? drop.closesAt : drop.opensAt) - now),
      started,
      attending: started ? attendees.filter((attendee) => attendee.checkedIn).length : attendees.length,
    };
  }

  if (drop.kind === "mystery" && drop.sealed) {
    return { type: "sealed", dropId: drop.dropId, slot: drop.slot };
  }

  return {
    type: "timed",
    countdown: formatCountdown(drop.closesAt - now),
    points: drop.points,
    gesture: drop.gesture,
    wager: drop.kind === "mystery" ? drop.wager : undefined,
    proof: proofTargetFor(drop),
  };
}
