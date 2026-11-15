// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { dropOpened } from "./lib/notificationContent";
import { reachableByPush, readTickets, shouldPush } from "./push";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Backend = TestConvex<typeof schema>;

const TOKEN = "ExponentPushToken[this-phone]";
const OTHER_TOKEN = "ExpoPushToken[another-phone]";
const PHONE = "+14155550177";
const NOW = Date.UTC(2026, 10, 15, 20);

/** A quick-time drop, built the way drops.ts builds it for the app and for the push alike. */
const DROP = dropOpened(
  { dropId: "drop1", title: "20 push-ups", points: 40, gesture: "three fingers up", closesAt: NOW + 2 * 60 * 60 * 1000 },
  NOW,
);

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Calls the backend as this device: Convex Auth puts the account id first in the token subject. */
function as(t: Backend, accountId: Id<"users">) {
  return t.withIdentity({ subject: `${accountId}|session` });
}

/** An account, with the token its device registered when one is given. */
async function addAccount(
  t: Backend,
  fields: Partial<Omit<Doc<"users">, "_id" | "_creationTime">> = {},
  token?: string,
): Promise<Id<"users">> {
  const accountId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true, ...fields }));
  if (token !== undefined) await as(t, accountId).mutation(api.push.registerToken, { token });
  return accountId;
}

async function tokenRows(t: Backend): Promise<{ userId: Id<"users">; token: string }[]> {
  const rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
  return rows.map(({ userId, token }) => ({ userId, token }));
}

/** Expo's push service: answers every request with these tickets and records what it was sent. */
function stubExpo(tickets: unknown[]) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ data: tickets }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("shouldPush, the one-alert rule", () => {
  it("pushes an account that has a token, left Push on and does not play by text", () => {
    expect(shouldPush({}, true)).toBe(true);
    expect(shouldPush({ pushEnabled: true, keikiOptIn: false, phone: PHONE }, true)).toBe(true);
  });

  it("has nowhere to push without a token", () => {
    expect(shouldPush({}, false)).toBe(false);
  });

  it("respects the Push switch", () => {
    expect(shouldPush({ pushEnabled: false }, true)).toBe(false);
  });

  it("leaves a player who plays by text to the text", () => {
    expect(shouldPush({ keikiOptIn: true, phone: PHONE }, true)).toBe(false);
  });

  it("pushes a player who opted in to texts but has no number to text", () => {
    expect(shouldPush({ keikiOptIn: true }, true)).toBe(true);
  });
});

describe("readTickets", () => {
  it("counts what Expo accepted and names the tokens it no longer knows", () => {
    const reply = {
      data: [
        { status: "ok", id: "ticket-1" },
        { status: "error", message: "not a registered recipient", details: { error: "DeviceNotRegistered" } },
        { status: "error", message: "too big", details: { error: "MessageTooBig" } },
      ],
    };

    expect(readTickets([TOKEN, OTHER_TOKEN, "ExponentPushToken[third]"], reply)).toEqual({
      accepted: 1,
      unregistered: [OTHER_TOKEN],
    });
  });

  it("forgets nothing when the reply is not tickets", () => {
    for (const reply of [null, "Bad Gateway", { errors: [{ code: "TOO_MANY_REQUESTS" }] }, { data: "oops" }]) {
      expect(readTickets([TOKEN], reply)).toEqual({ accepted: 0, unregistered: [] });
    }
  });
});

describe("push.registerToken", () => {
  it("keeps one row however often the app registers the same token", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, {}, TOKEN);

    await as(t, me).mutation(api.push.registerToken, { token: TOKEN });

    expect(await tokenRows(t)).toEqual([{ userId: me, token: TOKEN }]);
  });

  it("replaces the account's token when its device is given a new one", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, {}, TOKEN);

    await as(t, me).mutation(api.push.registerToken, { token: OTHER_TOKEN });

    expect(await tokenRows(t)).toEqual([{ userId: me, token: OTHER_TOKEN }]);
  });

  it("moves a token to the account that registered it last", async () => {
    const t = convexTest(schema, modules);
    const oldInstall = await addAccount(t, {}, TOKEN);
    const newInstall = await addAccount(t, {}, TOKEN);

    expect(await tokenRows(t)).toEqual([{ userId: newInstall, token: TOKEN }]);
    expect(await as(t, oldInstall).query(api.push.settings, {})).toMatchObject({ hasToken: false });
  });

  it("refuses anything that is not an Expo push token", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t);

    for (const junk of ["", "junk", "ExponentPushToken[]", "ExponentPushToken[abc", "x ExponentPushToken[abc]"]) {
      await expect(as(t, me).mutation(api.push.registerToken, { token: junk })).rejects.toThrow(/not an Expo push token/);
    }
    expect(await tokenRows(t)).toEqual([]);
  });

  it("refuses a caller who is not signed in", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.push.registerToken, { token: TOKEN })).rejects.toThrow(/Not signed in/);
  });
});

describe("push.settings", () => {
  it("starts with Push on, texts off and no token", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t);

    expect(await as(t, me).query(api.push.settings, {})).toEqual({ pushOn: true, textsOn: false, hasToken: false });
  });

  it("follows the Push switch, the texting opt-in and the device's token", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, { phone: PHONE, keikiOptIn: true }, TOKEN);

    await as(t, me).mutation(api.push.setEnabled, { enabled: false });
    expect(await as(t, me).query(api.push.settings, {})).toEqual({ pushOn: false, textsOn: true, hasToken: true });

    await as(t, me).mutation(api.push.setEnabled, { enabled: true });
    expect(await as(t, me).query(api.push.settings, {})).toEqual({ pushOn: true, textsOn: true, hasToken: true });
  });

  it("is about the device's own account, not the player it is acting as", async () => {
    const t = convexTest(schema, modules);
    const maya = await addAccount(t, { name: "Maya Chen", isSeed: true });
    const device = await addAccount(t, { demoActAs: maya }, TOKEN);

    await as(t, device).mutation(api.push.setEnabled, { enabled: false });

    expect(await as(t, device).query(api.push.settings, {})).toMatchObject({ pushOn: false, hasToken: true });
    expect(await tokenRows(t)).toEqual([{ userId: device, token: TOKEN }]);
    expect(await t.run((ctx) => ctx.db.get("users", maya))).not.toHaveProperty("pushEnabled");
  });
});

describe("who a push reaches", () => {
  const tokensFor = (t: Backend, userId: Id<"users">) => t.query(internal.push.tokensOf, { userId });
  const reachable = (t: Backend, userId: Id<"users">) => t.run((ctx) => reachableByPush(ctx, userId));

  it("reaches a player's own device", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, {}, TOKEN);

    expect(await tokensFor(t, me)).toEqual([TOKEN]);
    expect(await reachable(t, me)).toBe(true);
  });

  it("does not push a player whose texts are on: the text is their alert", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, { phone: PHONE, keikiOptIn: true }, TOKEN);

    expect(await tokensFor(t, me)).toEqual([]);
    expect(await reachable(t, me)).toBe(false);
  });

  it("does not push a player who turned Push off", async () => {
    const t = convexTest(schema, modules);
    const me = await addAccount(t, { pushEnabled: false }, TOKEN);

    expect(await tokensFor(t, me)).toEqual([]);
    expect(await reachable(t, me)).toBe(false);
  });

  it("reaches a device acting as the player, whatever the seeded player's own row says", async () => {
    const t = convexTest(schema, modules);
    const maya = await addAccount(t, { name: "Maya Chen", phone: "+14155550101", keikiOptIn: true, isSeed: true });
    const device = await addAccount(t, { demoActAs: maya }, TOKEN);

    expect(await tokensFor(t, maya)).toEqual([TOKEN]);
    expect(await reachable(t, maya)).toBe(true);

    // The rule is the device's own: once that phone plays by text, the text is its alert.
    await t.run((ctx) => ctx.db.patch("users", device, { phone: PHONE, keikiOptIn: true }));
    expect(await tokensFor(t, maya)).toEqual([]);
  });

  it("reaches every member of a league once, and nobody outside it", async () => {
    const t = convexTest(schema, modules);
    const maya = await addAccount(t, { name: "Maya Chen", isSeed: true });
    const sam = await addAccount(t, { name: "Sam" }, OTHER_TOKEN);
    // In the league as itself and acting as Maya: still one push.
    const device = await addAccount(t, { demoActAs: maya }, TOKEN);
    await addAccount(t, { name: "Outsider" }, "ExponentPushToken[outsider]");
    const leagueId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "YC Hackathon",
        inviteCode: "YCHACK",
        stakeUsd: 0,
        visibility: "private",
        maxMembers: 12,
        createdBy: maya,
      });
      for (const userId of [maya, sam, device]) {
        await ctx.db.insert("memberships", { leagueId, userId, paid: false, joinedAt: NOW });
      }
      return leagueId;
    });

    const tokens = await t.query(internal.push.tokensOf, { leagueId });

    expect([...tokens].sort()).toEqual([OTHER_TOKEN, TOKEN].sort());
  });
});

describe("push.send", () => {
  it("asks Expo nothing when no one can be pushed", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = stubExpo([]);
    const expoGo = await addAccount(t);
    const texter = await addAccount(t, { phone: PHONE, keikiOptIn: true }, TOKEN);

    await t.action(internal.push.send, { userId: expoGo, notification: DROP });
    await t.action(internal.push.send, { userId: texter, notification: DROP });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the notification to Expo with the id, kind and url the app reads back", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = stubExpo([{ status: "ok", id: "ticket-1" }]);
    const me = await addAccount(t, {}, TOKEN);

    await t.action(internal.push.send, { userId: me, notification: DROP });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual([
      {
        to: TOKEN,
        title: "Quick-time drop: +40",
        body: "20 push-ups. Show three fingers up in the photo. 2h left.",
        sound: "default",
        data: { id: "drop:drop1", kind: "drop", url: "/" },
        categoryId: "checkin",
      },
    ]);
  });

  it("forgets a token Expo says is no longer registered, and keeps the rest", async () => {
    const t = convexTest(schema, modules);
    const gone = await addAccount(t, {}, TOKEN);
    const here = await addAccount(t, {}, OTHER_TOKEN);
    stubExpo([{ status: "error", message: "not a registered recipient", details: { error: "DeviceNotRegistered" } }]);

    await t.action(internal.push.send, { userId: gone, notification: DROP });

    expect(await tokenRows(t)).toEqual([{ userId: here, token: OTHER_TOKEN }]);
  });
});
