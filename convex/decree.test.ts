/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import { askJson } from "./ai";
import schema from "./schema";

vi.mock("./ai", async (original) => ({ ...(await original<typeof import("./ai")>()), askJson: vi.fn() }));

const modules = import.meta.glob("./**/*.ts");
const getDecree = makeFunctionReference<"query">("decree:get");
const generate = makeFunctionReference<"action">("decree:generate");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

beforeEach(() => {
  vi.mocked(askJson).mockReset();
  vi.mocked(askJson).mockResolvedValue({
    proclamation: "Hear ye \u2014 a fine herald\u2019s word.",
    epithet: "Sir Ava the Unwashed Laundry",
  });
});

describe("decree cache", () => {
  it("writes once, serves the cache, and rewrites when the stats change", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    const me = asUser(t, ava);

    expect((await me.query(getDecree, { userId: ava })).decree).toBeNull();

    const first = await me.action(generate, { userId: ava });
    expect(first.text).toBe("Hear ye, a fine herald\u2019s word.");
    expect(first.text).not.toMatch(/[\u2013\u2014]/);
    expect((await me.query(getDecree, { userId: ava })).decree).toEqual(first);

    await me.action(generate, { userId: ava });
    expect(askJson).toHaveBeenCalledTimes(1);

    // A new name changes the stats, so the cached decree no longer matches them.
    await t.run((ctx) => ctx.db.patch("users", ava, { name: "Ava the Bold" }));
    expect((await me.query(getDecree, { userId: ava })).decree).toBeNull();
    await me.action(generate, { userId: ava });
    expect(askJson).toHaveBeenCalledTimes(2);
  });

  it("rerolls only for the player themself", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    const sam = await t.run((ctx) => ctx.db.insert("users", { name: "Sam" }));

    await asUser(t, ava).action(generate, { userId: ava });
    await asUser(t, ava).action(generate, { userId: ava, reroll: true });
    expect(askJson).toHaveBeenCalledTimes(2);

    await expect(asUser(t, sam).action(generate, { userId: ava, reroll: true })).rejects.toThrow(/Only you/);
    expect(askJson).toHaveBeenCalledTimes(2);
  });

  it("regenerates when the cached hash is stale", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    await t.run((ctx) =>
      ctx.db.insert("decrees", { userId: ava, statsHash: "stale", text: "Old news", epithet: "Sir Old", createdAt: 0 }),
    );

    expect((await asUser(t, ava).query(getDecree, { userId: ava })).decree).toBeNull();
    await asUser(t, ava).action(generate, { userId: ava });
    expect(askJson).toHaveBeenCalledTimes(1);
    const rows = await t.run((ctx) => ctx.db.query("decrees").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("Hear ye, a fine herald\u2019s word.");
  });
});
