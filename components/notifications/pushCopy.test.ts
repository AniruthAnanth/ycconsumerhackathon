import { describe, expect, it } from "vitest";

import { pushCopy } from "./pushCopy";

const base = { permission: "granted", textsOn: false, pushOn: true, hasToken: true } as const;

describe("pushCopy", () => {
  it("sends a player who denied notifications to Settings, whatever else is on", () => {
    expect(pushCopy({ ...base, permission: "denied", textsOn: true })).toBe(
      "Turn on notifications for Lineup in Settings.",
    );
  });

  it("says alerts come by text when texts and push are both on", () => {
    expect(pushCopy({ ...base, textsOn: true })).toBe(
      "Texts are on, so alerts come by text and the app updates quietly.",
    );
  });

  it("promises pushes while closed when the device has a token", () => {
    expect(pushCopy(base)).toBe("Drops, verdicts and rivals, even when Lineup is closed.");
    expect(pushCopy({ ...base, textsOn: true, pushOn: false })).toBe(
      "Drops, verdicts and rivals, even when Lineup is closed.",
    );
  });

  it("falls back to what works while the app is open when there is no token", () => {
    expect(pushCopy({ ...base, hasToken: false })).toBe(
      "Drops, verdicts and check-ins while Lineup is open, plus your evening reminder.",
    );
    expect(pushCopy({ ...base, permission: "undetermined", hasToken: false })).toBe(
      "Drops, verdicts and check-ins while Lineup is open, plus your evening reminder.",
    );
  });
});
