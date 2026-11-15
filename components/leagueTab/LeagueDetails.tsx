import { Pressable, StyleSheet, Text, View } from "react-native";

import { InviteButton } from "@/components/invite";
import { Divider, Icon, SectionLabel } from "@/components/ui";
import type { League, Pot } from "@/lib/backend";
import { formatCountdown, formatUsd, inviteMessage, isSettled } from "@/lib/leagueText";
import { shareText } from "@/lib/native/share";
import { colors, font, fontFamily, layout, SCREEN_MARGIN, spacing, tabular } from "@/theme";

type Props = { league: League; pot: Pot; now: number };

/** Flat label and value rows about the league. The invite code row opens the share sheet. */
export function LeagueDetails({ league, pot, now }: Props) {
  // shareText swallows a missing share sheet (web): the code is on the row to read out, so the tap just does nothing.
  const shareInvite = () => {
    void shareText(inviteMessage(league));
  };

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
      <View style={styles.invite}>
        <InviteButton leagueId={league._id} />
      </View>
      <Divider inset={SCREEN_MARGIN} />
      <DetailRow label="Stake" value={league.stakeUsd === 0 ? "Free" : formatUsd(league.stakeUsd)} />
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
  invite: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.md },
  valueWithIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
