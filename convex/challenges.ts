/**
 * Challenges and league votes (SPEC section 3).
 *
 * A league member who doubts a verified proof can challenge it once, within 24 hours.
 * The challenge puts the proof's points on hold and the rest of the league votes
 * "legit" or "not legit". The vote closes after 12 hours or as soon as every eligible
 * voter has voted, and a majority of the votes cast decides:
 *
 *   upheld      the points return, and the challenger loses CHALLENGER_STAKE points
 *   overturned  the task reopens so it can be proved again, and the challenger gains
 *               CHALLENGER_STAKE points
 *
 * How this is stored:
 *   - The hold is the task's status. Standings count only "verified" tasks, so "held"
 *     removes the points and "verified" returns them, with no separate ledger.
 *     A player has one lineup that scores in every league they are in, so the hold
 *     applies in all of their leagues while one league votes.
 *   - The proof row is never changed: it stays the record of what the referee saw.
 *   - The challenger's +10 / -10 is derived from the challenge's status
 *     (challengerDelta), never stored, so standings cannot drift from the outcome.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/auth";

// ---------------------------------------------------------------------------
// Rules (pure)
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

/** A proof can be challenged for this long after it was submitted. */
export const CHALLENGE_WINDOW_MS = 24 * HOUR_MS;
/** A vote stays open this long unless every eligible voter votes sooner. */
export const VOTE_WINDOW_MS = 12 * HOUR_MS;
/** Points the challenger wins when the proof is overturned and loses when it is upheld. */
export const CHALLENGER_STAKE = 10;

export type ChallengeStatus = Doc<"challenges">["status"];
export type Tally = { legit: number; notLegit: number };

export function challengeWindowOpen(
  proofCreatedAt: number,
  now: number,
): boolean {
  return now - proofCreatedAt <= CHALLENGE_WINDOW_MS;
}

/**
 * The proof's owner and the challenger are the two parties to the dispute, so
 * neither votes; everyone else in the league does.
 */
export function eligibleVoters<UserId extends string>(
  memberIds: UserId[],
  ownerId: UserId,
  challengerId: UserId,
): UserId[] {
  return memberIds.filter((id) => id !== ownerId && id !== challengerId);
}

export function tally(votes: { legit: boolean }[]): Tally {
  const legit = votes.filter((vote) => vote.legit).length;
  return { legit, notLegit: votes.length - legit };
}

/**
 * The referee's verdict stands unless a majority of the votes cast disagrees,
 * so a tie and an empty vote both uphold the proof.
 */
export function decide({ legit, notLegit }: Tally): "upheld" | "overturned" {
  return notLegit > legit ? "overturned" : "upheld";
}

/** What a challenge is worth to its challenger in the standings. */
export function challengerDelta(status: ChallengeStatus): number {
  if (status === "overturned") return CHALLENGER_STAKE;
  if (status === "upheld") return -CHALLENGER_STAKE;
  return 0;
}

/** The text the league gets when a challenge opens (SPEC section 7). */
export function challengeOpenedText(
  challengerName: string,
  ownerName: string,
  taskTitle: string,
): string {
  return `${challengerName} challenged ${ownerName}'s "${taskTitle}" proof. Vote in the app.`;
}

/** The text the league gets when the vote closes. */
export function challengeResultText(
  status: "upheld" | "overturned",
  challengerName: string,
  ownerName: string,
  taskTitle: string,
): string {
  return status === "upheld"
    ? `The league upheld ${ownerName}'s "${taskTitle}" proof. The points are back and ${challengerName} loses ${CHALLENGER_STAKE}.`
    : `The league overturned ${ownerName}'s "${taskTitle}" proof. The task reopens and ${challengerName} gets +${CHALLENGER_STAKE}.`;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/**
 * Each challenger's net points from the league's challenges that closed in
 * [range.from, range.to). Standings add this to a member's week total.
 *
 * closesAt is the moment a challenge was decided (settle moves it forward when a
 * vote ends early), so a challenge counts in the week its result landed.
 */
export async function challengerPointsByUser(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
  range: { from: number; to: number },
): Promise<Map<Id<"users">, number>> {
  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_league", (q) =>
      q
        .eq("leagueId", leagueId)
        .gte("closesAt", range.from)
        .lt("closesAt", range.to),
    )
    .collect();
  const points = new Map<Id<"users">, number>();
  for (const challenge of challenges) {
    const delta = challengerDelta(challenge.status);
    if (delta === 0) continue;
    points.set(
      challenge.challengerId,
      (points.get(challenge.challengerId) ?? 0) + delta,
    );
  }
  return points;
}

// ---------------------------------------------------------------------------
// Public API (API.md)
// ---------------------------------------------------------------------------

export const open = mutation({
  args: { proofId: v.id("proofs"), leagueId: v.id("leagues") },
  returns: v.id("challenges"),
  handler: async (ctx, { proofId, leagueId }) => {
    const challenger = await requireUser(ctx);
    const now = Date.now();

    const proof = await ctx.db.get("proofs", proofId);
    if (proof === null) throw new ConvexError("That proof no longer exists");
    const task = await ctx.db.get("tasks", proof.taskId);
    if (task === null) {
      throw new ConvexError("That proof's task no longer exists");
    }

    const memberIds = await leagueMemberIds(ctx, leagueId);
    if (!memberIds.includes(challenger._id)) {
      throw new ConvexError(
        "Only members of this league can challenge a proof here",
      );
    }
    if (!memberIds.includes(proof.userId)) {
      throw new ConvexError("That proof's owner is not in this league");
    }
    if (task.dropId !== undefined) {
      // A drop's task scores only in the drop's league, so only that league
      // can dispute it.
      const drop = await ctx.db.get("drops", task.dropId);
      if (drop !== null && drop.leagueId !== leagueId) {
        throw new ConvexError("That proof does not count in this league");
      }
    }
    if (proof.userId === challenger._id) {
      throw new ConvexError("You can't challenge your own proof");
    }

    // One challenge per proof, ever: a proof the league already ruled on is settled.
    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_proof", (q) => q.eq("proofId", proofId))
      .first();
    if (existing !== null) {
      throw new ConvexError("This proof has already been challenged");
    }

    if (!proof.pass || task.status !== "verified") {
      throw new ConvexError("Only a verified proof can be challenged");
    }
    if (!challengeWindowOpen(proof.createdAt, now)) {
      throw new ConvexError("Proofs can only be challenged within 24 hours");
    }
    // With nobody to vote the proof would be upheld by default, and the challenger
    // would pay the stake for a dispute that was never heard.
    if (eligibleVoters(memberIds, proof.userId, challenger._id).length === 0) {
      throw new ConvexError(
        "A challenge needs at least one other league member to vote",
      );
    }

    const closesAt = now + VOTE_WINDOW_MS;
    const challengeId = await ctx.db.insert("challenges", {
      proofId,
      leagueId,
      challengerId: challenger._id,
      status: "open",
      closesAt,
    });
    await ctx.db.patch("tasks", task._id, { status: "held" });
    // The held points leave the leaderboards' stored copy of the owner's week.
    await ctx.scheduler.runAfter(0, internal.leaderboards.refresh, { userId: task.userId, weekStart: task.weekStart });
    await ctx.scheduler.runAt(closesAt, internal.challenges.close, {
      challengeId,
    });
    await textLeague(
      ctx,
      leagueId,
      challengeOpenedText(
        nameOf(challenger),
        nameOf(await ctx.db.get("users", proof.userId)),
        task.title,
      ),
    );
    return challengeId;
  },
});

export const vote = mutation({
  args: { challengeId: v.id("challenges"), legit: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { challengeId, legit }) => {
    const voter = await requireUser(ctx);
    const now = Date.now();

    const challenge = await ctx.db.get("challenges", challengeId);
    if (challenge === null) {
      throw new ConvexError("That challenge no longer exists");
    }
    if (challenge.status !== "open" || now >= challenge.closesAt) {
      throw new ConvexError("Voting on this challenge has closed");
    }
    const proof = await ctx.db.get("proofs", challenge.proofId);
    if (proof === null) {
      throw new ConvexError("That challenge's proof no longer exists");
    }

    if (voter._id === proof.userId || voter._id === challenge.challengerId) {
      throw new ConvexError("The two sides of a challenge don't vote on it");
    }
    const voterIds = eligibleVoters(
      await leagueMemberIds(ctx, challenge.leagueId),
      proof.userId,
      challenge.challengerId,
    );
    if (!voterIds.includes(voter._id)) {
      throw new ConvexError(
        "Only members of this league can vote on this challenge",
      );
    }

    // A voter may change their mind while the vote is open, but holds one vote:
    // the row is replaced, never doubled.
    const votes = await votesOn(ctx, challengeId);
    const previous = votes.find((cast) => cast.userId === voter._id);
    if (previous === undefined) {
      await ctx.db.insert("votes", { challengeId, userId: voter._id, legit });
    } else {
      await ctx.db.patch("votes", previous._id, { legit });
    }

    // Nothing is left to wait for once every eligible voter has voted, so the result
    // lands now instead of at closesAt. The scheduled close then finds the challenge
    // decided and does nothing.
    const votedIds = new Set([...votes.map((cast) => cast.userId), voter._id]);
    if (voterIds.every((id) => votedIds.has(id))) {
      await settle(ctx, challenge, now);
    }
    return null;
  },
});

/**
 * Closes the vote at closesAt. open() schedules it for every challenge, so it must
 * tolerate running after the vote already closed early, and after a demo reset
 * deleted the challenge.
 */
export const close = internalMutation({
  args: { challengeId: v.id("challenges") },
  returns: v.null(),
  handler: async (ctx, { challengeId }) => {
    const challenge = await ctx.db.get("challenges", challengeId);
    if (challenge === null || challenge.status !== "open") return null;
    await settle(ctx, challenge, Date.now());
    return null;
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Counts the votes, records the result and lifts the hold on the task. */
async function settle(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number,
): Promise<void> {
  const status = decide(tally(await votesOn(ctx, challenge._id)));
  await ctx.db.patch("challenges", challenge._id, {
    status,
    // When the vote ends early, closesAt moves to the moment it was decided so the
    // challenger's points count in the week the result landed.
    closesAt: Math.min(challenge.closesAt, now),
  });
  // The result moved the challenger's points, so the leaderboards rebuild the league's stored rows.
  await ctx.scheduler.runAfter(0, internal.leaderboards.rebuild, { leagueId: challenge.leagueId });

  const proof = await ctx.db.get("proofs", challenge.proofId);
  const task = proof === null ? null : await ctx.db.get("tasks", proof.taskId);
  // A demo reset can delete the proof or task under an open challenge; there is
  // then nothing to release and nothing worth texting the league about.
  if (proof === null || task === null) return;
  // Only a task this challenge is still holding is released.
  if (task.status === "held") {
    await ctx.db.patch("tasks", task._id, {
      status: status === "upheld" ? "verified" : "open",
    });
    await ctx.scheduler.runAfter(0, internal.leaderboards.refresh, { userId: task.userId, weekStart: task.weekStart });
  }
  await textLeague(
    ctx,
    challenge.leagueId,
    challengeResultText(
      status,
      nameOf(await ctx.db.get("users", challenge.challengerId)),
      nameOf(await ctx.db.get("users", proof.userId)),
      task.title,
    ),
  );
}

/**
 * Texts every member of the league through Keiki. It is scheduled, never awaited,
 * so a messaging failure can't roll back the challenge or the ruling.
 */
async function textLeague(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  text: string,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.keiki.send, { leagueId, text });
}

/** users.name is optional until onboarding finishes. */
function nameOf(user: Doc<"users"> | null): string {
  return user?.name ?? "A player";
}

/** A league is capped at leagues.maxMembers, so reading every membership is bounded. */
async function leagueMemberIds(
  ctx: Pick<QueryCtx, "db">,
  leagueId: Id<"leagues">,
): Promise<Id<"users">[]> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
    .collect();
  return memberships.map((membership) => membership.userId);
}

/** At most one vote per league member, so this is bounded by the league's size. */
async function votesOn(
  ctx: Pick<QueryCtx, "db">,
  challengeId: Id<"challenges">,
): Promise<Doc<"votes">[]> {
  return await ctx.db
    .query("votes")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .collect();
}
