import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { Divider, Icon, SectionLabel } from "@/components/ui";
import type { League, Pot } from "@/lib/backend";
import { formatCountdown, formatUsd } from "@/lib/leagueText";
import { colors, font, spacing } from "@/theme";

type Props = { league: League; pot: Pot; now: number };

/** Flat label and value rows about the league. The invite code row opens the share sheet. */
export function LeagueDetails({ league, pot, now }: Props) {
  const shareInvite = () =>
    Share.share({ message: `Join my Lineup league "${league.name}" with code ${league.inviteCode}.` });

  return (
    <View>
      <SectionLabel left="League" />
      <Pressable style={styles.row} onPress={shareInvite} accessibilityRole="button" accessibilityLabel={`Share invite code ${league.inviteCode}`}>
        <Text style={styles.label}>Invite code</Text>
        <View style={styles.valueWithIcon}>
          <Text style={styles.value}>{league.inviteCode}</Text>
          <Icon name="share-outline" size={18} color={colors.accent} />
        </View>
      </Pressable>
      <Divider />
      <DetailRow label="Stake" value={league.stakeUsd === 0 ? "Free" : formatUsd(league.stakeUsd)} />
      <DetailRow label="Members" value={String(league.memberCount)} />
      <DetailRow label="Settles" value={formatCountdown(pot.settlesAt - now)} />
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
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  label: { fontSize: font.body, color: colors.textMuted },
  value: { fontSize: font.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  valueWithIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
