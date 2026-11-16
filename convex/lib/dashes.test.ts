import { describe, expect, test } from "vitest";

import { withoutDashes, withoutDashesDeep } from "./dashes";

describe("withoutDashes", () => {
  test("turns a dash between clauses into a comma", () => {
    expect(withoutDashes("Barbell rack visible \u2014 matches leg day.")).toBe("Barbell rack visible, matches leg day.");
    expect(withoutDashes("Leg day\u2014done")).toBe("Leg day, done");
    expect(withoutDashes("Close one \u2013 but it counts")).toBe("Close one, but it counts");
  });

  test("reads a numeric range as words", () => {
    expect(withoutDashes("30\u201360 points")).toBe("30 to 60 points");
  });

  test("never leaves a comma before other punctuation or at an edge", () => {
    expect(withoutDashes("Done \u2014.")).toBe("Done.");
    expect(withoutDashes("\u2014 Done")).toBe("Done");
  });

  test("leaves hyphens and plain text alone", () => {
    expect(withoutDashes("A quick-time drop, +40.")).toBe("A quick-time drop, +40.");
  });

  test("cleans every string inside a parsed answer", () => {
    expect(withoutDashesDeep({ reason: "Gym \u2014 fits", points: 30, tags: ["a\u2014b"], place: null })).toEqual({
      reason: "Gym, fits",
      points: 30,
      tags: ["a, b"],
      place: null,
    });
  });
});
