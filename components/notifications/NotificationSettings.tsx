import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, Switch, Text, View } from "react-native";

import { PlayByTextRow } from "@/components/keiki/PlayByTextRow";
import { SectionLabel } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { getPermission, isAvailable, requestPermission, type Permission } from "@/lib/notifications/native";
import { colors, font, hairline, spacing } from "@/theme";

import { pushCopy } from "./pushCopy";
import { SilentBoundary } from "./SilentBoundary";

/**
 * The League tab's notification settings: texts (the Keiki opt-in, which owns its own row) and
 * push. They are two switches because the player can want either; with both on the text is the
 * alert and the app stays quiet (see pushCopy).
 */
export function NotificationSettings() {
  return (
    <>
      <SectionLabel left="Notifications" />
      <PlayByTextRow />
      <SilentBoundary>
        <PushRow />
      </SilentBoundary>
    </>
  );
}

/**
 * The Push switch. It is on only when the player wants it and the system allows it, and the
 * system's answer is re-read whenever the app returns to the foreground because the player can
 * change it in Settings. Renders nothing where there is no native notifications (the web).
 */
function PushRow() {
  const available = isAvailable();
  const settings = useQuery(api.push.settings, available ? {} : "skip");
  const setEnabled = useMutation(api.push.setEnabled);
  const [permission, setPermission] = useState<Permission | null>(null);

  const refreshPermission = useCallback(() => {
    getPermission().then(setPermission);
  }, []);

  useEffect(() => {
    if (!available) return;
    refreshPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshPermission();
    });
    return () => subscription.remove();
  }, [available, refreshPermission]);

  if (!available || !settings || !permission) return null;

  async function onValueChange(on: boolean) {
    try {
      await setEnabled({ enabled: on });
    } catch {
      return;
    }
    if (!on) return;
    if (permission === "undetermined") setPermission(await requestPermission());
    // iOS shows its dialog only once, so a player who said no has to change it in Settings.
    else if (permission === "denied") await Linking.openSettings().catch(() => {});
  }

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>Push notifications</Text>
        <Text style={styles.copy}>{pushCopy({ permission, ...settings })}</Text>
      </View>
      <Switch
        value={settings.pushOn && permission === "granted"}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent }}
        accessibilityLabel="Push notifications"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: font.title, fontWeight: "700", color: colors.text },
  copy: { fontSize: font.meta, color: colors.textMuted },
});
