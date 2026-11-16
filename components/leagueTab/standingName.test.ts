import { describe, expect, it } from "vitest";

import { standingName } from "./standingName";

describe("standingName", () => {
  it("keeps a name that fits", () => {
    expect(standingName("Sam Lee")).toBe("Sam Lee");
  });
  it("cuts a long first name to an initial", () => {
    expect(standingName("Aniruth Ananthanarayanan")).toBe("A. Ananthanarayanan");
  });
  it("keeps every later name", () => {
    expect(standingName("Maximiliana de la Cruz Ortega")).toBe("M. de la Cruz Ortega");
  });
  it("leaves a single long word whole for the two-line wrap", () => {
    expect(standingName("Ananthanarayanan-Smith")).toBe("Ananthanarayanan-Smith");
  });
});
