import { requireOptionalNativeModule } from "expo";

/**
 * The JavaScript side of the on-device referee, a local Expo module written in Swift
 * (ios/OnDeviceRefereeModule.swift). It reads a photo with Apple's Vision framework, which
 * runs on Core ML with no bundled model and no network.
 *
 * The native half exists only in a standalone iOS build. In Expo Go, on Android and on the
 * web there is nothing to load, so the export below is null and callers go through
 * lib/onDeviceReferee.ts, which treats null as "feature absent".
 */

/** One Vision classification, for example { identifier: "barbell", confidence: 0.83 }. */
export type OnDeviceLabel = { identifier: string; confidence: number };

export type OnDeviceAnalysis = {
  /** False when Vision could not read the photo, as on the iOS simulator. */
  available: boolean;
  /** Why it is unavailable, for logs and reports. Never shown to a player. */
  reason?: string;
  /** Most confident first. */
  labels: OnDeviceLabel[];
  /** People found in the photo. Missing when not requested or when detection failed. */
  people?: number;
  /** Extended fingers for each hand found. Missing when not requested or when detection failed. */
  fingersUp?: number[];
  elapsedMs: number;
};

type OnDeviceRefereeNativeModule = {
  /** False on the iOS simulator, where Vision's models are handed a blank image. */
  isSupported(): boolean;
  analyze(uri: string, detectPeople: boolean, detectHands: boolean): Promise<OnDeviceAnalysis>;
};

export const OnDeviceRefereeNative =
  requireOptionalNativeModule<OnDeviceRefereeNativeModule>("OnDeviceReferee");
