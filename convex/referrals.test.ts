/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import type * as referralsModule from "./referrals";
import schema from "./schema";

type Modules = ApiFromModules<{ referrals: typeof referralsModule }>;
const api = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "public">>;
const modules = import.meta.glob("./**/*.ts");

async function player(t: ReturnType<typeof convexTest>, name: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { name }));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

async function leagueOf(t: ReturnType<typeof convexTest>, creatorId: Id<"users">) {
  return await t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", { name: "Friends", inviteCode: "FRNDS1", stakeUsd: 0, visibility: "private", maxMembers: 12, createdBy: creatorId });
    await ctx.db.insert("memberships", { leagueId, userId: creatorId, paid: true, joinedAt: Date.now() });
    return leagueId;
  });
}

describe("referrals", () => {
  it("joins a new friend by link and pays the inviter once the friend locks a lineup", async () => {
    const t = convexTest(schema, modules);
    const maya = await player(t, "Maya Chen");
    const sam = await player(t, "Sam Patel");
    const leagueId = await leagueOf(t, maya.userId);

    const link = await maya.as.mutation(api.referrals.createLink, { leagueId, appUrl: "exp://host/--/invite" });
    expect(link.message).toContain(link.url);
    expect((await maya.as.mutation(api.referrals.createLink, { leagueId })).token).toBe(link.token);

    const preview = await sam.as.query(api.referrals.preview, { token: link.token });
    expect(preview).toMatchObject({ inviterName: "Maya Chen", leagueName: "Friends", alreadyMember: false, isSelf: false });

    expect(await sam.as.mutation(api.referrals.accept, { token: link.token })).toEqual({ leagueId, mode: "league" });
    expect(await maya.as.query(api.referrals.mine, {})).toMatchObject({ invited: 1, locked: 0, recruiterPoints: 0, badge: null });

    await t.run((ctx) => ctx.db.insert("lineups", { userId: sam.userId, weekStart: 0, lockedAt: Date.now() }));
    expect(await maya.as.query(api.referrals.forUser, { userId: maya.userId })).toEqual({ invited: 1, locked: 1, recruiterPoints: 25, badge: "Recruiter" });

    // A second accept, or a second inviter's link, never counts Sam again.
    await sam.as.mutation(api.referrals.accept, { token: link.token });
    expect((await maya.as.query(api.referrals.mine, {})).invited).toBe(1);
  });

  it("never rewards the inviter's own tap or a player who was already playing", async () => {
    const t = convexTest(schema, modules);
    const maya = await player(t, "Maya Chen");
    const leagueId = await leagueOf(t, maya.userId);
    const link = await maya.as.mutation(api.referrals.createLink, { leagueId });
    expect((await maya.as.query(api.referrals.preview, { token: link.token }))?.isSelf).toBe(true);
    await maya.as.mutation(api.referrals.accept, { token: link.token });

    const veteran = await player(t, "Leo Martinez");
    await leagueOf(t, veteran.userId);
    await veteran.as.mutation(api.referrals.accept, { token: link.token });
    expect((await maya.as.query(api.referrals.mine, {})).invited).toBe(0);
    expect(await veteran.as.query(api.referrals.preview, { token: "NOPE234" })).toBeNull();
  });
});
