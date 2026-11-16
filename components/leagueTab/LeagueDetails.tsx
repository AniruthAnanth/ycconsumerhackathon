import { Pressable, StyleSheet, Text, View } from "react-native";

import { useShareInvite } from "@/components/invite/useShareInvite";
import { Divider, Icon, SectionLabel } from "@/components/ui";
import type { League, Pot } from "@/lib/backend";
import { formatCountdown, isSettled } from "@/lib/leagueText";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing, tabular } from "@/theme";

type Props = { league: League; pot: Pot; now: number };

/** Below this many members the Invite row makes the case for inviting, not just the action. */
const SMALL_LEAGUE = 6;

/** Flat label and value rows about the league. One Invite row shows the code and shares the invite link. The buy-in is not repeated here: the pot card and the Pay banner carry it. */
export function LeagueDetails({ league, pot, now }: Props) {
  const { share, notice } = useShareInvite(league._id);

  return (
    <View>
      <SectionLabel left="League" />
      <Pressable style={styles.row} onPress={share} accessibilityRole="button" accessibilityLabel={`Share invite code ${league.inviteCode}`}>
        <Text style={styles.label}>{notice ?? (league.memberCount < SMALL_LEAGUE ? "Bigger pot, better odds. Invite friends" : "Invite friends")}</Text>
        <View style={styles.valueWithIcon}>
          <Text style={styles.value}>{league.inviteCode}</Text>
          <Icon name="share-outline" size={18} color={colors.accent} />
        </View>
      </Pressable>
      <Divider inset={SCREEN_MARGIN} />
      <DetailRow label="Members" value={String(league.memberCount)} />
      <DetailRow label="Settles" value={isSettled(pot, now) ? "Settled" : formatCountdown(pot.settlesAt - now)} />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Divider inset={SCREEN_MARGIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: layout.rowMin, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_MARGIN },
  label: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  value: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text, ...tabular },
  valueWithIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
