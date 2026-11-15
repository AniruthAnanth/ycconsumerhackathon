/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Doc, Id } from "./_generated/dataModel";
import type * as demoModule from "./demo";
import { weekStartOf } from "./lib/week";
import schema from "./schema";

// Typed from the module source, so this compiles before and after codegen lists the module.
type Modules = ApiFromModules<{ demo: typeof demoModule }>;
const api = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "public">>;

const modules = import.meta.glob("./**/*.ts");

// Wednesday 18 November 2026, noon Pacific.
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0);
const WEEK = weekStartOf(NOW);
const DOLORES_PARK = { name: "Dolores Park", lat: 37.7596, lng: -122.4269 };
const STAGE = { lat: 37.7749, lng: -122.4194 };
const PINNED = { name: "YC office", ...STAGE };

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

function asUser(t: Harness, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function addUser(t: Harness, fields: { name?: string; demoActAs?: Id<"users"> } = {}) {
  return await t.run((ctx) => ctx.db.insert("users", fields));
}

async function addTask(t: Harness, userId: Id<"users">, fields: Partial<Doc<"tasks">> = {}) {
  return await t.run((ctx) =>
    ctx.db.insert("tasks", {
      userId,
      weekStart: WEEK,
      slot: "people",
      title: "Meet the team at the park",
      points: 30,
      proofType: "photo_location",
      place: DOLORES_PARK,
      status: "open",
      source: "draft",
      ...fields,
    }),
  );
}

async function tasksOf(t: Harness, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("tasks")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", WEEK))
      .collect(),
  );
}

describe("demo.pinCheckIn", () => {
  it("moves the player's open location task to the phone and leaves the rest of it alone", async () => {
    const t = newHarness();
    const me = await addUser(t);
    const taskId = await addTask(t, me);

    expect(await asUser(t, me).mutation(api.demo.pinCheckIn, STAGE)).toBe(taskId);

    expect(await tasksOf(t, me)).toMatchObject([
      { _id: taskId, title: "Meet the team at the park", points: 30, status: "open", place: PINNED },
    ]);
  });

  it("adds a check-in when the player has no location task left to prove", async () => {
    const t = newHarness();
    const me = await addUser(t);
    const verified = await addTask(t, me, { status: "verified" });
    // "failed" is a drop that closed unproven: proofs.verify refuses it, so it is no use to pin.
    const closed = await addTask(t, me, { status: "failed", source: "drop" });
    await addTask(t, me, { proofType: "photo", place: undefined, title: "Call mom" });
    await addTask(t, me, { weekStart: WEEK - 7 * 24 * 60 * 60 * 1000, title: "Last week's check-in" });

    const added = await asUser(t, me).mutation(api.demo.pinCheckIn, STAGE);

    const tasks = await tasksOf(t, me);
    expect(tasks.find((task) => task._id === added)).toMatchObject({
      title: "Check in at the YC office",
      slot: "people",
      points: 30,
      proofType: "photo_location",
      place: PINNED,
      status: "open",
      source: "flex",
      weekStart: WEEK,
    });
    expect(tasks.find((task) => task._id === verified)?.place).toEqual(DOLORES_PARK);
    expect(tasks.find((task) => task._id === closed)?.place).toEqual(DOLORES_PARK);
  });

  it("pins the seeded player a switched phone is playing as, and nobody else", async () => {
    const t = newHarness();
    const maya = await addUser(t, { name: "Maya Chen" });
    const sam = await addUser(t, { name: "Sam Patel" });
    const phone = await addUser(t, { demoActAs: maya });
    const mayasTask = await addTask(t, maya);
    await addTask(t, sam);

    expect(await asUser(t, phone).mutation(api.demo.pinCheckIn, STAGE)).toBe(mayasTask);

    expect((await tasksOf(t, maya))[0].place).toEqual(PINNED);
    expect((await tasksOf(t, sam))[0].place).toEqual(DOLORES_PARK);
    expect(await tasksOf(t, phone)).toEqual([]);
  });

  it("refuses a caller who is not signed in", async () => {
    const t = newHarness();
    await expect(t.mutation(api.demo.pinCheckIn, STAGE)).rejects.toThrow("Not signed in");
  });
});
