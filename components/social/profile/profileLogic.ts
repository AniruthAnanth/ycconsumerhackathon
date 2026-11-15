export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatStreak(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatPoints(points: number): string {
  return `${points.toFixed(1)} pts`;
}

/** A quick-time is a stopwatch result, so seconds stay visible even past a minute. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
