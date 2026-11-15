import { useMutation } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type FeedChallenge, socialApi } from "@/components/social/contract";
import { errorMessage } from "@/components/social/errorMessage";
import { notify } from "@/components/social/notify";
import { colors } from "@/theme";

import { challengeStatus, legitShare } from "./feedLogic";

/**
 * The league's vote on a challenged proof: a bar split between Legit and Not
 * Legit with a button for each side. Once the vote settles, or for someone who
 * has no vote, the same bar stays as the record and the buttons go quiet.
 */
export function ChallengeBar({
  challenge,
  votable,
  now,
}: {
  challenge: FeedChallenge;
  votable: boolean;
  now: number;
}) {
  const vote = useMutation(socialApi.challenges.vote);
  const share = legitShare(challenge.legit, challenge.notLegit);
  const cast = (legit: boolean) =>
    vote({ challengeId: challenge.challengeId, legit }).catch((error) => notify(errorMessage(error)));

  return (
    <View style={styles.box}>
      <View style={styles.heading}>
        <Text style={styles.title}>CHALLENGED</Text>
        <Text style={styles.status}>{challengeStatus(challenge, now)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.legit, { flex: share }]} />
        <View style={[styles.notLegit, { flex: 1 - share }]} />
      </View>
      <View style={styles.sides}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Legit"
          accessibilityState={{ selected: challenge.myVote === true, disabled: !votable }}
          disabled={!votable}
          onPress={() => cast(true)}
          style={[styles.side, votable && styles.sideVotable, challenge.myVote === true && styles.sideLegitMine]}
        >
          <Text style={[styles.sideLabel, styles.legitText]}>Legit</Text>
          <Text style={styles.sideCount}>{challenge.legit}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not Legit"
          accessibilityState={{ selected: challenge.myVote === false, disabled: !votable }}
          disabled={!votable}
          onPress={() => cast(false)}
          style={[styles.side, votable && styles.sideVotable, challenge.myVote === false && styles.sideNotLegitMine]}
        >
          <Text style={styles.sideCount}>{challenge.notLegit}</Text>
          <Text style={[styles.sideLabel, styles.notLegitText]}>Not Legit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  status: { color: colors.textMuted, fontSize: 12 },
  track: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.strip },
  legit: { backgroundColor: colors.tabActive },
  notLegit: { backgroundColor: colors.danger },
  sides: { flexDirection: "row", gap: 8 },
  side: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sideVotable: { borderColor: colors.divider },
  sideLegitMine: { borderColor: colors.tabActive },
  sideNotLegitMine: { borderColor: colors.danger },
  sideLabel: { fontSize: 14, fontWeight: "700" },
  legitText: { color: colors.tabActive },
  notLegitText: { color: colors.danger },
  sideCount: { color: colors.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
