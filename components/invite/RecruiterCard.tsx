import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { Divider, SectionLabel } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { REFERRAL_POINTS } from "@/convex/lib/referralRules";
import { colors, font, fontFamily, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing, tabular } from "@/theme";

import { friendStatusLine } from "./inviteRoute";

/**
 * The caller's Recruiter standing: points, badge and every friend they brought
 * in. Recruiter points are kept apart from league points, so this never moves a pot.
 */
export function RecruiterCard() {
  const mine = useQuery(api.referrals.mine);
  if (!mine) return null;
  return (
    <View>
      <SectionLabel left="Recruiter" right={mine.badge ? mine.badge.toUpperCase() : undefined} />
      <View style={styles.totals}>
        <Total label="Points" value={`+${mine.recruiterPoints}`} />
        <Total label="Invited" value={String(mine.invited)} />
        <Total label="Locked" value={String(mine.locked)} />
      </View>
      <Divider />
      <Text style={styles.rule}>{`A friend who locks a first lineup earns you ${REFERRAL_POINTS} Recruiter points.`}</Text>
      <SectionLabel left="Friends" />
      {mine.friends.length === 0 ? <Text style={styles.empty}>No friends invited yet</Text> : null}
      {mine.friends.map((friend) => (
        <View key={friend.userId}>
          <View style={styles.row}>
            <Text style={styles.name}>{friend.name}</Text>
            <Text style={[styles.status, friend.status === "locked" && styles.locked]}>{friendStatusLine(friend)}</Text>
          </View>
          <Divider inset={SCREEN_MARGIN} />
        </View>
      ))}
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.total} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.totalLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: "row", paddingVertical: spacing.lg, paddingHorizontal: SCREEN_MARGIN },
  total: { flex: 1, alignItems: "center", gap: spacing.xs },
  totalValue: { fontSize: font.total, fontFamily: fontFamily.bold, color: colors.text, ...tabular },
  totalLabel: { fontSize: font.label, fontFamily: fontFamily.bold, color: colors.textMuted },
  rule: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
  empty: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.lg, fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  row: { minHeight: ROW_HEIGHT_COMPACT, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: layout.columnGap, paddingVertical: spacing.sm, paddingHorizontal: SCREEN_MARGIN },
  name: { flex: 1, fontSize: font.title, fontFamily: fontFamily.semiBold, color: colors.text },
  status: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
  locked: { color: colors.tabActive, fontFamily: fontFamily.bold },
});
