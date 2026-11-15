import { describe, expect, it } from "vitest";

import { friendStatusLine, inviteDetailLine, recruiterPillText, routeAfterAccept, stakeLabel } from "./inviteRoute";

describe("routeAfterAccept", () => {
  it("sends a player with no league yet to the draft", () => {
    expect(routeAfterAccept({ hadLeagues: false, mode: "league" })).toBe("/draft");
    expect(routeAfterAccept({ hadLeagues: false, mode: "versus" })).toBe("/draft");
  });
  it("sends a player already playing to the league, or the matchup for a 1v1", () => {
    expect(routeAfterAccept({ hadLeagues: true, mode: "league" })).toBe("/(tabs)/league");
    expect(routeAfterAccept({ hadLeagues: true, mode: "versus" })).toBe("/(tabs)/matchup");
  });
});

describe("stakeLabel and inviteDetailLine", () => {
  it("names the buy-in or says Free", () => {
    expect(stakeLabel(5)).toBe("$5 buy-in");
    expect(stakeLabel(2.5)).toBe("$2.50 buy-in");
    expect(stakeLabel(0)).toBe("Free");
  });
  it("adds 1v1 challenge only for versus", () => {
    expect(inviteDetailLine({ mode: "versus", stakeUsd: 5, memberCount: 1 })).toBe("1v1 challenge · $5 buy-in · 1 player");
    expect(inviteDetailLine({ mode: "league", stakeUsd: 0, memberCount: 6 })).toBe("Free · 6 players");
  });
});

describe("recruiterPillText", () => {
  it("is null without a badge", () => {
    expect(recruiterPillText({ recruiterPoints: 0, invited: 2, locked: 0, badge: null })).toBeNull();
  });
  it("names the badge, locked friends and points", () => {
    expect(recruiterPillText({ recruiterPoints: 75, invited: 4, locked: 3, badge: "Top Recruiter" })).toBe("TOP RECRUITER · 3 friends · +75");
    expect(recruiterPillText({ recruiterPoints: 25, invited: 1, locked: 1, badge: "Recruiter" })).toBe("RECRUITER · 1 friend · +25");
  });
});

describe("friendStatusLine", () => {
  it("shows the reward once the friend locked a lineup", () => {
    expect(friendStatusLine({ userId: "u" as never, name: "Sam", status: "locked", points: 25 })).toBe("Locked a lineup +25");
    expect(friendStatusLine({ userId: "u" as never, name: "Sam", status: "joined", points: 0 })).toBe("Joined");
  });
});
