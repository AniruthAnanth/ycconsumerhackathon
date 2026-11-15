import { useMutation, useQuery } from "convex/react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";

import { PlayByTextRow } from "@/components/keiki/PlayByTextRow";
import { RowDivider, SectionLabel } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { isAvailable, requestPermission } from "@/lib/notifications/native";
import { usePermission } from "@/lib/notifications/usePermission";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

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
 * The Push switch. It is on only when the player wants it and the system allows it. The
 * system's answer is the one the notifications host follows too (usePermission), so a grant
 * made here enables the device at once, and a change made in Settings shows here when the app
 * returns to the foreground. Renders nothing where there is no native notifications (the web).
 */
function PushRow() {
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
    // Nothing is done with the answer: requestPermission publishes it to this row and the host.
    if (permission === "undetermined") await requestPermission();
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
      <RowDivider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.columnGap,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  copy: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
