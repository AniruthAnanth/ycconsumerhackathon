import { describe, expect, it } from "vitest";

import type { Task } from "@/lib/backend";

import { canSubmitProof, findTask, submitProofHref, toProofTarget } from "./taskSheet";

const gym: Task = {
  taskId: "t1" as Task["taskId"],
  slot: "body",
  title: "Leg day",
  points: 10,
  proofType: "photo_location",
  place: { name: "Gym", lat: 37.77, lng: -122.41 },
  status: "open",
  source: "draft",
  score: null,
  dueLabel: "Due Sun",
  upNext: true,
};
const essay: Task = { ...gym, taskId: "t2" as Task["taskId"], slot: "mind", proofType: "canvas", place: undefined };

describe("findTask", () => {
  it("finds a row by id", () => expect(findTask([gym, essay], "t2")).toBe(essay));
  it("returns undefined for an unknown id", () => expect(findTask([gym], "nope")).toBeUndefined());
});

describe("toProofTarget", () => {
  it("carries what the camera and referee need", () => {
    expect(toProofTarget(gym)).toEqual({
      taskId: "t1",
      title: "Leg day",
      points: 10,
      proofType: "photo_location",
      place: gym.place,
    });
  });
});

describe("canSubmitProof", () => {
  it.each([
    ["open", true],
    ["failed", true],
    ["verified", false],
    ["held", false],
  ] as const)("%s -> %s", (status, expected) => expect(canSubmitProof(status)).toBe(expected));
});

describe("submitProofHref", () => {
  it("opens the camera for a photo task", () => {
    expect(submitProofHref(gym)).toMatchObject({ pathname: "/proof/[taskId]", params: { taskId: "t1" } });
  });

  it("skips the camera for a Canvas task", () => {
    expect(submitProofHref(essay)).toMatchObject({
      pathname: "/proof/verdict",
      params: { taskId: "t2", mediaType: "canvas" },
    });
  });
});
