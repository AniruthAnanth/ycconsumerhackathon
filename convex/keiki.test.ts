// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { linkCodeIn } from "./lib/keikiText";
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

  it("links nothing for a code this backend did not write", async () => {
    const t = convexTest(schema, modules);
    const me = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const { createdMs } = await linkCodeFor(t, me);
    const forged = createdMs.toString(36).toUpperCase() + "-00000000";

    expect(await t.mutation(internal.keiki.linkPhone, { phone: PHONE, code: forged, createdMs })).toBe(false);
    expect(await playerOn(t, PHONE)).toBeNull();
  });
});
