import { useMutation } from "convex/react";
import { StyleSheet, Text } from "react-native";

import { PressScale } from "@/components/motion";
import { type Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import {
  BORDER,
  colors,
  font,
  fontFamily,
  radius,
  spacing,
  tabular,
} from "@/theme";

import { socialApi, type TaskVeto } from "../contract";
import { notify } from "../notify";
import { chipLabel } from "./vetoLogic";

/** "Veto? 1/2": the league's running vote on a task. Tap to add or take back my veto while it is open. */
export function VetoChip({
  veto,
  leagueId,
}: {
  veto: TaskVeto;
  leagueId: Id<"leagues">;
}) {
  const cast = useMutation(socialApi.vetoes.cast);
  const label = chipLabel(veto);
  const onPress = () => {
    haptics.select();
    cast({ taskId: veto.taskId, leagueId }).catch((error) =>
      notify(errorMessage(error)),
    );
  };
  const style = [
    styles.chip,
    veto.mine && !veto.struck && styles.mine,
    veto.struck && styles.struck,
  ];
  const text = [
    styles.label,
    veto.mine && !veto.struck && styles.labelMine,
    veto.struck && styles.labelStruck,
  ];

  return (
    <PressScale
      testID={`veto-chip-${veto.taskId}`}
      accessibilityRole="button"
      accessibilityLabel={
        veto.struck
          ? "Struck by the league"
          : `Veto, ${veto.votes} of ${veto.needed}`
      }
      accessibilityState={{ selected: veto.mine, disabled: !veto.canVote }}
      disabled={!veto.canVote}
      onPress={onPress}
      style={style}
    >
      <Text style={text}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  mine: { backgroundColor: colors.accent, borderColor: colors.accent },
  struck: { borderColor: colors.danger },
  label: {
    color: colors.textMuted,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    ...tabular,
  },
  labelMine: { color: colors.onAccent },
  labelStruck: { color: colors.danger },
});
