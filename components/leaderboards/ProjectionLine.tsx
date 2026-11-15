import { StyleSheet, Text, View } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, spacing } from "@/theme";

import { projectionDetail } from "./format";
import { useProjection } from "./useProjection";

/** "Projected: +$12.40" over a grey range line. Renders nothing in a free league. */
export function ProjectionLine({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const projection = useProjection(leagueId);
  if (!projection) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{projection.label}</Text>
      <Text style={styles.detail}>{projectionDetail(projection)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  label: { fontSize: font.title, fontWeight: "700", color: colors.text },
  detail: { fontSize: font.meta, color: colors.textMuted },
});
