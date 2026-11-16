import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { removePlayer } from "./fixtures";
import { addMember, currentWeek, paidInto } from "./leagues";
import { requireSignedInUser, requireUser, signedInUser } from "./lib/auth";
import { UNNAMED_PLAYER } from "./lib/names";
import { versusLabel } from "./versus";

const MAX_NAME_LENGTH = 40;
const MAX_CONTACTS = 1000;
const MAX_LEAGUES_LISTED = 50;
const E164 = /^\+[1-9]\d{6,14}$/;
// Bounds for Delete account. A player's whole history fits well inside them; removePlayer's own
// allowance carries anything past DELETES_PER_RUN into finishDeleteAccount.
const MAX_PROOFS_DELETED = 4000;
const MAX_SOCIAL_ROWS_SCANNED = 4000;
const DELETES_PER_RUN = 4000;

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      phone: v.optional(v.string()),
      onboarded: v.boolean(),
      actingAs: v.optional(v.object({ _id: v.id("users"), name: v.string() })),
      leagues: v.array(
        v.object({
          _id: v.id("leagues"),
          name: v.string(),
          stakeUsd: v.number(),
          paid: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    // The app asks before sign-in has finished, so signed out is null, not an error.
    const signedIn = await signedInUser(ctx);
    if (signedIn === null) {
      return null;
    }
    // Everything below describes the player the device plays as, so screens
    // never special-case Switch Player.
    const player = await requireUser(ctx);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", player._id))
      .take(MAX_LEAGUES_LISTED);
    // In the order the player joined, which is not the order the rows were written: a seed
    // reset rewrites the demo league's memberships, and the app opens the first league listed.
    memberships.sort((a, b) => a.joinedAt - b.joinedAt);
    const leagues = [];
    for (const membership of memberships) {
      const league = await ctx.db.get("leagues", membership.leagueId);
      if (league !== null) {
        const week = await currentWeek(ctx, league._id);
        leagues.push({
          _id: league._id,
          // A 1v1 versus is named for the other player, as this player sees it: "vs Maya".
          name: league.mode === "versus" ? await versusLabel(ctx, league._id, player._id) : league.name,
          stakeUsd: league.stakeUsd,
          // Paid into the week in play, by the ledger: the same answer the pot gives.
          paid: week === null ? league.stakeUsd === 0 : (await paidInto(ctx, league, week))(player._id),
        });
      }
    }

    return {
      _id: player._id,
      ...(player.name !== undefined && { name: player.name }),
      ...(player.phone !== undefined && { phone: player.phone }),
      onboarded: Boolean(player.name) && Boolean(player.phone),
      ...(player._id !== signedIn._id && {
        actingAs: { _id: player._id, name: player.name ?? UNNAMED_PLAYER },
      }),
      leagues,
    };
  },
});

export const createUser = mutation({
  args: { name: v.string(), phone: v.string() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // The device's own row, never the seeded player Switch Player points at:
    // onboarding must not write to a seeded account.
    const user = await requireSignedInUser(ctx);
    const name = args.name.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      throw new ConvexError(`Enter a name of 1 to ${MAX_NAME_LENGTH} characters`);
    }
    if (!E164.test(args.phone)) {
      throw new ConvexError("Enter a phone number with its country code");
    }

    // Reinstalling the app signs in as a brand new anonymous account. The
    // number moves to the newest account so Keiki texts reach it, and the old
    // row gives it up to keep by_phone unique. A seeded demo player keeps its
    // number, or Reset Seed could no longer find it.
    const previousOwners = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .take(10);
    for (const previous of previousOwners) {
      if (previous._id === user._id) continue;
      if (previous.isSeed) {
        throw new ConvexError("That number belongs to a demo player");
      }
      await ctx.db.patch("users", previous._id, { phone: undefined });
    }

    await ctx.db.patch("users", user._id, {
      name,
      phone: args.phone,
      ...(user.createdAt === undefined && { createdAt: Date.now() }),
    });
    return user._id;
  },
});

export const matchContacts = mutation({
  args: { leagueId: v.id("leagues"), phones: v.array(v.string()) },
  returns: v.object({
    added: v.array(v.object({ userId: v.id("users"), name: v.string() })),
    notOnLineup: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const league = await ctx.db.get("leagues", args.leagueId);
    if (league === null) {
      throw new ConvexError("League not found");
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .take(league.maxMembers);
    const memberIds = new Set<Id<"users">>(memberships.map((membership) => membership.userId));
    if (!memberIds.has(caller._id)) {
      throw new ConvexError("Join the league before adding friends");
    }

    const phones = [...new Set(args.phones)];
    if (phones.length > MAX_CONTACTS) {
      throw new ConvexError("Too many contacts to match at once");
    }

    const added: { userId: Id<"users">; name: string }[] = [];
    const notOnLineup: string[] = [];
    for (const phone of phones) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .first();
      if (user === null) {
        notOnLineup.push(phone);
        continue;
      }
      // A full league keeps classifying but stops adding.
      if (memberIds.has(user._id) || memberIds.size >= league.maxMembers) {
        continue;
      }
      await addMember(ctx, league, user._id);
      memberIds.add(user._id);
      added.push({ userId: user._id, name: user.name ?? UNNAMED_PLAYER });
    }
    return { added, notOnLineup };
  },
});

/** The Settings switches the account owns that no other module serves. Unset means on. */
export const preferences = query({
  args: {},
  returns: v.object({ nudgesOn: v.boolean() }),
  handler: async (ctx) => {
    const account = await requireSignedInUser(ctx);
    return { nudgesOn: account.nudgesEnabled !== false };
  },
});

/** Settings' Nudges switch: the scheduled check-in texts and pushes (convex/checkins.ts). */
export const setNudges = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const account = await requireSignedInUser(ctx);
    await ctx.db.patch("users", account._id, { nudgesEnabled: enabled });
    return null;
  },
});

/**
 * Settings' avatar: a photo uploaded through proofs.generateUploadUrl. The old file is deleted,
 * since only this row points at it (seeded players keep theirs: their photos are shared).
 */
export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const account = await requireSignedInUser(ctx);
    if (account.isSeed) {
      throw new ConvexError("A demo player keeps their photo");
    }
    const previous = account.avatarStorageId;
    await ctx.db.patch("users", account._id, { avatarStorageId: storageId });
    if (previous !== undefined && previous !== storageId) {
      await ctx.storage.delete(previous);
    }
    return null;
  },
});

/**
 * Settings' Delete account. Deletes the device's own account, never the seeded player Switch
 * Player points at, with every row that hangs off it (fixtures.removePlayer: memberships, the
 * matchups, drops, challenges and ledger rows it left in its leagues, lineups, tasks, proofs,
 * scores, nudges, push tokens, referrals and the Convex Auth sessions and accounts, so the
 * anonymous identity can't sign back in), plus its photos and its reactions and votes. Leagues
 * it created stay for their other members.
 *
 * The phone number is given up first, so it is free to sign up again even when the rest needs
 * a second run: a very long history carries on in finishDeleteAccount.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const account = await requireSignedInUser(ctx);
    if (account.isSeed) {
      throw new ConvexError("A demo player can't be deleted");
    }
    await ctx.db.patch("users", account._id, { phone: undefined, demoActAs: undefined });

    // Photos first, while the proofs that name them can still be read. A real player's proofs
    // are their own uploads; only seeded players share files.
    const proofs = await ctx.db
      .query("proofs")
      .withIndex("by_user_week", (q) => q.eq("userId", account._id))
      .take(MAX_PROOFS_DELETED);
    const files = new Set<Id<"_storage">>();
    for (const proof of proofs) {
      if (proof.storageId) files.add(proof.storageId);
      if (proof.beforeStorageId) files.add(proof.beforeStorageId);
    }
    if (account.avatarStorageId) files.add(account.avatarStorageId);
    for (const file of files) {
      if ((await ctx.db.system.get("_storage", file)) !== null) await ctx.storage.delete(file);
    }

    // Reactions and votes have no index by player and both tables are small, as fixtures.remove reads them.
    const reactions = await ctx.db.query("reactions").take(MAX_SOCIAL_ROWS_SCANNED);
    const votes = await ctx.db.query("votes").take(MAX_SOCIAL_ROWS_SCANNED);
    for (const reaction of reactions) {
      if (reaction.userId === account._id) await ctx.db.delete("reactions", reaction._id);
    }
    for (const vote of votes) {
      if (vote.userId === account._id) await ctx.db.delete("votes", vote._id);
    }

    if (!(await removePlayer({ ctx, left: DELETES_PER_RUN }, account))) {
      await ctx.scheduler.runAfter(0, internal.users.finishDeleteAccount, { userId: account._id });
    }
    return null;
  },
});

/** What deleteAccount could not fit in one transaction, one budget at a time. */
export const finishDeleteAccount = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const account = await ctx.db.get("users", userId);
    if (account === null) return null;
    if (!(await removePlayer({ ctx, left: DELETES_PER_RUN }, account))) {
      await ctx.scheduler.runAfter(0, internal.users.finishDeleteAccount, { userId });
    }
    return null;
  },
});
