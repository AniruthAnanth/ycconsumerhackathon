import { requireOptionalNativeModule } from "expo";

/**
 * The JavaScript side of the Live Activity, a local Expo module written in Swift
 * (ios/LiveActivityModule.swift) that wraps ActivityKit. The activity's lock-screen and
 * Dynamic Island views live in the widget extension (targets/widget).
 *
 * The native half exists only in a standalone iOS build. In Expo Go, on Android and on the
 * web there is nothing to load, so the export below is null and callers go through
 * lib/liveActivity.ts, which treats null as "feature absent".
 */
type LiveActivityNativeModule = {
  /** False when the player turned Live Activities off for Lineup in Settings, or before iOS 16.2. */
  areActivitiesEnabled(): boolean;
  /** Shows the state: updates the running activity, or requests a new one. Takes JSON of a LiveActivityState. */
  start(stateJson: string): Promise<void>;
  /** Updates the running activity and does nothing when there is none. Takes JSON of a LiveActivityState. */
  update(stateJson: string): Promise<void>;
  /** Ends the activity and removes it from the lock screen and the island at once. */
  end(): Promise<void>;
};

export const LiveActivityNative = requireOptionalNativeModule<LiveActivityNativeModule>("LiveActivity");
