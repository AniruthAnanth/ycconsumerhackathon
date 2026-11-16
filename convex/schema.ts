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

/**
 * How a task is proven. "photo" is the default: rows written before the other kinds existed
 * keep working. before_after is two photos of the same place, timelapse a series of stills
 * spread over the task's duration, screenshot an image from the phone's library, survey_video a
 * 5-second clip panning the place that shows the result.
 */
export const proofType = v.union(
  v.literal("photo"),
  v.literal("photo_location"),
  v.literal("canvas"),
  v.literal("before_after"),
  v.literal("timelapse"),
  v.literal("screenshot"),
  v.literal("survey_video"),
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
    // Playing by text is opt-in. True once this account's phone has texted
    // the league number or the player turned it on in the app; keiki.send
    // texts nobody else. Unset means they were never asked.
    keikiOptIn: v.optional(v.boolean()),
    // The Push switch in notification settings. Unset means on: iOS's own
    // permission prompt is the opt-in, so this only records a player who
    // turned pushes off afterwards.
    pushEnabled: v.optional(v.boolean()),
    // The Nudges switch in Settings: the scheduled check-in texts and pushes
    // (convex/checkins.ts). Unset means on; false stops them.
    nudgesEnabled: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
  })
    .index("email", ["email"]) // looked up by Convex Auth under this exact name
    .index("by_phone", ["phone"])
    // Which devices are acting as a player (Switch Player), so they get that player's texts.
    .index("by_demoActAs", ["demoActAs"]),

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
    // A "versus" is a 1v1 challenge: a private league of exactly two members
    // (convex/versus.ts), so standings, matchup, feed and drops work unchanged.
    // Absent means an ordinary league.
    mode: v.optional(v.union(v.literal("league"), v.literal("versus"))),
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
    proofType,
    place: v.optional(place),
    // How long a timelapse task runs; the app treats a missing value as 30.
    targetMinutes: v.optional(v.number()),
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
      v.literal("group"),
    ),
    dropId: v.optional(v.id("drops")),
    // Set when the league vetoed the task as too easy (vetoes.ts); the owner swaps it for another.
    struck: v.optional(v.boolean()),
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
    // The before photo of a before/after proof.
    beforeStorageId: v.optional(v.id("_storage")),
    // The sha256 of every image the referee saw, so a later proof can't reuse one.
    imageHashes: v.optional(v.array(v.string())),
    // Short machine tags from the referee and the anti-cheat rules, such as "reused_image".
    flags: v.optional(v.array(v.string())),
    // True while a low-confidence proof waits for the league's vote; the task is held meanwhile.
    needsVote: v.optional(v.boolean()),
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
    // The referee was unsure of the proof and sent it to the league itself; nobody challenged it,
    // so challengerId is the proof's owner and no stake moves.
    byReferee: v.optional(v.boolean()),
  })
    .index("by_proof", ["proofId"])
    .index("by_status", ["status"])
    // closesAt follows leagueId so standings can read the challenges decided
    // in one week without scanning the league's whole history.
    .index("by_league", ["leagueId", "closesAt"]),

  // One row per league member who called a locked task too easy (vetoes.ts).
  // The league group chat: one thread per league, members and Sunny. A Sunny message has no userId.
  leagueMessages: defineTable({
    leagueId: v.id("leagues"),
    userId: v.optional(v.id("users")),
    text: v.string(),
    replyToId: v.optional(v.id("leagueMessages")),
    createdAt: v.number(),
  }).index("by_league_created", ["leagueId", "createdAt"]),

  leagueMessageReactions: defineTable({
    messageId: v.id("leagueMessages"),
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_league", ["leagueId"]),

  // Per member: when they last opened the thread (the unread count), and per league whether Sunny is typing.
  leagueChatReads: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  }).index("by_league_user", ["leagueId", "userId"]),

  leagueChatSunny: defineTable({
    leagueId: v.id("leagues"),
    typing: v.boolean(),
  }).index("by_league", ["leagueId"]),

  taskVetoes: defineTable({
    taskId: v.id("tasks"),
    leagueId: v.id("leagues"),
    userId: v.id("users"),
  }).index("by_task", ["taskId"]),

  votes: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    legit: v.boolean(),
  }).index("by_challenge", ["challengeId"]),

  drops: defineTable({
    leagueId: v.id("leagues"),
    kind: v.union(v.literal("quicktime"), v.literal("group")),
    createdBy: v.optional(v.id("users")),
    title: v.string(),
    slot,
    points: v.number(),
    gesture: v.optional(v.string()),
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
      v.literal("rollover"),
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

  // Prompted check-ins (convex/checkins.ts). One row per text the module sent
  // a player: the cap of three texts a day and "this kind already went out
  // today" are both one read of a player's day.
  checkinNudges: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("evening"),
      v.literal("last_day"),
      v.literal("final_hours"),
      v.literal("pace"),
      v.literal("rival_passed"),
      v.literal("arrival"),
    ),
    day: v.string(), // the calendar day in Los Angeles, "2026-11-15"
    text: v.string(),
    sentAt: v.number(),
    // Set on an arrival text, which goes out at most once per task per day.
    taskId: v.optional(v.id("tasks")),
    // Set on a falling-behind text, which goes out at most once per rival per day.
    rivalId: v.optional(v.id("users")),
  }).index("by_user_day", ["userId", "day"]),

  // Each member's league points the last time convex/checkins.ts looked, so
  // the next proof can tell who was just passed. Standings stay computed
  // live; this is only the "before" of that before-and-after. weekStart is
  // the week those points were scored in: every week starts from zero, so a
  // mark left in an earlier week says nothing about this one.
  checkinMarks: defineTable({
    leagueId: v.id("leagues"),
    userId: v.id("users"),
    points: v.number(),
    weekStart: v.optional(v.number()),
  }).index("by_league_user", ["leagueId", "userId"]),

  // Where a player was when the app told them they had arrived at a task's
  // pinned place (convex/checkins.ts). One row per player and task, moved
  // forward on every arrival. A text carries no GPS, so this is the location
  // evidence for a photo texted from that place.
  arrivals: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    lat: v.number(),
    lng: v.number(),
    at: v.number(),
  }).index("by_user_task", ["userId", "taskId"]),

  // Turns Keiki has pushed to us that convex/keiki.ts has taken on, so a turn
  // delivered twice is answered once. A row is deleted an hour later.
  keikiTurns: defineTable({
    turnId: v.string(),
  }).index("by_turnId", ["turnId"]),

  // Expo push tokens (convex/push.ts). A token belongs to the device's own
  // account: accounts are anonymous and device-bound, so the device that
  // registered it is the one that rings. A table rather than a field on users
  // so a token that moves to a new account (the app was reinstalled) can be
  // found by index and taken off the old one.
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // Invite links and the referrals they bring in (convex/referrals.ts). One link per
  // inviter and league, so sharing again sends the same short token.
  inviteLinks: defineTable({
    token: v.string(),
    inviterId: v.id("users"),
    leagueId: v.id("leagues"),
    // Where "Open in Lineup" on the /i/<token> page points: the inviter's own app link
    // (exp:// in Expo Go, lineup:// in a build), so the friend opens the same runtime.
    appUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_inviter_league", ["inviterId", "leagueId"]),

  // One row per invited player, ever: by_invitee is what stops a second link from
  // counting the same friend twice. The reward is read from the friend's lineups,
  // so nothing here changes when they lock one.
  referrals: defineTable({
    inviterId: v.id("users"),
    inviteeId: v.id("users"),
    leagueId: v.id("leagues"),
    joinedAt: v.number(),
  })
    .index("by_invitee", ["inviteeId"])
    .index("by_inviter", ["inviterId"]),
});
