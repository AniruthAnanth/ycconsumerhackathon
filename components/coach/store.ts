import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import type { TourId } from "./tours";

/**
 * Which coach-mark tours a player has finished, kept on the device per user so a second account
 * on the same phone (Switch Player, Reset my account) gets its own first run.
 */
const PREFIX = "lineup.coach.v1.";

let resets = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function hasSeenTour(userId: string, tour: TourId): Promise<boolean> {
  const seen: TourId[] = JSON.parse((await AsyncStorage.getItem(PREFIX + userId)) ?? "[]");
  return seen.includes(tour);
}

export async function markTourSeen(userId: string, tour: TourId) {
  const key = PREFIX + userId;
  const seen: TourId[] = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
  if (!seen.includes(tour)) await AsyncStorage.setItem(key, JSON.stringify([...seen, tour]));
}

/** Every tour shows again, for every player on this device. Replay onboarding and Settings' Reset tips call it. */
export async function resetCoachMarks() {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  await AsyncStorage.multiRemove(keys);
  resets += 1;
  listeners.forEach((listener) => listener());
}

/** Changes after each reset, so a mounted screen offers its tour again without remounting. */
export function useCoachResets(): number {
  return useSyncExternalStore(subscribe, () => resets, () => resets);
}
