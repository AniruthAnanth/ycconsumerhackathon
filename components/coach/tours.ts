/**
 * The first-run tours, one per screen, each shown once per player: each step points at one element on a screen, by the id its CoachTarget
 * carries, with one short sentence. A step whose element is not on screen is skipped.
 */
export const TOURS = {
  roster: [
    {
      target: "score",
      title: "Your matchup",
      text: "Your points this week, against your opponent's.",
    },
    {
      target: "tasks",
      title: "Your week",
      text: "These are your five tasks for the week.",
    },
    {
      target: "task",
      title: "Prove it",
      text: "Tap a task to prove you did it.",
    },
    {
      target: "switcher",
      title: "Your leagues",
      text: "Tap here to switch leagues or join another.",
    },
  ],
  matchup: [
    {
      target: "winChance",
      title: "Win chance",
      text: "Your live chance of winning this week.",
    },
    {
      target: "slots",
      title: "Head to head",
      text: "Your tasks line up slot by slot against theirs.",
    },
    {
      target: "veto",
      title: "Veto",
      text: "Veto one of their tasks if it looks too easy.",
    },
  ],
  league: [
    {
      target: "pot",
      title: "The pot",
      text: "Everyone's buy-in, held in escrow.",
    },
    {
      target: "standings",
      title: "Standings",
      text: "Clear the most of your week to share the pot.",
    },
  ],
  proof: [
    // One step on the line that is always there: before camera access the shutter is not.
    {
      target: "howToProve",
      title: "What counts",
      text: "The AI checks that your proof shows this before it scores.",
    },
  ],
} as const satisfies Record<
  string,
  readonly { target: string; title: string; text: string }[]
>;

export type TourId = keyof typeof TOURS;
export type CoachTargetId = (typeof TOURS)[TourId][number]["target"];

export type Rect = { x: number; y: number; width: number; height: number };

/** A target is worth pointing at only while some of it is on screen. */
export function isOnScreen(
  target: Rect,
  screen: { width: number; height: number },
): boolean {
  return (
    target.width > 0 &&
    target.height > 0 &&
    target.y < screen.height &&
    target.y + target.height > 0
  );
}

const PAD = 8;

/**
 * The spotlight's cutout: the target plus 8 pt all round, but a row that runs edge to edge is
 * inset to the screen margins, so the light hugs the content rather than the whole width.
 */
export function spotlightFrame(
  target: Rect,
  screen: { width: number },
  margin: number,
): Rect {
  const left = Math.max(target.x, margin) - PAD;
  const right = Math.min(target.x + target.width, screen.width - margin) + PAD;
  return {
    x: left,
    y: target.y - PAD,
    width: right - left,
    height: target.height + PAD * 2,
  };
}

/** The bubble goes on whichever side of the cutout has more room, so it never covers the target. */
export function bubbleSide(
  cutout: Rect,
  screenHeight: number,
): "below" | "above" {
  return screenHeight - (cutout.y + cutout.height) >= cutout.y
    ? "below"
    : "above";
}

/** The bubble's left edge: centred on the cutout, kept inside the margins. */
export function bubbleLeft(
  cutout: Rect,
  bubbleWidth: number,
  screenWidth: number,
  margin: number,
): number {
  const centred = cutout.x + cutout.width / 2 - bubbleWidth / 2;
  return Math.min(
    Math.max(centred, margin),
    screenWidth - margin - bubbleWidth,
  );
}

/**
 * Where the bubble's arrow sits along its top or bottom edge, measured from the bubble's left: under
 * the target's centre, but never past the bubble's rounded corners.
 */
export function arrowOffset(
  target: Rect,
  bubble: { left: number; width: number },
  arrow: number,
  corner: number,
): number {
  const centre = target.x + target.width / 2 - bubble.left - arrow / 2;
  return Math.min(Math.max(centre, corner), bubble.width - corner - arrow);
}
