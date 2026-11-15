import { StyleSheet, Text, View } from "react-native";

import { Divider, SectionLabel } from "@/components/ui";
import type { Payout } from "@/lib/backend";
import { formatUsd } from "@/lib/leagueText";
import { colors, font, spacing } from "@/theme";

const KIND_LABEL = { refund: "Refund", winnings: "Winnings" } as const;

/** What each player was paid when the week settled. Only rendered once payouts exist. */
export function PayoutRows({ payouts }: { payouts: Payout[] }) {
  return (
    <View>
      <SectionLabel left="Payouts" />
      {payouts.map((payout) => (
        <View key={`${payout.userId}-${payout.kind}`}>
          <View style={styles.row} accessible accessibilityLabel={`${payout.name}, ${KIND_LABEL[payout.kind]}, ${formatUsd(payout.amountUsd)}`}>
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>{payout.name}</Text>
              <Text style={styles.kind}>{KIND_LABEL[payout.kind]}</Text>
            </View>
            <Text style={styles.amount}>{`+${formatUsd(payout.amountUsd)}`}</Text>
          </View>
          <Divider />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.md },
  who: { flex: 1 },
  name: { fontSize: font.title, fontWeight: "600", color: colors.text },
  kind: { fontSize: font.meta, color: colors.textMuted },
  amount: { fontSize: font.score, fontWeight: "700", color: colors.tabActive, fontVariant: ["tabular-nums"] },
});
