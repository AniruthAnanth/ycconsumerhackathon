import { describe, expect, it } from "vitest";

import { LIVE_CHUNK_MS, joinTranscripts, shouldCutSegment } from "./liveTranscript";

describe("joinTranscripts", () => {
  it("joins pieces in order", () => {
    expect(joinTranscripts(["Gym on Monday,", "finish the problem set."])).toBe("Gym on Monday, finish the problem set.");
  });

  it("skips missing, failed and empty pieces", () => {
    expect(joinTranscripts([undefined, "call mom", null, "  ", "and read"])).toBe("call mom and read");
  });

  it("drops words repeated across a cut, ignoring case and punctuation", () => {
    expect(joinTranscripts(["going to the", "The gym twice"])).toBe("going to the gym twice");
    expect(joinTranscripts(["clean my room.", "my room, then laundry"])).toBe("clean my room. then laundry");
  });

  it("keeps a word the player really said twice in the middle", () => {
    expect(joinTranscripts(["run run", "fast"])).toBe("run run fast");
  });

  it("is empty for nothing", () => {
    expect(joinTranscripts([])).toBe("");
  });
});

describe("shouldCutSegment", () => {
  const base = { segmentMillis: LIVE_CHUNK_MS, totalMillis: 10_000, limitMillis: 60_000, cutting: false };

  it("cuts once a segment is long enough", () => {
    expect(shouldCutSegment(base)).toBe(true);
    expect(shouldCutSegment({ ...base, segmentMillis: LIVE_CHUNK_MS - 1 })).toBe(false);
  });

  it("never starts a second cut while one is running", () => {
    expect(shouldCutSegment({ ...base, cutting: true })).toBe(false);
  });

  it("does not cut right before the recording stops on its own", () => {
    expect(shouldCutSegment({ ...base, totalMillis: 59_500 })).toBe(false);
  });
});
