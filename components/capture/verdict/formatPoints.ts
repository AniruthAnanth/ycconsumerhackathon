/** The verdict's score on a pass: a signed one-decimal number. */
export function formatPoints(points: number): string {
  return `+${points.toFixed(1)}`;
}
