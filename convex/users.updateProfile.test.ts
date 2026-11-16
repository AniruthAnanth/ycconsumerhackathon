/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { anyApi, type ApiFromModules, type FilterApi, type FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import type * as usersModule from "./users";

type Modules = ApiFromModules<{ users: typeof usersModule }>;
const api = anyApi as unknown as FilterApi<Modules, FunctionReference<any, "public">>;
const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function storeFile(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.storage.store(new Blob(["photo"])));
}

describe("users.updateProfile", () => {
  it("renames the caller with a trimmed name", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    await asUser(t, ava).mutation(api.users.updateProfile, { name: "  Ava Lee  " });
    expect((await t.run((ctx) => ctx.db.get("users", ava)))?.name).toBe("Ava Lee");
  });

  it("refuses an empty or over-long name", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    await expect(asUser(t, ava).mutation(api.users.updateProfile, { name: "   " })).rejects.toThrow(/1 to 40/);
    await expect(asUser(t, ava).mutation(api.users.updateProfile, { name: "x".repeat(41) })).rejects.toThrow(/1 to 40/);
    expect((await t.run((ctx) => ctx.db.get("users", ava)))?.name).toBe("Ava");
  });

  it("sets, replaces and removes the photo, deleting the old file", async () => {
    const t = convexTest(schema, modules);
    const ava = await t.run((ctx) => ctx.db.insert("users", { name: "Ava" }));
    const first = await storeFile(t);
    const second = await storeFile(t);

    await asUser(t, ava).mutation(api.users.updateProfile, { avatarStorageId: first });
    await asUser(t, ava).mutation(api.users.updateProfile, { avatarStorageId: second });
    expect((await t.run((ctx) => ctx.db.get("users", ava)))?.avatarStorageId).toBe(second);
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();

    await asUser(t, ava).mutation(api.users.updateProfile, { avatarStorageId: null });
    expect((await t.run((ctx) => ctx.db.get("users", ava)))?.avatarStorageId).toBeUndefined();
    expect(await t.run((ctx) => ctx.storage.getUrl(second))).toBeNull();
  });

  it("writes only the player the caller plays as, and keeps a seeded player's shared photo", async () => {
    const t = convexTest(schema, modules);
    const photo = await storeFile(t);
    const maya = await t.run((ctx) => ctx.db.insert("users", { name: "Maya", isSeed: true, avatarStorageId: photo }));
    const device = await t.run((ctx) => ctx.db.insert("users", { name: "Device", demoActAs: maya }));
    const sam = await t.run((ctx) => ctx.db.insert("users", { name: "Sam" }));

    await asUser(t, device).mutation(api.users.updateProfile, { name: "Maya Q", avatarStorageId: null });

    expect((await t.run((ctx) => ctx.db.get("users", maya)))?.name).toBe("Maya Q");
    expect(await t.run((ctx) => ctx.storage.getUrl(photo))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get("users", device)))?.name).toBe("Device");
    expect((await t.run((ctx) => ctx.db.get("users", sam)))?.name).toBe("Sam");
  });

  it("refuses a signed-out caller", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.updateProfile, { name: "Ava" })).rejects.toThrow();
  });
});
