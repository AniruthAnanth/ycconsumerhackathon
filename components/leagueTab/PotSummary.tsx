import { StyleSheet, Text, View } from "react-native";

import { Divider, Icon } from "@/components/ui";
import type { Pot } from "@/lib/backend";
import { formatCountdown, formatUsd, isSettled } from "@/lib/leagueText";
import { colors, font, spacing } from "@/theme";

type Props = { pot: Pot; now: number };

/** The league's pot as the biggest figure on the screen, then who has paid in. */
export function PotSummary({ pot, now }: Props) {
  const free = pot.stakeUsd === 0;
  return (
    <View>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>POT</Text>
          <Text style={styles.amount} accessibilityLabel={free ? "Free league" : `Pot ${formatUsd(pot.potUsd)}`}>
            {free ? "Free league" : formatUsd(pot.potUsd)}
          </Text>
        </View>
        <View style={styles.meta}>
          {free ? null : <Text style={styles.muted}>{`${formatUsd(pot.stakeUsd)} buy-in`}</Text>}
          <Text style={styles.muted}>
            {isSettled(pot, now) ? "Settled" : `Settles in ${formatCountdown(pot.settlesAt - now)}`}
          </Text>
        </View>
      </View>
      {free ? null : (
        <>
          <NameGroup label={`PAID ${pot.paid.length}`} names={pot.paid.map((p) => ({ id: p.userId, name: p.name }))} paid />
          <NameGroup label={`UNPAID ${pot.unpaid.length}`} names={pot.unpaid.map((p) => ({ id: p.userId, name: p.name }))} paid={false} />
        </>
      )}
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
