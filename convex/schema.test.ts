import { describe, expect, it } from "vitest";

import schema from "./schema";

describe("schema contract", () => {
  it("defines every table the workstreams share", () => {
    expect(Object.keys(schema.tables)).toEqual(
      expect.arrayContaining([
        "users",
        "leagues",
        "memberships",
        "weeks",
        "matchups",
        "lineups",
        "tasks",
        "proofs",
        "reactions",
        "challenges",
        "votes",
        "drops",
        "rsvps",
        "canvasConnections",
        "ledger",
      ]),
    );
  });
});
