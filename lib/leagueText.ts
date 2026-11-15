/** "$20", "$36.50": cents only when there are some, so a whole-dollar buy-in reads as a round number. */
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Time until the league settles: "2d 4h", "3h 12m", "12m". Shows only the two
 * largest units, since the screen re-renders once a minute and finer detail
 * would be stale at once.
 */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Settled";
  const days = Math.floor(msRemaining / DAY_MS);
  const hours = Math.floor((msRemaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((msRemaining % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  // Under a minute left still reads as "1m" rather than a misleading "0m".
  return `${Math.max(1, minutes)}m`;
}
