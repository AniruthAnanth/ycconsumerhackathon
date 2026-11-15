/**
 * Texts a league when its lead changes hands (SPEC.md section 7: "Standings changes when the
 * leader changes").
 *
 * Standings are never stored, so "changed" needs something to compare with: leagues.leaderId
 * remembers who led outright the last time this looked. Whenever a proof passes, the table is
 * recomputed for each league the prover plays in, and the league is texted once if someone new
 * is in front. Running it twice for the same proof is harmless: the second run finds the leader
 * it already stored.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { leagueStandings } from "./standings";

/** A player is in a handful of leagues at most; this only bounds the read. */
const MAX_LEAGUES = 50;

type Standing<UserId> = { userId: UserId; name: string; points: number };

/**
 * Who leads outright, and by how much. Null while nobody has scored or the top two are level,
 * because a tie is not a lead and must not flip the stored leader back and forth.
 * `standings` is best first, as leagueStandings returns it.
 */
export function outrightLeader<UserId>(
  standings: readonly Standing<UserId>[],
): { leader: Standing<UserId>; runnerUp: Standing<UserId> | null; gap: number } | null {
  const [leader, runnerUp] = standings;
  if (leader === undefined || leader.points <= 0) return null;
  if (runnerUp === undefined) return { leader, runnerUp: null, gap: leader.points };
  if (leader.points === runnerUp.points) return null;
  return { leader, runnerUp, gap: leader.points - runnerUp.points };
}

/** "Maya took the lead in YC Hackathon: 240 points, 15 ahead of Sam." First names, as in every text. */
export function leadChangeText(input: {
  leagueName: string;
  leader: { name: string; points: number };
  runnerUp: { name: string } | null;
  gap: number;
}): string {
  const firstName = (name: string) => name.trim().split(/\s+/)[0];
  const margin = input.runnerUp === null ? "" : `, ${input.gap} ahead of ${firstName(input.runnerUp.name)}`;
  return `${firstName(input.leader.name)} took the lead in ${input.leagueName}: ${input.leader.points} points${margin}.`;
}

/** Scheduled by proofs.record each time a proof passes. */
export const afterProof = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await announceLeadChanges(ctx, userId);
    return null;
  },
});

/**
 * Checks every league this player is in. drops.ts calls it directly after it has written a
 * drop bonus, so a first-finisher +10 that decides the lead is announced too.
 */
export async function announceLeadChanges(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_LEAGUES);
  for (const { leagueId } of memberships) {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) continue;
    const lead = outrightLeader(await leagueStandings(ctx, leagueId));
    if (lead === null || lead.leader.userId === league.leaderId) continue;
    await ctx.db.patch("leagues", leagueId, { leaderId: lead.leader.userId });
    // The first leader of a league is recorded quietly: nobody was overtaken, so there is no news.
    if (league.leaderId === undefined) continue;
    await ctx.scheduler.runAfter(0, internal.keiki.send, {
      leagueId,
      text: leadChangeText({ leagueName: league.name, ...lead }),
    });
  }
}
