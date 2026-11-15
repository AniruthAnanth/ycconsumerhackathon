import { describe, expect, it } from "vitest";
import {
  CLOSE_CALL_CONFIDENCE,
  PASS_CONFIDENCE,
  decideVerdict,
  locationProblem,
  rejectWithoutJudging,
  type Judgement,
} from "./verdict";

/** A confident, clean pass. Each test overrides only what it is about. */
function judgement(overrides: Partial<Judgement> = {}): Judgement {
  return {
    pass: true,
    confidence: 0.92,
    reason: "Barbell rack and mirror visible, matches leg day.",
    highlight: 6,
    caption: "Leg day survived",
    gestureSeen: null,
    sceneMatchesPlace: null,
    ...overrides,
  };
}

const photoTask = { points: 40 };

describe("confidence thresholds", () => {
  it("uses 0.6 as the pass line and 0.75 as the top of the close-call band", () => {
    expect(PASS_CONFIDENCE).toBe(0.6);
    expect(CLOSE_CALL_CONFIDENCE).toBe(0.75);
  });

  it("passes a confident proof and awards the task's points", () => {
    const verdict = decideVerdict(judgement(), photoTask);
    expect(verdict).toMatchObject({ pass: true, points: 40, closeCall: false, confidence: 0.92 });
    expect(verdict.reason).toBe("Barbell rack and mirror visible, matches leg day.");
  });

  it("fails below 0.6 even when the model said pass, and says why", () => {
    const verdict = decideVerdict(judgement({ confidence: 0.59, reason: "A treadmill is partly visible." }), photoTask);
    expect(verdict).toMatchObject({ pass: false, points: 0, closeCall: false });
    expect(verdict.reason).toBe("Not clear enough to count. A treadmill is partly visible.");
  });

  it("passes at exactly 0.6 as a close call", () => {
    expect(decideVerdict(judgement({ confidence: 0.6 }), photoTask)).toMatchObject({ pass: true, closeCall: true, points: 40 });
  });

  it("flags 0.6 to 0.75 as a close call, inclusive", () => {
    expect(decideVerdict(judgement({ confidence: 0.7 }), photoTask).closeCall).toBe(true);
    expect(decideVerdict(judgement({ confidence: 0.75 }), photoTask).closeCall).toBe(true);
  });

  it("does not flag anything above 0.75", () => {
    expect(decideVerdict(judgement({ confidence: 0.76 }), photoTask)).toMatchObject({ pass: true, closeCall: false });
  });

  it("fails when the model says fail, however confident, with the model's reason", () => {
    const verdict = decideVerdict(
      judgement({ pass: false, confidence: 0.95, reason: "That's a cat and a lizard, not leg day." }),
      photoTask,
    );
    expect(verdict).toMatchObject({ pass: false, points: 0, closeCall: false });
    expect(verdict.reason).toBe("That's a cat and a lizard, not leg day.");
  });

  it("clamps out-of-range model numbers instead of trusting them", () => {
    const verdict = decideVerdict(judgement({ confidence: 1.4, highlight: 14.2 }), photoTask);
    expect(verdict.confidence).toBe(1);
    expect(verdict.highlight).toBe(10);
    expect(decideVerdict(judgement({ confidence: Number.NaN }), photoTask).pass).toBe(false);
  });
});

describe("gesture check", () => {
  const dropTask = { points: 40, gesture: "three fingers up" };

  it("passes when the gesture is seen", () => {
    expect(decideVerdict(judgement({ gestureSeen: true }), dropTask).pass).toBe(true);
  });

  it("fails a good photo without the gesture and names the gesture", () => {
    const verdict = decideVerdict(judgement({ gestureSeen: false }), dropTask);
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain("three fingers up");
  });

  it("treats an unanswered gesture check as not seen", () => {
    expect(decideVerdict(judgement({ gestureSeen: null }), dropTask).pass).toBe(false);
  });

  it("keeps the model's reason when the proof failed anyway", () => {
    const verdict = decideVerdict(judgement({ pass: false, gestureSeen: false, reason: "No push-ups here, just a desk." }), dropTask);
    expect(verdict.reason).toBe("No push-ups here, just a desk.");
  });

  it("ignores gestureSeen when the task needs no gesture", () => {
    expect(decideVerdict(judgement({ gestureSeen: false }), photoTask).pass).toBe(true);
  });
});

describe("location check-in: distance and scene must both pass", () => {
  const at = (distanceM: number | null) => ({ points: 30, location: { placeName: "YC office", distanceM } });

  it("passes within 150 m when the scene matches, and shows the distance", () => {
    const verdict = decideVerdict(judgement({ sceneMatchesPlace: true, reason: "Open-plan office with the orange logo wall." }), at(42));
    expect(verdict).toMatchObject({ pass: true, points: 30 });
    expect(verdict.reason).toBe("Open-plan office with the orange logo wall. (42 m from YC office)");
  });

  it("passes at exactly 150 m and fails at 151 m", () => {
    expect(decideVerdict(judgement({ sceneMatchesPlace: true }), at(150)).pass).toBe(true);
    expect(decideVerdict(judgement({ sceneMatchesPlace: true }), at(151)).pass).toBe(false);
  });

  it("fails when too far away even if the scene matches, with a readable distance", () => {
    const verdict = decideVerdict(judgement({ sceneMatchesPlace: true }), at(3210));
    expect(verdict).toMatchObject({ pass: false, points: 0 });
    expect(verdict.reason).toBe("You're 3.2 km from YC office. Check in within 150 m.");
  });

  it("fails when close enough but the scene does not match", () => {
    const verdict = decideVerdict(judgement({ sceneMatchesPlace: false }), at(20));
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toBe("This doesn't look like YC office.");
  });

  it("fails when the phone sent no coordinates", () => {
    const verdict = decideVerdict(judgement({ sceneMatchesPlace: true }), at(null));
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain("Location is needed");
  });

  it("takes any scene for a group session, but still needs the phone to be there", () => {
    const groupAt = (distanceM: number) => ({ points: 30, location: { placeName: "YC office", distanceM, anyScene: true } });
    const onTheLawn = judgement({ sceneMatchesPlace: null, reason: "Four friends together on a grassy hill." });
    expect(decideVerdict(onTheLawn, groupAt(40))).toMatchObject({ pass: true, points: 30 });
    expect(decideVerdict(onTheLawn, groupAt(900)).pass).toBe(false);
  });

  it("still applies the confidence line after both location checks pass", () => {
    expect(decideVerdict(judgement({ sceneMatchesPlace: true, confidence: 0.5 }), at(10)).pass).toBe(false);
  });
});

describe("locationProblem", () => {
  it("is null inside the radius and a sentence outside it", () => {
    expect(locationProblem({ placeName: "Dolores Park", distanceM: 149.9 })).toBeNull();
    expect(locationProblem({ placeName: "Dolores Park", distanceM: 480 })).toBe(
      "You're 480 m from Dolores Park. Check in within 150 m.",
    );
  });
});

describe("rejectWithoutJudging", () => {
  it("is a zero-point fail carrying the reason", () => {
    expect(rejectWithoutJudging("Send a photo instead.")).toEqual({
      pass: false,
      confidence: 0,
      reason: "Send a photo instead.",
      highlight: 1,
      caption: "",
      points: 0,
      closeCall: false,
    });
  });
});
