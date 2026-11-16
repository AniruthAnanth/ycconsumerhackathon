import { describe, expect, it } from "vitest";

import { addressesSunny } from "./leagueChat";

describe("addressesSunny", () => {
  it("answers a mention or a question", () => {
    expect(addressesSunny("@Sunny who's winning")).toBe(true);
    expect(addressesSunny("who's winning?")).toBe(true);
  });

  it("stays quiet on chatter", () => {
    expect(addressesSunny("nice proof")).toBe(false);
  });
});
