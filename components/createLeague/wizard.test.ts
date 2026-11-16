import { describe, expect, it } from "vitest";

import {
  blockerOf,
  defaultDraft,
  hasUnsavedWork,
  isPresetStake,
  isRecommended,
  parseStake,
  potExample,
  progressOf,
  RECOMMENDED_SETTINGS,
  recommendedLines,
  reviewRows,
  stepAfter,
  stepBefore,
  type Draft,
  type Step,
} from "./wizard";

describe("defaultDraft", () => {
  it("answers every step, so Next works all the way through", () => {
    const draft = defaultDraft("Maya Chen");
    expect(draft).toEqual({ name: "Maya's League", kind: "league", stakeUsd: 0, settings: RECOMMENDED_SETTINGS });
    for (const step of ["name", "kind", "stake", "season", "review"] as Step[]) {
      expect(blockerOf(step, draft)).toBeNull();
    }
  });

  it("still names the league while the player's name is unknown", () => {
    expect(defaultDraft(undefined).name).toBe("My League");
    expect(defaultDraft("   ").name).toBe("My League");
  });

  it("keeps a long first name inside the name limit", () => {
    expect(defaultDraft("A".repeat(60)).name).toHaveLength(40);
  });
});

describe("steps", () => {
  it("walks name, who's playing, stakes, season, then review", () => {
    const walked: Step[] = ["name"];
    while (walked[walked.length - 1] !== "review") walked.push(stepAfter(walked[walked.length - 1]));
    expect(walked).toEqual(["name", "kind", "stake", "season", "review"]);
    expect(stepAfter("review")).toBe("review");
  });

  it("goes back one step at a time and leaves from the first", () => {
    expect(stepBefore("review")).toBe("season");
    expect(stepBefore("kind")).toBe("name");
    expect(stepBefore("name")).toBeNull();
  });

  it("counts the four decisions and fills the bar on review", () => {
    expect(progressOf("name")).toEqual({ label: "Step 1 of 4", ratio: 0.25 });
    expect(progressOf("season")).toEqual({ label: "Step 4 of 4", ratio: 1 });
    expect(progressOf("review")).toEqual({ label: "Review", ratio: 1 });
  });
});

describe("blockerOf", () => {
  const draft: Draft = defaultDraft("Maya");

  it("asks for a name on every step, since the fast path can skip ahead", () => {
    expect(blockerOf("name", { ...draft, name: "  " })).toBe("Give your league a name");
    expect(blockerOf("review", { ...draft, name: "" })).toBe("Give your league a name");
    expect(blockerOf("name", { ...draft, name: "x".repeat(41) })).toBe("Keep the name to 40 characters");
  });

  it("holds the walkthrough at stakes until a custom amount is valid", () => {
    const unset = { ...draft, stakeUsd: null };
    expect(blockerOf("name", unset)).toBeNull();
    expect(blockerOf("kind", unset)).toBeNull();
    expect(blockerOf("stake", unset)).toBe("Enter a whole-dollar buy-in from $1 to $1,000");
    expect(blockerOf("review", unset)).not.toBeNull();
  });
});

describe("stakes", () => {
  it("reads a custom buy-in as whole dollars from 1 to 1000", () => {
    expect(parseStake("50")).toBe(50);
    expect(parseStake(" $12 ")).toBe(12);
    expect(parseStake("1000")).toBe(1000);
    for (const bad of ["", "0", "1001", "7.50", "ten", "-5"]) expect(parseStake(bad)).toBeNull();
  });

  it("knows the one-tap amounts from a custom one", () => {
    expect([0, 5, 20].every(isPresetStake)).toBe(true);
    expect(isPresetStake(50)).toBe(false);
    expect(isPresetStake(null)).toBe(false);
  });

  it("shows the pot six players would make", () => {
    expect(potExample(20)).toBe("6 players × $20 = $120 pot");
    expect(potExample(250)).toBe("6 players × $250 = $1,500 pot");
    expect(potExample(null)).toBe("Enter a buy-in to see the pot.");
  });
});

describe("season", () => {
  it("recommends 8 weeks, double round robin and an end-of-season payout", () => {
    expect(RECOMMENDED_SETTINGS).toEqual({ payout: "season", seasonWeeks: 8, format: "double_round_robin" });
    expect(isRecommended({ ...RECOMMENDED_SETTINGS })).toBe(true);
    expect(isRecommended({ ...RECOMMENDED_SETTINGS, format: "bracket" })).toBe(false);
    expect(isRecommended({ ...RECOMMENDED_SETTINGS, seasonWeeks: 4 })).toBe(false);
    expect(isRecommended({ ...RECOMMENDED_SETTINGS, payout: "weekly" })).toBe(false);
  });

  it("says the recommendation in plain words", () => {
    expect(recommendedLines()).toEqual(["8 weeks. Long enough for a comeback.", "Double round robin. You play everyone twice."]);
  });
});

describe("reviewRows", () => {
  it("lists every answer in the order it was asked", () => {
    const draft: Draft = { name: " Gym Rats ", kind: "league", stakeUsd: 20, settings: { payout: "season", seasonWeeks: 12, format: "bracket" } };
    expect(reviewRows(draft)).toEqual([
      { label: "Name", value: "Gym Rats" },
      { label: "Who's playing", value: "Private friends league" },
      { label: "Buy-in", value: "$20" },
      { label: "Season", value: "12 weeks" },
      { label: "Format", value: "Bracket" },
    ]);
    expect(reviewRows({ ...draft, stakeUsd: 0 })[2].value).toBe("Free");
  });

  it("starts every league on the end-of-season payout", () => {
    expect(defaultDraft("Maya Chen").settings.payout).toBe("season");
  });
});

describe("hasUnsavedWork", () => {
  const start = defaultDraft("Maya Chen");

  it("leaves untouched defaults without asking", () => {
    expect(hasUnsavedWork({ ...start }, start)).toBe(false);
  });

  it("asks once any answer has changed", () => {
    expect(hasUnsavedWork({ ...start, name: "Night Owls" }, start)).toBe(true);
    expect(hasUnsavedWork({ ...start, kind: "versus" }, start)).toBe(true);
    expect(hasUnsavedWork({ ...start, stakeUsd: null }, start)).toBe(true);
    expect(hasUnsavedWork({ ...start, settings: { ...start.settings, seasonWeeks: 4 } }, start)).toBe(true);
  });
});
