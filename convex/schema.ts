import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// This schema is the contract between the app, core backend and integrations
// workstreams. Add fields as optional and never rename an index: other threads
// query them by name.
//
// A player drafts ONE lineup per calendar week and it scores in every league
// they belong to, so lineups, tasks and proofs are keyed by (userId, weekStart)
// and not by league. weekStart is the epoch milliseconds of that week's Monday
// 00:00 in America/Los_Angeles, and a league's weeks row for the same week has
// startsAt equal to it. A task that carries a dropId scores only in that drop's
// league.

export const slot = v.union(
  v.literal("body"),
  v.literal("mind"),
  v.literal("recharge"),
  v.literal("chores"),
  v.literal("people"),
  v.literal("flex"),
);

export const place = v.object({
  name: v.string(),
  lat: v.number(),
  lng: v.number(),
});

// League settings the creator picks. They are optional on leagues so a league
// created without them keeps the original behaviour (weekly payout, 8 weeks,
// round robin); read them through resolveSettings in lib/schedule.ts, never
// straight off the row.
export const payout = v.union(v.literal("weekly"), v.literal("season"));

export const leagueFormat = v.union(
  v.literal("round_robin"),
  v.literal("double_round_robin"),
  v.literal("bracket"),
);

// What a leaderboard ranks by. One shape serves a week row and the all-time
// row of the scores table; in the all-time row the numbers are totals and
// streak is the longest ever.
export const scoreStats = v.object({
  points: v.number(),
  slotsCleared: v.number(),
  streak: v.number(),
  tasksVerified: v.number(),
  slotPoints: v.object({
    body: v.number(),
    mind: v.number(),
    recharge: v.number(),
    chores: v.number(),
    people: v.number(),
  }),
  bestHighlight: v.number(), // 0 until a proof passes
  bestProofId: v.optional(v.id("proofs")),
  fastestQuickTimeSec: v.optional(v.number()),
});

export default defineSchema({
  ...authTables,

  // Convex Auth creates this row on the first anonymous sign-in, which is why
  // every Lineup field is optional. The first block is what Convex Auth reads
  // and writes; the second is ours.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()), // E.164; how Keiki texts are matched to a player
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    avatarStorageId: v.optional(v.id("_storage")),
    whopUserId: v.optional(v.string()),
    isSeed: v.optional(v.boolean()),
    // Demo control "Switch Player": requireUser resolves this device to the
    // seeded player named here.
    demoActAs: v.optional(v.id("users")),
    createdAt: v.optional(v.number()),
  })
    .index("email", ["email"]) // looked up by Convex Auth under this exact name
    .index("by_phone", ["phone"]),

  leagues: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    stakeUsd: v.number(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    maxMembers: v.number(),
    keikiConversationId: v.optional(v.string()),
    whopCompanyId: v.optional(v.string()),
    createdBy: v.id("users"),
    payout: v.optional(payout), // "season" holds every stake until the last week
    seasonWeeks: v.optional(v.number()),
    format: v.optional(leagueFormat),
    // Who led the standings when a text last went out, so "took the lead" is
    // sent once per change of leader and not on every proof.
    leaderId: v.optional(v.id("users")),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_visibility_stake", ["visibility", "stakeUsd"]),

  memberships: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    paid: v.boolean(),
    whopPaymentId: v.optional(v.string()),
    whopAccountId: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_league", ["leagueId"])
    .index("by_user", ["userId"])
    .index("by_league_user", ["leagueId", "userId"]),

  weeks: defineTable({
    leagueId: v.id("leagues"),
    number: v.number(),
    startsAt: v.number(), // equals weekStart for the same calendar week
    endsAt: v.number(),
    status: v.union(v.literal("open"), v.literal("settled")),
  }).index("by_league", ["leagueId"]),

  matchups: defineTable({
    weekId: v.id("weeks"),
    userA: v.id("users"),
    userB: v.id("users"),
    // Each side's final points, frozen once the week is over so the season
    // schedule does not rescore old weeks. Absent while the week is live;
    // seasons.ts scores the week itself when they are missing.
    scoreA: v.optional(v.number()),
    scoreB: v.optional(v.number()),
  }).index("by_week", ["weekId"]),

  lineups: defineTable({
    userId: v.id("users"),
    weekStart: v.number(),
    transcript: v.optional(v.string()),
    lockedAt: v.optional(v.number()),
  }).index("by_user_week", ["userId", "weekStart"]),

  tasks: defineTable({
    userId: v.id("users"),
    weekStart: v.number(),
    slot,
    title: v.string(),
    points: v.number(),
    proofType: v.union(
      v.literal("photo"),
      v.literal("photo_location"),
      v.literal("canvas"),
    ),
    place: v.optional(place),
    // Canvas ids are stored as strings: they are opaque to us and only ever
    // go back into Canvas URLs.
    canvas: v.optional(
      v.object({ courseId: v.string(), assignmentId: v.string() }),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("verified"),
      v.literal("held"),
      v.literal("failed"),
    ),
    source: v.union(
      v.literal("draft"),
      v.literal("flex"),
      v.literal("drop"),
      v.literal("mystery"),
      v.literal("group"),
    ),
    dropId: v.optional(v.id("drops")),
  })
    .index("by_user_week", ["userId", "weekStart"])
    .index("by_drop", ["dropId"]),

  proofs: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    weekStart: v.number(),
    storageId: v.optional(v.id("_storage")),
    mediaType: v.union(
      v.literal("photo"),
      v.literal("video"),
      v.literal("canvas"),
    ),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    // The AI verdict, stored as returned.
    pass: v.boolean(),
    confidence: v.number(), // 0 to 1
    reason: v.string(),
    highlight: v.number(), // 1 to 10: how feed-worthy the proof is
    caption: v.string(),
    via: v.union(v.literal("app"), v.literal("keiki"), v.literal("canvas")),
    createdAt: v.number(),
  })
    .index("by_user_week", ["userId", "weekStart"])
    .index("by_task", ["taskId"]),

  reactions: defineTable({
    proofId: v.id("proofs"),
    userId: v.id("users"),
    emoji: v.string(),
  }).index("by_proof", ["proofId"]),

  challenges: defineTable({
    proofId: v.id("proofs"),
    leagueId: v.id("leagues"),
    challengerId: v.id("users"),
    status: v.union(
      v.literal("open"),
      v.literal("upheld"),
      v.literal("overturned"),
    ),
    closesAt: v.number(),
  })
    .index("by_proof", ["proofId"])
    .index("by_status", ["status"])
    // closesAt follows leagueId so standings can read the challenges decided
    // in one week without scanning the league's whole history.
    .index("by_league", ["leagueId", "closesAt"]),

  votes: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    legit: v.boolean(),
  }).index("by_challenge", ["challengeId"]),

  drops: defineTable({
    leagueId: v.id("leagues"),
    kind: v.union(
      v.literal("quicktime"),
      v.literal("mystery"),
      v.literal("group"),
    ),
    userId: v.optional(v.id("users")),
    createdBy: v.optional(v.id("users")),
    title: v.string(),
    slot,
    points: v.number(),
    gesture: v.optional(v.string()),
    sealed: v.boolean(),
    wager: v.optional(v.number()),
    place: v.optional(place),
    // Group sessions only: the most people the model counted in one check-in
    // photo, and that photo. Attendees beyond the headcount earn no bonus.
    headcount: v.optional(v.number()),
    groupPhotoId: v.optional(v.id("_storage")),
    opensAt: v.number(),
    closesAt: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("open"),
      v.literal("closed"),
    ),
  }).index("by_league_status", ["leagueId", "status"]),

  rsvps: defineTable({
    dropId: v.id("drops"),
    userId: v.id("users"),
    checkedIn: v.boolean(),
  }).index("by_drop", ["dropId"]),

  // Holds a player's Canvas access token. Never return a row of this table,
  // or any field of it, to a client.
  canvasConnections: defineTable({
    userId: v.id("users"),
    baseUrl: v.string(),
    token: v.string(),
  }).index("by_user", ["userId"]),

  ledger: defineTable({
    leagueId: v.id("leagues"),
    weekId: v.id("weeks"),
    userId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("buy_in"),
      v.literal("refund"),
      v.literal("winnings"),
      v.literal("fee"),
    ),
    amountUsd: v.number(),
    whopId: v.optional(v.string()),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_league", ["leagueId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  // Leaderboards (convex/leaderboards.ts). A denormalised copy of one player's
  // week in one league, so a board is a single index range read instead of a
  // recompute over tasks and proofs. Standings stay computed live; this table
  // is written only by leaderboards.refresh, which rebuilds a row from tasks
  // and proofs and can be re-run at any time. weekStart 0 is the player's
  // all-time total in that league.
  scores: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    weekStart: v.number(),
    points: v.number(), // copy of now.points: the cross-league ranking index needs a top-level field
    now: scoreStats,
    // The same stats as they stood when `day` began. "Movement since yesterday"
    // ranks a board by these and compares.
    yesterday: scoreStats,
    day: v.number(), // epoch ms of the Los Angeles midnight before the last refresh
    // Day numbers (0 = this week's Monday) with a verified proof, so streaks
    // can be joined across weeks without re-reading proofs.
    activeDays: v.array(v.number()),
  })
    .index("by_league_week_user", ["leagueId", "weekStart", "userId"])
    .index("by_user_week", ["userId", "weekStart"])
    .index("by_week_points", ["weekStart", "points"]),
});
