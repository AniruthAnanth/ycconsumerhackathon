/**
 * Drops: bonus tasks that appear during a week, on top of the drafted lineup.
 *
 * A drop is one row in `drops`. A player takes part through an ordinary row in `tasks` that
 * carries the dropId, so proofs, the feed and standings treat it like any other task. This
 * module only decides when those tasks exist and what they are worth.
 *
 *   scheduled ──openDrop──▶ open ──closeDrop──▶ closed
 *
 * Both transitions are scheduled functions (ctx.scheduler), so a drop opens and closes on time
 * with no client involved, and no query has to read the clock to know whether a drop is live.
 *
 * Points live on the task row: standings sum tasks.points, so a bonus is written there the
 * moment it is earned and is never added again at read time. The numbers and the wording of
 * every text are in lib/dropRules.ts.
 */
import { makeFunctionReference } from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";
import {
  clampMysteryPoints,
  clampWager,
  firstFinisher,
  MYSTERY_WINDOW_MS,
  mysteryLossPoints,
  mysteryText,
  mysteryWinPoints,
  pickFallbackMystery,
  pickQuickTime,
  QUICK_TIME_WINDOW_MS,
  quickTimePoints,
  quickTimeText,
} from "./lib/dropRules";
import { place, slot } from "./schema";

/** leagues.maxMembers keeps every list here far below this; it only bounds the reads. */
const MAX_ROWS = 500;

/** How tasks.source names a task that came from each kind of drop. */
const TASK_SOURCE = { quicktime: "drop", mystery: "mystery", group: "group" } as const;

// ─── Roster banner ───────────────────────────────────────────────────────────────────────────

const activeDrop = v.object({
  dropId: v.id("drops"),
  kind: v.union(v.literal("quicktime"), v.literal("mystery"), v.literal("group")),
  title: v.string(),
  slot,
  points: v.number(),
  gesture: v.optional(v.string()),
  sealed: v.boolean(),
  wager: v.optional(v.number()),
  place: v.optional(place),
  opensAt: v.number(),
  closesAt: v.number(),
  taskId: v.optional(v.id("tasks")),
  attendees: v.optional(
    v.array(v.object({ userId: v.id("users"), name: v.string(), checkedIn: v.boolean() })),
  ),
});

type ActiveDrop = Infer<typeof activeDrop>;

/** The drops the caller can act on in this league right now, soonest to close first. */
export const active = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(activeDrop),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    if ((await membership(ctx, leagueId, me._id)) === null) return [];

    const banners: ActiveDrop[] = [];
    for (const drop of await dropsIn(ctx, leagueId, "open")) {
      const banner = await bannerFor(ctx, drop, me._id);
      if (banner !== null) banners.push(banner);
    }
    return banners.sort((a, b) => a.closesAt - b.closesAt);
  },
});

/** What a sealed envelope is called: its real title stays hidden until it is opened. */
const SEALED_TITLE = "Mystery task";

/** One drop as one player sees it, or null when there is nothing in it for them to do. */
async function bannerFor(ctx: QueryCtx, drop: Doc<"drops">, me: Id<"users">): Promise<ActiveDrop | null> {
  const banner = {
    dropId: drop._id,
    kind: drop.kind,
    title: drop.title,
    slot: drop.slot,
    points: drop.points,
    gesture: drop.gesture,
    sealed: drop.sealed,
    wager: drop.wager,
    place: drop.place,
    opensAt: drop.opensAt,
    closesAt: drop.closesAt,
  };
  if (drop.kind === "mystery") {
    if (drop.userId !== me) return null;
    // Sealed, an envelope shows its slot and what it pays, and nothing about the task.
    if (drop.sealed) return { ...banner, title: SEALED_TITLE, points: mysteryWinPoints(drop.points, 0) };
  }
  const myTask = (await tasksOf(ctx, drop._id)).find((task) => task.userId === me);
  // A banner asks for one action. Once my task is verified, or I never had one because I
  // joined after the drop opened, there is nothing left for me to do.
  if (myTask?.status !== "open") return null;
  // The task's points, not the drop's: an opened envelope is worth double plus the wager.
  return { ...banner, points: myTask.points, taskId: myTask._id };
}

// ─── Quick-time drops ────────────────────────────────────────────────────────────────────────

/** Demo control: starts a quick-time drop for the league now. */
export const triggerQuickTime = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.id("drops"),
  handler: async (ctx, { leagueId }) => {
    const me = await requireUser(ctx);
    if ((await membership(ctx, leagueId, me._id)) === null) {
      throw new ConvexError("Only a member of the league can start a drop");
    }
    // One live quick-time drop per league: a texted photo has to mean exactly one drop, and
    // pressing the demo button twice must not stack banners.
    for (const drop of await dropsIn(ctx, leagueId, "open")) {
      if (drop.kind === "quicktime") await close(ctx, drop);
    }

    const now = Date.now();
    const idea = pickQuickTime();
    const dropId = await ctx.db.insert("drops", {
      leagueId,
      kind: "quicktime",
      createdBy: me._id,
      title: idea.title,
      slot: idea.slot,
      points: idea.points,
      gesture: idea.gesture,
      sealed: false,
      opensAt: now,
      closesAt: now + QUICK_TIME_WINDOW_MS,
      status: "scheduled",
    });
    await ctx.scheduler.runAt(now, internal.drops.openDrop, { dropId });
    await ctx.scheduler.runAt(now + QUICK_TIME_WINDOW_MS, internal.drops.closeDrop, { dropId });
    return dropId;
  },
});

// ─── Mystery task ────────────────────────────────────────────────────────────────────────────
//
// Each morning every player gets one sealed envelope in each of their leagues. Opening it
// (optionally with a wager) creates the task at double points. Passing costs nothing. Opening
// it and not finishing before it closes costs 20 points and the wager.

/** Cron target (crons.ts): starts an envelope for every member of every league. */
export const dailyMystery = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const league of await ctx.db.query("leagues").take(MAX_ROWS)) {
      const open = await dropsIn(ctx, league._id, "open");
      for (const member of await membersOf(ctx, league._id)) {
        // Running the job twice in a day must not hand anyone a second envelope.
        const hasEnvelope = open.some((drop) => drop.kind === "mystery" && drop.userId === member.userId);
        if (hasEnvelope) continue;
        await ctx.scheduler.runAfter(0, internal.drops.writeMystery, {
          leagueId: league._id,
          userId: member.userId,
        });
      }
    }
    return null;
  },
});

/** Chooses one player's mystery task, then seals it. An action because choosing calls out. */
export const writeMystery = internalAction({
  args: { leagueId: v.id("leagues"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { leagueId, userId }) => {
    const idea = pickFallbackMystery();
    await ctx.runMutation(internal.drops.sealMystery, { leagueId, userId, ...idea });
    return null;
  },
});

/** Stores the envelope, sealed and already open for the day, and texts the player. */
export const sealMystery = internalMutation({
  args: { leagueId: v.id("leagues"), userId: v.id("users"), title: v.string(), slot, points: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, userId, title, slot, points }) => {
    // Checked again here because two runs of the cron can both reach this point.
    const open = await dropsIn(ctx, leagueId, "open");
    if (open.some((drop) => drop.kind === "mystery" && drop.userId === userId)) return null;

    const now = Date.now();
    const dropId = await ctx.db.insert("drops", {
      leagueId,
      kind: "mystery",
      userId,
      title,
      slot,
      points: clampMysteryPoints(points),
      sealed: true,
      opensAt: now,
      closesAt: now + MYSTERY_WINDOW_MS,
      status: "open",
    });
    await ctx.scheduler.runAt(now + MYSTERY_WINDOW_MS, internal.drops.closeDrop, { dropId });
    await sendText(ctx, { userId }, mysteryText(slot));
    return null;
  },
});

export const acceptMystery = mutation({
  args: { dropId: v.id("drops"), wager: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { dropId, wager }) => {
    const me = await requireUser(ctx);
    await openEnvelope(ctx, me._id, dropId, wager);
    return null;
  },
});

export const passMystery = mutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const me = await requireUser(ctx);
    await passEnvelope(ctx, me._id, dropId);
    return null;
  },
});

/** OPEN and "OPEN 30" by text: Keiki has matched the sender's phone to this user already. */
export const acceptMysteryFor = internalMutation({
  args: { userId: v.id("users"), dropId: v.id("drops"), wager: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { userId, dropId, wager }) => {
    await openEnvelope(ctx, userId, dropId, wager);
    return null;
  },
});

/** PASS by text. */
export const passMysteryFor = internalMutation({
  args: { userId: v.id("users"), dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { userId, dropId }) => {
    await passEnvelope(ctx, userId, dropId);
    return null;
  },
});

async function openEnvelope(
  ctx: MutationCtx,
  userId: Id<"users">,
  dropId: Id<"drops">,
  requestedWager: number | undefined,
): Promise<void> {
  const drop = await sealedEnvelope(ctx, userId, dropId);
  const weekStart = await currentWeekStart(ctx, drop.leagueId);
  // An over-sized wager is cut down rather than refused, so "OPEN 80" by text still opens.
  const wager = clampWager(requestedWager, await bankedPoints(ctx, drop.leagueId, userId, weekStart));
  await ctx.db.patch("drops", dropId, { sealed: false, wager });
  await ctx.db.insert("tasks", {
    userId,
    weekStart,
    slot: drop.slot,
    title: drop.title,
    // Priced for success now. If the envelope closes unfinished, close() turns this negative.
    points: mysteryWinPoints(drop.points, wager),
    proofType: "photo",
    status: "open",
    source: TASK_SOURCE[drop.kind],
    dropId,
  });
}

/** A passed envelope is closed still sealed: no task was ever created, so nothing is scored. */
async function passEnvelope(ctx: MutationCtx, userId: Id<"users">, dropId: Id<"drops">): Promise<void> {
  await sealedEnvelope(ctx, userId, dropId);
  await ctx.db.patch("drops", dropId, { status: "closed" });
}

async function sealedEnvelope(ctx: QueryCtx, userId: Id<"users">, dropId: Id<"drops">): Promise<Doc<"drops">> {
  const drop = await ctx.db.get("drops", dropId);
  if (drop === null || drop.kind !== "mystery" || drop.userId !== userId) {
    throw new ConvexError("That mystery task is not yours");
  }
  if (drop.status !== "open" || !drop.sealed) {
    throw new ConvexError("That mystery task was already opened, passed or has expired");
  }
  return drop;
}

/**
 * The points a player has banked in a league this week: the most they can wager, because a
 * wager is "of their own points". It counts verified tasks only, and a drop task only where
 * its drop belongs to this league.
 */
async function bankedPoints(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
  weekStart: number,
): Promise<number> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", weekStart))
    .take(MAX_ROWS);
  let banked = 0;
  for (const task of tasks) {
    if (task.status !== "verified") continue;
    if (task.dropId !== undefined && (await ctx.db.get("drops", task.dropId))?.leagueId !== leagueId) continue;
    banked += task.points;
  }
  return banked;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────────────────────

/** Scheduled for drops.opensAt: gives every member the drop's task and texts the league. */
export const openDrop = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get("drops", dropId);
    // Already open, or closed before it opened because a newer drop replaced it.
    if (drop === null || drop.status !== "scheduled") return null;
    await ctx.db.patch("drops", dropId, { status: "open" });

    const weekStart = await currentWeekStart(ctx, drop.leagueId);
    for (const member of await membersOf(ctx, drop.leagueId)) {
      await ctx.db.insert("tasks", {
        userId: member.userId,
        weekStart,
        slot: drop.slot,
        title: drop.title,
        points: drop.points,
        proofType: "photo",
        status: "open",
        source: TASK_SOURCE[drop.kind],
        dropId,
      });
    }
    await sendText(
      ctx,
      { leagueId: drop.leagueId },
      quickTimeText({
        title: drop.title,
        points: drop.points,
        gesture: drop.gesture ?? "a thumbs up",
        windowMs: drop.closesAt - drop.opensAt,
      }),
    );
    return null;
  },
});

/** Scheduled for drops.closesAt. Safe to run twice: a closed drop is left alone. */
export const closeDrop = internalMutation({
  args: { dropId: v.id("drops") },
  returns: v.null(),
  handler: async (ctx, { dropId }) => {
    const drop = await ctx.db.get("drops", dropId);
    if (drop === null || drop.status === "closed") return null;
    await close(ctx, drop);
    return null;
  },
});

/**
 * Called by proofs.verify, through the scheduler, whenever a proof passes on a task that has a
 * dropId. This is what makes a drop bonus show up in standings the instant the proof lands.
 */
export const onTaskVerified = internalMutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get("tasks", taskId);
    if (task === null || task.dropId === undefined) return null;
    const drop = await ctx.db.get("drops", task.dropId);
    if (drop !== null) await reprice(ctx, drop);
    return null;
  },
});

async function close(ctx: MutationCtx, drop: Doc<"drops">): Promise<void> {
  // Price one last time: the backstop for a verification that never reached onTaskVerified.
  await reprice(ctx, drop);
  await ctx.db.patch("drops", drop._id, { status: "closed" });
  for (const task of await tasksOf(ctx, drop._id)) {
    // Still unproven when the window shut, so it can no longer be submitted.
    if (task.status !== "open") continue;
    // A missed quick-time drop simply scores nothing. An envelope that was opened and not
    // finished costs points, and standings count the negative points of a failed task.
    const points = drop.kind === "mystery" ? mysteryLossPoints(drop.wager ?? 0) : task.points;
    await ctx.db.patch("tasks", task._id, { status: "failed", points });
  }
}

/**
 * Sets what each finished task of a drop is worth right now. It recomputes from the rows rather
 * than adding to them, so it can run on every verification and again at close without paying
 * anyone twice, and it corrects itself if a challenge later overturns the first finisher.
 */
async function reprice(ctx: MutationCtx, drop: Doc<"drops">): Promise<void> {
  // An envelope is priced once, when it is opened, and the wager is fixed from then on.
  if (drop.kind !== "quicktime") return;
  const finishers = [];
  for (const task of await tasksOf(ctx, drop._id)) {
    if (task.status !== "verified") continue;
    finishers.push({ task, verifiedAt: await verifiedAt(ctx, task._id) });
  }
  const first = firstFinisher(finishers);
  for (const { task } of finishers) {
    const points = quickTimePoints(drop.points, task._id === first?.task._id);
    if (task.points !== points) await ctx.db.patch("tasks", task._id, { points });
  }
}

/** When the proof that currently verifies a task was recorded, on the server's clock. */
async function verifiedAt(ctx: QueryCtx, taskId: Id<"tasks">): Promise<number> {
  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .take(MAX_ROWS);
  const passedAt = proofs.filter((proof) => proof.pass).map((proof) => proof.createdAt);
  // A verified task always has a passing proof; one without (hand-edited data) ranks last.
  return passedAt.length > 0 ? Math.max(...passedAt) : Number.MAX_SAFE_INTEGER;
}

// ─── Reads shared by the functions above ─────────────────────────────────────────────────────

async function dropsIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  status: Doc<"drops">["status"],
): Promise<Doc<"drops">[]> {
  return await ctx.db
    .query("drops")
    .withIndex("by_league_status", (q) => q.eq("leagueId", leagueId).eq("status", status))
    .take(MAX_ROWS);
}

async function tasksOf(ctx: QueryCtx, dropId: Id<"drops">): Promise<Doc<"tasks">[]> {
  return await ctx.db
    .query("tasks")
    .withIndex("by_drop", (q) => q.eq("dropId", dropId))
    .take(MAX_ROWS);
}

async function membersOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"memberships">[]> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_ROWS);
}

async function membership(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  userId: Id<"users">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_league_user", (q) => q.eq("leagueId", leagueId).eq("userId", userId))
    .first();
}

/**
 * Tasks are keyed by (userId, weekStart), and weekStart equals weeks.startsAt for every league,
 * so a drop's tasks take the start of the league's newest week.
 */
async function currentWeekStart(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  const weeks = await ctx.db
    .query("weeks")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .take(MAX_ROWS);
  if (weeks.length === 0) throw new ConvexError("This league has no week to play in yet");
  return Math.max(...weeks.map((week) => week.startsAt));
}

// ─── Texts ───────────────────────────────────────────────────────────────────────────────────

const recipient = {
  userId: v.optional(v.id("users")),
  leagueId: v.optional(v.id("leagues")),
};

/**
 * The one door from drops to Keiki. A text is scheduled, never awaited, so a slow or failing
 * send cannot delay or roll back the mutation that changed the drop.
 */
async function sendText(
  ctx: MutationCtx,
  to: { userId: Id<"users"> } | { leagueId: Id<"leagues"> },
  text: string,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.drops.deliverText, { ...to, text });
}

/**
 * Hands a text to keiki.send, the Keiki module's outbound action ({ userId | leagueId, text }).
 * It is looked up by name and a failure is only logged, so drops keep working on a deployment
 * where that action is missing. Once keiki.send is on main, sendText schedules it directly and
 * this action goes away.
 */
export const deliverText = internalAction({
  args: { ...recipient, text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(makeFunctionReference<"action">("keiki:send"), args);
    } catch (error) {
      console.warn(`Drop text not sent: ${args.text} (${String(error)})`);
    }
    return null;
  },
});
