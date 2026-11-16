import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useShareInvite } from "@/components/invite/useShareInvite";
import { MatchupMarkets } from "@/components/markets";
import { Icon, RowDivider, SectionLabel, type IconName } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

import type { Matchup } from "../contract";
import { BonusRow } from "./BonusRow";

/**
 * Everything on Matchup that does not answer "am I winning?": the odds detail, the bonus line and
 * the ways to bring in a friend. One inset-grouped list at the bottom keeps them a tap away.
 */
export function MatchupMore({ matchup, leagueId }: { matchup: Matchup; leagueId: Id<"leagues"> | null | undefined }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { share, busy, notice } = useShareInvite(leagueId);
  return (
    <View style={styles.section}>
      <SectionLabel left="More" />
      <View style={styles.group}>
        <MoreRow
          icon="stats-chart-outline"
          label="Odds and bonuses"
          trailing={<Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textFaint} />}
          onPress={() => setOpen((value) => !value)}
          accessibilityState={{ expanded: open }}
        />
        {open ? (
          <View style={styles.details}>
            <BonusRow matchup={matchup} />
            <MatchupMarkets />
          </View>
        ) : null}
        <RowDivider inset={ROW_TEXT_INSET} />
        <MoreRow
          icon="flash-outline"
          label="Challenge a friend"
          trailing={<Icon name="chevron-forward" size={18} color={colors.textFaint} />}
          onPress={() => router.push({ pathname: "/join", params: { mode: "versus" } })}
        />
        {leagueId ? (
          <>
            <RowDivider inset={ROW_TEXT_INSET} />
            <MoreRow
              icon="share-outline"
              label={notice === "Link copied" ? notice : "Invite a friend"}
              trailing={notice && notice !== "Link copied" ? <Text style={styles.error}>{notice}</Text> : null}
              onPress={share}
              disabled={busy}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

function MoreRow({
  icon,
  label,
  trailing,
  onPress,
  disabled,
  accessibilityState,
}: {
  icon: IconName;
  label: string;
  trailing: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityState?: { expanded: boolean };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={icon} size={ICON_SIZE} color={colors.textMuted} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

const ICON_SIZE = 20;
// Inside the card, a row's label starts after the inner padding, the icon and one column gap; its divider starts there too.
const ROW_TEXT_INSET = spacing.lg + ICON_SIZE + layout.columnGap;

const styles = StyleSheet.create({
  section: { paddingTop: spacing.lg },
  group: { marginHorizontal: SCREEN_MARGIN, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden" },
  row: { minHeight: layout.rowMin, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", gap: layout.columnGap },
  pressed: { opacity: 0.6 },
  label: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: font.body },
  details: { paddingBottom: spacing.sm },
  error: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.danger },
});
