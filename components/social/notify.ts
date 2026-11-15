import { Alert, Platform } from "react-native";

/**
 * Alert.alert does nothing on React Native Web, so a failed action or a
 * confirmation would vanish there. On web these fall back to the browser's own
 * dialogs; on a phone they stay native alerts.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS !== "web") return Alert.alert(title, message);
  globalThis.alert(message ? `${title}\n\n${message}` : title);
}

/** Asks before an action that costs the player something; onConfirm runs only on a yes. */
export function confirmAction({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  if (Platform.OS !== "web") {
    return Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, style: "destructive", onPress: onConfirm },
    ]);
  }
  if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
}
