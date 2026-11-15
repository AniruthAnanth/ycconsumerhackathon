import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, fontFamily, MIN_TARGET, SCREEN_MARGIN } from "@/theme";

import { isProjectedGain } from "./format";
import { useProjection } from "./useProjection";

/**
 * One compact "Projected: +$12.40" line that opens the money board. It sits
 * above the week's total, so it is a single short row: the range lives on the
 * money board (ProjectionRange), and a taller line would push the task list up
 * when it loads.
 * Renders nothing in a free league or while the projection loads.
 */
export function ProjectionLine({ leagueId }: { leagueId: Id<"leagues"> | null }) {
  const router = useRouter();
  const projection = useProjection(leagueId);
  if (!projection) return null;
  return (
    <Pressable
      style={styles.line}
      onPress={() => router.push({ pathname: "/leaderboards", params: { board: "money" } })}
      accessibilityRole="button"
      accessibilityLabel={`${projection.label}, open the money board`}
    >
      <Text style={[styles.label, isProjectedGain(projection) && styles.gain]}>
        {projection.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { minHeight: MIN_TARGET, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: SCREEN_MARGIN },
  label: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
  gain: { color: colors.tabActive },
});
