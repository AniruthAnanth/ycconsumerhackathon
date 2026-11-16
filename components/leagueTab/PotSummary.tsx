import { StyleSheet, Text, View } from "react-native";

import { EscrowFlow } from "@/components/money";
import { cardStyle, Divider } from "@/components/ui";
import type { Pot, Standing } from "@/lib/backend";
import { escrowFlowData } from "@/lib/escrow";
import { potEmptyText } from "./emptyState";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

type Props = {
  pot: Pot;
  /** The standings rows, for the members' pictures. The card still draws without them, with initials. */
  standings?: readonly Standing[];
  now: number;
};

/**
 * The league's pot as a picture of the money: every member's buy-in flowing into the pot, and the
 * pot down to what the winner takes. Each fact appears once on the League tab: the avatars say who
 * has paid (no list of names, no paid count), and the stake and the time to settlement are rows in
 * LeagueDetails, so the card repeats neither.
 * A free league or a pot nobody has paid into shows a one-line note instead (see potEmptyText).
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
  return (
    <View>
      <View style={styles.card}>
        <EscrowFlow {...escrowFlowData(pot, standings, now)} testID="pot-escrow" />
      </View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardStyle,
    marginHorizontal: SCREEN_MARGIN,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  empty: { marginHorizontal: SCREEN_MARGIN, marginVertical: spacing.lg, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
});
