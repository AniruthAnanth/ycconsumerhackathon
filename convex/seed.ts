/**
 * The demo league. `seed.reset` (Reset Seed in the demo controls) puts "YC Hackathon" back into
 * the same late-week state every time: six players, a paid pot, head-to-head matchups, a week of
 * proofs with photos and one finished quick-time drop.
 *
 * Two choices shape this file:
 * - Times are written as "days ago at a clock time" and resolved against the moment of the reset,
 *   so the league always reads as a week that has just been lived.
 * - The league row and the six player rows are patched in place and never recreated, so a phone
 *   that is looking at the league, or is switched to a seeded player, keeps working across a
 *   reset. Everything hanging off them is deleted and rebuilt.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireSignedInUser } from "./lib/auth";
import { scheduleFor } from "./lib/schedule";
import { quickTimeScore, type Slot } from "./lib/scoring";
import { SEED_PHOTOS, type SeedPhotoKey } from "./lib/seedPhotos";
import { HOUR_MS, pacificDay, startOfPacificDay, weekEndOf, weekStartOf } from "./lib/week";

const MINUTE_MS = 60 * 1000;
/** More rows than a demo league ever holds under one parent. It keeps every read bounded. */
const SWEEP_LIMIT = 500;
const PHOTO_KEYS = Object.keys(SEED_PHOTOS) as SeedPhotoKey[];

// Public with a $20 stake, so Quick Match at $20 also lands a new player in this full league.
// It plays an 8-week double round robin and pays out every week.
const LEAGUE = {
  name: "YC Hackathon",
  inviteCode: "YCHACK",
  stakeUsd: 20,
  visibility: "public" as const,
  maxMembers: 12,
  payout: "weekly" as const,
  seasonWeeks: 8,
  format: "double_round_robin" as const,
};

// The league is in week 5 of that season, so the Season screen has results behind it, a week in
// play and a schedule ahead. Each row is one finished week: what the six scored, in PLAYERS
// order. They leave Sam unbeaten at 4-0 and Maya 3-1 (Jordan beat her in week 2), which makes
// this week's Maya v Sam the game at the top of the table.
const EARLIER_WEEKS = [
  [412, 298, 255, 150, 210, 365],
  [301, 351, 322, 120, 265, 402],
  [455, 322, 310, 205, 190, 340],
  [431, 280, 275, 160, 245, 395],
];
const CURRENT_WEEK = EARLIER_WEEKS.length + 1;

/** When something happened: whole days before the reset, at a Pacific clock time. */
type When = [daysAgo: number, clock: string];

type SeedProof = {
  at: When;
  photo: SeedPhotoKey;
  /** False for a proof the referee turned down. The task then stays open. */
  pass?: false;
  confidence: number;
  highlight: number;
  reason: string;
  caption: string;
  via?: "keiki";
  /** Emoji reactions, one from each of the next players in the list. */
  cheers?: string[];
};

type SeedTask = {
  slot: Slot;
  title: string;
  points: number;
  /** "draft" unless said otherwise. A "drop" task belongs to the seeded quick-time drop. */
  source?: "flex" | "drop";
  place?: { name: string; lat: number; lng: number };
  proof?: SeedProof;
};

type SeedPlayer = { name: string; phone: string; tasks: SeedTask[] };

const QUICK_TIME = {
  title: "20 push-ups",
  slot: "body" as const,
  points: 40,
  gesture: "three fingers up",
  opened: [1, "14:00"] as When,
  closed: [1, "16:00"] as When,
};

// The order sets this week's matchups: the first player meets the last, then it works inward
// (Maya v Sam, Priya v Ava, Jordan v Leo). Reset on a Sunday, the table reads Maya 500, Sam 285,
// Priya 195, Jordan 120, Ava 60, Leo 0. The bottom is low on purpose: a new player's first
// verified proof lifts them past two seeded players, which is the demo's live reorder.
const PLAYERS: SeedPlayer[] = [
  {
    name: "Maya Chen",
    phone: "+14155550101",
    tasks: [
      {
        slot: "body",
        title: "Leg day at the gym",
        points: 40,
        proof: {
          at: [6, "07:42"],
          photo: "gym",
          confidence: 0.94,
          highlight: 7,
          reason: "Barbell on the squat rack and a gym mirror, matches leg day.",
          caption: "Leg day before 8 AM.",
          cheers: ["🔥", "💪"],
        },
      },
      {
        slot: "mind",
        title: "Finish the CS 161 problem set",
        points: 45,
        proof: {
          at: [4, "22:10"],
          photo: "desk",
          confidence: 0.9,
          highlight: 6,
          reason: "Handwritten solutions beside an open laptop, matches a finished problem set.",
          caption: "Problem set, done.",
          cheers: ["👏"],
        },
      },
      {
        slot: "recharge",
        title: "Read for 30 minutes",
        points: 20,
        proof: {
          at: [5, "21:30"],
          photo: "book",
          confidence: 0.92,
          highlight: 5,
          reason: "Open paperback and a cup of tea on the couch, matches reading time.",
          caption: "Thirty quiet pages.",
        },
      },
      {
        slot: "chores",
        title: "Do the laundry",
        points: 25,
        proof: {
          at: [1, "11:05"],
          photo: "laundry",
          confidence: 0.95,
          highlight: 4,
          reason: "A folded stack beside an empty basket, the laundry is done.",
          caption: "Folded. All of it.",
        },
      },
      {
        slot: "people",
        title: "Dinner with friends",
        points: 30,
        proof: {
          at: [2, "19:48"],
          photo: "dinner",
          confidence: 0.97,
          highlight: 9,
          reason: "Three friends at a restaurant table with plates of pasta, matches dinner with friends.",
          caption: "Pasta night with the crew.",
          cheers: ["🔥", "😂", "👏"],
        },
      },
      {
        slot: "flex",
        title: "Sunset walk",
        points: 15,
        source: "flex",
        proof: {
          at: [3, "17:40"],
          photo: "walk",
          confidence: 0.91,
          highlight: 8,
          reason: "A park path at sunset with the skyline behind, matches a sunset walk.",
          caption: "Golden hour at the park.",
          cheers: ["🔥"],
        },
      },
    ],
  },
  {
    name: "Priya Shah",
    phone: "+14155550102",
    tasks: [
      {
        slot: "body",
        title: "Morning run at Dolores Park",
        points: 35,
        place: { name: "Dolores Park", lat: 37.7596, lng: -122.4269 },
        proof: {
          at: [4, "07:20"],
          photo: "run",
          confidence: 0.93,
          highlight: 7,
          reason: "Running shoes on a park trail and a watch mid-run, checked in at Dolores Park.",
          caption: "Up before the sun.",
          cheers: ["💪"],
        },
      },
      {
        slot: "mind",
        title: "Draft the pitch deck",
        points: 40,
        proof: {
          at: [2, "15:05"],
          photo: "slides",
          confidence: 0.88,
          highlight: 6,
          reason: "A pitch deck open in a slide editor beside planning notes, matches drafting the deck.",
          caption: "Slide four still needs work.",
        },
      },
      { slot: "recharge", title: "Read for 30 minutes", points: 20 },
      { slot: "chores", title: "Do the laundry", points: 25 },
      {
        slot: "people",
        title: "Coffee with a friend",
        points: 25,
        proof: {
          at: [1, "10:40"],
          photo: "coffee",
          confidence: 0.96,
          highlight: 8,
          reason: "Two lattes and a friend across the table, matches coffee with a friend.",
          caption: "Caught up over lattes.",
          cheers: ["👏", "😂"],
        },
      },
    ],
  },
  {
    name: "Jordan Lee",
    phone: "+14155550103",
    tasks: [
      {
        slot: "body",
        title: "Pickup basketball",
        points: 30,
        proof: {
          at: [3, "18:30"],
          photo: "basketball",
          // Between 0.6 and 0.75 the feed flags a proof as a close call.
          confidence: 0.68,
          highlight: 4,
          reason: "A court, a hoop and a ball, but no game in the frame. Close call.",
          caption: "Everyone had left by the time I took the photo.",
        },
      },
      { slot: "mind", title: "Study for the stats midterm", points: 45 },
      { slot: "recharge", title: "Phone-free evening", points: 20 },
      {
        slot: "chores",
        title: "Deep clean the kitchen",
        points: 30,
        proof: {
          at: [1, "12:15"],
          photo: "kitchen",
          confidence: 0.93,
          highlight: 5,
          reason: "Empty sink, wiped counters and dishes drying, the kitchen is clean.",
          caption: "You could eat off this counter.",
          cheers: ["👏"],
        },
      },
      { slot: "people", title: "Dinner with roommates", points: 25 },
    ],
  },
  {
    name: "Leo Martinez",
    phone: "+14155550104",
    tasks: [
      {
        slot: "body",
        title: "Gym session",
        points: 35,
        proof: {
          at: [1, "20:10"],
          photo: "couch",
          pass: false,
          confidence: 0.12,
          highlight: 2,
          reason: "A couch, a TV and a bag of crisps. No gym in sight.",
          caption: "Rest day, apparently.",
        },
      },
      { slot: "mind", title: "Finish the lab report", points: 40 },
      { slot: "recharge", title: "Go for a long walk", points: 20 },
      { slot: "chores", title: "Do the laundry", points: 25 },
      { slot: "people", title: "Call grandma", points: 20 },
    ],
  },
  {
    name: "Ava Kim",
    phone: "+14155550105",
    tasks: [
      {
        slot: "body",
        title: "Yoga class",
        points: 30,
        proof: {
          at: [2, "18:00"],
          photo: "yoga",
          confidence: 0.95,
          highlight: 6,
          reason: "A studio class holding warrior pose with a mat in the foreground, matches a yoga class.",
          caption: "Warrior two, held for ever.",
          cheers: ["🔥"],
        },
      },
      { slot: "mind", title: "Read two papers", points: 35 },
      { slot: "recharge", title: "Long bath and a podcast", points: 15 },
      { slot: "chores", title: "Deep clean the bathroom", points: 30 },
      { slot: "people", title: "Call my sister", points: 20 },
      { slot: "flex", title: "Meal prep for the week", points: 15, source: "flex" },
    ],
  },
  {
    name: "Sam Patel",
    phone: "+14155550106",
    tasks: [
      {
        slot: "body",
        title: "Bike to work",
        points: 30,
        proof: {
          at: [5, "08:10"],
          photo: "bike",
          confidence: 0.9,
          highlight: 6,
          reason: "Handlebars on a city bike lane in morning traffic, matches a bike commute.",
          caption: "Beat the bus again.",
        },
      },
      {
        slot: "mind",
        title: "Ship the onboarding PR",
        points: 40,
        proof: {
          at: [3, "16:20"],
          photo: "merged",
          confidence: 0.92,
          highlight: 7,
          reason: "A pull request page showing Merged on the monitor, matches shipping the PR.",
          caption: "Merged before dinner.",
          cheers: ["🔥", "👏"],
        },
      },
      {
        slot: "recharge",
        title: "Journal for ten minutes",
        points: 15,
        proof: {
          at: [1, "21:40"],
          photo: "journal",
          confidence: 0.9,
          highlight: 5,
          reason: "An open journal with a full page of handwriting by candlelight, matches journaling.",
          caption: "Brain, emptied.",
        },
      },
      {
        slot: "chores",
        title: "Clean my room",
        points: 25,
        proof: {
          at: [0, "10:30"],
          photo: "room",
          confidence: 0.95,
          highlight: 5,
          reason: "Bed made, floor clear and a vacuum in the corner, the room is clean.",
          caption: "You can see the floor again.",
          cheers: ["👏"],
        },
      },
      // Left open so the second phone, switched to Sam, can finish a sweep live.
      { slot: "people", title: "Call mom", points: 20 },
      {
        slot: QUICK_TIME.slot,
        title: QUICK_TIME.title,
        // Bonuses are written into task.points when earned, as drops.ts does.
        points: quickTimeScore(QUICK_TIME.points, true),
        source: "drop",
        proof: {
          at: [1, "14:12"],
          photo: "pushups",
          confidence: 0.91,
          highlight: 9,
          reason: "Mid push-up with three fingers raised, matches the drop and its gesture.",
          caption: "First in. Three fingers up.",
          via: "keiki",
          cheers: ["💪", "🔥", "😂"],
        },
      },
    ],
  },
];

/**
 * The instant a `When` names, kept inside the current week and in the past. A reset early in
 * the week therefore squeezes the days together instead of dating a proof before the week
 * started or after now.
 */
function momentAt(now: number, [daysAgo, clock]: When): number {
  const [hours, minutes] = clock.split(":").map(Number);
  const moment = startOfPacificDay(pacificDay(now) - daysAgo) + hours * HOUR_MS + minutes * MINUTE_MS;
  return Math.max(weekStartOf(now), Math.min(moment, now - MINUTE_MS));
}

/**
 * The seed photos already in file storage, found by content hash. Photos are never deleted on
 * reset, so after the first upload every later reset reuses the same files.
 */
async function storedPhotos(ctx: QueryCtx): Promise<Partial<Record<SeedPhotoKey, Id<"_storage">>>> {
  const keyBySha256 = new Map(PHOTO_KEYS.map((key) => [SEED_PHOTOS[key].sha256, key]));
  const stored: Partial<Record<SeedPhotoKey, Id<"_storage">>> = {};
  for await (const file of ctx.db.system.query("_storage")) {
    const key = keyBySha256.get(file.sha256);
    if (key !== undefined) stored[key] = file._id;
  }
  return stored;
}

/** A seeded player's row, found by a phone number only seed rows hold (users.createUser refuses them). */
async function seededPlayer(ctx: QueryCtx, phone: string): Promise<Doc<"users"> | null> {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .take(5);
  return rows.find((row) => row.isSeed) ?? null;
}

async function upsertPlayers(ctx: MutationCtx, now: number): Promise<Id<"users">[]> {
  const ids: Id<"users">[] = [];
  for (const player of PLAYERS) {
    const existing = await seededPlayer(ctx, player.phone);
    if (existing !== null) {
      await ctx.db.patch("users", existing._id, { name: player.name });
      ids.push(existing._id);
    } else {
      ids.push(await ctx.db.insert("users", { name: player.name, phone: player.phone, isSeed: true, createdAt: now }));
    }
  }
  return ids;
}

async function upsertLeague(ctx: MutationCtx, createdBy: Id<"users">): Promise<Id<"leagues">> {
  const existing = await ctx.db
    .query("leagues")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", LEAGUE.inviteCode))
    .first();
  if (existing === null) {
    return await ctx.db.insert("leagues", { ...LEAGUE, createdBy });
  }
  // A patch, so what the integrations attached to the league (its Whop company, its Keiki
  // conversation) survives the reset.
  await ctx.db.patch("leagues", existing._id, { ...LEAGUE, createdBy });
  return existing._id;
}

async function deleteChallenge(ctx: MutationCtx, challengeId: Id<"challenges">): Promise<void> {
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .take(SWEEP_LIMIT);
  for (const vote of votes) await ctx.db.delete("votes", vote._id);
  await ctx.db.delete("challenges", challengeId);
}

async function deleteProof(ctx: MutationCtx, proofId: Id<"proofs">): Promise<void> {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_proof", (q) => q.eq("proofId", proofId))
    .take(SWEEP_LIMIT);
  for (const reaction of reactions) await ctx.db.delete("reactions", reaction._id);

  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_proof", (q) => q.eq("proofId", proofId))
    .take(SWEEP_LIMIT);
  for (const challenge of challenges) await deleteChallenge(ctx, challenge._id);
  await ctx.db.delete("proofs", proofId);
}

async function deleteTask(ctx: MutationCtx, taskId: Id<"tasks">): Promise<void> {
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .take(SWEEP_LIMIT);
  for (const proof of proofs) await deleteProof(ctx, proof._id);
  await ctx.db.delete("tasks", taskId);
}

/**
 * Removes everything that belongs to the league itself: its weeks and matchups, its ledger, its
 * challenges, its drops and its memberships. Anyone who joined since the last reset is out
 * again; their own lineup stays theirs, since tasks belong to the player and not to a league.
 */
async function clearLeague(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  // Challenges on a seeded player's proof go with that proof. These are the rest: opened in this
  // league on a guest's proof, they would keep paying or costing their challenger after the
  // reset. An open one is holding the guest's task, so the task gets its points back.
  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(SWEEP_LIMIT);
  for (const challenge of challenges) {
    const proof = await ctx.db.get("proofs", challenge.proofId);
    const task = proof && (await ctx.db.get("tasks", proof.taskId));
    if (challenge.status === "open" && task?.status === "held") {
      await ctx.db.patch("tasks", task._id, { status: "verified" });
    }
    await deleteChallenge(ctx, challenge._id);
  }

  const weeks = await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(SWEEP_LIMIT);
  for (const week of weeks) {
    const matchups = await ctx.db
      .query("matchups")
      .withIndex("by_week", (q) => q.eq("weekId", week._id))
      .take(SWEEP_LIMIT);
    for (const matchup of matchups) await ctx.db.delete("matchups", matchup._id);
    await ctx.db.delete("weeks", week._id);
  }

  const ledger = await ctx.db
    .query("ledger")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(SWEEP_LIMIT);
  for (const row of ledger) await ctx.db.delete("ledger", row._id);

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(SWEEP_LIMIT);
  for (const membership of memberships) await ctx.db.delete("memberships", membership._id);

  const drops = await ctx.db
    .query("drops")
    .withIndex("by_league_status", (q) => q.eq("leagueId", leagueId))
    .take(SWEEP_LIMIT);
  for (const drop of drops) {
    const rsvps = await ctx.db
      .query("rsvps")
      .withIndex("by_drop", (q) => q.eq("dropId", drop._id))
      .take(SWEEP_LIMIT);
    for (const rsvp of rsvps) await ctx.db.delete("rsvps", rsvp._id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_drop", (q) => q.eq("dropId", drop._id))
      .take(SWEEP_LIMIT);
    for (const task of tasks) await deleteTask(ctx, task._id);
    await ctx.db.delete("drops", drop._id);
  }
}

/** Removes a seeded player's lineups, tasks and proofs, for every week. */
async function clearPlayer(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const lineups = await ctx.db
    .query("lineups")
    .withIndex("by_user_week", (q) => q.eq("userId", userId))
    .take(SWEEP_LIMIT);
  for (const lineup of lineups) await ctx.db.delete("lineups", lineup._id);

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) => q.eq("userId", userId))
    .take(SWEEP_LIMIT);
  for (const task of tasks) await deleteTask(ctx, task._id);
}

/** Rebuilds the league. Reports whether any photo is not in file storage yet. */
async function restoreSeed(ctx: MutationCtx): Promise<{ photosMissing: boolean }> {
  const now = Date.now();
  const weekStart = weekStartOf(now);
  const photos = await storedPhotos(ctx);

  const playerIds = await upsertPlayers(ctx, now);
  const leagueId = await upsertLeague(ctx, playerIds[0]);
  await clearLeague(ctx, leagueId);
  for (const playerId of playerIds) await clearPlayer(ctx, playerId);
  // Maya is connected to the demo Canvas school, so a Canvas proof can be shown without a token.
  await ctx.runMutation(internal.canvas.seedDemoConnection, { userId: playerIds[0] });

  // The schedule seats members in the order they joined and moves all but the first up one seat
  // a week. Joining in this order puts the six back in PLAYERS order in the current week, so its
  // round of the rotation is the pairing PLAYERS was written for.
  const [host, ...others] = playerIds;
  const turns = (CURRENT_WEEK - 1) % others.length;
  const joinOrder = [host, ...others.slice(-turns), ...others.slice(0, -turns)];
  const pairingsIn = (week: number) => scheduleFor(LEAGUE.format, joinOrder, week, [], LEAGUE.seasonWeeks);

  // A finished week is its matchups with the final scores on them, and nothing else: no lineups
  // are kept and no stake was paid into it. It is left unsettled for that reason, which also
  // keeps Wrapped (a recap of the latest settled week) on the week in play.
  for (const [index, points] of EARLIER_WEEKS.entries()) {
    const number = index + 1;
    const startsAt = startOfPacificDay(pacificDay(weekStart) - 7 * (CURRENT_WEEK - number));
    const earlierWeekId = await ctx.db.insert("weeks", {
      leagueId,
      number,
      startsAt,
      endsAt: weekEndOf(startsAt),
      status: "open",
    });
    for (const { a, b } of pairingsIn(number)) {
      await ctx.db.insert("matchups", {
        weekId: earlierWeekId,
        userA: a,
        userB: b,
        scoreA: points[playerIds.indexOf(a)],
        scoreB: points[playerIds.indexOf(b)],
      });
    }
  }

  // Inserted last: the league's current week is its newest weeks row.
  const weekId = await ctx.db.insert("weeks", {
    leagueId,
    number: CURRENT_WEEK,
    startsAt: weekStart,
    endsAt: weekEndOf(weekStart),
    status: "open",
  });
  for (const { a, b } of pairingsIn(CURRENT_WEEK)) {
    await ctx.db.insert("matchups", { weekId, userA: a, userB: b });
  }

  // All six have paid. Settlement pays out only members whose buy_in row is in the week's
  // ledger, so each membership comes with one. No Whop ids: these stakes never touched Whop.
  for (const userId of joinOrder) {
    await ctx.db.insert("memberships", { leagueId, userId, paid: true, joinedAt: weekStart });
    await ctx.db.insert("ledger", {
      leagueId,
      weekId,
      userId,
      kind: "buy_in",
      amountUsd: LEAGUE.stakeUsd,
      idempotencyKey: `seed:${weekId}:${userId}`,
      createdAt: weekStart,
    });
  }

  const dropId = await ctx.db.insert("drops", {
    leagueId,
    kind: "quicktime",
    title: QUICK_TIME.title,
    slot: QUICK_TIME.slot,
    points: QUICK_TIME.points,
    gesture: QUICK_TIME.gesture,
    sealed: false,
    opensAt: momentAt(now, QUICK_TIME.opened),
    closesAt: momentAt(now, QUICK_TIME.closed),
    status: "closed",
  });

  for (const [index, player] of PLAYERS.entries()) {
    const userId = playerIds[index];
    // Drafted on the Sunday evening before the week began.
    await ctx.db.insert("lineups", { userId, weekStart, lockedAt: weekStart - 3 * HOUR_MS });

    for (const task of player.tasks) {
      const proof = task.proof;
      const taskId = await ctx.db.insert("tasks", {
        userId,
        weekStart,
        slot: task.slot,
        title: task.title,
        points: task.points,
        proofType: task.place ? "photo_location" : "photo",
        ...(task.place && { place: task.place }),
        status: proof && proof.pass !== false ? "verified" : "open",
        source: task.source ?? "draft",
        ...(task.source === "drop" && { dropId }),
      });
      if (!proof) continue;

      const storageId = photos[proof.photo];
      const proofId = await ctx.db.insert("proofs", {
        taskId,
        userId,
        weekStart,
        ...(storageId && { storageId }),
        mediaType: "photo",
        ...(task.place && { lat: task.place.lat, lng: task.place.lng }),
        pass: proof.pass !== false,
        confidence: proof.confidence,
        reason: proof.reason,
        highlight: proof.highlight,
        caption: proof.caption,
        via: proof.via ?? "app",
        createdAt: momentAt(now, proof.at),
      });
      for (const [offset, emoji] of (proof.cheers ?? []).entries()) {
        const fan = playerIds[(index + 1 + offset) % playerIds.length];
        await ctx.db.insert("reactions", { proofId, userId: fan, emoji });
      }
    }
  }

  // The leaderboards keep stored rows per player and week; rebuild them for the fresh league.
  await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId });

  return { photosMissing: PHOTO_KEYS.some((key) => photos[key] === undefined) };
}

/**
 * Restores the demo league. It needs no signed-in caller, so it also runs from
 * `npx convex run seed:reset`.
 *
 * A mutation can't write to file storage. On a deployment that doesn't hold the photos yet, the
 * league is rebuilt at once without them and an action uploads them and rebuilds it again a
 * moment later; every reset after that finds them and is a single transaction.
 */
export const reset = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { photosMissing } = await restoreSeed(ctx);
    if (photosMissing) {
      await ctx.scheduler.runAfter(0, internal.seed.uploadMissingPhotos, {});
    }
    return null;
  },
});

/** The rebuild alone, for uploadMissingPhotos. It never schedules another upload, so a failed one can't loop. */
export const restore = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await restoreSeed(ctx);
    return null;
  },
});

export const storedPhotoKeys = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => Object.keys(await storedPhotos(ctx)),
});

export const uploadMissingPhotos = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const stored: string[] = await ctx.runQuery(internal.seed.storedPhotoKeys, {});
    for (const key of PHOTO_KEYS) {
      if (stored.includes(key)) continue;
      const bytes = Uint8Array.from(atob(SEED_PHOTOS[key].jpegBase64), (char) => char.charCodeAt(0));
      await ctx.storage.store(new Blob([bytes], { type: "image/jpeg" }));
    }
    await ctx.runMutation(internal.seed.restore, {});
    return null;
  },
});

/** The seeded players Switch Player can choose from, in seed order. Empty before the first reset. */
export const players = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("users"), name: v.string() })),
  handler: async (ctx) => {
    const rows: { _id: Id<"users">; name: string }[] = [];
    for (const player of PLAYERS) {
      const row = await seededPlayer(ctx, player.phone);
      if (row !== null) rows.push({ _id: row._id, name: row.name ?? player.name });
    }
    return rows;
  },
});

/**
 * Switch Player: from now on this device plays as the given seeded player, or as itself again
 * when passed null. requireUser reads the switch on every call.
 */
export const actAs = mutation({
  args: { userId: v.union(v.id("users"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The switch lives on the device's own row, so it must not be resolved through the switch.
    const signedIn = await requireSignedInUser(ctx);
    if (args.userId === null) {
      await ctx.db.patch("users", signedIn._id, { demoActAs: undefined });
      return null;
    }
    const target = await ctx.db.get("users", args.userId);
    if (!target?.isSeed) {
      throw new ConvexError("Switch Player only works with a seeded player");
    }
    await ctx.db.patch("users", signedIn._id, { demoActAs: target._id });
    return null;
  },
});
