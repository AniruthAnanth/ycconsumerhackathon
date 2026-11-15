export const REVEAL_INTERVAL_MS = 30;

export function transcriptWords(transcript: string): string[] {
  return transcript.split(/\s+/).filter(Boolean);
}

export function revealedText(words: string[], count: number): string {
  return words.slice(0, count).join(" ");
}
