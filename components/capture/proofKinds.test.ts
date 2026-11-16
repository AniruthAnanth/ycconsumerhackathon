import { describe, expect, it } from "vitest";

import { formatElapsed, frameTimesMs, howToProve, intervalMs, parseProofType, pickEvenly, timelapseCapSeconds } from "./proofKinds";

describe("parseProofType", () => {
  it("reads every known type and falls back to a photo", () => {
    expect(parseProofType("timelapse")).toBe("timelapse");
    expect(parseProofType("before_after")).toBe("before_after");
    expect(parseProofType("screenshot")).toBe("screenshot");
    expect(parseProofType("hologram")).toBe("photo");
    expect(parseProofType(undefined)).toBe("photo");
  });
});

describe("timelapse sampling", () => {
  it("samples eight frames from the middle of eight equal stretches", () => {
    expect(frameTimesMs(80_000)).toEqual([5_000, 15_000, 25_000, 35_000, 45_000, 55_000, 65_000, 75_000]);
  });

  it("keeps both ends and at most eight interval photos", () => {
    const shots = Array.from({ length: 20 }, (_, i) => i);
    const picked = pickEvenly(shots);
    expect(picked).toHaveLength(8);
    expect(picked[0]).toBe(0);
    expect(picked[7]).toBe(19);
    expect(pickEvenly([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("spaces interval photos so eight span the target, never closer than 5 s", () => {
    expect(intervalMs(30)).toBe(225_000);
    expect(intervalMs(10)).toBe(75_000);
    expect(intervalMs(0.1)).toBe(5_000);
  });

  it("caps a recording at twice the target and an hour at most", () => {
    expect(timelapseCapSeconds(10)).toBe(1_200);
    expect(timelapseCapSeconds(45)).toBe(3_600);
  });
});

describe("formatElapsed", () => {
  it("shows minutes and seconds, and hours once past an hour", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
});

describe("howToProve", () => {
  it("asks a timelapse task for its target, five minutes by default and never more than ten", () => {
    expect(howToProve({ proofType: "timelapse", targetMinutes: 7 })).toBe("Record a 7-min timelapse while you do it.");
    expect(howToProve({ proofType: "timelapse" })).toBe("Record a 5-min timelapse while you do it.");
    expect(howToProve({ proofType: "timelapse", targetMinutes: 45 })).toBe("Record a 10-min timelapse while you do it.");
  });

  it("gives each other type its own line", () => {
    expect(howToProve({ proofType: "photo_location", place: { name: "the gym" } })).toBe("Check in at the gym.");
    expect(howToProve({ proofType: "photo_location" })).toBe("Check in where it happens.");
    expect(howToProve({ proofType: "photo" })).toBe("Snap a photo that shows it's done.");
    expect(howToProve({})).toBe("Snap a photo that shows it's done.");
    expect(howToProve({ proofType: "screenshot" })).toBe("Pick a screenshot that shows it's done.");
    expect(howToProve({ proofType: "before_after" })).toBe("Snap a before photo, then an after from the same spot.");
  });

  it("asks an outcome task for a 5-second survey video", () => {
    expect(howToProve({ proofType: "survey_video", targetMinutes: 30 })).toBe("Take a 5-second video showing it's done.");
  });
});
