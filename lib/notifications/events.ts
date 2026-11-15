/**
 * Which notification a change in the app's reactive queries is worth.
 *
 * While the app is running, every change reaches it through the queries its screens already
 * subscribe to, so it can tell the player itself instead of waiting for a push. This module is
 * the deciding half of that: it compares what the queries said a moment ago with what they say
 * now and names the events in between, and it says which reminders should be waiting to fire.
 * components/notifications feeds it snapshots and hands what it returns to the phone.
 *
 * Every notification is built by convex/lib/notificationContent.ts, the builders the backend
 * pushes with, so an event that reaches a phone both ways carries one id and shows once.
 *
 * Pure: no React, no Expo, and no clock of its own. The caller passes `now`, so each rule is
 * tested at a pinned moment.
 */
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";
import {
  type LineupNotification,
  dropOpened,
  eveningNudge,
  proofChallenged,
  rivalPassed,
  settlingSoon,
  verdictReached,
  weekSettled,
} from "@/convex/lib/notificationContent";
import type { Drop, Pot, Roster, Standing } from "@/lib/backend";

/**
 * What the app knows at one moment: the results of the queries it already subscribes to.
 * A field is undefined while its query loads.
 */
export type Snapshot = {
  /** The player this device plays as: users.me()._id, which follows Switch Player. */
  userId: string;
  leagueId: string;
  leagueName: string;
  /** drops.active({ leagueId }) */
  drops: Drop[] | undefined;
  /** lineup.roster({ leagueId }) */
  roster: Roster | undefined;
  /** standings.table({ leagueId }) */
  standings: Standing[] | undefined;
  /** feed.list({ leagueId }) */
  feed: FunctionReturnType<typeof api.feed.list> | undefined;
  /** standings.pot({ leagueId }) */
  pot: Pot | undefined;
};

// ─── What just happened ──────────────────────────────────────────────────────────────────────

/**
 * The notifications to raise now because of what changed from `before` to `after`.
 *
 * Only a change is news. The first snapshot of a player in a league is where the app starts
 * watching, and so is a query's first result: whatever they hold happened while the app was not
 * looking, and the backend's push already said so. Without this rule, opening the app or
 * switching league would announce every open drop and challenge again.
 */
export function eventsBetween(before: Snapshot | null, after: Snapshot, now: number): LineupNotification[] {
  if (before === null || before.userId !== after.userId || before.leagueId !== after.leagueId) return [];
  return [
    ...dropsOpened(before, after, now),
    ...proofsVerified(before, after),
    ...rivalsWhoPassed(before, after),
    ...proofsChallenged(before, after),
    ...weekJustSettled(before, after),
  ];
}

/**
 * Quick-time drops that were not on the list a moment ago. drops.active lists one only while the
 * player's own task for it is open, so a drop that appears is one they can still win. The other
 * kinds of drop have no notification.
 */
function dropsOpened(before: Snapshot, after: Snapshot, now: number): LineupNotification[] {
  if (before.drops === undefined || after.drops === undefined) return [];
  const alreadyListed = new Set<string>(before.drops.map((drop) => drop.dropId));
  return after.drops
    .filter((drop) => drop.kind === "quicktime" && !alreadyListed.has(drop.dropId) && drop.closesAt > now)
    .map(({ dropId, title, points, gesture, closesAt, taskId }) =>
      dropOpened(
        {
          dropId,
          title,
          points,
          gesture,
          closesAt,
          // With the player's task in hand the tap opens the proof camera, not just Roster.
          task: taskId === undefined ? undefined : { taskId, title, points, proofType: "photo", gesture },
        },
        now,
      ),
    );
}

/**
 * Tasks the referee passed since the last snapshot. Only a pass can be seen here: a failed proof
 * leaves its task open (DECISIONS.md), so the roster reads the same before and after, and it is
 * the backend's push that reports a fail.
 */
function proofsVerified(before: Snapshot, after: Snapshot): LineupNotification[] {
  if (before.roster === undefined || after.roster === undefined) return [];
  // Another week is another lineup (the Monday rollover), not a set of verdicts.
  if (before.roster.weekStart !== after.roster.weekStart) return [];
  const wasOpen = new Set<string>(before.roster.rows.filter((row) => row.status === "open").map((row) => row.taskId));
  return after.roster.rows
    .filter((row) => row.status === "verified" && wasOpen.has(row.taskId))
    .map((row) =>
      // score is what the proof earned; points is only what the task was drafted at.
      verdictReached({ taskId: row.taskId, title: row.title, points: row.score ?? row.points, pass: true }),
    );
}

/**
 * League mates who went past the player: level with them or behind before, ahead now. A rival who
 * was already ahead has passed nobody by pulling further away, and catching up to a tie is not a
 * pass until the tie is broken.
 */
function rivalsWhoPassed(before: Snapshot, after: Snapshot): LineupNotification[] {
  if (before.standings === undefined || after.standings === undefined) return [];
  const mineBefore = before.standings.find((row) => row.userId === after.userId);
  const mineNow = after.standings.find((row) => row.userId === after.userId);
  if (mineBefore === undefined || mineNow === undefined) return [];
  const pointsBefore = new Map<string, number>(before.standings.map((row) => [row.userId, row.points]));
  return after.standings
    .filter((rival) => {
      // A rival with no row before has just joined; they were never behind to pass from.
      const theirsBefore = pointsBefore.get(rival.userId);
      return theirsBefore !== undefined && theirsBefore <= mineBefore.points && rival.points > mineNow.points;
    })
    .map((rival) =>
      rivalPassed({
        leagueId: after.leagueId,
        rivalId: rival.userId,
        rivalName: rival.name,
        gap: rival.points - mineNow.points,
      }),
    );
}

/**
 * Challenges opened against the player's own proofs. One that was already open a moment ago has
 * been announced, and one the league has finished voting on is no longer a call to action.
 */
function proofsChallenged(before: Snapshot, after: Snapshot): LineupNotification[] {
  if (before.feed === undefined || after.feed === undefined) return [];
  const alreadyOpen = new Set<string>(
    before.feed.flatMap(({ challenge }) => (challenge?.status === "open" ? [challenge.challengeId] : [])),
  );
  return after.feed.flatMap(({ user, taskTitle, challenge }) =>
    user._id === after.userId && challenge?.status === "open" && !alreadyOpen.has(challenge.challengeId)
      ? [proofChallenged({ challengeId: challenge.challengeId, taskTitle })]
      : [],
  );
}

/** The pot's payouts appear the moment the week settles, and stay; only their arrival is the event. */
function weekJustSettled(before: Snapshot, after: Snapshot): LineupNotification[] {
  if (before.pot === undefined || after.pot === undefined) return [];
  if (before.pot.payouts !== undefined || after.pot.payouts === undefined) return [];
  const mine = after.pot.payouts.filter((payout) => payout.userId === after.userId);
  return [
    weekSettled({
      leagueId: after.leagueId,
      leagueName: after.leagueName,
      settlesAt: after.pot.settlesAt,
      // A finisher gets their stake back and a share of the forfeited stakes: two rows. The share is the news.
      payout: mine.find((payout) => payout.kind === "winnings") ?? mine[0],
    }),
  ];
}

// ─── What to remind the player of later ──────────────────────────────────────────────────────

export type ScheduledNotification = LineupNotification & {
  /** Epoch milliseconds, always after the `now` it was computed at. */
  fireAt: number;
};

/** 7:00 PM on the phone's own clock: the player's evening, wherever they are. */
const NUDGE_HOUR = 19;
/** Long enough before the week ends to still get a proof in. */
const SETTLING_SOON_MS = 3 * 60 * 60 * 1000;

/**
 * The local reminders that should be pending right now. The host schedules these and cancels any
 * pending reminder that is not in the list, so a reminder withdraws itself the moment it stops
 * being true: the last open task is proven, or the week settles.
 */
export function scheduledFor(snapshot: Snapshot, now: number): ScheduledNotification[] {
  const { roster, pot, leagueId, leagueName } = snapshot;
  if (roster === undefined) return [];
  // Both reminders ask for what is still open, so without an open task there is nothing to say.
  const open = roster.rows.filter((row) => row.status === "open");
  if (open.length === 0) return [];

  const reminders: ScheduledNotification[] = [];

  const evening = nextEvening(now);
  // An evening on or past the settlement belongs to a week this lineup is not playing in.
  if (roster.locked && (pot === undefined || evening.getTime() < pot.settlesAt)) {
    // Roster's own Up Next when it is among the open tasks, else the one that pays the most.
    const upNext = open.find((row) => row.upNext) ?? open.reduce((best, row) => (row.points > best.points ? row : best));
    reminders.push({
      ...eveningNudge({ day: localDay(evening), openTasks: open.length, upNext }),
      fireAt: evening.getTime(),
    });
  }

  if (pot !== undefined && pot.payouts === undefined && pot.settlesAt - SETTLING_SOON_MS > now) {
    reminders.push({
      ...settlingSoon({ leagueId, leagueName, settlesAt: pot.settlesAt, msLeft: SETTLING_SOON_MS }),
      fireAt: pot.settlesAt - SETTLING_SOON_MS,
    });
  }

  return reminders;
}

/**
 * Whether scheduledFor can give its whole answer for this snapshot. While the roster loads it
 * returns nothing, and while the pot loads it leaves the settlement reminder out; neither means
 * a reminder has stopped being true. The host cancels whatever is pending and not in the list,
 * so it waits for this before it reconciles. Otherwise every launch would cancel the reminders
 * and schedule them again a moment later, and closing the app in between would lose them.
 */
export function readyToSchedule(snapshot: Snapshot): boolean {
  return snapshot.roster !== undefined && snapshot.pot !== undefined;
}

/** The next 7:00 PM strictly after `now`: today's, or tomorrow's once today's has come. */
function nextEvening(now: number): Date {
  const evening = new Date(now);
  evening.setHours(NUDGE_HOUR, 0, 0, 0);
  // A calendar day, not 24 hours: the day the clocks change is 23 or 25 hours long.
  if (evening.getTime() <= now) evening.setDate(evening.getDate() + 1);
  return evening;
}

/** "2026-11-15": the day on the phone's calendar, which is what makes it one nudge a day. */
function localDay(date: Date): string {
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}
