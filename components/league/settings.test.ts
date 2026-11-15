import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/convex/lib/schedule";

import {
  FORMAT_CHOICES,
  PAYOUT_CHOICES,
  SEASON_WEEKS_CHOICES,
  seasonProgress,
  settingsSummary,
} from "./settings";

describe("settings choices", () => {
  it("offers the default of every setting, so the picker opens with one pill selected in each group", () => {
    expect(PAYOUT_CHOICES.map((choice) => choice.value)).toContain(DEFAULT_SETTINGS.payout);
    expect(SEASON_WEEKS_CHOICES.map((choice) => choice.value)).toContain(DEFAULT_SETTINGS.seasonWeeks);
    expect(FORMAT_CHOICES.map((choice) => choice.value)).toContain(DEFAULT_SETTINGS.format);
  });
});

describe("seasonProgress", () => {
  it("names the season only after the first", () => {
    expect(seasonProgress(1, 5, 8)).toBe("Week 5 of 8");
    expect(seasonProgress(2, 1, 8)).toBe("Season 2 · Week 1 of 8");
  });
});

describe("settingsSummary", () => {
  it("says the format and when the pot pays out", () => {
    expect(settingsSummary(DEFAULT_SETTINGS)).toBe("Round robin · Weekly payout");
    expect(settingsSummary({ format: "double_round_robin", payout: "season" })).toBe(
      "Double round robin · Season payout",
    );
  });
});
