import { describe, expect, it } from "vitest";

import { formatCountdown, formatUsd, inviteMessage, isSettled, payoutLine, stakeLine } from "./leagueText";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("payoutLine", () => {
  it("names the kind alone until Whop has accepted the payout", () => {
    expect(payoutLine({ kind: "refund" })).toBe("Refund");
    expect(payoutLine({ kind: "winnings" })).toBe("Winnings");
  });

  it("adds the start of Whop's id once the money has moved", () => {
    expect(payoutLine({ kind: "refund", whopId: "pay_z8Bp1nEBq4XyZ" })).toBe("Refund | Paid on Whop pay_z8Bp1nEB...");
    expect(payoutLine({ kind: "winnings", whopId: "ctt_sent" })).toBe("Winnings | Paid on Whop ctt_sent");
  });
});

describe("formatUsd", () => {
  it("drops the cents on whole amounts", () => {
    expect(formatUsd(20)).toBe("$20");
    expect(formatUsd(0)).toBe("$0");
  });

  it("keeps two decimals otherwise", () => {
    expect(formatUsd(36.5)).toBe("$36.50");
    expect(formatUsd(7.25)).toBe("$7.25");
  });
});

describe("stakeLine", () => {
  it("reads Free for a league with no buy-in", () => {
    expect(stakeLine({ stakeUsd: 0, paid: false })).toBe("Free");
  });

  it("shows the buy-in and whether it is paid", () => {
    expect(stakeLine({ stakeUsd: 20, paid: true })).toBe("$20 buy-in | Paid");
    expect(stakeLine({ stakeUsd: 5, paid: false })).toBe("$5 buy-in | Unpaid");
  });
});

describe("inviteMessage", () => {
  it("names the league and its code", () => {
    expect(inviteMessage({ name: "Dorm 4", inviteCode: "K7QF2M" })).toBe('Join my Lineup league "Dorm 4" with code K7QF2M.');
  });
});

describe("isSettled", () => {
  const now = 1_000_000;

  it("is settled as soon as payouts exist, even before the scheduled end", () => {
    expect(isSettled({ settlesAt: now + 11 * HOUR, payouts: [] }, now)).toBe(true);
  });

  it("is settled once the scheduled end has passed", () => {
    expect(isSettled({ settlesAt: now }, now)).toBe(true);
    expect(isSettled({ settlesAt: now - MINUTE }, now)).toBe(true);
  });

  it("is open while the end is ahead and nothing has been paid out", () => {
    expect(isSettled({ settlesAt: now + MINUTE }, now)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("shows days and hours when a day or more remains", () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR + 30 * MINUTE)).toBe("2d 4h");
    expect(formatCountdown(DAY)).toBe("1d 0h");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatCountdown(3 * HOUR + 12 * MINUTE)).toBe("3h 12m");
  });

  it("shows minutes alone under an hour", () => {
    expect(formatCountdown(12 * MINUTE)).toBe("12m");
    expect(formatCountdown(20_000)).toBe("1m");
  });

  it("reads Settled at or below zero", () => {
    expect(formatCountdown(0)).toBe("Settled");
    expect(formatCountdown(-5 * MINUTE)).toBe("Settled");
  });
});
