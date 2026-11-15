import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("shows the server's wording when a ConvexError carries a string", () => {
    expect(errorMessage(new ConvexError("Session is full"))).toBe("Session is full");
  });

  it("falls back for anything else, which was not written for players", () => {
    expect(errorMessage(new ConvexError({ code: 1 }))).toBe("Something went wrong. Try again.");
    expect(errorMessage(new Error("boom"), "Couldn't join. Try again.")).toBe("Couldn't join. Try again.");
  });
});
