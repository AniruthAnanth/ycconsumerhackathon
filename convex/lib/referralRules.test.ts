import { describe, expect, it } from "vitest";

import { appLink, badgeFor, countsAsReferral, inviteMessage, invitePage, isToken, makeToken, recruiterPoints, sanitizedAppPrefix } from "./referralRules";

describe("countsAsReferral", () => {
  const base = { inviterId: "a", inviteeId: "b", inviteeLeagues: 0, alreadyReferred: false };
  it("counts a new player brought in by someone else", () => expect(countsAsReferral(base)).toBe(true));
  it("never counts the inviter", () => expect(countsAsReferral({ ...base, inviteeId: "a" })).toBe(false));
  it("never counts a player already in a league", () => expect(countsAsReferral({ ...base, inviteeLeagues: 1 })).toBe(false));
  it("never counts a player twice", () => expect(countsAsReferral({ ...base, alreadyReferred: true })).toBe(false));
});

describe("rewards", () => {
  it("pays 25 per friend who locked a lineup", () => expect(recruiterPoints(3)).toBe(75));
  it("badges at one and three friends", () => {
    expect(badgeFor(0)).toBeNull();
    expect(badgeFor(1)).toBe("Recruiter");
    expect(badgeFor(3)).toBe("Top Recruiter");
  });
});

describe("tokens and links", () => {
  it("makes tokens it accepts", () => {
    const token = makeToken();
    expect(isToken(token)).toBe(true);
    expect(isToken("abc")).toBe(false);
    expect(isToken("O0O0O0O")).toBe(false);
  });
  it("appends the token to an app prefix", () => {
    expect(appLink("exp://10.0.0.2:8081/--/invite", "ABCDEFG")).toBe("exp://10.0.0.2:8081/--/invite/ABCDEFG");
    expect(appLink(undefined, "ABCDEFG")).toBe("lineup://invite/ABCDEFG");
  });
  it("refuses a prefix that is not an app or web link", () => {
    expect(sanitizedAppPrefix("javascript:alert(1)")).toBeUndefined();
    expect(appLink("javascript:alert(1)", "ABCDEFG")).toBe("lineup://invite/ABCDEFG");
  });
  it("puts the link and the code in the message", () => {
    const text = inviteMessage({ inviterName: "Maya Chen", leagueName: "YC Hackathon", versus: false, inviteCode: "YCHACK", url: "https://x/i/ABCDEFG" });
    expect(text).toContain("Maya invited you to YC Hackathon");
    expect(text).toContain("https://x/i/ABCDEFG");
    expect(text).toContain("YCHACK");
  });
  it("escapes names on the page", () => {
    const html = invitePage({ inviterName: "<b>", leagueName: "L", inviteCode: "C", openUrl: "lineup://invite/ABCDEFG" });
    expect(html).not.toContain("<b> invited");
    expect(html).toContain("&lt;b&gt;");
  });
});
