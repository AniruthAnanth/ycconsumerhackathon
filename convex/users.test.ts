/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import {
  anyApi,
  type ApiFromModules,
  type FilterApi,
  type FunctionReference,
} from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import type * as leaguesModule from "./leagues";
import schema from "./schema";
import type * as usersModule from "./users";

// Typed from the module sources, so these tests compile before and after
// "convex dev" regenerates _generated/api to list the new modules.
type Modules = ApiFromModules<{ leagues: typeof leaguesModule; users: typeof usersModule }>;
const api = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "public">>;

const modules = import.meta.glob("./**/*.ts");

// Wednesday 18 November 2026, noon Pacific. Its week starts Monday 16 November 00:00 PST.
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

type Harness = ReturnType<typeof newHarness>;

function newHarness() {
  return convexTest(schema, modules);
}

async function addUser(
  t: Harness,
  fields: { name?: string; phone?: string; demoActAs?: Id<"users"> } = {},
) {
  return await t.run((ctx) => ctx.db.insert("users", fields));
}

function asUser(t: Harness, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function createLeague(t: Harness, creator: Id<"users">, name: string, stakeUsd = 0) {
  return await asUser(t, creator).mutation(api.leagues.create, {
    name,
    stakeUsd,
    visibility: "private",
  });
}

async function memberIdsOf(t: Harness, leagueId: Id<"leagues">) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    return rows.map((row) => row.userId);
  });
}

describe("users.me", () => {
  it("is null when signed out", async () => {
    const t = newHarness();
    await expect(t.query(api.users.me, {})).resolves.toBeNull();
  });

  it("describes the signed-in player's own row", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava", phone: "+14155550101" });

    const me = await asUser(t, ava).query(api.users.me, {});

    expect(me).toEqual({
      _id: ava,
      name: "Ava",
      phone: "+14155550101",
      onboarded: true,
      leagues: [],
    });
  });

  it("is not onboarded until the player has both a name and a phone", async () => {
    const t = newHarness();
    const blank = await addUser(t);
    const nameOnly = await addUser(t, { name: "Ben" });
    const phoneOnly = await addUser(t, { phone: "+14155550102" });

    expect((await asUser(t, blank).query(api.users.me, {}))?.onboarded).toBe(false);
    expect((await asUser(t, nameOnly).query(api.users.me, {}))?.onboarded).toBe(false);
    expect((await asUser(t, phoneOnly).query(api.users.me, {}))?.onboarded).toBe(false);
  });

  it("describes the seeded player while Switch Player is on, and says who is switched in", async () => {
    const t = newHarness();
    const seeded = await addUser(t, { name: "Maya", phone: "+14155550103" });
    const device = await addUser(t, { name: "Device Owner", demoActAs: seeded });
    const { leagueId } = await createLeague(t, seeded, "Maya's League", 5);

    const me = await asUser(t, device).query(api.users.me, {});

    expect(me).toEqual({
      _id: seeded,
      name: "Maya",
      phone: "+14155550103",
      onboarded: true,
      actingAs: { _id: seeded, name: "Maya" },
      leagues: [{ _id: leagueId, name: "Maya's League", stakeUsd: 5, paid: false }],
    });
  });

  it("lists leagues by when the player joined, not by when the membership row was written", async () => {
    const t = newHarness();
    const ava = await addUser(t);
    await createLeague(t, ava, "Joined today", 0);
    const { leagueId: earlier } = await createLeague(t, await addUser(t), "Joined on Monday", 0);
    // What a seed reset does: a fresh row for a league the player has been in all week.
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        leagueId: earlier,
        userId: ava,
        paid: true,
        joinedAt: NOW - 2 * 24 * 60 * 60 * 1000,
      });
    });

    const me = await asUser(t, ava).query(api.users.me, {});

    expect(me?.leagues.map((league) => league.name)).toEqual(["Joined on Monday", "Joined today"]);
  });

  it("lists leagues in the order the player joined them", async () => {
    const t = newHarness();
    const [ava, ben] = [await addUser(t), await addUser(t)];
    const second = await createLeague(t, ben, "Second", 0);
    const first = await createLeague(t, ava, "First", 20);
    await asUser(t, ava).mutation(api.leagues.joinByCode, { inviteCode: second.inviteCode });

    const me = await asUser(t, ava).query(api.users.me, {});

    expect(me?.leagues).toEqual([
      { _id: first.leagueId, name: "First", stakeUsd: 20, paid: false },
      { _id: second.leagueId, name: "Second", stakeUsd: 0, paid: true },
    ]);
  });
});

describe("users.createUser", () => {
  it("fills in the signed-in row with a trimmed name and the phone", async () => {
    const t = newHarness();
    const ava = await addUser(t);

    const id = await asUser(t, ava).mutation(api.users.createUser, {
      name: "  Ava  ",
      phone: "+14155550101",
    });

    expect(id).toBe(ava);
    const row = await t.run((ctx) => ctx.db.get("users", ava));
    expect(row).toMatchObject({ name: "Ava", phone: "+14155550101", createdAt: NOW });
  });

  it("keeps an existing createdAt", async () => {
    const t = newHarness();
    const ava = await t.run((ctx) => ctx.db.insert("users", { createdAt: 123 }));
    await asUser(t, ava).mutation(api.users.createUser, { name: "Ava", phone: "+14155550101" });
    expect((await t.run((ctx) => ctx.db.get("users", ava)))?.createdAt).toBe(123);
  });

  it.each([
    ["an empty name", "   ", "+14155550101", "Enter a name of 1 to 40 characters"],
    ["a name over 40 characters", "x".repeat(41), "+14155550101", "Enter a name of 1 to 40 characters"],
    ["a phone without a country code", "Ava", "4155550101", "Enter a phone number with its country code"],
    ["a phone with formatting", "Ava", "+1 (415) 555-0101", "Enter a phone number with its country code"],
    ["a phone that is too short", "Ava", "+12345", "Enter a phone number with its country code"],
    ["a phone starting +0", "Ava", "+04155550101", "Enter a phone number with its country code"],
  ])("rejects %s", async (_label, name, phone, message) => {
    const t = newHarness();
    const ava = await addUser(t);
    await expect(
      asUser(t, ava).mutation(api.users.createUser, { name, phone }),
    ).rejects.toMatchObject({ data: message });
    expect(await t.run((ctx) => ctx.db.get("users", ava))).toEqual(
      expect.not.objectContaining({ name: expect.anything() }),
    );
  });

  it("moves a phone from an older account to the newest one", async () => {
    const t = newHarness();
    const oldInstall = await addUser(t, { name: "Ava", phone: "+14155550101" });
    const newInstall = await addUser(t);

    await asUser(t, newInstall).mutation(api.users.createUser, {
      name: "Ava",
      phone: "+14155550101",
    });

    const owners = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", "+14155550101"))
        .collect(),
    );
    expect(owners.map((u) => u._id)).toEqual([newInstall]);
    const old = await t.run((ctx) => ctx.db.get("users", oldInstall));
    expect(old?.phone).toBeUndefined();
    expect(old?.name).toBe("Ava");
  });

  it("writes to the device's own row, not the player Switch Player points at", async () => {
    const t = newHarness();
    const seeded = await addUser(t, { name: "Maya", phone: "+14155550103" });
    const device = await addUser(t, { demoActAs: seeded });

    await asUser(t, device).mutation(api.users.createUser, { name: "Ava", phone: "+14155550101" });

    expect(await t.run((ctx) => ctx.db.get("users", seeded))).toMatchObject({
      name: "Maya",
      phone: "+14155550103",
    });
    expect(await t.run((ctx) => ctx.db.get("users", device))).toMatchObject({
      name: "Ava",
      phone: "+14155550101",
    });
  });
});

describe("users.matchContacts", () => {
  it("adds friends who are on Lineup and lists the rest", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava", phone: "+14155550101" });
    const ben = await addUser(t, { name: "Ben", phone: "+14155550102" });
    const nameless = await addUser(t, { phone: "+14155550103" });
    const { leagueId } = await createLeague(t, ava, "Dorm 4");

    const result = await asUser(t, ava).mutation(api.users.matchContacts, {
      leagueId,
      phones: ["+14155550102", "+14155550103", "+14155550199", "+14155550198"],
    });

    expect(result).toEqual({
      added: [
        { userId: ben, name: "Ben" },
        { userId: nameless, name: "Player" },
      ],
      notOnLineup: ["+14155550199", "+14155550198"],
    });
    expect(await memberIdsOf(t, leagueId)).toEqual([ava, ben, nameless]);
  });

  it("skips the caller, members already in and repeated numbers", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava", phone: "+14155550101" });
    const ben = await addUser(t, { name: "Ben", phone: "+14155550102" });
    const cal = await addUser(t, { name: "Cal", phone: "+14155550103" });
    const { leagueId, inviteCode } = await createLeague(t, ava, "Dorm 4");
    await asUser(t, ben).mutation(api.leagues.joinByCode, { inviteCode });

    const result = await asUser(t, ava).mutation(api.users.matchContacts, {
      leagueId,
      phones: ["+14155550101", "+14155550102", "+14155550103", "+14155550103"],
    });

    expect(result).toEqual({ added: [{ userId: cal, name: "Cal" }], notOnLineup: [] });
    expect(await memberIdsOf(t, leagueId)).toEqual([ava, ben, cal]);
  });

  it("stops adding once the league is full but keeps classifying", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava", phone: "+14155550100" });
    const { leagueId } = await createLeague(t, ava, "Dorm 4");
    const friends: Id<"users">[] = [];
    const phones: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const phone = "+1415555" + String(1000 + i);
      phones.push(phone);
      friends.push(await addUser(t, { name: "Friend " + i, phone }));
    }

    const result = await asUser(t, ava).mutation(api.users.matchContacts, {
      leagueId,
      phones: [...phones, "+14155559999"],
    });

    expect(result.added.map((a) => a.userId)).toEqual(friends.slice(0, 11));
    expect(result.notOnLineup).toEqual(["+14155559999"]);
    expect(await memberIdsOf(t, leagueId)).toHaveLength(12);
  });

  it("rejects a caller who is not in the league", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava" });
    const outsider = await addUser(t, { name: "Zed" });
    const { leagueId } = await createLeague(t, ava, "Dorm 4");

    await expect(
      asUser(t, outsider).mutation(api.users.matchContacts, { leagueId, phones: ["+14155550102"] }),
    ).rejects.toMatchObject({ data: "Join the league before adding friends" });
  });

  it("rejects more than 1000 contacts", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava" });
    const { leagueId } = await createLeague(t, ava, "Dorm 4");
    const phones = Array.from({ length: 1001 }, (_, i) => "+1415555" + String(10000 + i).padStart(5, "0"));

    await expect(
      asUser(t, ava).mutation(api.users.matchContacts, { leagueId, phones }),
    ).rejects.toMatchObject({ data: "Too many contacts to match at once" });
  });
});

/** One drafted week for a player: a lineup, a task and a passed proof with a stored photo. */
async function addWeek(t: Harness, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const weekStart = Date.UTC(2026, 10, 16, 8);
    const lineupId = await ctx.db.insert("lineups", { userId, weekStart, lockedAt: weekStart });
    const taskId = await ctx.db.insert("tasks", {
      userId,
      weekStart,
      slot: "body",
      title: "Run 5k",
      points: 30,
      proofType: "photo",
      status: "verified",
      source: "draft",
    });
    const storageId = await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
    const proofId = await ctx.db.insert("proofs", {
      taskId,
      userId,
      weekStart,
      storageId,
      mediaType: "photo",
      pass: true,
      confidence: 0.9,
      reason: "A run",
      highlight: 5,
      caption: "5k done",
      via: "app",
      createdAt: Date.now(),
    });
    return { lineupId, taskId, proofId, storageId };
  });
}

describe("users.deleteAccount", () => {
  it("deletes the caller's account and everything under it, frees the phone and leaves others alone", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava", phone: "+14155550101" });
    const ben = await addUser(t, { name: "Ben", phone: "+14155550102" });
    const { leagueId } = await createLeague(t, ben, "Dorm 4");
    await asUser(t, ava).mutation(api.leagues.joinByCode, {
      inviteCode: (await t.run((ctx) => ctx.db.get("leagues", leagueId)))!.inviteCode,
    });
    const avas = await addWeek(t, ava);
    const bens = await addWeek(t, ben);
    await t.run(async (ctx) => {
      const accountId = await ctx.db.insert("authAccounts", { userId: ava, provider: "anonymous", providerAccountId: ava });
      await ctx.db.insert("authSessions", { userId: ava, expirationTime: Date.now() + 1000 });
      return accountId;
    });

    await asUser(t, ava).mutation(api.users.deleteAccount, {});

    const left = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", ava),
      lineup: await ctx.db.get("lineups", avas.lineupId),
      task: await ctx.db.get("tasks", avas.taskId),
      proof: await ctx.db.get("proofs", avas.proofId),
      photo: await ctx.db.system.get("_storage", avas.storageId),
      sessions: (await ctx.db.query("authSessions").collect()).filter((row) => row.userId === ava),
      accounts: (await ctx.db.query("authAccounts").collect()).filter((row) => row.userId === ava),
      bensProof: await ctx.db.get("proofs", bens.proofId),
      bensPhoto: await ctx.db.system.get("_storage", bens.storageId),
      bensLineup: await ctx.db.get("lineups", bens.lineupId),
    }));
    expect(left.user).toBeNull();
    expect(left.lineup).toBeNull();
    expect(left.task).toBeNull();
    expect(left.proof).toBeNull();
    expect(left.photo).toBeNull();
    expect(left.sessions).toEqual([]);
    expect(left.accounts).toEqual([]);
    expect(await memberIdsOf(t, leagueId)).toEqual([ben]);
    expect(left.bensProof).not.toBeNull();
    expect(left.bensPhoto).not.toBeNull();
    expect(left.bensLineup).not.toBeNull();

    // A fresh install signs up again with the same number.
    const again = await addUser(t);
    await asUser(t, again).mutation(api.users.createUser, { name: "Ava", phone: "+14155550101" });
    const owners = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", "+14155550101"))
        .collect(),
    );
    expect(owners.map((owner) => owner._id)).toEqual([again]);
  });

  it("deletes the device's own account, never the seeded player it is playing as", async () => {
    const t = newHarness();
    const seeded = await t.run((ctx) => ctx.db.insert("users", { name: "Maya", phone: "+14155550199", isSeed: true }));
    const device = await addUser(t, { name: "Sam", demoActAs: seeded });

    await asUser(t, device).mutation(api.users.deleteAccount, {});

    expect(await t.run((ctx) => ctx.db.get("users", device))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("users", seeded))).not.toBeNull();
  });

  it("refuses a seeded demo player", async () => {
    const t = newHarness();
    const seeded = await t.run((ctx) => ctx.db.insert("users", { name: "Maya", isSeed: true }));

    await expect(asUser(t, seeded).mutation(api.users.deleteAccount, {})).rejects.toMatchObject({
      data: "A demo player can't be deleted",
    });
  });
});

describe("users.setNudges", () => {
  it("is on until turned off", async () => {
    const t = newHarness();
    const ava = await addUser(t, { name: "Ava" });

    expect(await asUser(t, ava).query(api.users.preferences, {})).toEqual({ nudgesOn: true });
    await asUser(t, ava).mutation(api.users.setNudges, { enabled: false });
    expect(await asUser(t, ava).query(api.users.preferences, {})).toEqual({ nudgesOn: false });
  });
});
