/** "$20", "$36.50": cents only when there are some, so a whole-dollar buy-in reads as a round number. */
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** A league's stake under its name in the league switcher: "Free", or the buy-in and whether this player has paid it. */
export function stakeLine(league: { stakeUsd: number; paid: boolean }): string {
  if (league.stakeUsd === 0) return "Free";
  return `${formatUsd(league.stakeUsd)} buy-in | ${league.paid ? "Paid" : "Unpaid"}`;
}

/** The text a player sends to bring a friend into their league. */
export function inviteMessage(league: { name: string; inviteCode: string }): string {
  return `Join my Lineup league "${league.name}" with code ${league.inviteCode}.`;
}

/**
 * Whether the league's week has settled. The server keeps settlesAt at the
 * week's scheduled end even when the week is settled before it (the demo
 * controls do that), so payouts existing decides first and the clock second.
 */
export function isSettled(pot: { settlesAt: number; payouts?: readonly unknown[] }, now: number): boolean {
  return pot.payouts !== undefined || pot.settlesAt <= now;
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
