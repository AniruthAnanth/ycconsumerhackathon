import { StyleSheet, Switch, Text, View } from "react-native";

import { PlayByTextRow } from "@/components/keiki/PlayByTextRow";
import { RowDivider, SectionLabel } from "@/components/ui";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

import { SilentBoundary } from "./SilentBoundary";
import { usePushSwitch } from "./usePushSwitch";

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

/** The Push switch (usePushSwitch). Renders nothing where there is no native notifications (the web). */
function PushRow() {
  const push = usePushSwitch();
  if (!push) return null;

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>Push notifications</Text>
        <Text style={styles.copy}>{push.copy}</Text>
      </View>
      <Switch
        value={push.value}
        onValueChange={push.onValueChange}
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
