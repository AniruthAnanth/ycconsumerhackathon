/**
 * The first-run tours: each step points at one element on a screen, by the id its CoachTarget
 * carries, with one short sentence. A step whose element is not on screen is skipped.
 */
export const TOURS = {
  roster: [
    { target: "score", text: "Your points this week, against your opponent's." },
    { target: "tasks", text: "These are your five tasks for the week." },
    { target: "task", text: "Tap a task to prove you did it." },
  ],
  matchup: [
    { target: "winChance", text: "Your live chance of winning this week." },
    { target: "slots", text: "Your tasks line up slot by slot against theirs." },
    { target: "veto", text: "Veto one of their tasks if it looks too easy." },
  ],
  league: [
    { target: "pot", text: "The pot: every player's buy-in for the week." },
    { target: "standings", text: "Standings: everyone's points this season." },
    { target: "odds", text: "Live odds on who wins the pot." },
  ],
  proof: [
    // One step on the line that is always there: before camera access the shutter is not.
    { target: "howToProve", text: "The AI checks that your proof shows this before it scores." },
  ],
} as const satisfies Record<string, readonly { target: string; text: string }[]>;

export type TourId = keyof typeof TOURS;
export type CoachTargetId = (typeof TOURS)[TourId][number]["target"];

export type Rect = { x: number; y: number; width: number; height: number };

/** A target is worth pointing at only while some of it is on screen. */
export function isOnScreen(target: Rect, screen: { width: number; height: number }): boolean {
  return target.width > 0 && target.height > 0 && target.y < screen.height && target.y + target.height > 0;
}

/** The bubble goes on the roomier side of its target: below one in the top half, above one in the bottom half. */
export function bubbleSide(target: Rect, screenHeight: number): "below" | "above" {
  return target.y + target.height / 2 < screenHeight / 2 ? "below" : "above";
}

/**
 * Where the bubble's arrow sits along its top or bottom edge, measured from the bubble's left: under
 * the target's centre, but never past the bubble's rounded corners.
 */
export function arrowOffset(target: Rect, bubble: { left: number; width: number }, arrow: number, corner: number): number {
  const centre = target.x + target.width / 2 - bubble.left - arrow / 2;
  return Math.min(Math.max(centre, corner), bubble.width - corner - arrow);
}
