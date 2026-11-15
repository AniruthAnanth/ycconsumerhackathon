import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { DeviceError, errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("shows the text a ConvexError was thrown with", () => {
    expect(errorMessage(new ConvexError("Couldn't hear a plan"))).toBe("Couldn't hear a plan");
  });

  it("reads a message field from a structured ConvexError", () => {
    expect(errorMessage(new ConvexError({ message: "That task is already verified" }))).toBe(
      "That task is already verified",
    );
  });

  it("shows what went wrong on the phone itself", () => {
    expect(errorMessage(new DeviceError("Location access is off. Turn it on in Settings."))).toBe(
      "Location access is off. Turn it on in Settings.",
    );
  });

  it("hides the text of any other error behind the fallback", () => {
    expect(errorMessage(new Error("[CONVEX A(proofs:verify)] Server Error"), "Couldn't reach the referee.")).toBe(
      "Couldn't reach the referee.",
    );
    expect(errorMessage(undefined)).toBe("Something went wrong. Try again.");
  });
});
