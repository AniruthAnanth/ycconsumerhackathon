import { describe, expect, it } from "vitest";

import {
  dropOpened,
  eveningNudge,
  proofChallenged,
  rivalPassed,
  settlingSoon,
  verdictReached,
  weekSettled,
} from "@/convex/lib/notificationContent";
import type { Drop, Payout, Pot, Roster, Standing, Task } from "@/lib/backend";

import { type Snapshot, eventsBetween, scheduledFor } from "./events";

const ME = "me";
const LEAGUE = "league1";
const LEAGUE_NAME = "Tahoe House";
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * A moment on the test machine's own clock in 2026. The evening nudge follows the phone's clock,
 * so times written this way make the cases hold in whatever zone the tests run in.
 */
const local = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

/** Sunday afternoon, with the week settling at the end of the day. */
const NOW = local(11, 15, 14);
const SETTLES_AT = local(11, 15, 23, 59);

type FeedItem = NonNullable<Snapshot["feed"]>[number];
type Challenge = NonNullable<FeedItem["challenge"]>;

/** Every query loaded, with nothing in it. */
function snapshot(fields: Partial<Snapshot> = {}): Snapshot {
  return {
    userId: ME,
    leagueId: LEAGUE,
    leagueName: LEAGUE_NAME,
    drops: [],
    roster: roster([]),
    standings: [],
    feed: [],
    pot: pot(),
    ...fields,
  };
}

function drop(dropId: string, fields: Partial<Drop> = {}): Drop {
  return {
    dropId: dropId as Drop["dropId"],
    kind: "quicktime",
    title: "20 push-ups",
    slot: "body",
    points: 40,
    gesture: "three fingers up",
    sealed: false,
    opensAt: NOW - HOUR_MS,
    closesAt: NOW + HOUR_MS,
    taskId: `${dropId}-task` as Drop["taskId"],
    ...fields,
  };
}

function task(taskId: string, fields: Partial<Task> = {}): Task {
  return {
    taskId: taskId as Task["taskId"],
    slot: "body",
    title: taskId,
    points: 30,
    proofType: "photo",
    status: "open",
    source: "draft",
    score: null,
    dueLabel: "Due Sun",
    upNext: false,
    ...fields,
  };
}

function roster(rows: Task[], fields: Partial<Roster> = {}): Roster {
  return { locked: true, weekStart: local(11, 9, 0), total: 0, bonusPoints: 0, bonusLabels: [], rows, ...fields };
}

/** A standings table from each player's points, ranked the way standings.table ranks it. */
function standings(points: Record<string, number>): Standing[] {
  return Object.entries(points)
    .sort(([, a], [, b]) => b - a)
    .map(([userId, playerPoints], index) => ({
      rank: index + 1,
      userId: userId as Standing["userId"],
      name: userId.toUpperCase(),
      slotsCleared: 0,
      points: playerPoints,
      streak: 0,
      paid: true,
    }));
}

/** One proof in the feed, with the challenge against it when there is one. */
function feedItem(ownerId: string, challenge?: { id: string; status: Challenge["status"] }): FeedItem {
  return {
    proofId: `${ownerId}-proof` as FeedItem["proofId"],
    kind: "proof",
    user: { _id: ownerId as FeedItem["user"]["_id"], name: ownerId.toUpperCase() },
    taskTitle: "Gym session",
    slot: "body",
    points: 30,
    reason: "Clear photo of the gym floor.",
    caption: "Leg day",
    mediaType: "photo",
    createdAt: NOW - HOUR_MS,
    closeCall: false,
    reactions: [],
    ...(challenge && {
      challenge: {
        challengeId: challenge.id as Challenge["challengeId"],
        status: challenge.status,
        legit: 0,
        notLegit: 0,
        canVote: false,
        closesAt: NOW + HOUR_MS,
      },
    }),
  };
}

function pot(fields: Partial<Pot> = {}): Pot {
  return { stakeUsd: 5, potUsd: 20, paid: [], unpaid: [], settlesAt: SETTLES_AT, ...fields };
}

function payout(userId: string, kind: Payout["kind"], amountUsd: number): Payout {
  return { userId: userId as Payout["userId"], name: userId.toUpperCase(), kind, amountUsd };
}

describe("eventsBetween: what counts as news", () => {
  const quiet = snapshot({
    roster: roster([task("gym")]),
    standings: standings({ me: 50, maya: 40 }),
    feed: [feedItem(ME)],
  });
  /** The same league a moment later, with one event from every query. */
  const eventful = snapshot({
    drops: [drop("drop1")],
    roster: roster([task("gym", { status: "verified", score: 30 })]),
    standings: standings({ maya: 90, me: 80 }),
    feed: [feedItem(ME, { id: "challenge1", status: "open" })],
    pot: pot({ payouts: [] }),
  });
  const kinds = (before: Snapshot | null, after: Snapshot) => eventsBetween(before, after, NOW).map((event) => event.kind);

  const queries = [
    ["drops", "drop"],
    ["roster", "verdict"],
    ["standings", "rival"],
    ["feed", "challenge"],
    ["pot", "settlement"],
  ] as const;

  it("raises one notification for each thing that changed", () => {
    expect(kinds(quiet, eventful)).toEqual(["drop", "verdict", "rival", "challenge", "settlement"]);
  });

  it("takes the first snapshot as the baseline", () => {
    expect(kinds(null, eventful)).toEqual([]);
  });

  it("starts again from a baseline when Switch Player changes who the device plays as", () => {
    expect(kinds({ ...quiet, userId: "maya" }, eventful)).toEqual([]);
  });

  it("starts again from a baseline when the league switcher changes league", () => {
    expect(kinds({ ...quiet, leagueId: "league2" }, eventful)).toEqual([]);
  });

  it.each(queries)("takes the first result of %s as that query's baseline and still reports the rest", (query, kind) => {
    const others = queries.map(([, other]) => other).filter((other) => other !== kind);
    expect(kinds({ ...quiet, [query]: undefined }, eventful)).toEqual(others);
  });

  it.each(queries)("raises nothing from %s while it loads again", (query, kind) => {
    expect(kinds(quiet, { ...eventful, [query]: undefined })).not.toContain(kind);
  });

  it("raises nothing a second time when the same snapshot comes round again", () => {
    expect(kinds(eventful, eventful)).toEqual([]);
  });
});

describe("eventsBetween: a quick-time drop opens", () => {
  const opened = (after: Drop[], before: Drop[] = []) =>
    eventsBetween(snapshot({ drops: before }), snapshot({ drops: after }), NOW);

  it("opens the proof camera on the player's task for the drop", () => {
    const events = opened([drop("drop1")]);
    expect(events).toEqual([
      dropOpened(
        {
          dropId: "drop1",
          title: "20 push-ups",
          points: 40,
          gesture: "three fingers up",
          closesAt: NOW + HOUR_MS,
          task: { taskId: "drop1-task", title: "20 push-ups", points: 40, proofType: "photo", gesture: "three fingers up" },
        },
        NOW,
      ),
    ]);
    expect(events.map((event) => event.url.split("?")[0])).toEqual(["/proof/drop1-task"]);
  });

  it("lands on Roster when the drop names no task", () => {
    const events = opened([drop("drop1", { taskId: undefined, gesture: undefined })]);
    expect(events).toEqual([dropOpened({ dropId: "drop1", title: "20 push-ups", points: 40, closesAt: NOW + HOUR_MS }, NOW)]);
    expect(events.map((event) => event.url)).toEqual(["/"]);
  });

  it("announces only the drop that is new", () => {
    expect(opened([drop("drop1"), drop("drop2")], [drop("drop1")]).map((event) => event.id)).toEqual(["drop:drop2"]);
  });

  it.each([
    ["was already listed", [drop("drop1")], [drop("drop1")]],
    ["is a mystery envelope", [], [drop("drop1", { kind: "mystery" })]],
    ["is a group session", [], [drop("drop1", { kind: "group" })]],
    ["closes at this very moment", [], [drop("drop1", { closesAt: NOW })]],
    ["has already closed", [], [drop("drop1", { closesAt: NOW - MINUTE_MS })]],
  ])("raises nothing for a drop that %s", (_, before, after) => {
    expect(opened(after, before)).toEqual([]);
  });
});

describe("eventsBetween: the referee passes a proof", () => {
  const verdicts = (before: Roster, after: Roster) => eventsBetween(snapshot({ roster: before }), snapshot({ roster: after }), NOW);

  it("says what the proof earned", () => {
    const events = verdicts(roster([task("gym"), task("read")]), roster([task("gym", { status: "verified", score: 45 }), task("read")]));
    expect(events).toEqual([verdictReached({ taskId: "gym", title: "gym", points: 45, pass: true })]);
  });

  it("falls back on the task's points when the row carries no score", () => {
    const events = verdicts(roster([task("gym")]), roster([task("gym", { status: "verified" })]));
    expect(events).toEqual([verdictReached({ taskId: "gym", title: "gym", points: 30, pass: true })]);
  });

  it.each([
    ["stays open after a failed proof", [task("gym")], [task("gym")]],
    ["was verified already", [task("gym", { status: "verified" })], [task("gym", { status: "verified" })]],
    ["has its points held by a challenge", [task("gym")], [task("gym", { status: "held" })]],
    ["gets its held points back", [task("gym", { status: "held" })], [task("gym", { status: "verified" })]],
    ["first shows up verified", [], [task("gym", { status: "verified" })]],
  ])("raises nothing for a task that %s", (_, before, after) => {
    expect(verdicts(roster(before), roster(after))).toEqual([]);
  });

  it("raises nothing when the roster has moved on to another week", () => {
    const nextWeek = roster([task("gym", { status: "verified" })], { weekStart: local(11, 16, 0) });
    expect(verdicts(roster([task("gym")]), nextWeek)).toEqual([]);
  });
});

describe("eventsBetween: a rival passes the player", () => {
  it.each<{ when: string; before: Record<string, number>; after: Record<string, number>; passed: [string, number][] }>([
    { when: "a rival comes from behind", before: { me: 50, maya: 40 }, after: { me: 50, maya: 60 }, passed: [["maya", 10]] },
    { when: "a rival breaks a tie", before: { me: 50, maya: 50 }, after: { me: 50, maya: 51 }, passed: [["maya", 1]] },
    { when: "a rival only draws level", before: { me: 50, maya: 40 }, after: { me: 50, maya: 50 }, passed: [] },
    { when: "a rival who was ahead pulls away", before: { me: 50, maya: 60 }, after: { me: 50, maya: 90 }, passed: [] },
    { when: "a rival gains and stays behind", before: { me: 50, maya: 10 }, after: { me: 50, maya: 40 }, passed: [] },
    { when: "the player answers a rival's points with more", before: { me: 50, maya: 40 }, after: { me: 90, maya: 80 }, passed: [] },
    {
      when: "the player's held points drop them below a rival",
      before: { me: 50, maya: 40 },
      after: { me: 20, maya: 40 },
      passed: [["maya", 20]],
    },
    {
      when: "several rivals pass at once",
      before: { leo: 60, me: 50, sam: 50, maya: 40 },
      after: { leo: 90, maya: 70, sam: 55, me: 50 },
      passed: [
        ["maya", 20],
        ["sam", 5],
      ],
    },
    { when: "a rival joins the league already ahead", before: { me: 50 }, after: { me: 50, maya: 60 }, passed: [] },
    { when: "the player was not in the table before", before: { maya: 40 }, after: { maya: 60, me: 0 }, passed: [] },
    { when: "the player is no longer in the table", before: { me: 50, maya: 40 }, after: { maya: 60 }, passed: [] },
  ])("when $when", ({ before, after, passed }) => {
    const events = eventsBetween(snapshot({ standings: standings(before) }), snapshot({ standings: standings(after) }), NOW);
    expect(events).toEqual(
      passed.map(([rivalId, gap]) => rivalPassed({ leagueId: LEAGUE, rivalId, rivalName: rivalId.toUpperCase(), gap })),
    );
  });
});

describe("eventsBetween: a league mate challenges the player's proof", () => {
  const open = { id: "challenge1", status: "open" } as const;
  const challenges = (before: FeedItem[], after: FeedItem[]) => eventsBetween(snapshot({ feed: before }), snapshot({ feed: after }), NOW);

  it("names the task whose proof was challenged", () => {
    expect(challenges([feedItem(ME)], [feedItem(ME, open)])).toEqual([
      proofChallenged({ challengeId: "challenge1", taskTitle: "Gym session" }),
    ]);
  });

  it("notices a challenge on a proof the feed did not hold before", () => {
    expect(challenges([], [feedItem(ME, open)]).map((event) => event.id)).toEqual(["challenge:challenge1"]);
  });

  it.each([
    ["is on someone else's proof", [feedItem("maya")], [feedItem("maya", open)]],
    ["was already open", [feedItem(ME, open)], [feedItem(ME, open)]],
    ["has been upheld", [feedItem(ME, open)], [feedItem(ME, { id: "challenge1", status: "upheld" })]],
    [
      "was opened and overturned between two snapshots",
      [feedItem(ME)],
      [feedItem(ME, { id: "challenge1", status: "overturned" })],
    ],
  ])("raises nothing for a challenge that %s", (_, before, after) => {
    expect(challenges(before, after)).toEqual([]);
  });
});

describe("eventsBetween: the week settles", () => {
  const settled = (before: Pot, after: Pot) => eventsBetween(snapshot({ pot: before }), snapshot({ pot: after }), NOW);

  it.each<[string, Payout[], { kind: Payout["kind"]; amountUsd: number } | undefined]>([
    [
      "the winnings when the player also got their stake back",
      [payout(ME, "refund", 5), payout(ME, "winnings", 12.5), payout("maya", "refund", 5)],
      { kind: "winnings", amountUsd: 12.5 },
    ],
    ["the refund when that is all the player got", [payout("maya", "winnings", 9), payout(ME, "refund", 5)], { kind: "refund", amountUsd: 5 }],
    ["no amount when the player was not paid", [payout("maya", "refund", 5)], undefined],
  ])("names %s", (_, payouts, mine) => {
    expect(settled(pot(), pot({ payouts }))).toEqual([
      weekSettled({ leagueId: LEAGUE, leagueName: LEAGUE_NAME, settlesAt: SETTLES_AT, payout: mine }),
    ]);
  });

  it("raises nothing while the week is still open", () => {
    expect(settled(pot(), pot({ potUsd: 25 }))).toEqual([]);
  });

  it("raises nothing more once the payouts are known", () => {
    const payouts = [payout(ME, "refund", 5)];
    expect(settled(pot({ payouts }), pot({ payouts }))).toEqual([]);
  });
});

describe("scheduledFor: the evening nudge", () => {
  const lineup = roster([
    task("gym", { upNext: true }),
    task("read", { points: 50 }),
    task("call mum", { status: "verified", score: 20 }),
  ]);
  const nudges = (fields: Partial<Snapshot>, now: number) =>
    scheduledFor(snapshot({ roster: lineup, ...fields }), now).filter((reminder) => reminder.kind === "nudge");

  it.each([
    ["today while the evening is still ahead", local(11, 15, 14), local(11, 15, 19), "2026-11-15"],
    ["today with a minute to go", local(11, 15, 18, 59), local(11, 15, 19), "2026-11-15"],
    ["tomorrow once it is 7 PM", local(11, 15, 19), local(11, 16, 19), "2026-11-16"],
    ["tomorrow late at night", local(11, 15, 23, 30), local(11, 16, 19), "2026-11-16"],
    ["on the 1st after the last evening of a month", local(11, 30, 21), local(12, 1, 19), "2026-12-01"],
  ])("fires at 7 PM %s", (_, now, fireAt, day) => {
    // The pot is still loading, so nothing is known about when the week ends.
    expect(nudges({ pot: undefined }, now)).toEqual([
      { ...eveningNudge({ day, openTasks: 2, upNext: { title: "gym", points: 30 } }), fireAt },
    ]);
  });

  it("names the open task worth the most when Up Next is not among them", () => {
    const rows = [task("gym", { status: "verified", points: 50, upNext: true }), task("read", { points: 20 }), task("walk", { points: 40 })];
    expect(nudges({ roster: roster(rows), pot: undefined }, NOW)).toEqual([
      { ...eveningNudge({ day: "2026-11-15", openTasks: 2, upNext: { title: "walk", points: 40 } }), fireAt: local(11, 15, 19) },
    ]);
  });

  it.each([
    ["the lineup is not locked", roster([task("gym")], { locked: false })],
    ["every task is proven", roster([task("gym", { status: "verified" })])],
    ["nothing is drafted", roster([])],
    ["the roster is still loading", undefined],
  ])("stays quiet when %s", (_, quietRoster) => {
    expect(nudges({ roster: quietRoster, pot: undefined }, NOW)).toEqual([]);
  });

  it.each([
    ["is skipped when the week settles at 7 PM exactly", local(11, 15, 19), []],
    ["is skipped when the week settles before 7 PM", local(11, 15, 18), []],
    ["still fires when the week settles a minute after 7 PM", local(11, 15, 19, 1), [local(11, 15, 19)]],
  ])("%s", (_, settlesAt, fireAts) => {
    expect(nudges({ pot: pot({ settlesAt }) }, NOW).map((reminder) => reminder.fireAt)).toEqual(fireAts);
  });

  it("is always at 7 PM on the phone's clock, on the next calendar day when today's has passed", () => {
    // A year of evenings at 8 PM, so that in a zone with daylight saving both clock changes are crossed.
    for (let day = 1; day <= 365; day += 1) {
      const now = local(1, day, 20);
      const [nudge] = nudges({ pot: undefined }, now);
      const fireAt = new Date(nudge?.fireAt ?? Number.NaN);
      expect([fireAt.getHours(), fireAt.getMinutes(), fireAt.getDate()]).toEqual([19, 0, new Date(2026, 0, day + 1).getDate()]);
    }
  });
});

describe("scheduledFor: settling soon", () => {
  const THREE_HOURS_MS = 3 * HOUR_MS;
  const lineup = roster([task("gym")]);
  const settling = (fields: Partial<Snapshot>, now: number) =>
    scheduledFor(snapshot({ roster: lineup, ...fields }), now).filter((reminder) => reminder.kind === "settlement");

  it("fires three hours before the pot settles", () => {
    expect(settling({}, NOW)).toEqual([
      {
        ...settlingSoon({ leagueId: LEAGUE, leagueName: LEAGUE_NAME, settlesAt: SETTLES_AT, msLeft: THREE_HOURS_MS }),
        fireAt: SETTLES_AT - THREE_HOURS_MS,
      },
    ]);
  });

  it("does not wait for the lineup to be locked", () => {
    const unlocked = roster([task("gym")], { locked: false });
    expect(scheduledFor(snapshot({ roster: unlocked }), NOW).map((reminder) => reminder.kind)).toEqual(["settlement"]);
  });

  it.each<[string, Partial<Snapshot>, number]>([
    ["the three-hour mark is this very moment", {}, SETTLES_AT - THREE_HOURS_MS],
    ["less than three hours are left", {}, SETTLES_AT - THREE_HOURS_MS + MINUTE_MS],
    ["the week has settled", { pot: pot({ payouts: [] }) }, NOW],
    ["the pot is still loading", { pot: undefined }, NOW],
    ["every task is proven", { roster: roster([task("gym", { status: "verified" })]) }, NOW],
    ["the roster is still loading", { roster: undefined }, NOW],
  ])("stays quiet when %s", (_, fields, now) => {
    expect(settling(fields, now)).toEqual([]);
  });
});

describe("scheduledFor: both reminders", () => {
  const lastEvening = snapshot({ roster: roster([task("gym")]) });

  it("lists the nudge and then the settlement reminder on the week's last evening", () => {
    expect(scheduledFor(lastEvening, NOW).map((reminder) => [reminder.id, reminder.fireAt])).toEqual([
      ["nudge:2026-11-15", local(11, 15, 19)],
      [`settling:${LEAGUE}:${SETTLES_AT}`, local(11, 15, 20, 59)],
    ]);
  });

  it("never schedules a reminder for a moment that has come", () => {
    const moments = [local(11, 15, 19), local(11, 15, 20, 59), SETTLES_AT, SETTLES_AT + HOUR_MS];
    for (const moment of moments) {
      for (const now of [moment - 1, moment, moment + 1]) {
        for (const reminder of scheduledFor(lastEvening, now)) expect(reminder.fireAt).toBeGreaterThan(now);
      }
    }
  });
});
