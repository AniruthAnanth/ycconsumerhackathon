import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { getPermission, isAvailable, lastPermission, onPermission, type Permission } from "./native";

/**
 * The system's answer to "may Lineup notify?", or undefined until it has been read.
 *
 * Every component that calls this follows native.ts's one copy of the answer, so they all see
 * a change in the same render: a grant made from the Push switch is known to the notifications
 * host at once, with no wait for the app to come back to the foreground.
 *
 * The answer is read when the component mounts and again whenever the app returns to the
 * foreground, because the player can change it in Settings without Lineup being told. Reading
 * never shows the system's dialog; that takes requestPermission(). Where the device can't
 * notify (the web) nothing is read or listened to, and the answer stays undefined.
 */
export function usePermission(): Permission | undefined {
  useEffect(() => {
    if (!isAvailable()) return;
    void getPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission();
    });
    return () => subscription.remove();
  }, []);

  return useSyncExternalStore(onPermission, lastPermission, lastPermission);
}
