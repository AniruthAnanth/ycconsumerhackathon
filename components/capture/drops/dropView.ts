import type { Id } from "@/convex/_generated/dataModel";
import type { Drop } from "@/lib/backend";

import type { ProofTarget } from "../proofRoute";
import { formatClockCountdown } from "./countdown";

/** What the banner shows for a drop at a given moment. */
export type DropView =
  | { type: "hidden" }
  | {
      type: "timed";
      countdown: string;
      points: number;
      gesture?: string;
      proof?: ProofTarget;
    }
  | { type: "group"; dropId: Id<"drops">; countdown: string; started: boolean; attending: number; going: boolean };

function proofTargetFor(drop: Drop): ProofTarget | undefined {
  if (!drop.taskId) return undefined;
  return {
    taskId: drop.taskId,
    title: drop.title,
    points: drop.points,
    proofType: drop.place ? "photo_location" : "photo",
    place: drop.place,
    gesture: drop.gesture,
    slot: drop.slot,
  };
}

export function dropView(drop: Drop, now: number, meId?: Id<"users">): DropView {
  if (now >= drop.closesAt) return { type: "hidden" };

  if (drop.kind === "group") {
    // Check-in opens before the start time, and drops.active sends my taskId from that moment.
    const started = drop.taskId !== undefined || now >= drop.opensAt;
    const attendees = drop.attendees ?? [];
    return {
      type: "group",
      dropId: drop.dropId,
      countdown: formatClockCountdown((started ? drop.closesAt : drop.opensAt) - now),
      started,
      attending: started ? attendees.filter((attendee) => attendee.checkedIn).length : attendees.length,
      // Until my id loads, assume I'm in, so someone already going never sees "I'm in" flash.
      going: meId === undefined || attendees.some((attendee) => attendee.userId === meId),
    };
  }

  if (drop.kind !== "quicktime") return { type: "hidden" };

  return {
    type: "timed",
    countdown: formatClockCountdown(drop.closesAt - now),
    points: drop.points,
    gesture: drop.gesture,
    proof: proofTargetFor(drop),
  };
}
