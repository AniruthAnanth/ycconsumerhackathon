import { describe, expect, it } from "vitest";

import { CHECK_IN_ACTION, PASS_ACTION } from "@/convex/lib/notificationContent";

import { DUPLICATE_WINDOW_MS, incomingOf, presentationFor, urlToOpen } from "./rules";

const NOW = 1_800_000_000_000;
const onRoster = { pathname: "/", textsOn: false, lastShownAt: undefined, now: NOW };

describe("incomingOf", () => {
  it("keeps Lineup's string fields and drops everything else", () => {
    expect(incomingOf({ id: "drop:1", kind: "drop", url: "/", extra: 4 })).toEqual({ id: "drop:1", kind: "drop", url: "/" });
    expect(incomingOf({ id: 7, url: { path: "/" } })).toEqual({ id: undefined, kind: undefined, url: undefined });
    expect(incomingOf(null)).toEqual({ id: undefined, kind: undefined, url: undefined });
  });
});

describe("presentationFor", () => {
  it("alerts for news the player has not seen", () => {
    expect(presentationFor({ id: "drop:1", kind: "drop" }, onRoster)).toBe("alert");
  });

  it("drops a second copy of the same event inside the duplicate window", () => {
    const again = { ...onRoster, lastShownAt: NOW - DUPLICATE_WINDOW_MS + 1 };
    expect(presentationFor({ id: "drop:1", kind: "drop" }, again)).toBe("none");
  });

  it("shows the same event again once the window has passed", () => {
    const later = { ...onRoster, lastShownAt: NOW - DUPLICATE_WINDOW_MS };
    expect(presentationFor({ id: "arrival:1", kind: "arrival" }, later)).toBe("alert");
  });

  it("says nothing about a verdict while the proof screens are showing it", () => {
    expect(presentationFor({ kind: "verdict" }, { ...onRoster, pathname: "/proof/verdict" })).toBe("none");
    expect(presentationFor({ kind: "verdict" }, onRoster)).toBe("alert");
  });

  it("raises no banner over Demo controls, where it would cover Back", () => {
    const onDemo = { ...onRoster, pathname: "/demo" };
    expect(presentationFor({ id: "arrival:1", kind: "arrival" }, onDemo)).toBe("quiet");
    expect(presentationFor({ id: "drop:1", kind: "drop" }, onDemo)).toBe("quiet");
  });

  it.each(["drop", "challenge", "rival", "nudge"])("keeps a texted %s quiet when texts are on", (kind) => {
    expect(presentationFor({ kind }, { ...onRoster, textsOn: true })).toBe("quiet");
  });

  it.each(["arrival", "verdict", "settlement"])("still alerts for a %s with texts on, because no text carries it", (kind) => {
    expect(presentationFor({ kind }, { ...onRoster, textsOn: true })).toBe("alert");
  });
});

describe("urlToOpen", () => {
  it("opens the notification's screen on a tap or on Check In", () => {
    expect(urlToOpen("expo.modules.notifications.actions.DEFAULT", { url: "/task/abc" })).toBe("/task/abc");
    expect(urlToOpen(CHECK_IN_ACTION, { url: "/proof/abc?title=Gym" })).toBe("/proof/abc?title=Gym");
  });

  it("opens nothing on Pass", () => {
    expect(urlToOpen(PASS_ACTION, { url: "/proof/abc" })).toBeNull();
  });

  it("follows only paths inside the app", () => {
    expect(urlToOpen(CHECK_IN_ACTION, { url: "https://example.com" })).toBeNull();
    expect(urlToOpen(CHECK_IN_ACTION, { url: "//example.com" })).toBeNull();
    expect(urlToOpen(CHECK_IN_ACTION, {})).toBeNull();
  });
});
