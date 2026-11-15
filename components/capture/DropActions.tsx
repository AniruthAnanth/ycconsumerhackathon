import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  /** One element of drops.active({ leagueId }). */
  drop: { dropId: Id<"drops">; kind: "quicktime" | "mystery" | "group" };
  leagueId: Id<"leagues">;
};

/**
 * The controls inside Roster's live drop banner: Submit for a quick-time drop,
 * Open, Pass and the wager stepper for a sealed mystery task.
 *
 * Placeholder so Roster compiles; the capture thread (YCCO-11) owns this file.
 */
export function DropActions(_props: Props) {
  return null;
}
