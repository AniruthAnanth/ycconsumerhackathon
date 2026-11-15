export const NO_POINTS = "\u2014";

/** The verdict's score: a signed one-decimal number on a pass, a dash on a fail. */
export function formatPoints(points: number, pass: boolean): string {
  return pass ? `+${points.toFixed(1)}` : NO_POINTS;
}

/** The value shown at a point of the count-up, so the digits settle on the final score. */
export function countedPoints(target: number, progress: number): number {
  return target * Math.min(Math.max(progress, 0), 1);
}
