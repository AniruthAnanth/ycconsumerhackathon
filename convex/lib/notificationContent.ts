/**
 * What every Lineup notification says and where a tap on it lands.
 *
 * One event can reach a player two ways. While the app is running it raises the notification
 * itself, from the reactive queries (lib/notifications). When the app is closed the backend
 * pushes it (convex/push.ts). Both build it here, so the two copies carry the same words and
 * the same id, and a phone that receives both shows one.
 *
 * Pure: nothing from Convex or React Native is imported, so the app and the backend both load it.
 */

export type NotificationKind = "drop" | "verdict" | "rival" | "challenge" | "arrival" | "nudge" | "settlement";

/** The one category with action buttons. Check In opens the proof camera; Pass dismisses. */
export const CHECK_IN_CATEGORY = "checkin";
export const CHECK_IN_ACTION = "check_in";
export const PASS_ACTION = "pass";

export type LineupNotification = {
  /**
   * Names the real-world event, for example "drop:<dropId>". The same event always gets the
   * same id, which is how a second copy of it is recognised and dropped.
   */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** The Expo Router path a tap opens, for example "/task/<taskId>". */
  url: string;
  /** Set when the notification carries the Check In and Pass buttons. */
  category?: typeof CHECK_IN_CATEGORY;
};

/** Where each screen lives. Tabs are addressed the way app/(tabs)/_layout.tsx does. */
export const ROSTER_URL = "/";
export const FEED_URL = "/feed";
export const LEAGUE_URL = "/league";
export const LEADERBOARDS_URL = "/leaderboards";

type Place = { name: string; lat: number; lng: number };

/** What the proof camera needs to know about a task (components/capture/proofRoute.ts). */
export type ProofTarget = {
  taskId: string;
  title: string;
  points: number;
  proofType: "photo" | "photo_location" | "canvas";
  place?: Place;
  gesture?: string;
};

/**
 * The proof camera for a task, written the way parseProofTarget in
 * components/capture/proofRoute.ts reads it back. That module builds an Href object; a
 * notification can only carry a string, and the backend can't import app code, so the same
 * parameter names are spelled out here. proofRoute.test.ts-style round trips in
 * notificationContent.test.ts keep the two from drifting.
 */
export function proofUrl(target: ProofTarget): string {
  const params: [string, string][] = [
    ["title", target.title],
    ["points", String(target.points)],
    ["proofType", target.proofType],
  ];
  if (target.place) {
    params.push(["placeName", target.place.name], ["placeLat", String(target.place.lat)], ["placeLng", String(target.place.lng)]);
  }
  if (target.gesture) params.push(["gesture", target.gesture]);
  const query = params.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("&");
  return `/proof/${encodeURIComponent(target.taskId)}?${query}`;
}

const MINUTE_MS = 60 * 1000;

/** "2h", "1h 30m", "45 min": how long a drop stays open, short enough for a banner. */
export function timeLeftLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
}

function usd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * A quick-time drop opened. `task` is the player's own task for the drop; the backend pushes
 * one message to the whole league and has no single task to name, so without it the tap lands
 * on Roster, where the drop's banner has Submit.
 */
export function dropOpened(
  drop: { dropId: string; title: string; points: number; gesture?: string; closesAt: number; task?: ProofTarget },
  now: number,
): LineupNotification {
  const gesture = drop.gesture ? ` Show ${drop.gesture} in the photo.` : "";
  return {
    id: `drop:${drop.dropId}`,
    kind: "drop",
    title: `Quick-time drop: +${drop.points}`,
    body: `${drop.title}.${gesture} ${timeLeftLabel(drop.closesAt - now)} left.`,
    url: drop.task ? proofUrl(drop.task) : ROSTER_URL,
    category: CHECK_IN_CATEGORY,
  };
}

/** The referee ruled on a proof. A failed task stays open, so the body says it can be retried. */
export function verdictReached(proof: {
  taskId: string;
  title: string;
  points: number;
  pass: boolean;
  reason?: string;
}): LineupNotification {
  const reason = proof.reason ? ` ${proof.reason}` : "";
  return {
    // Pass and fail are different events on the same task: a retry after a fail must show.
    id: `verdict:${proof.taskId}:${proof.pass ? "pass" : "fail"}`,
    kind: "verdict",
    title: proof.pass ? `Verified: +${proof.points}` : "Not verified",
    body: proof.pass ? `${proof.title}.${reason}` : `${proof.title}.${reason} Retry any time this week.`,
    url: `/task/${proof.taskId}`,
  };
}

/** A league mate's proof carried them past the player. */
export function rivalPassed(pass: { leagueId: string; rivalId: string; rivalName: string; gap: number }): LineupNotification {
  return {
    id: `rival:${pass.leagueId}:${pass.rivalId}`,
    kind: "rival",
    title: `${pass.rivalName} passed you`,
    body: `You're ${pass.gap} ${pass.gap === 1 ? "point" : "points"} behind. Prove a task to take it back.`,
    url: LEADERBOARDS_URL,
  };
}

/** Someone challenged the player's proof; the points are held until the league has voted. */
export function proofChallenged(challenge: { challengeId: string; taskTitle: string; challengerName?: string }): LineupNotification {
  const who = challenge.challengerName ?? "A league mate";
  return {
    id: `challenge:${challenge.challengeId}`,
    kind: "challenge",
    title: "Your proof was challenged",
    body: `${who} challenged "${challenge.taskTitle}". Its points are held while the league votes.`,
    url: FEED_URL,
  };
}

/**
 * The phone is where a task gets done: within 100 ft of its pinned place, or at a gym for a Body
 * task with no pin, in which case the phone's own name for the spot is passed as `placeName`.
 */
export function arrivedAt(task: ProofTarget, placeName: string | undefined = task.place?.name): LineupNotification {
  return {
    id: `arrival:${task.taskId}`,
    kind: "arrival",
    title: placeName ? `You're at ${placeName}` : "You've arrived",
    body: `Check in for ${task.title}: +${task.points}.`,
    url: proofUrl(task),
    category: CHECK_IN_CATEGORY,
  };
}

/** The evening reminder. `day` is the Pacific calendar day ("2026-11-15"): one nudge a day. */
export function eveningNudge(nudge: { day: string; openTasks: number; upNext: { title: string; points: number } }): LineupNotification {
  return {
    id: `nudge:${nudge.day}`,
    kind: "nudge",
    title: nudge.openTasks === 1 ? "1 task still open" : `${nudge.openTasks} tasks still open`,
    body: `${nudge.upNext.title} is worth +${nudge.upNext.points}. Prove it tonight.`,
    url: ROSTER_URL,
  };
}

/** The pot is about to settle. `settlesAt` is in the id so each week gets its own reminder. */
export function settlingSoon(week: { leagueId: string; leagueName: string; settlesAt: number; msLeft: number }): LineupNotification {
  return {
    id: `settling:${week.leagueId}:${week.settlesAt}`,
    kind: "settlement",
    title: `${week.leagueName} settles in ${timeLeftLabel(week.msLeft)}`,
    body: "Last chance to prove what's still open.",
    url: ROSTER_URL,
  };
}

/** The week settled. `payout` is the player's own row, absent when they were not paid. */
export function weekSettled(week: {
  leagueId: string;
  leagueName: string;
  settlesAt: number;
  payout?: { kind: "refund" | "winnings"; amountUsd: number };
}): LineupNotification {
  const title =
    week.payout === undefined
      ? "The week is settled"
      : week.payout.kind === "winnings"
        ? `You won ${usd(week.payout.amountUsd)}`
        : `${usd(week.payout.amountUsd)} back to you`;
  return {
    id: `settled:${week.leagueId}:${week.settlesAt}`,
    kind: "settlement",
    title,
    body: `${week.leagueName} settled. See who got paid.`,
    url: LEAGUE_URL,
  };
}
