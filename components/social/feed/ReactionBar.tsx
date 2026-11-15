import { useMutation } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { type FeedReaction, socialApi } from "@/components/social/contract";
import { errorMessage } from "@/components/social/errorMessage";
import { notify } from "@/components/social/notify";
import { colors } from "@/theme";

import { reactionButtons } from "./feedLogic";

/** One tap reacts, a second takes it back; the server toggles, so the bar only reports. */
export function ReactionBar({ proofId, reactions }: { proofId: Id<"proofs">; reactions: FeedReaction[] }) {
  const react = useMutation(socialApi.feed.react);
  return (
    <View style={styles.bar}>
      {reactionButtons(reactions).map(({ emoji, count, mine }) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
          accessibilityState={{ selected: mine }}
          hitSlop={4}
          onPress={() => react({ proofId, emoji }).catch((error) => notify(errorMessage(error)))}
          style={[styles.reaction, mine && styles.reactionMine]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          {count > 0 ? <Text style={[styles.count, mine && styles.countMine]}>{count}</Text> : null}
        </Pressable>
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
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  reactionMine: { borderColor: colors.accent },
  emoji: { fontSize: 15 },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  countMine: { color: colors.accent },
});
