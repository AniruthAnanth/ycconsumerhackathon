/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { CORE_SLOTS, type CoreSlot } from "./lib/scoring";
import { DAY_MS, pacificDay, weekEndOf, weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sunday 15 November 2026, 2:30 PM Pacific: the last afternoon of the week, as in the demo.
const NOW = new Date("2026-11-15T22:30:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

type Harness = TestConvex<typeof schema>;
type UserId = Id<"users">;

const BOARDS = [
  "week",
  "season",
  "allTime",
  "global",
  "globalAllTime",
  "body",
  "mind",
  "recharge",
  "chores",
  "people",
  "streak",
  "highlights",
  "quickTime",
  "headToHead",
  "money",
] as const;
type BoardKey = (typeof BOARDS)[number];

const VIEWERS = ["Maya", "Leo"] as const;

/** Each player's final scores for the seeded season's weeks 1 to 4 (EARLIER_WEEKS in convex/seed.ts), by first name. */
const EARLIER_TOTALS: Record<string, number> = {
  Maya: 412 + 301 + 455 + 431,
  Priya: 298 + 351 + 322 + 280,
  Jordan: 255 + 322 + 310 + 275,
  Leo: 150 + 120 + 205 + 160,
  Ava: 210 + 265 + 190 + 245,
  Sam: 365 + 402 + 340 + 395,
};

/** The demo league, seeded: week 5 of 8 in play, as convex/leaderboards.test.ts sets it up. */
async function seededLeague() {
  const t = convexTest(schema, modules);
  await t.mutation(api.seed.reset, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const players = await t.query(api.seed.players, {});
  const idOf = (firstName: string) => players.find((player) => player.name.startsWith(firstName))!._id;
  const leagueId = await t.run(async (ctx) => {
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", "YCHACK"))
      .unique();
    return league!._id;
  });
  const as = (firstName: string) => t.withIdentity({ subject: `${idOf(firstName)}|session` });
  return { t, leagueId, idOf, as };
}
type Seeded = Awaited<ReturnType<typeof seededLeague>>;
type Reader = Pick<Seeded, "t" | "as" | "leagueId">;

/** Read-only tests share one seeded league: seeding is the slow part. Called inside a test, where the clock is faked. */
let shared: Promise<Seeded> | undefined;
const readOnlyLeague = () => (shared ??= seededLeague());

// ---- Reading the test database, not the leaderboard code -----------------------------------------

async function readWorld(t: Harness, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const league = (await ctx.db.get("leagues", leagueId))!;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    const members: { id: UserId; name: string }[] = [];
    for (const membership of memberships) {
      members.push({ id: membership.userId, name: (await ctx.db.get("users", membership.userId))?.name ?? "" });
    }
    const weeks = (
      await ctx.db
        .query("weeks")
        .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
        .collect()
    ).sort((a, b) => a.number - b.number);
    const current = weeks[weeks.length - 1];
    const tasks: Doc<"tasks">[] = [];
    const proofs: Doc<"proofs">[] = [];
    for (const { id } of members) {
      tasks.push(
        ...(await ctx.db
          .query("tasks")
          .withIndex("by_user_week", (q) => q.eq("userId", id).eq("weekStart", current.startsAt))
          .collect()),
      );
      proofs.push(
        ...(await ctx.db
          .query("proofs")
          .withIndex("by_user_week", (q) => q.eq("userId", id).eq("weekStart", current.startsAt))
          .collect()),
      );
    }
    const drops: Doc<"drops">[] = [];
    for (const dropId of new Set(tasks.flatMap((task) => (task.dropId ? [task.dropId] : [])))) {
      drops.push((await ctx.db.get("drops", dropId))!);
    }
    const matchups: (Doc<"matchups"> & { weekNumber: number })[] = [];
    for (const week of weeks) {
      const pairs = await ctx.db
        .query("matchups")
        .withIndex("by_week", (q) => q.eq("weekId", week._id))
        .collect();
      matchups.push(...pairs.map((pair) => ({ ...pair, weekNumber: week.number })));
    }
    const ledger = await ctx.db
      .query("ledger")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    const scores = await ctx.db.query("scores").collect();
    const leagueNames = (await ctx.db.query("leagues").collect()).map((row): [Id<"leagues">, string] => [row._id, row.name]);
    const userNames = (await ctx.db.query("users").collect()).map((user): [Id<"users">, string] => [user._id, user.name ?? ""]);
    return { leagueId, league, members, current, tasks, proofs, drops, matchups, ledger, scores, leagueNames, userNames };
  });
}
type World = Awaited<ReturnType<typeof readWorld>>;

/** What a player did this week, counted straight off the tasks and proofs rows. */
function weekStatsOf(world: World, userId: UserId) {
  const dropOf = new Map(world.drops.map((drop) => [drop._id, drop]));
  // A drop's task scores only in the league that ran the drop.
  const tasks = world.tasks.filter(
    (task) => task.userId === userId && (task.dropId === undefined || dropOf.get(task.dropId)?.leagueId === world.leagueId),
  );
  const verified = tasks.filter((task) => task.status === "verified");

  const slotPoints = Object.fromEntries(CORE_SLOTS.map((slot) => [slot, 0])) as Record<CoreSlot, number>;
  const cleared = new Set<string>();
  for (const task of verified) {
    if ((CORE_SLOTS as readonly string[]).includes(task.slot)) slotPoints[task.slot as CoreSlot] += task.points;
    if (task.source === "draft") cleared.add(task.slot);
    if (task.source === "group") cleared.add("body").add("people");
  }

  const passes = verified.flatMap((task) => {
    const proof = world.proofs
      .filter((candidate) => candidate.taskId === task._id && candidate.pass)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return proof ? [{ task, proof }] : [];
  });

  const days = [...new Set(passes.map(({ proof }) => pacificDay(proof.createdAt)))].sort((a, b) => a - b);
  let streak = 0;
  let run = 0;
  days.forEach((day, i) => {
    run = i > 0 && days[i - 1] === day - 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
  });

  const quickTimes = passes.flatMap(({ task, proof }) => {
    const drop = task.dropId === undefined ? undefined : dropOf.get(task.dropId);
    return drop?.kind === "quicktime" ? [Math.max(0, Math.round((proof.createdAt - drop.opensAt) / 1000))] : [];
  });

  return {
    slotPoints,
    slotsCleared: CORE_SLOTS.filter((slot) => cleared.has(slot)).length,
    streak,
    bestHighlight: Math.max(0, ...passes.map(({ proof }) => proof.highlight)),
    fastestQuickTime: quickTimes.length === 0 ? undefined : Math.min(...quickTimes),
  };
}

/** A final score kept on a finished week's matchup is that player's week. */
function earlierPoints(world: World, userId: UserId): number {
  return world.matchups
    .filter((pair) => pair.weekNumber < world.current.number)
    .reduce((sum, pair) => {
      const score = pair.userA === userId ? pair.scoreA : pair.userB === userId ? pair.scoreB : undefined;
      return sum + (score ?? 0);
    }, 0);
}

/** Dollars in the ledger: winnings and refunds in, stakes out, fees never. */
function ledgerNet(world: World, userId: UserId): number {
  const cents = world.ledger.reduce((sum, row) => {
    if (row.userId !== userId || row.kind === "fee") return sum;
    return sum + Math.round(row.amountUsd * 100) * (row.kind === "buy_in" ? -1 : 1);
  }, 0);
  return cents / 100;
}

// ---- What each board should say ---------------------------------------------------------------------

type Expected = { userId: UserId; name: string; value: number; tiebreak: number; label: string; details?: string[] };

const duration = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
const signedUsd = (n: number) => (n === 0 ? "$0.00" : `${n < 0 ? "-" : "+"}$${Math.abs(n).toFixed(2)}`);

async function expectedFor(
  key: BoardKey,
  world: World,
  viewer: ReturnType<Seeded["as"]>,
  as: Seeded["as"],
  tableOf: Map<UserId, number>,
): Promise<Expected[]> {
  const { members } = world;
  const stats = new Map(members.map((member) => [member.id, weekStatsOf(world, member.id)]));
  const entry = (member: { id: UserId; name: string }, value: number, label = String(value)): Expected => ({
    userId: member.id,
    name: member.name,
    value,
    tiebreak: stats.get(member.id)!.slotsCleared,
    label,
  });

  switch (key) {
    case "week":
      return members.map((member) => entry(member, tableOf.get(member.id)!));
    case "season":
    case "allTime":
      return members.map((member) => entry(member, earlierPoints(world, member.id) + tableOf.get(member.id)!));
    case "global":
    case "globalAllTime": {
      const weekStart = key === "global" ? world.current.startsAt : 0;
      return [...new Set(world.scores.map((row) => row.userId))].flatMap((userId) => {
        const best = world.scores
          .filter((row) => row.userId === userId && row.weekStart === weekStart)
          .sort((a, b) => b.points - a.points)[0];
        if (best === undefined) return [];
        const name = world.userNames.find(([id]) => id === userId)![1];
        // Level in two leagues, either one is the best.
        const details = world.scores
          .filter((row) => row.userId === userId && row.weekStart === weekStart && row.points === best.points)
          .map((row) => world.leagueNames.find(([id]) => id === row.leagueId)![1]);
        return [{ userId, name, value: best.points, tiebreak: 0, label: String(best.points), details }];
      });
    }
    case "body":
    case "mind":
    case "recharge":
    case "chores":
    case "people":
      return members.map((member) => entry(member, stats.get(member.id)!.slotPoints[key]));
    case "streak":
      return members.map((member) => entry(member, stats.get(member.id)!.streak));
    case "highlights":
      return members.flatMap((member) => {
        const best = stats.get(member.id)!.bestHighlight;
        return best > 0 ? [entry(member, best, `${best}/10`)] : [];
      });
    case "quickTime":
      return members.flatMap((member) => {
        const fastest = stats.get(member.id)!.fastestQuickTime;
        return fastest === undefined ? [] : [entry(member, fastest, duration(fastest))];
      });
    case "headToHead": {
      const overview = await viewer.query(api.seasons.overview, { leagueId: world.leagueId });
      // The matchup in play counts towards the tiebreak until its week is settled.
      const open = world.current.status === "open";
      return overview.table.map((row) => ({
        userId: row.userId,
        name: row.name,
        value: row.wins,
        tiebreak: row.pointsFor + (open ? (tableOf.get(row.userId) ?? 0) : 0),
        label: [row.wins, row.losses, ...(row.ties > 0 ? [row.ties] : [])].join("-"),
      }));
    }
    case "money": {
      const rows = await Promise.all(
        members.map(async (member) => {
          const projection = await as(member.name.split(" ")[0]).query(api.leaderboards.projection, {
            leagueId: world.leagueId,
            at: NOW,
          });
          // A settled week has paid out: nothing is left to project.
          const staked = world.current.status !== "settled" && projection?.eligible === true;
          const value = Math.round((ledgerNet(world, member.id) + (staked ? projection.expectedUsd : 0)) * 100) / 100;
          // Only players with money in the league are on its money board.
          const onBoard = staked || world.ledger.some((row) => row.userId === member.id && row.kind !== "fee");
          return onBoard ? [{ userId: member.id, name: member.name, value, tiebreak: 0, label: signedUsd(value) }] : [];
        }),
      );
      return rows.flat();
    }
  }
}

/** Best first, then the places: level players share one and the next is skipped, unless they are numbered straight through. */
function ranked(expected: Expected[], ascending: boolean, splitTies: boolean) {
  const sorted = [...expected].sort(
    (a, b) =>
      (ascending ? a.value - b.value : b.value - a.value) || b.tiebreak - a.tiebreak || a.name.localeCompare(b.name),
  );
  const places: number[] = [];
  sorted.forEach((row, i) => {
    const level = !splitTies && i > 0 && sorted[i - 1].value === row.value && sorted[i - 1].tiebreak === row.tiebreak;
    places.push(level ? places[i - 1] : i + 1);
  });
  return sorted.map((row, i) => ({ ...row, rank: places[i] }));
}

/** One board, read as one player, checked row by row against the independent reading of the database. */
async function checkBoard(seeded: Pick<Reader, "as">, world: World, key: BoardKey, viewerName: string) {
  const viewer = seeded.as(viewerName);
  const result = await viewer.query(api.leaderboards.board, { leagueId: world.leagueId, board: key, at: NOW });
  const table = await viewer.query(api.standings.table, { leagueId: world.leagueId });
  const tableOf = new Map(table.map((row) => [row.userId, row.points]));
  const expected = ranked(await expectedFor(key, world, viewer, seeded.as, tableOf), key === "quickTime", key === "week");
  const me = world.members.find((member) => member.name.startsWith(viewerName));

  expect(result.board).toBe(key);
  expect(result.title.length).toBeGreaterThan(0);
  expect(result.valueHeader.length).toBeGreaterThan(0);

  const cents = (n: number) => Math.round(n * 100) / 100;
  expect(result.rows.map((row) => [row.rank, row.name, cents(row.value), row.valueLabel])).toEqual(
    expected.map((row) => [row.rank, row.name, cents(row.value), row.label]),
  );
  if (key === "week") {
    expect(result.rows.map((row) => [row.rank, row.name, row.value])).toEqual(table.map((row) => [row.rank, row.name, row.points]));
  }
  if (key === "global" || key === "globalAllTime") {
    result.rows.forEach((row, i) => expect(expected[i].details).toContain(row.detail));
  }

  const { rows } = result;
  expect(rows.filter((row) => row.isMe)).toHaveLength(rows.some((row) => row.userId === me?.id) ? 1 : 0);
  const rivals = rows.filter((row) => row.isRival);
  expect(rivals.length).toBeLessThanOrEqual(1);
  if (rivals.length === 1) expect(result.rival).toMatchObject({ userId: rivals[0].userId, name: rivals[0].name });
  else expect(result.rival).toBeUndefined();
  rows.forEach((row, i) => {
    expect(row.valueLabel.length).toBeGreaterThan(0);
    expect(row.valueLabel).not.toMatch(/NaN|undefined|null/);
    expect(row.detail ?? "").not.toMatch(/NaN|undefined|null/);
    if (rows.length === 1) {
      expect(row.gapLabel).toBeUndefined();
      return;
    }
    const neighbour = rows[i === 0 ? 1 : i - 1];
    expect(row.gapLabel).toMatch(neighbour.value === row.value ? /^Level with / : i === 0 ? / ahead of / : / behind /);
    expect(row.gapLabel).toContain(neighbour.name);
    expect(row.gapLabel).not.toMatch(/NaN|undefined|null/);
  });
}

async function checkEveryBoard(reader: Reader, viewers: readonly string[] = VIEWERS) {
  const world = await readWorld(reader.t, reader.leagueId);
  for (const key of BOARDS) for (const viewer of viewers) await checkBoard(reader, world, key, viewer);
}

async function valuesOn(viewer: ReturnType<Seeded["as"]>, leagueId: Id<"leagues">, key: BoardKey) {
  const { rows } = await viewer.query(api.leaderboards.board, { leagueId, board: key, at: NOW });
  return new Map(rows.map((row) => [row.name, row.value]));
}

// ---- The seeded league: every board, every row -------------------------------------------------------

describe("every board of the seeded league", () => {
  test.each(BOARDS)("%s is sorted, placed and numbered right for two players", async (key) => {
    const seeded = await readOnlyLeague();
    const world = await readWorld(seeded.t, seeded.leagueId);
    for (const viewer of VIEWERS) await checkBoard(seeded, world, key, viewer);
  });

  test("the independent reading agrees with the seed's own season", async () => {
    const { t, leagueId } = await readOnlyLeague();
    const world = await readWorld(t, leagueId);
    for (const member of world.members) {
      expect(earlierPoints(world, member.id)).toBe(EARLIER_TOTALS[member.name.split(" ")[0]]);
    }
  });

  test("the money board is each player's projection before anything is paid out", async () => {
    const { leagueId, as, idOf } = await readOnlyLeague();
    const { rows } = await as("Maya").query(api.leaderboards.board, { leagueId, board: "money", at: NOW });
    expect(rows).toHaveLength(6);
    for (const firstName of ["Maya", "Priya", "Jordan", "Leo", "Ava", "Sam"]) {
      const projection = await as(firstName).query(api.leaderboards.projection, { leagueId, at: NOW });
      const row = rows.find((candidate) => candidate.userId === idOf(firstName))!;
      expect(row.value).toBeCloseTo(projection!.expectedUsd - projection!.stakeUsd, 2);
    }
  });

  test("head-to-head is the Season screen's wins and losses", async () => {
    const { leagueId, as, idOf } = await readOnlyLeague();
    const overview = await as("Maya").query(api.seasons.overview, { leagueId });
    const { rows } = await as("Maya").query(api.leaderboards.board, { leagueId, board: "headToHead" });
    for (const seasonRow of overview.table) {
      const row = rows.find((candidate) => candidate.userId === seasonRow.userId)!;
      expect(row.value).toBe(seasonRow.wins);
      expect(row.valueLabel.startsWith(`${seasonRow.wins}-${seasonRow.losses}`)).toBe(true);
    }
    expect(rows.find((row) => row.userId === idOf("Sam"))?.valueLabel).toBe("4-0");
  });
});

// ---- Flows ---------------------------------------------------------------------------------------------

describe("boards through a player's week", () => {
  test("a verified task moves week, season, all-time, global, the slot board and streak by the right amounts", async () => {
    const seeded = await seededLeague();
    const { t, leagueId, as, idOf } = seeded;
    const leo = idOf("Leo");
    const viewer = as("Maya");
    const boards = ["week", "season", "allTime", "global", "globalAllTime", "mind", "streak"] as const;
    const read = async () => {
      const values: Record<string, number> = {};
      for (const key of boards) values[key] = (await valuesOn(viewer, leagueId, key)).get("Leo Martinez")!;
      return values;
    };
    const before = await read();

    const { task, storageId } = await t.run(async (ctx) => {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", leo).eq("weekStart", weekStartOf(NOW)))
        .collect();
      return {
        task: tasks.find((row) => row.slot === "mind" && row.status === "open")!,
        storageId: await ctx.storage.store(new Blob(["a photo"])),
      };
    });
    await t.mutation(internal.proofs.record, {
      taskId: task._id,
      userId: leo,
      storageId,
      mediaType: "photo",
      via: "app",
      verdict: { pass: true, confidence: 0.9, reason: "A finished report.", highlight: 7, caption: "Done.", points: task.points, closeCall: false },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await read();

    // The task's points, 25 for clearing the slot and 5 for a first day of streak.
    const earned = task.points + 25 + 5;
    expect(after.week - before.week).toBe(earned);
    expect(after.season - before.season).toBe(earned);
    expect(after.allTime - before.allTime).toBe(earned);
    expect(after.global - before.global).toBe(earned);
    expect(after.globalAllTime - before.globalAllTime).toBe(earned);
    expect(after.mind - before.mind).toBe(task.points);
    expect(after.streak - before.streak).toBe(1);

    await checkEveryBoard(seeded);
  });

  test("a settled week adds the matchup bonus everywhere and pays the money board from the ledger", async () => {
    const seeded = await seededLeague();
    const { t, leagueId, as } = seeded;
    const viewer = as("Maya");
    const worldBefore = await readWorld(t, leagueId);
    const pointsBefore = new Map((await viewer.query(api.standings.table, { leagueId })).map((row) => [row.userId, row.points]));

    await viewer.action(api.whop.settleWeek, { leagueId });
    // Settlement schedules the rebuild. It is run by hand: running everything scheduled would also send texts and memories.
    await t.mutation(internal.leaderboards.rebuild, { leagueId });

    // The higher scorer of each pair holds the 50-point bonus.
    const tableAfter = await viewer.query(api.standings.table, { leagueId });
    const pointsAfter = (id: UserId) => tableAfter.find((row) => row.userId === id)!.points;
    const inPlay = worldBefore.matchups.filter((pair) => pair.weekNumber === worldBefore.current.number);
    expect(inPlay.length).toBeGreaterThan(0);
    for (const pair of inPlay) {
      const a = pointsBefore.get(pair.userA)!;
      const b = pointsBefore.get(pair.userB)!;
      expect(pointsAfter(pair.userA)).toBe(a + (a > b ? 50 : 0));
      expect(pointsAfter(pair.userB)).toBe(b + (b > a ? 50 : 0));
    }

    const world = await readWorld(t, leagueId);
    expect(world.current.status).toBe("settled");
    expect(world.ledger.some((row) => row.kind === "winnings")).toBe(true);
    await checkEveryBoard(seeded);

    const maya = world.members.find((member) => member.name === "Maya Chen")!;
    const mayaOn = async (key: BoardKey) => (await valuesOn(viewer, leagueId, key)).get("Maya Chen");
    expect(await mayaOn("week")).toBe(pointsAfter(maya.id));
    expect(await mayaOn("season")).toBe(EARLIER_TOTALS.Maya + pointsAfter(maya.id));
    expect(await mayaOn("global")).toBe(pointsAfter(maya.id));
    expect(await mayaOn("money")).toBe(ledgerNet(world, maya.id));
  });
});

describe("a second league", () => {
  test("a shared player's global row is their best league, and the league boards keep to their own members", async () => {
    const seeded = await seededLeague();
    const { t, leagueId, as, idOf } = seeded;
    const priya = idOf("Priya");
    const side = await t.run(async (ctx) => {
      const zoe = await ctx.db.insert("users", { name: "Zoe Side" });
      const sideId = await ctx.db.insert("leagues", {
        name: "Side League",
        inviteCode: "SIDE01",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 12,
        createdBy: zoe,
      });
      const lastWeek = weekStartOf(NOW) - 7 * DAY_MS;
      const finishedId = await ctx.db.insert("weeks", {
        leagueId: sideId,
        number: 1,
        startsAt: lastWeek,
        endsAt: weekEndOf(lastWeek),
        status: "open",
      });
      const currentId = await ctx.db.insert("weeks", {
        leagueId: sideId,
        number: 2,
        startsAt: weekStartOf(NOW),
        endsAt: weekEndOf(weekStartOf(NOW)),
        status: "open",
      });
      for (const userId of [priya, zoe]) await ctx.db.insert("memberships", { leagueId: sideId, userId, paid: true, joinedAt: NOW });
      // A final score kept on a finished week's matchup is that week: Priya's biggest week anywhere, in the smaller league.
      await ctx.db.insert("matchups", { weekId: finishedId, userA: priya, userB: zoe, scoreA: 1500, scoreB: 100 });
      await ctx.db.insert("matchups", { weekId: currentId, userA: priya, userB: zoe });
      return { sideId, zoe };
    });
    await t.mutation(internal.leaderboards.rebuild, { leagueId: side.sideId });
    await t.mutation(internal.leaderboards.rebuild, { leagueId });

    const priyaView = as("Priya");
    const global = await priyaView.query(api.leaderboards.board, { leagueId, board: "global" });
    expect(global.rows.find((row) => row.isMe)?.value).toBe(195);
    expect(global.rows).toHaveLength(7);
    const allTime = await priyaView.query(api.leaderboards.board, { leagueId, board: "globalAllTime" });
    // The seeded league has 1251 from weeks 1 to 4 plus 195 this week; the side league has 1500 and whatever this week adds.
    const mine = allTime.rows.find((row) => row.isMe)!;
    expect(mine.detail).toBe("Side League");
    expect(mine.value).toBeGreaterThanOrEqual(1500);

    for (const key of BOARDS.filter((board) => board !== "global" && board !== "globalAllTime")) {
      const main = await priyaView.query(api.leaderboards.board, { leagueId, board: key, at: NOW });
      expect(main.rows.map((row) => row.name)).not.toContain("Zoe Side");
      const sideBoard = await priyaView.query(api.leaderboards.board, { leagueId: side.sideId, board: key, at: NOW });
      for (const row of sideBoard.rows) expect(["Priya Shah", "Zoe Side"]).toContain(row.name);
    }

    await checkEveryBoard(seeded);
    const sideReader = {
      t,
      leagueId: side.sideId,
      as: (firstName: string) => t.withIdentity({ subject: `${firstName === "Zoe" ? side.zoe : priya}|session` }),
    };
    await checkEveryBoard(sideReader, ["Zoe", "Priya"]);
  });
});
