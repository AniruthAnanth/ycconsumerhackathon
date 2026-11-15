import { describe, expect, it } from "vitest";

import { expectedLabels, fingersWanted, judgePhoto, type PrecheckTask } from "./onDeviceRefereeRules";

const label = (identifier: string, confidence: number) => ({ identifier, confidence });

const legDay: PrecheckTask = { slot: "body", title: "Leg day at the gym" };

describe("expectedLabels", () => {
  it("starts from the slot", () => {
    const expected = expectedLabels({ slot: "mind", title: "Something vague" });
    expect(expected.has("book")).toBe(true);
    expect(expected.has("barbell")).toBe(false);
  });

  it("adds what the title's words suggest, whatever the slot", () => {
    const expected = expectedLabels({ slot: "flex", title: "Fold the laundry" });
    expect(expected.has("laundry_machine")).toBe(true);
    expect(expected.has("clothing")).toBe(true);
  });

  it("matches a word at the start of a title word, so run covers running", () => {
    expect(expectedLabels({ slot: "flex", title: "Running club" }).has("sneaker")).toBe(true);
    // "run" inside "brunch" is not a run; brunch is a meal.
    const brunch = expectedLabels({ slot: "flex", title: "Brunch" });
    expect(brunch.has("sneaker")).toBe(false);
    expect(brunch.has("food")).toBe(true);
  });

  it("matches phrases of more than one word", () => {
    expect(expectedLabels({ slot: "flex", title: "Finish the problem set" }).has("handwriting")).toBe(true);
  });

  it("expects nothing of a flex task it can't read", () => {
    expect(expectedLabels({ slot: "flex", title: "Surprise myself" }).size).toBe(0);
  });

  it("goes by the title alone when the slot isn't known", () => {
    const expected = expectedLabels({ title: "Leg day at the gym" });
    expect(expected.has("barbell")).toBe(true);
    expect(expected.has("bicycle")).toBe(false);
    expect(expectedLabels({ title: "Check in at the YC office" }).size).toBe(0);
  });
});

describe("judgePhoto", () => {
  it("names what fits the task first and lets it through", () => {
    const read = judgePhoto(
      { labels: [label("interior_room", 0.9), label("people", 0.8), label("barbell", 0.7), label("health_club", 0.6)] },
      legDay,
    );
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: barbell, gym, person.");
  });

  it("calls a mismatch when the photo plainly shows something else", () => {
    const read = judgePhoto(
      { labels: [label("computer", 0.95), label("laptop", 0.9), label("desk", 0.7)], people: 0 },
      legDay,
    );
    expect(read.likelyMatch).toBe(false);
    expect(read.hint).toBe(`On-device: computer, laptop, desk. That doesn't look like "Leg day at the gym".`);
  });

  it("gives the benefit of the doubt when Vision isn't confident", () => {
    const read = judgePhoto({ labels: [label("laptop", 0.4), label("desk", 0.3)] }, legDay);
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: laptop, desk.");
  });

  it("gives the benefit of the doubt when only broad labels are confident", () => {
    const read = judgePhoto({ labels: [label("interior_room", 0.95), label("machine", 0.8)] }, legDay);
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: indoors, machine.");
  });

  it("never objects to a photo with a person in it", () => {
    const byLabel = judgePhoto({ labels: [label("laptop", 0.9), label("adult", 0.8)] }, legDay);
    const byDetection = judgePhoto({ labels: [label("laptop", 0.9)], people: 1 }, legDay);
    expect(byLabel.likelyMatch).toBe(true);
    expect(byDetection.likelyMatch).toBe(true);
  });

  it("never objects to a flex task it has no expectation for", () => {
    const read = judgePhoto({ labels: [label("pizza", 0.95)] }, { slot: "flex", title: "Surprise myself" });
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: pizza.");
  });

  it("ignores labels below the noise floor and says nothing when none are left", () => {
    const read = judgePhoto({ labels: [label("laptop", 0.1)] }, legDay);
    expect(read).toEqual({ labels: [], likelyMatch: true, hint: "" });
  });

  it("names a label once when two identifiers read the same", () => {
    const read = judgePhoto({ labels: [label("people", 0.9), label("adult", 0.9)] }, { slot: "people", title: "Coffee with Sam" });
    expect(read.hint).toBe("On-device: person.");
  });
});

describe("a quick-time drop's gesture", () => {
  const drop: PrecheckTask = { slot: "body", title: "20 push-ups", gesture: "three fingers up" };
  const person = [label("people", 0.9)];

  it("reads finger counts from words, digits and common gestures", () => {
    expect(fingersWanted("three fingers up")).toBe(3);
    expect(fingersWanted("Hold up 2 fingers")).toBe(2);
    expect(fingersWanted("one finger up")).toBe(1);
    expect(fingersWanted("peace sign")).toBe(2);
    expect(fingersWanted("thumbs up")).toBe(1);
    expect(fingersWanted("tongue out")).toBeNull();
  });

  it("shows the count when the gesture is in the photo", () => {
    const read = judgePhoto({ labels: person, fingersUp: [3] }, drop);
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: 3 fingers up, person.");
  });

  it("says so when no hand is in the photo, without objecting", () => {
    const read = judgePhoto({ labels: person, fingersUp: [] }, drop);
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: no hand seen, person.");
  });

  it("shows a different count without objecting, because the count is approximate", () => {
    const read = judgePhoto({ labels: person, fingersUp: [2] }, drop);
    expect(read.likelyMatch).toBe(true);
    expect(read.hint).toBe("On-device: 2 fingers up, person.");
  });

  it("skips the gesture when hand detection did not run or the gesture isn't a count", () => {
    expect(judgePhoto({ labels: person }, drop).hint).toBe("On-device: person.");
    expect(judgePhoto({ labels: person, fingersUp: [] }, { ...drop, gesture: "tongue out" }).likelyMatch).toBe(true);
  });
});
