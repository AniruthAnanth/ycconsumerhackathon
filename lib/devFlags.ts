/**
 * Development flags for running the capture flow where a phone's sensors are missing: a cloud
 * simulator has no camera, no microphone and no GPS. Each flag swaps the sensor for bundled or
 * fixed input, and the result still goes through the real Convex draft and verify paths.
 *
 * Every flag is off unless the build sets EXPO_PUBLIC_DEV_FLAGS=1, so the demo build starts
 * clean. The Demo controls screen flips them at runtime. They live in memory only: a flag that
 * survived a restart could leak sample media into the live demo.
 */
import { useSyncExternalStore } from "react";

export type DevFlags = {
  /** The proof camera offers bundled sample photos and one sample video. */
  sampleMedia: boolean;
  /** Voice Draft offers a typed transcript, prefilled with SAMPLE_TRANSCRIPT. */
  sampleVoice: boolean;
  /** Proofs report fixed coordinates instead of the phone's GPS. */
  locationOverride: boolean;
  /** Which fixed coordinates the override reports: the task's pinned place (passes the distance check) or a far point (fails it). */
  overrideSpot: "place" | "away";
};

export type Coords = { lat: number; lng: number };

const onByDefault = process.env.EXPO_PUBLIC_DEV_FLAGS === "1";

let flags: DevFlags = {
  sampleMedia: onByDefault,
  sampleVoice: onByDefault,
  locationOverride: onByDefault,
  overrideSpot: "place",
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDevFlags(): DevFlags {
  return flags;
}

export function setDevFlag<K extends keyof DevFlags>(key: K, value: DevFlags[K]) {
  flags = { ...flags, [key]: value };
  listeners.forEach((listener) => listener());
}

/** Re-renders the calling component whenever a flag changes. */
export function useDevFlags(): DevFlags {
  return useSyncExternalStore(subscribe, getDevFlags, getDevFlags);
}

/**
 * YC's San Francisco office: the override's "place" when a task pins none. It must match the
 * coordinates convex/ai.ts gives the draft model for "the YC office", or a drafted YC-office
 * task checked in from here lands outside the 150 m radius.
 */
export const YC_OFFICE: Coords = { lat: 37.7608, lng: -122.3866 };

/** Alcatraz: kilometres from anywhere a player would pin a task, so the 150 m check fails. */
export const AWAY_SPOT: Coords = { lat: 37.8267, lng: -122.423 };

/**
 * The coordinates a proof should report while the override is on, or null when the phone's
 * real GPS should be used.
 */
export function overrideCoords(current: DevFlags, place?: Coords): Coords | null {
  if (!current.locationOverride) return null;
  if (current.overrideSpot === "away") return AWAY_SPOT;
  return place ? { lat: place.lat, lng: place.lng } : YC_OFFICE;
}

/** A spoken week that touches all five slots and names one place, for the sample voice note. */
export const SAMPLE_TRANSCRIPT =
  "This week I want to do leg day at the gym, finish my algorithms problem set, " +
  "read for thirty minutes before bed, do my laundry and clean my room, " +
  "and call my mom on Sunday. I also want to check in at the YC office for the hackathon, " +
  "and if there's time go for a 5k run.";
