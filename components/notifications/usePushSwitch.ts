import { useMutation, useQuery } from "convex/react";
import { Linking } from "react-native";

import { api } from "@/convex/_generated/api";
import { isAvailable, requestPermission } from "@/lib/notifications/native";
import { usePermission } from "@/lib/notifications/usePermission";

import { pushCopy } from "./pushCopy";

/**
 * The Push switch, shared by the League tab's notification settings and Settings. It is on only
 * when the player wants it and the system allows it. The system's answer is the one the
 * notifications host follows too (usePermission), so a grant made here enables the device at
 * once, and a change made in iOS Settings shows when the app returns to the foreground. null
 * while loading and where there is no native notifications (the web).
 */
export function usePushSwitch() {
  const available = isAvailable();
  const settings = useQuery(api.push.settings, available ? {} : "skip");
  const setEnabled = useMutation(api.push.setEnabled);
  const permission = usePermission();

  if (!available || !settings || !permission) return null;

  async function onValueChange(on: boolean) {
    try {
      await setEnabled({ enabled: on });
    } catch {
      return;
    }
    if (!on) return;
    // Nothing is done with the answer: requestPermission publishes it to this switch and the host.
    if (permission === "undetermined") await requestPermission();
    // iOS shows its dialog only once, so a player who said no has to change it in Settings.
    else if (permission === "denied") await Linking.openSettings().catch(() => {});
  }

  return {
    value: settings.pushOn && permission === "granted",
    copy: pushCopy({ permission, ...settings }),
    onValueChange,
  };
}
