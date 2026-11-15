import { StyleSheet, Text, View } from "react-native";

import { EscrowFlow } from "@/components/money";
import { Divider } from "@/components/ui";
import type { Pot, Standing } from "@/lib/backend";
import { escrowFlowData } from "@/lib/escrow";
import { formatCountdown, formatUsd, isSettled } from "@/lib/leagueText";
import { potEmptyText } from "./emptyState";
import { colors, font, fontFamily, radius, SCREEN_MARGIN, spacing } from "@/theme";

type Props = {
  pot: Pot;
  /** The standings rows, for the members' pictures. The card still draws without them, with initials. */
  standings?: readonly Standing[];
  now: number;
};

/**
 * The league's pot as a picture of the money: every member's buy-in flowing into the pot, and the
 * pot down to what the winner takes. The avatars say who has paid, so there is no list of names.
 * A free league or a pot nobody has paid into shows a one-line note instead (see potEmptyText);
 * the stake and the time to settlement are already rows in LeagueDetails.
 */
export function PotSummary({ pot, standings = [], now }: Props) {
  const empty = potEmptyText(pot);
  if (empty !== null) {
    // A free league has nothing to draw, and a paid one has nothing until someone pays: say so instead of a bare $0.
    return (
      <View>
        <Text style={styles.empty} accessibilityLabel={empty}>{empty}</Text>
        <Divider />
      </View>
    );
  }
  const memberCount = pot.paid.length + pot.unpaid.length;
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.muted}>{`${formatUsd(pot.stakeUsd)} buy-in`}</Text>
          <Text style={styles.muted}>
            {isSettled(pot, now) ? "Settled" : `Settles in ${formatCountdown(pot.settlesAt - now)}`}
          </Text>
        </View>
        <EscrowFlow {...escrowFlowData(pot, standings, now)} testID="pot-escrow" />
        <Text style={styles.count}>{`${pot.paid.length} OF ${memberCount} PAID IN`}</Text>
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  empty: { marginHorizontal: SCREEN_MARGIN, marginVertical: spacing.lg, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  top: { flexDirection: "row", justifyContent: "space-between" },
  muted: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  count: { textAlign: "center", fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted, letterSpacing: 0.6 },
});
