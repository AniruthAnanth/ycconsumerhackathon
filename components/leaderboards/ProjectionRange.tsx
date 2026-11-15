import { StyleSheet, Text, View } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, hairline, spacing } from "@/theme";

import { projectionDetail } from "./format";
import { useProjection } from "./useProjection";

/**
 * Above the money board: what the caller would be paid if the week ended now,
 * and the range their payout can still land in. The board's own numbers are
 * net of the stake; this is the payout they come from. Renders nothing in a
 * free league or for a member who has not paid, who has no payout to show.
 */
export function ProjectionRange({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const projection = useProjection(leagueId);
  if (!projection?.eligible) return null;
  return (
    <View style={styles.line}>
      <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {projectionDetail(projection)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { fontFamily: fontFamily.regular, fontSize: font.meta, color: colors.textMuted },
});
