import { useSyncExternalStore } from "react";

import { setHapticsEnabled } from "./native/haptics";
import { readPreference, writePreference } from "./preference";

/**
 * The device's own App settings: they describe this phone, not the account, so they live on the
 * device (lib/preference) and never in Convex. Haptics off silences lib/native/haptics; Reduce
 * motion "on" makes components/motion's useReduceMotion answer true whatever the system says.
 */
export type AppPrefs = { haptics: boolean; reduceMotion: "system" | "on" };

const KEY = "lineup.appPrefs";
const DEFAULTS: AppPrefs = { haptics: true, reduceMotion: "system" };

let prefs = DEFAULTS;
const listeners = new Set<() => void>();

/** A stored value, or the defaults for anything missing or unreadable, so a bad write never sticks. */
export function parseAppPrefs(raw: string | null): AppPrefs {
  try {
    const stored = raw ? (JSON.parse(raw) as Partial<AppPrefs>) : {};
    return {
      haptics: typeof stored.haptics === "boolean" ? stored.haptics : DEFAULTS.haptics,
      reduceMotion: stored.reduceMotion === "on" ? "on" : DEFAULTS.reduceMotion,
    };
  } catch {
    return DEFAULTS;
  }
}

function publish(next: AppPrefs) {
  prefs = next;
  setHapticsEnabled(next.haptics);
  for (const listener of listeners) listener();
}

/** Loaded once, at the first import: the tab bar's useReduceMotion pulls this in before any tap. */
void readPreference(KEY).then((raw) => publish(parseAppPrefs(raw)));

export function setAppPref(patch: Partial<AppPrefs>) {
  const next = { ...prefs, ...patch };
  publish(next);
  void writePreference(KEY, JSON.stringify(next));
}

export function useAppPrefs(): AppPrefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => prefs,
  );
}
