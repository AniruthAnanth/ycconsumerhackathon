/**
 * Live transcription in Voice Draft: the recorder is cut into short segments while the player
 * talks, each segment is transcribed on its own, and the pieces are joined back into one text.
 * Pure, so the app (live words) and convex/liveTranscribe.ts (the final text) join the same way.
 */

/** How long a segment runs before the recorder is cut and the segment transcribed. */
export const LIVE_CHUNK_MS = 1_000;

/** A minute of talk is 60 one-second segments; a few spare cover a cut that came early. */
export const MAX_LIVE_CHUNKS = 70;

/** Near the limit the recording is about to stop anyway, and a cut there only adds a gap. */
const LIMIT_MARGIN_MS = 1_000;

export function shouldCutSegment(input: {
  segmentMillis: number;
  totalMillis: number;
  limitMillis: number;
  cutting: boolean;
}): boolean {
  if (input.cutting) return false;
  if (input.totalMillis >= input.limitMillis - LIMIT_MARGIN_MS) return false;
  return input.segmentMillis >= LIVE_CHUNK_MS;
}

/** The overlap we look for: a word cut in two can come back at the end of one piece and the start of the next. */
const MAX_OVERLAP_WORDS = 3;

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Joins transcribed segments in recording order. A missing or failed piece is skipped, and words
 * repeated across a cut ("going to the / the gym") appear once.
 */
export function joinTranscripts(parts: readonly (string | null | undefined)[]): string {
  const words: string[] = [];
  for (const part of parts) {
    const next = (part ?? "").trim().split(/\s+/).filter(Boolean);
    words.push(...next.slice(overlap(words, next)));
  }
  return words.join(" ");
}

function overlap(before: readonly string[], next: readonly string[]): number {
  for (let size = Math.min(MAX_OVERLAP_WORDS, before.length, next.length); size > 0; size--) {
    const tail = before.slice(before.length - size).map(normalize);
    const head = next.slice(0, size).map(normalize);
    if (tail.every((word, i) => word !== "" && word === head[i])) return size;
  }
  return 0;
}
