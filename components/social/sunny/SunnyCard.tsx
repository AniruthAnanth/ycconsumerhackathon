import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PressScale } from "@/components/motion";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { SunnyAvatar } from "./SunnyAvatar";
import { SUNNY } from "./sunnyLogic";
import { useSunny } from "./useSunny";

/**
 * Sunny, the league's commissioner, with one line about this week from the live matchup.
 * Tapping Sunny opens the chat; a chip opens it with that question.
 */
export function SunnyCard() {
  const router = useRouter();
  const { brief } = useSunny();
  if (!brief) return null;
  const ask = (text?: string) => router.push(text ? { pathname: "/chat", params: { ask: text } } : "/chat");


  return (
    <View testID="sunny-card" style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${SUNNY.name}`} onPress={() => ask()} style={styles.top}>
        <SunnyAvatar size={layout.rowMin} />
        <View style={styles.text}>
          <Text style={styles.name}>
            {SUNNY.name} <Text style={styles.role}>· {SUNNY.role}</Text>
          </Text>
          <Text style={styles.line}>{brief.line}</Text>
        </View>
      </Pressable>
      <View style={styles.chips}>
        {brief.chips.map((chip) => (
          <PressScale key={chip} accessibilityRole="button" onPress={() => ask(chip)} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {chip}
            </Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shared card: 24-pt corners, the one outline, 20-pt margin and inset, like the Roster hero.
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  top: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  text: { flex: 1, gap: spacing.xs },
  name: { color: colors.text, fontFamily: fontFamily.bold, fontSize: font.body },
  role: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  line: { color: colors.text, fontFamily: fontFamily.regular, fontSize: font.body, lineHeight: type.body.lineHeight },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: layout.pillHeight,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentTint,
  },
  chipText: { color: colors.accent, fontFamily: fontFamily.semiBold, fontSize: font.meta },
});
