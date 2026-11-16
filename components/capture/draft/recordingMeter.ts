export const MAX_RECORDING_MS = 60_000;

/** expo-audio meters in decibels from about -160 (silence) to 0 (clipping); speech sits between -50 and -10. */
const QUIET_DB = -50;
const LOUD_DB = -10;

export function meterLevel(decibels: number | undefined): number {
  if (decibels === undefined) return 0;
  const level = (decibels - QUIET_DB) / (LOUD_DB - QUIET_DB);
  return Math.min(1, Math.max(0, level));
}

/** The newest level at the end of a fixed-length history, for the live waveform's bars. */
export function pushLevel(history: readonly number[], level: number, length: number): number[] {
  return [...history, level].slice(-length);
}

export function formatElapsed(durationMillis: number): string {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

export function hasReachedLimit(durationMillis: number): boolean {
  return durationMillis >= MAX_RECORDING_MS;
}
