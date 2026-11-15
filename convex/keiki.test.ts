// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { linkCodeIn } from "./lib/keikiText";
import { DAY_MS, weekStartOf } from "./lib/week";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const PHONE = "+14155550177";

beforeEach(() => {
  vi.stubEnv("KEIKI_SIGNING_SECRET", "whsec_test_secret");
  vi.stubEnv("KEIKI_LINE_NUMBER", "+17796251378");
  vi.stubEnv("KEIKI_JOIN_CODE", "K-ZL2PWU");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function asUser(t: Backend, userId: Id<"users">) {
  return t.withIdentity({ subject: userId + "|session" });
}

/** The link code the app's "Play by text" row puts in the text for this account. */
async function linkCodeFor(t: Backend, userId: Id<"users">) {
  const line = await asUser(t, userId).query(api.keiki.line, {});
  const code = linkCodeIn(decodeURIComponent(line?.smsUrl ?? ""));
  if (code === null) throw new Error("The link carries no code");
  return code;
}

function playerOn(t: Backend, phone: string) {
  return t.query(internal.keiki.playerFor, { conversationId: phone, leagueTag: null });
}

describe("keiki.takeTurn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules one answer for a turn that is delivered twice", async () => {
    const t = convexTest(schema, modules);
    const turn = {
      turnId: "turn-1",
      agentId: "agent-1",
      conversationId: PHONE,
      channel: "imessage",
      turnUrl: "https://keiki.example/api/v1/turns/turn-1",
      messages: [{ text: "STANDINGS", silent: false, attachments: [] }],
      history: [],
    };

    await t.mutation(internal.keiki.takeTurn, { turn });
    await t.mutation(internal.keiki.takeTurn, { turn });
    await t.mutation(internal.keiki.takeTurn, { turn: { ...turn, turnId: "turn-2" } });

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const answers = scheduled.filter((job) => job.name.includes("answerTurn")).map((job) => job.args[0].turn.turnId);
    expect(answers.sort()).toEqual(["turn-1", "turn-2"]);
  });
});

describe("keiki.proofTargets", () => {
  it("lists this week's open tasks only, oldest first", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const thisWeek = weekStartOf(now);
    const me = await t.run((ctx) => ctx.db.insert("users", { name: "Me" }));
    const task = { userId: me, slot: "body", points: 30, proofType: "photo", status: "open", source: "draft" } as const;
    await t.run(async (ctx) => {
      await ctx.db.insert("tasks", { ...task, title: "Last week's run", weekStart: thisWeek - 7 * DAY_MS });
      await ctx.db.insert("tasks", { ...task, title: "Gym session", weekStart: thisWeek });
      await ctx.db.insert("tasks", { ...task, title: "Do laundry", weekStart: thisWeek, slot: "chores" });
      await ctx.db.insert("tasks", { ...task, title: "Already done", weekStart: thisWeek, status: "verified" });
      await ctx.db.insert("tasks", { ...task, title: "Problem Set 6", weekStart: thisWeek, slot: "flex", proofType: "canvas" });
    });

    const targets = await t.query(internal.keiki.proofTargets, { userId: me, now });
    expect(targets.photoTasks.map((open) => open.title)).toEqual(["Gym session", "Do laundry"]);
    expect(targets.canvasTasks).toEqual([{ title: "Problem Set 6" }]);
  });
});

describe("keiki.opponentOf", () => {
  it("is the other side of the player's pair in the league's newest week", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, me, sam, maya } = await t.run(async (ctx) => {
      const [me, sam, maya] = await Promise.all(["Me", "Sam", "Maya"].map((name) => ctx.db.insert("users", { name })));
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 12,
        createdBy: me,
      });
      const week = { leagueId, startsAt: 0, endsAt: 1, status: "settled" as const };
      const lastWeek = await ctx.db.insert("weeks", { ...week, number: 1 });
      await ctx.db.insert("matchups", { weekId: lastWeek, userA: me, userB: maya });
      const thisWeek = await ctx.db.insert("weeks", { ...week, number: 2, status: "open" });
      await ctx.db.insert("matchups", { weekId: thisWeek, userA: sam, userB: me });
      return { leagueId, me, sam, maya };
    });

    expect(await t.query(internal.keiki.opponentOf, { leagueId, userId: me })).toBe(sam);
    expect(await t.query(internal.keiki.opponentOf, { leagueId, userId: sam })).toBe(me);
    expect(await t.query(internal.keiki.opponentOf, { leagueId, userId: maya })).toBeNull();
  });
});

describe("keiki.linkPhone", () => {
  it("ties the number a link code is texted from to that account and opts it in", async () => {
    const t = convexTest(schema, modules);
    const me = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    expect(await playerOn(t, PHONE)).toBeNull();

    expect(await t.mutation(internal.keiki.linkPhone, { phone: PHONE, ...(await linkCodeFor(t, me)) })).toBe(true);

    expect(await playerOn(t, PHONE)).toMatchObject({ accountId: me, userId: me, optIn: true });
    expect(await asUser(t, me).query(api.keiki.line, {})).toMatchObject({ optedIn: true });
    expect(await t.query(internal.keiki.phonesOf, { userId: me })).toEqual([PHONE]);
  });

  it("moves the number to the account that linked last", async () => {
    const t = convexTest(schema, modules);
    const oldInstall = await t.run((ctx) => ctx.db.insert("users", { name: "Sam", phone: PHONE, keikiOptIn: true }));
    const newInstall = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));

    await t.mutation(internal.keiki.linkPhone, { phone: PHONE, ...(await linkCodeFor(t, newInstall)) });

    expect(await playerOn(t, PHONE)).toMatchObject({ accountId: newInstall });
    expect(await t.run((ctx) => ctx.db.get("users", oldInstall))).not.toHaveProperty("phone");
  });

  it("texts as the seeded player the device is acting as, and gets that player's texts", async () => {
    const t = convexTest(schema, modules);
    const maya = await t.run((ctx) => ctx.db.insert("users", { name: "Maya Chen", phone: "+14155550101", isSeed: true }));
    const device = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true, demoActAs: maya }));

    await t.mutation(internal.keiki.linkPhone, { phone: PHONE, ...(await linkCodeFor(t, device)) });

    expect(await playerOn(t, PHONE)).toMatchObject({ accountId: device, userId: maya });
    expect(await t.query(internal.keiki.phonesOf, { userId: maya })).toEqual([PHONE]);
  });

  it("refuses a number a seeded player holds, as onboarding does", async () => {
    const t = convexTest(schema, modules);
    const maya = await t.run((ctx) => ctx.db.insert("users", { name: "Maya Chen", phone: PHONE, isSeed: true }));
    const me = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));

    expect(await t.mutation(internal.keiki.linkPhone, { phone: PHONE, ...(await linkCodeFor(t, me)) })).toBe(false);

    expect(await playerOn(t, PHONE)).toMatchObject({ accountId: maya });
    expect(await t.run((ctx) => ctx.db.get("users", me))).not.toHaveProperty("phone");
  });

  it("links nothing for a code this backend did not write", async () => {
    const t = convexTest(schema, modules);
    const me = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const { createdMs } = await linkCodeFor(t, me);
    const forged = createdMs.toString(36).toUpperCase() + "-00000000";

    expect(await t.mutation(internal.keiki.linkPhone, { phone: PHONE, code: forged, createdMs })).toBe(false);
    expect(await playerOn(t, PHONE)).toBeNull();
  });
});
