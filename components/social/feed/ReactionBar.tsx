import { useMutation } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { CountUp, PressScale } from "@/components/motion";
import type { Id } from "@/convex/_generated/dataModel";
import { type FeedReaction, socialApi } from "@/components/social/contract";
import { notify } from "@/components/social/notify";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { colors, fontFamily, MIN_TARGET, radius } from "@/theme";

import { reactionButtons } from "./feedLogic";

/** One tap reacts, a second takes it back; the server toggles, so the bar only reports. */
export function ReactionBar({ proofId, reactions }: { proofId: Id<"proofs">; reactions: FeedReaction[] }) {
  const react = useMutation(socialApi.feed.react);
  return (
    <View style={styles.bar}>
      {reactionButtons(reactions).map(({ emoji, count, mine }) => (
        <PressScale
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
          accessibilityState={{ selected: mine }}
          hitSlop={4}
          onPress={() => {
            haptics.select();
            react({ proofId, emoji }).catch((error) => notify(errorMessage(error)));
          }}
          style={[styles.reaction, mine && styles.reactionMine]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          {count > 0 ? <CountUp value={count} format={String} style={[styles.count, mine && styles.countMine]} /> : null}
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: MIN_TARGET,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  reactionMine: { borderColor: colors.accent },
  emoji: { fontFamily: fontFamily.regular, fontSize: 15 },
  count: { color: colors.textMuted, fontSize: 13, fontFamily: fontFamily.semiBold, fontVariant: ["tabular-nums"] },
  countMine: { color: colors.accent },
});
