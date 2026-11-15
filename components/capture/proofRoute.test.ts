import { describe, expect, it } from "vitest";

import {
  type Capture,
  type ProofTarget,
  type RouteParams,
  parseCapture,
  parseProofTarget,
  proofCameraHref,
  verdictHref,
} from "./proofRoute";

/** The params a screen would receive after navigating to the href. */
function paramsOf(href: unknown): RouteParams {
  return (href as { params: RouteParams }).params;
}

const checkIn: ProofTarget = {
  taskId: "task1",
  title: "Check in at the YC office",
  points: 30,
  proofType: "photo_location",
  place: { name: "YC office", lat: 37.7609, lng: -122.3884 },
};

describe("proof route params", () => {
  it("carries a location task to the camera and back", () => {
    const href = proofCameraHref(checkIn);
    expect(href).toMatchObject({ pathname: "/proof/[taskId]" });
    expect(parseProofTarget(paramsOf(href))).toEqual({ ...checkIn, gesture: undefined });
  });

  it("carries a quick-time gesture", () => {
    const drop: ProofTarget = { taskId: "task2", title: "20 push-ups", points: 40, proofType: "photo", gesture: "three fingers up" };
    expect(parseProofTarget(paramsOf(proofCameraHref(drop)))).toEqual({ ...drop, place: undefined });
  });

  it("carries a video capture with its coordinates and length to the verdict", () => {
    const capture: Capture = { mediaType: "video", uri: "file:///clip.mov", lat: 37.76, lng: -122.39, durationMs: 6400 };
    const params = paramsOf(verdictHref(checkIn, capture));
    expect(parseCapture(params)).toEqual(capture);
    expect(parseProofTarget(params).taskId).toBe("task1");
  });

  it("leaves coordinates out when the phone had no fix", () => {
    const params = paramsOf(verdictHref(checkIn, { mediaType: "photo", uri: "file:///shot.jpg" }));
    expect(parseCapture(params)).toEqual({ mediaType: "photo", uri: "file:///shot.jpg", lat: undefined, lng: undefined, durationMs: undefined });
  });

  it("sends a Canvas task to the verdict without media", () => {
    const params = paramsOf(verdictHref({ ...checkIn, proofType: "canvas", place: undefined }, { mediaType: "canvas" }));
    expect(parseCapture(params)).toEqual({ mediaType: "canvas" });
    expect(params.uri).toBeUndefined();
  });

  it("carries the slot to the camera and the verdict", () => {
    const target: ProofTarget = { ...checkIn, slot: "body" };
    expect(parseProofTarget(paramsOf(proofCameraHref(target)))).toMatchObject({ slot: "body" });
    const params = paramsOf(verdictHref(target, { mediaType: "photo", uri: "file:///shot.jpg" }));
    expect(parseProofTarget(params).slot).toBe("body");
  });

  it("leaves the slot out when the target has none", () => {
    expect(paramsOf(proofCameraHref(checkIn))).not.toHaveProperty("slot");
    expect(parseProofTarget(paramsOf(proofCameraHref(checkIn))).slot).toBeUndefined();
  });

  it("ignores a slot that is not a real one", () => {
    expect(parseProofTarget({ taskId: "task4", slot: "nap" }).slot).toBeUndefined();
    expect(parseProofTarget({ taskId: "task4", slot: "" }).slot).toBeUndefined();
  });

  it("falls back to a plain photo task when params are missing or malformed", () => {
    expect(parseProofTarget({ taskId: ["task3", "ignored"], points: "many", placeName: "Gym" })).toEqual({
      taskId: "task3",
      title: "",
      points: 0,
      proofType: "photo",
      place: undefined,
      gesture: undefined,
    });
  });
});
