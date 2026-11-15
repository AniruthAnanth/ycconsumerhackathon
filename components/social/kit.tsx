/**
 * Temporary mirror of the shell thread's shared pieces.
 *
 * The shell thread (YCCO-10) owns components/ui, lib/currentLeague and theme/.
 * Until its first pull request is on main, the social screens use these
 * stand-ins. They copy the names and props agreed in handoffs/app-shell.md, so
 * switching over is an import-path change. Delete this file once nothing
 * imports it.
 */
import { useQuery } from "convex/react";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Id } from "@/convex/_generated/dataModel";
import { colors as theme } from "@/theme";

import { socialApi, type Slot } from "./contract";

/** The theme's palette under the short names the social screens were written with, plus two it lacks. */
export const colors = {
  bg: theme.background,
  text: theme.text,
  muted: theme.textMuted,
  hairline: theme.divider,
  accent: theme.accent,
  green: theme.tabActive,
  /** Faint fill behind media and initials while there is nothing to show. */
  wash: "#F1F2F3",
  red: "#D0021B",
} as const;

export const SLOT_LABEL: Record<Slot, string> = {
  body: "BOD",
  mind: "MND",
  recharge: "RCH",
  chores: "CHR",
  people: "PPL",
  flex: "FLX",
};

/** The league the header shows. Stand-in: the player's first league. */
export function useCurrentLeague(): {
  leagueId: Id<"leagues"> | null;
  weekStart: number | undefined;
  weekNumber: number | undefined;
} {
  const me = useQuery(socialApi.users.me);
  return { leagueId: me?.leagues[0]?._id ?? null, weekStart: undefined, weekNumber: undefined };
}

/** White page with safe-area padding top and bottom. */
export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}
    </SafeAreaView>
  );
}

/** Title bar for a pushed screen; the root Stack hides the native one. */
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}>
            <Text style={styles.headerBack}>{"\u2039"}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

/** Small uppercase label row above a list: "STARTERS" on the left, "SCORE" on the right. */
export function SectionLabel({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText}>{left}</Text>
      {right ? <Text style={styles.sectionLabelText}>{right}</Text> : null}
    </View>
  );
}

/** Blue outlined position pill: BOD, MND, RCH, CHR, PPL, FLX. */
export function PositionPill({ slot }: { slot: Slot }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{SLOT_LABEL[slot]}</Text>
    </View>
  );
}

/** Box-score number: a dash until scored, then one decimal place. */
export function Score({ value, size = "row" }: { value: number | null | undefined; size?: "row" | "total" }) {
  return (
    <Text style={[styles.score, size === "total" && styles.scoreTotal]}>
      {value == null ? "\u2014" : value.toFixed(1)}
    </Text>
  );
}

export function OutlinedPillButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.outlined, (pressed || disabled) && styles.dim]}
    >
      <Text style={styles.outlinedText}>{label}</Text>
    </Pressable>
  );
}

/** The one filled primary action on a screen. */
export function Button({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.filled, (pressed || disabled || loading) && styles.dim]}
    >
      {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.filledText}>{label}</Text>}
    </Pressable>
  );
}

/** A round photo, or the player's initial when they have none. */
export function Avatar({ uri, name, size = 36 }: { uri?: string; name?: string; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[styles.avatar, round]} contentFit="cover" />;
  return (
    <View style={[styles.avatar, round]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.42 }]}>
        {(name ?? "").trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function TextField({ label, style, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.fieldInput, style]}
        {...input}
      />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  headerSide: { width: 64, flexDirection: "row", alignItems: "center" },
  headerRight: { justifyContent: "flex-end" },
  headerBack: { color: colors.text, fontSize: 32, lineHeight: 34, paddingHorizontal: 4 },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "700" },
  sectionLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  sectionLabelText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pill: {
    minWidth: 44,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  score: { color: colors.text, fontSize: 17, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
  scoreTotal: { fontSize: 28 },
  outlined: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  outlinedText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  filled: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  filledText: { color: colors.bg, fontSize: 16, fontWeight: "700" },
  dim: { opacity: 0.5 },
  avatar: { backgroundColor: colors.wash, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.muted, fontWeight: "700" },
  field: { paddingHorizontal: 16, paddingVertical: 10 },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fieldInput: {
    height: 44,
    color: colors.text,
    fontSize: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
});
