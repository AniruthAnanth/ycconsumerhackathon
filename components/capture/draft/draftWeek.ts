/**
 * The line Voice Draft shows when the lineup being drafted is not for the week on Roster.
 *
 * lineup.lock fills the week in play until that week is locked, and the next week after that.
 * Roster keeps showing the week in play, so a player who drafts ahead would lock a lineup and
 * see nothing change. Telling them before they talk is cheaper than explaining it afterwards.
 */
export function draftWeekNote(thisWeekLocked: boolean | undefined): string | null {
  // Unknown while the roster loads: say nothing rather than flash the wrong week.
  return thisWeekLocked ? "This week is locked. You're drafting next week." : null;
}
