import { describe, expect, it } from "vitest";

import { artworkForTask } from "./taskArtwork";

describe("artworkForTask", () => {
  it("prefers a keyword in the title over the slot", () => {
    expect(artworkForTask("mind", "Tennis lesson with coach")).toBe("tennis");
    expect(artworkForTask("people", "Cook dinner for the house")).toBe("cooking");
    expect(artworkForTask("chores", "Call Mom")).toBe("familyCalls");
  });

  it("falls back to the slot when the title names no activity", () => {
    expect(artworkForTask("body", "Something hard")).toBe("exercise");
    expect(artworkForTask("recharge", "Phone off")).toBe("windingDown");
    expect(artworkForTask("flex", "Side quest")).toBe("buildingCreating");
  });
});
