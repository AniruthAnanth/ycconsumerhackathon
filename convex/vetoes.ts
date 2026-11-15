/**
 * Task vetoes: the league calls a locked task too easy (owner's ask, 15 Nov).
 *
 * Once a lineup is locked, the owner's leaguemates can veto any of its open tasks until the later
 * of 24 hours after the task was added and the middle of the week. When enough of them have
 * vetoed it (vetoesNeeded), the task is struck: it stops being provable and scores nothing until
 * its owner swaps it for a new one, which keeps the slot and is re-rated like a flex task.
 *
 * A player's one lineup scores in every league they are in, so a task is struck by whichever of
 * their leagues reaches its quorum first; each vote counts only in the league it was cast in.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { membersInJoinOrder } from "./leagues";
import { requireUser } from "./lib/auth";
import { DAY_MS, HOUR_MS, weekStartOf } from "./lib/week";

// ---------------------------------------------------------------------------
// Rules (pure)
// ---------------------------------------------------------------------------

export const VETO_WINDOW_MS = 24 * HOUR_MS;
const HALF_WEEK_MS = 3.5 * DAY_MS;

/**
 * Vetoes that strike a task: a majority of the owner's leaguemates, but never fewer than two
 * where there are two to ask, so one sour leaguemate can't strike a task in a small league.
 * A one-on-one league has one other member, whose single veto is the whole league.
 */
export function vetoesNeeded(otherMembers: number): number {
  if (otherMembers <= 0) return Infinity;
  const majority = Math.floor(otherMembers / 2) + 1;
  return Math.max(majority, Math.min(2, otherMembers));
}

/** Voting on a task ends at the later of 24 hours after it was added and the week's midpoint. */
export function vetoClosesAt(task: { addedAt: number; weekStart: number }): number {
  return Math.max(task.addedAt + VETO_WINDOW_MS, task.weekStart + HALF_WEEK_MS);
}

/** Only a lineup task still waiting for its proof can be called too easy; drops set their own tasks. */
export function vetoable(task: Pick<Doc<"tasks">, "status" | "source">): boolean {
  return task.status === "open" && (task.source === "draft" || task.source === "flex");
}

export function struckText(ownerName: string, taskTitle: string): string {
  return `The league vetoed ${ownerName}'s "${taskTitle}" as too easy. ${ownerName} has to swap it for a new task.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const boardRow = v.object({
  taskId: v.id("tasks"),
  ownerId: v.id("users"),
  ownerName: v.string(),
  title: v.string(),
  slot: v.union(
    v.literal("body"),
    v.literal("mind"),
    v.literal("recharge"),
    v.literal("chores"),
    v.literal("people"),
    v.literal("flex"),
  ),
  points: v.number(),
  votes: v.number(),
  needed: v.number(),
  mine: v.boolean(),
  canVote: v.boolean(),
  struck: v.boolean(),
  closesAt: v.number(),
});

/** The league's current-week tasks that can still be vetoed, and any that were struck. */
export const board = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(boardRow),
  handler: async (ctx, { leagueId }) => {
    const viewer = await requireUser(ctx);
    const now = Date.now();
    const weekStart = weekStartOf(now);
    const members = await membersInJoinOrder(ctx, leagueId);
    if (!members.some((member) => member.userId === viewer._id)) return [];
    const needed = vetoesNeeded(members.length - 1);
    const rows = [];
    for (const member of members) {
      const owner = await ctx.db.get("users", member.userId);
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_week", (q) => q.eq("userId", member.userId).eq("weekStart", weekStart))
        .take(100);
      for (const task of tasks) {
        const closesAt = vetoClosesAt({ addedAt: task._creationTime, weekStart: task.weekStart });
        const struck = task.struck === true;
        if (!struck && (!vetoable(task) || now >= closesAt)) continue;
        const votes = await leagueVetoes(ctx, task._id, leagueId);
        const mine = votes.some((veto) => veto.userId === viewer._id);
        rows.push({
          taskId: task._id,
          ownerId: member.userId,
          ownerName: owner?.name ?? "A player",
          title: task.title,
          slot: task.slot,
          points: task.points,
          votes: votes.length,
          needed: Number.isFinite(needed) ? needed : 0,
          mine,
          canVote: !struck && member.userId !== viewer._id && Number.isFinite(needed),
          struck,
          closesAt,
        });
      }
    }
    return rows;
  },
});

/** Vetoes a leaguemate's task, or takes the veto back. The quorum strikes the task at once. */
export const cast = mutation({
  args: { taskId: v.id("tasks"), leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { taskId, leagueId }) => {
    const voter = await requireUser(ctx);
    const now = Date.now();
    const task = await ctx.db.get("tasks", taskId);
    if (task === null) throw new ConvexError("That task no longer exists");
    if (task.userId === voter._id) throw new ConvexError("You can't veto your own task");
    if (task.struck) throw new ConvexError("The league already struck this task");
    if (!vetoable(task)) throw new ConvexError("Only an open lineup task can be vetoed");
    if (now >= vetoClosesAt({ addedAt: task._creationTime, weekStart: task.weekStart })) {
      throw new ConvexError("Vetoes on this task have closed");
    }
    const members = await membersInJoinOrder(ctx, leagueId);
    const memberIds = members.map((member) => member.userId);
    if (!memberIds.includes(voter._id) || !memberIds.includes(task.userId)) {
      throw new ConvexError("Only the task owner's leaguemates can veto it");
    }

    const votes = await leagueVetoes(ctx, taskId, leagueId);
    const previous = votes.find((veto) => veto.userId === voter._id);
    if (previous !== undefined) {
      await ctx.db.delete("taskVetoes", previous._id);
      return null;
    }
    await ctx.db.insert("taskVetoes", { taskId, leagueId, userId: voter._id });
    if (votes.length + 1 >= vetoesNeeded(members.length - 1)) {
      await ctx.db.patch("tasks", taskId, { struck: true, status: "failed" });
      await ctx.scheduler.runAfter(0, internal.leaderboards.refresh, { userId: task.userId, weekStart: task.weekStart });
      const owner = await ctx.db.get("users", task.userId);
      await ctx.scheduler.runAfter(0, internal.keiki.send, {
        leagueId,
        text: struckText(owner?.name ?? "A player", task.title),
      });
    }
    return null;
  },
});

/** The owner replaces a struck task: same slot, new title, re-rated like a flex task. */
export const swap = mutation({
  args: { taskId: v.id("tasks"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, { taskId, title }) => {
    const owner = await requireUser(ctx);
    const task = await ctx.db.get("tasks", taskId);
    if (task === null || task.userId !== owner._id) throw new ConvexError("That isn't your task");
    if (!task.struck) throw new ConvexError("Only a task the league struck needs a swap");
    const tidy = title.trim().replace(/\s+/g, " ").slice(0, 80);
    if (tidy === "") throw new ConvexError("Give the new task a title.");
    if (tidy.toLowerCase() === task.title.toLowerCase()) {
      throw new ConvexError("Pick a different task than the one the league struck.");
    }
    // The old vetoes were about the old task.
    for (const veto of await ctx.db.query("taskVetoes").withIndex("by_task", (q) => q.eq("taskId", taskId)).take(100)) {
      await ctx.db.delete("taskVetoes", veto._id);
    }
    await ctx.db.patch("tasks", taskId, { title: tidy, struck: false, status: "open" });
    await ctx.scheduler.runAfter(0, internal.lineup.rateFlexTask, { taskId, title: tidy });
    return null;
  },
});

/** A league is capped at maxMembers, so a task's vetoes are bounded too. */
async function leagueVetoes(
  ctx: Pick<QueryCtx, "db">,
  taskId: Id<"tasks">,
  leagueId: Id<"leagues">,
): Promise<Doc<"taskVetoes">[]> {
  const vetoes = await ctx.db.query("taskVetoes").withIndex("by_task", (q) => q.eq("taskId", taskId)).take(100);
  return vetoes.filter((veto) => veto.leagueId === leagueId);
}
