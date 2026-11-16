import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Artwork } from "@/components/art";
import Animated from "react-native-reanimated";

import { PressScale, useSunnyHop } from "@/components/motion";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { SUNNY } from "./sunnyLogic";
import { useSunny } from "./useSunny";

const MASCOT = 64;
/** How far Sunny rises out of the card's top edge. The artwork has about 15% empty space above the mascot, so the offset covers that too. */
const BREAKOUT = spacing.xl;
const ART_TOP = MASCOT * 0.15;
const POINTER = 12;

/**
 * Sunny, the league's commissioner: the one callout in the app, so the one card on the tint with
 * the green outline. The full mascot sits on the card's left edge and breaks out of its top, and
 * this week's line is a speech bubble pointing at Sunny. Tapping opens the chat; a chip asks it.
 */
export function SunnyCard() {
  const router = useRouter();
  const { brief } = useSunny();
  if (!brief) return null;
  const ask = (text?: string) => router.push(text ? { pathname: "/chat", params: { ask: text } } : "/chat");

  return (
    <View testID="sunny-card" style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${SUNNY.name}: ${brief.line}`} onPress={() => ask()} style={styles.top}>
        {/* Keyed on the line, so Sunny hops once each time there is something new to say. */}
        <HoppingSunny key={brief.line} />
        <View style={styles.bubble}>
          <View style={styles.pointer} />
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

function HoppingSunny() {
  const hop = useSunnyHop(MASCOT);
  return (
    <Animated.View style={[styles.mascot, hop]}>
      <Artwork name="sunny" size={MASCOT} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.md + BREAKOUT,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.accentTint,
    borderWidth: BORDER,
    borderColor: colors.accent,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  mascot: { marginTop: -(BREAKOUT + ART_TOP) },
  bubble: {
    flex: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  // A square turned 45 degrees and half hidden behind the bubble: the tail that points at Sunny.
  pointer: {
    position: "absolute",
    left: -POINTER / 2,
    top: spacing.md,
    width: POINTER,
    height: POINTER,
    backgroundColor: colors.surface,
    transform: [{ rotate: "45deg" }],
  },
  name: { color: colors.text, fontFamily: fontFamily.bold, fontSize: font.meta },
  role: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  line: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.body, lineHeight: type.body.lineHeight },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: layout.pillHeight,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  chipText: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: font.meta },
});
