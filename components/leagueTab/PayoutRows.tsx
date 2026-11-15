import { StyleSheet, Text, View } from "react-native";

import { Divider, SectionLabel } from "@/components/ui";
import type { Payout } from "@/lib/backend";
import { formatUsd, payoutLine } from "@/lib/leagueText";
import { colors, font, fontFamily, spacing } from "@/theme";

/** What each player was paid when the week settled. Only rendered when there is at least one payout, so a free league shows no empty header. */
export function PayoutRows({ payouts }: { payouts: Payout[] }) {
  return (
    <View>
      <SectionLabel left="Payouts" />
      {payouts.map((payout) => {
        const line = payoutLine(payout);
        return (
          <View key={`${payout.userId}-${payout.kind}`}>
            <View style={styles.row} accessible accessibilityLabel={`${payout.name}, ${line.replace(" | ", ", ")}, ${formatUsd(payout.amountUsd)}`}>
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{payout.name}</Text>
                <Text style={styles.kind} numberOfLines={1}>{line}</Text>
              </View>
              <Text style={styles.amount}>{`+${formatUsd(payout.amountUsd)}`}</Text>
            </View>
            <Divider />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.md },
  who: { flex: 1 },
  name: { fontSize: font.title, fontFamily: fontFamily.semiBold, color: colors.text },
  kind: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  amount: { fontSize: font.score, fontFamily: fontFamily.bold, color: colors.tabActive, fontVariant: ["tabular-nums"] },
});
