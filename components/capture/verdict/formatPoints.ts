export const NO_POINTS = "\u2014";

/** The verdict's score: a signed one-decimal number on a pass, a dash on a fail. */
export function formatPoints(points: number, pass: boolean): string {
  return pass ? `+${points.toFixed(1)}` : NO_POINTS;
}
