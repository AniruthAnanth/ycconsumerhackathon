import { describe, expect, it, vi } from "vitest";

import {
  CHECK_IN_CATEGORY,
  FEED_URL,
  LEADERBOARDS_URL,
  LEAGUE_URL,
  type LineupNotification,
  type ProofTarget,
  ROSTER_URL,
  arrivedAt,
  dropOpened,
  eveningNudge,
  proofChallenged,
  proofUrl,
  rivalPassed,
  settlingSoon,
  timeLeftLabel,
  verdictReached,
  weekSettled,
} from "./notificationContent";

/**
 * The app's reader of proof URLs, components/capture/proofRoute.ts. convex/ is typechecked on its
 * own, without the app's "@/" alias or React Native's types, so the module is loaded at run time
 * (vitest has the alias) and typed here by the one function the round trip needs.
 */
type ProofRoute = { parseProofTarget: (params: Record<string, string>) => ProofTarget };
const { parseProofTarget } = await vi.importActual<ProofRoute>("@/components/capture/proofRoute");

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const NOW = Date.UTC(2026, 10, 15, 21);

const pushUps: ProofTarget = { taskId: "task1", title: "20 push-ups", points: 40, proofType: "photo", gesture: "three fingers up" };
const gym = {
  taskId: "task2",
  title: "Gym session",
  points: 30,
  proofType: "photo_location",
  place: { name: "Fitness SF", lat: 37.7609, lng: -122.3884 },
} satisfies ProofTarget;
const quickTime = { dropId: "drop1", title: "20 push-ups", points: 40, gesture: "three fingers up", closesAt: NOW + 2 * HOUR_MS };
const week = { leagueId: "league1", leagueName: "Tahoe House", settlesAt: 1794815999000 };

describe("ids and deep links", () => {
  it.each<[string, LineupNotification, Pick<LineupNotification, "id" | "url" | "category">]>([
    [
      "a drop the player has a task for opens the proof camera",
      dropOpened({ ...quickTime, task: pushUps }, NOW),
      { id: "drop:drop1", url: proofUrl(pushUps), category: CHECK_IN_CATEGORY },
    ],
    [
      "a drop pushed to the whole league opens Roster",
      dropOpened(quickTime, NOW),
      { id: "drop:drop1", url: ROSTER_URL, category: CHECK_IN_CATEGORY },
    ],
    [
      "a passed proof opens its task",
      verdictReached({ taskId: "task1", title: "20 push-ups", points: 40, pass: true }),
      { id: "verdict:task1:pass", url: "/task/task1" },
    ],
    [
      "a failed proof is a different event on the same task",
      verdictReached({ taskId: "task1", title: "20 push-ups", points: 40, pass: false }),
      { id: "verdict:task1:fail", url: "/task/task1" },
    ],
    [
      "a rival going past opens the leaderboards",
      rivalPassed({ leagueId: "league1", rivalId: "maya", rivalName: "Maya", gap: 15 }),
      { id: "rival:league1:maya", url: LEADERBOARDS_URL },
    ],
    [
      "a challenge opens the feed",
      proofChallenged({ challengeId: "challenge1", taskTitle: "Gym session" }),
      { id: "challenge:challenge1", url: FEED_URL },
    ],
    ["an arrival opens the proof camera", arrivedAt(gym), { id: "arrival:task2", url: proofUrl(gym), category: CHECK_IN_CATEGORY }],
    [
      "the evening nudge is one a day and opens Roster",
      eveningNudge({ day: "2026-11-15", openTasks: 2, upNext: gym }),
      { id: "nudge:2026-11-15", url: ROSTER_URL },
    ],
    [
      "settling soon is one a week and opens Roster",
      settlingSoon({ ...week, msLeft: 3 * HOUR_MS }),
      { id: "settling:league1:1794815999000", url: ROSTER_URL },
    ],
    ["a settled week opens the league", weekSettled(week), { id: "settled:league1:1794815999000", url: LEAGUE_URL }],
  ])("%s", (_, { id, url, category }, expected) => {
    expect({ id, url, category }).toEqual(expected);
  });
});

describe("proofUrl", () => {
  /**
   * The params Expo Router hands app/proof/[taskId].tsx for a URL: the path segment under the
   * route's name for it, then the query, all decoded.
   */
  function routeParams(url: string): Record<string, string> {
    const { pathname, searchParams } = new URL(url, "https://lineup.app");
    return { taskId: decodeURIComponent(pathname.slice("/proof/".length)), ...Object.fromEntries(searchParams) };
  }

  it.each<[string, ProofTarget]>([
    ["a photo task", { taskId: "task3", title: "Read 20 pages", points: 20, proofType: "photo" }],
    ["a location task with its pin", gym],
    ["a quick-time gesture", pushUps],
    ["a Canvas task", { taskId: "task4", title: "Problem set 5", points: 50, proofType: "canvas" }],
    [
      "text a URL would otherwise mangle",
      {
        taskId: "task5",
        title: "Coffee & a call: 50% done? #1 + more",
        points: 25,
        proofType: "photo_location",
        place: { name: "Café Réveille / Mission", lat: -33.8568, lng: 151.2153 },
        gesture: "a peace sign = two fingers",
      },
    ],
  ])("is read back by the proof camera as the same task: %s", (_, target) => {
    expect(parseProofTarget(routeParams(proofUrl(target)))).toEqual(target);
  });
});

describe("timeLeftLabel", () => {
  it.each([
    [-5 * MINUTE_MS, "1 min"],
    [0, "1 min"],
    [20 * 1000, "1 min"],
    [MINUTE_MS, "1 min"],
    [45 * MINUTE_MS, "45 min"],
    [59 * MINUTE_MS, "59 min"],
    [59 * MINUTE_MS + 40 * 1000, "1h"],
    [HOUR_MS, "1h"],
    [61 * MINUTE_MS, "1h 1m"],
    [90 * MINUTE_MS, "1h 30m"],
    [2 * HOUR_MS, "2h"],
    [26 * HOUR_MS, "26h"],
  ])("%d ms reads as %s", (ms, label) => {
    expect(timeLeftLabel(ms)).toBe(label);
  });
});

describe("wording", () => {
  it("tells a drop's task, its gesture and how long is left", () => {
    expect(dropOpened(quickTime, NOW)).toMatchObject({
      title: "Quick-time drop: +40",
      body: "20 push-ups. Show three fingers up in the photo. 2h left.",
    });
    expect(dropOpened({ ...quickTime, gesture: undefined, closesAt: NOW + 45 * MINUTE_MS }, NOW).body).toBe("20 push-ups. 45 min left.");
  });

  it.each([
    [true, "Clear shot, three fingers up.", "Verified: +40", "20 push-ups. Clear shot, three fingers up."],
    [true, undefined, "Verified: +40", "20 push-ups."],
    [false, "Too dark to count the fingers.", "Not verified", "20 push-ups. Too dark to count the fingers. Retry any time this week."],
    [false, undefined, "Not verified", "20 push-ups. Retry any time this week."],
  ])("gives a verdict (pass: %s, reason: %s) and says a fail can be retried", (pass, reason, title, body) => {
    expect(verdictReached({ taskId: "task1", title: "20 push-ups", points: 40, pass, reason })).toMatchObject({ title, body });
  });

  it.each([
    [1, "You're 1 point behind. Prove a task to take it back."],
    [15, "You're 15 points behind. Prove a task to take it back."],
  ])("counts a gap of %d to a rival", (gap, body) => {
    expect(rivalPassed({ leagueId: "league1", rivalId: "maya", rivalName: "Maya", gap })).toMatchObject({ title: "Maya passed you", body });
  });

  it.each([
    [undefined, 'A league mate challenged "Gym session". Its points are held while the league votes.'],
    ["Maya", 'Maya challenged "Gym session". Its points are held while the league votes.'],
  ])("names the challenger when it knows them (%s)", (challengerName, body) => {
    expect(proofChallenged({ challengeId: "challenge1", taskTitle: "Gym session", challengerName })).toMatchObject({
      title: "Your proof was challenged",
      body,
    });
  });

  it("names the place the player arrived at and what checking in pays", () => {
    expect(arrivedAt(gym)).toMatchObject({ title: "You're at Fitness SF", body: "Check in for Gym session: +30." });
  });

  it.each([
    [1, "1 task still open"],
    [3, "3 tasks still open"],
  ])("counts %d open tasks in the evening nudge", (openTasks, title) => {
    expect(eveningNudge({ day: "2026-11-15", openTasks, upNext: gym })).toMatchObject({
      title,
      body: "Gym session is worth +30. Prove it tonight.",
    });
  });

  it("says how long is left before the pot settles", () => {
    expect(settlingSoon({ ...week, msLeft: 3 * HOUR_MS })).toMatchObject({
      title: "Tahoe House settles in 3h",
      body: "Last chance to prove what's still open.",
    });
  });

  it.each<[string, { kind: "refund" | "winnings"; amountUsd: number } | undefined, string]>([
    ["nothing", undefined, "The week is settled"],
    ["winnings with cents", { kind: "winnings", amountUsd: 12.5 }, "You won $12.50"],
    ["winnings in whole dollars", { kind: "winnings", amountUsd: 12 }, "You won $12"],
    ["their stake back", { kind: "refund", amountUsd: 5 }, "$5 back to you"],
  ])("tells a player who got %s what the settled week paid them", (_, payout, title) => {
    expect(weekSettled({ ...week, payout })).toMatchObject({ title, body: "Tahoe House settled. See who got paid." });
  });
});
