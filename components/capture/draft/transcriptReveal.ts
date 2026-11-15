export const REVEAL_INTERVAL_MS = 30;

/**
 * The longest the typing may run, however long the transcript is. The tasks are already on
 * screen by then; the typing is a flourish and must never be what the player waits for.
 */
export const REVEAL_CAP_MS = 1000;

export function transcriptWords(transcript: string): string[] {
  return transcript.split(/\s+/).filter(Boolean);
}

export function revealedText(words: string[], count: number): string {
  return words.slice(0, count).join(" ");
}

/**
 * How many words are out after `elapsedMs`: one per interval, or faster when a long transcript
 * would otherwise pass the cap. Worked out from the clock, not from a count of timer ticks,
 * because a browser tab that is not in front fires its timers about once a second, and counting
 * ticks made a 58-word transcript take a minute there.
 */
export function wordsRevealed(wordCount: number, elapsedMs: number): number {
  const duration = Math.min(wordCount * REVEAL_INTERVAL_MS, REVEAL_CAP_MS);
  if (elapsedMs >= duration) return wordCount;
  return Math.max(0, Math.floor((elapsedMs / duration) * wordCount));
}
