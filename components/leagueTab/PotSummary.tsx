import { StyleSheet, Text, View } from "react-native";

import { CountUp } from "@/components/motion";
import { Divider, Icon } from "@/components/ui";
import type { Pot } from "@/lib/backend";
import { formatCountdown, formatUsd, isSettled } from "@/lib/leagueText";
import { colors, font, spacing } from "@/theme";

type Props = { pot: Pot; now: number };

/**
 * The league's pot as the biggest figure on the screen, then who has paid in.
 * A free league has no pot and nobody to pay, so it draws nothing: the stake
 * and the time to settlement are already rows in LeagueDetails.
 */
export function PotSummary({ pot, now }: Props) {
  if (pot.stakeUsd === 0) return null;
  return (
    <View>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>POT</Text>
          {/* Ticks up when a buy-in lands, so the pot visibly grows. */}
          <CountUp style={styles.amount} value={pot.potUsd} format={formatUsd} accessibilityLabel={`Pot ${formatUsd(pot.potUsd)}`} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.muted}>{`${formatUsd(pot.stakeUsd)} buy-in`}</Text>
          <Text style={styles.muted}>
            {isSettled(pot, now) ? "Settled" : `Settles in ${formatCountdown(pot.settlesAt - now)}`}
          </Text>
        </View>
      </View>
      <NameGroup label={`PAID ${pot.paid.length}`} names={pot.paid.map((p) => ({ id: p.userId, name: p.name }))} paid />
      <NameGroup label={`UNPAID ${pot.unpaid.length}`} names={pot.unpaid.map((p) => ({ id: p.userId, name: p.name }))} paid={false} />
      <Divider />
    </View>
  );
}

function NameGroup({ label, names, paid }: { label: string; names: { id: string; name: string }[]; paid: boolean }) {
  if (names.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.names}>
        {names.map(({ id, name }) => (
          <View key={id} style={styles.name} accessible accessibilityLabel={`${name}, ${paid ? "paid" : "unpaid"}`}>
            {paid ? <Icon name="checkmark" size={14} color={colors.tabActive} /> : null}
            <Text style={[styles.nameText, !paid && styles.unpaid]}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  label: { fontSize: font.label, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.6 },
  amount: { fontSize: font.pot, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  meta: { alignItems: "flex-end", gap: 2 },
  muted: { fontSize: font.body, color: colors.textMuted },
  group: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  names: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: spacing.xs },
  name: { flexDirection: "row", alignItems: "center", gap: 2 },
  nameText: { fontSize: font.body, color: colors.text },
  unpaid: { color: colors.textMuted },
});
