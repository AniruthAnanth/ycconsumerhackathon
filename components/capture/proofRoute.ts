/**
 * The proof flow spans three screens (task sheet or drop banner -> camera -> verdict), and Expo
 * Router carries only flat string params between them. This module is the one place that knows
 * how a task and a capture are written into those params and read back out.
 */
import type { Href } from "expo-router";

import { SLOT_ORDER, type ProofType, type Slot } from "@/lib/slots";

export type { ProofType } from "@/lib/slots";

/** What the camera and the verdict screen need to know about the task being proven. */
export type ProofTarget = {
  taskId: string;
  title: string;
  points: number;
  proofType: ProofType;
  place?: { name: string; lat: number; lng: number };
  /** Quick-time drops require a gesture in frame, for example "three fingers up". */
  gesture?: string;
  /** Optional because drops and check-ins may not have one; the on-device pre-check reads it. */
  slot?: Slot;
};

/**
 * What reaches the verdict screen. A video carries its length because the referee is shown
 * stills sampled across the clip, and only the camera knows how long it recorded.
 * A Canvas task has no media: the backend reads the submission.
 */
export type Capture =
  | { mediaType: "photo" | "video"; uri: string; lat?: number; lng?: number; durationMs?: number }
  | { mediaType: "canvas" };

export type RouteParams = Record<string, string | string[] | undefined>;

function targetParams(target: ProofTarget): Record<string, string> {
  const params: Record<string, string> = {
    taskId: target.taskId,
    title: target.title,
    points: String(target.points),
    proofType: target.proofType,
  };
  if (target.place) {
    params.placeName = target.place.name;
    params.placeLat = String(target.place.lat);
    params.placeLng = String(target.place.lng);
  }
  if (target.gesture) params.gesture = target.gesture;
  if (target.slot) params.slot = target.slot;
  return params;
}

/** Opens the live camera for a task. */
export function proofCameraHref(target: ProofTarget): Href {
  return { pathname: "/proof/[taskId]", params: targetParams(target) } as Href;
}

/** Opens the verdict screen, which uploads the capture and asks the referee. */
export function verdictHref(target: ProofTarget, capture: Capture): Href {
  const params = targetParams(target);
  params.mediaType = capture.mediaType;
  if (capture.mediaType !== "canvas") {
    params.uri = capture.uri;
    if (capture.lat !== undefined && capture.lng !== undefined) {
      params.lat = String(capture.lat);
      params.lng = String(capture.lng);
    }
    if (capture.durationMs !== undefined) params.durationMs = String(capture.durationMs);
  }
  return { pathname: "/proof/verdict", params } as Href;
}

function text(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === "" ? undefined : first;
}

function number(value: string | string[] | undefined): number | undefined {
  const raw = text(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseProofTarget(params: RouteParams): ProofTarget {
  const proofType = text(params.proofType);
  const placeName = text(params.placeName);
  const placeLat = number(params.placeLat);
  const placeLng = number(params.placeLng);
  const slot = SLOT_ORDER.find((candidate) => candidate === text(params.slot));
  return {
    taskId: text(params.taskId) ?? "",
    title: text(params.title) ?? "",
    points: number(params.points) ?? 0,
    proofType: proofType === "photo_location" || proofType === "canvas" ? proofType : "photo",
    place:
      placeName !== undefined && placeLat !== undefined && placeLng !== undefined
        ? { name: placeName, lat: placeLat, lng: placeLng }
        : undefined,
    gesture: text(params.gesture),
    slot,
  };
}

export function parseCapture(params: RouteParams): Capture {
  const mediaType = text(params.mediaType);
  if (mediaType === "canvas") return { mediaType };
  return {
    mediaType: mediaType === "video" ? "video" : "photo",
    uri: text(params.uri) ?? "",
    lat: number(params.lat),
    lng: number(params.lng),
    durationMs: number(params.durationMs),
  };
}
