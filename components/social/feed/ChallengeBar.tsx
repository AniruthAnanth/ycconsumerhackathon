import { useMutation } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { CountUp, PressScale, ProgressFill } from "@/components/motion";
import { type FeedChallenge, socialApi } from "@/components/social/contract";
import { notify } from "@/components/social/notify";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { colors, font, fontFamily, MIN_TARGET, progress, radius, SCREEN_MARGIN, spacing, tabular } from "@/theme";

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
  const cast = (legit: boolean) => {
    haptics.select();
    vote({ challengeId: challenge.challengeId, legit }).catch((error) => notify(errorMessage(error)));
  };

  return (
    <View style={styles.box}>
      <View style={styles.heading}>
        <Text style={styles.title}>CHALLENGED</Text>
        <Text style={styles.status}>{challengeStatus(challenge, now)}</Text>
      </View>
      <ProgressFill ratio={share} color={progress.fill} track={colors.danger} />
      <View style={styles.sides}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Legit"
          accessibilityState={{ selected: challenge.myVote === true, disabled: !votable }}
          disabled={!votable}
          onPress={() => cast(true)}
          style={[styles.side, votable && styles.sideVotable, challenge.myVote === true && styles.sideLegitMine]}
        >
          <Text style={[styles.sideLabel, styles.legitText]}>Legit</Text>
          <CountUp value={challenge.legit} format={String} style={styles.sideCount} />
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Not Legit"
          accessibilityState={{ selected: challenge.myVote === false, disabled: !votable }}
          disabled={!votable}
          onPress={() => cast(false)}
          style={[styles.side, votable && styles.sideVotable, challenge.myVote === false && styles.sideNotLegitMine]}
        >
          <CountUp value={challenge.notLegit} format={String} style={styles.sideCount} />
          <Text style={[styles.sideLabel, styles.notLegitText]}>Not Legit</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.lg, gap: spacing.sm },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { color: colors.text, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
  status: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  sides: { flexDirection: "row", gap: spacing.sm },
  side: {
    flex: 1,
    minHeight: MIN_TARGET,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sideVotable: { borderColor: colors.divider },
  sideLegitMine: { borderColor: colors.tabActive },
  sideNotLegitMine: { borderColor: colors.danger },
  sideLabel: { fontSize: font.body, fontFamily: fontFamily.bold },
  legitText: { color: colors.tabActive },
  notLegitText: { color: colors.danger },
  sideCount: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold, ...tabular },
});
