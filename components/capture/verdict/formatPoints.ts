import { formatScore } from "@/lib/taskText";

/** The verdict's score on a pass, signed and written like every other score: "+30", or "+12.5" for a fraction. */
export function formatPoints(points: number): string {
  return `+${formatScore(points)}`;
}
