import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, spacing } from "@/theme";

import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** "accent" is a quiet blue tint (Pay); "live" is solid, for something on a clock (a drop). */
  tone?: "accent" | "live";
  /** Makes the whole strip a button and shows a chevron. */
  onPress?: () => void;
  /** Controls on the right, for example a drop's countdown and Submit. */
  children?: ReactNode;
};

/** A full-width strip pinned above a list. Flat, like everything else: no card, no shadow. */
export function Banner({ title, subtitle, icon, tone = "accent", onPress, children }: Props) {
  const live = tone === "live";
  const ink = live ? colors.background : colors.text;
  const strip = (
    <View style={[styles.strip, live && styles.live]}>
      {icon ? <Icon name={icon} size={20} color={live ? colors.background : colors.accent} /> : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, live && styles.subtitleLive]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
      {onPress ? <Icon name="chevron-forward" size={18} color={live ? colors.background : colors.accent} /> : null}
    </View>
  );
  if (!onPress) return strip;
  return (
    // A button's label replaces the text inside it, so the subtitle (a failed checkout, say) has to be part of it.
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
      {strip}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentTint,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  live: { backgroundColor: colors.text },
  text: { flex: 1, gap: 1 },
  title: { fontSize: font.body, fontWeight: "700" },
  subtitle: { fontSize: font.meta, color: colors.textMuted },
  subtitleLive: { color: colors.divider },
});
