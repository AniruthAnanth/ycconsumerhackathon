import { describe, expect, it } from "vitest";

import { formatLineNumber } from "./formatLineNumber";

describe("formatLineNumber", () => {
  it("formats a +1 number the way a person reads it", () => {
    expect(formatLineNumber("+17796251378")).toBe("(779) 625-1378");
  });

  it("leaves a number outside the +1 plan as it was given", () => {
    expect(formatLineNumber("+447911123456")).toBe("+447911123456");
  });

  it("leaves a malformed +1 number as it was given", () => {
    expect(formatLineNumber("+1779625")).toBe("+1779625");
  });
});
