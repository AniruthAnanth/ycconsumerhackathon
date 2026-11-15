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
import { chipLabel, isQuiet } from "./vetoLogic";

/** A quiet "Veto" until someone votes, then the running "Veto 1/2". Tap to add or take back my veto while it is open. */
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
    haptics.veto();
    cast({ taskId: veto.taskId, leagueId }).catch((error) =>
      notify(errorMessage(error)),
    );
  };
  const quiet = isQuiet(veto);
  const style = [
    quiet ? styles.quiet : styles.chip,
    veto.mine && !veto.struck && styles.mine,
    veto.struck && styles.struck,
  ];
  const text = [
    styles.label,
    quiet && styles.labelQuiet,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  // Text-only, same height as the chip so the row doesn't jump when the first veto lands.
  quiet: {
    paddingVertical: spacing.xs,
    borderWidth: BORDER,
    borderColor: "transparent",
  },
  mine: { backgroundColor: colors.accent, borderColor: colors.accent },
  struck: { borderColor: colors.danger },
  label: {
    color: colors.textMuted,
    fontSize: font.label,
    fontFamily: fontFamily.bold,
    ...tabular,
  },
  labelQuiet: { color: colors.textMuted },
  labelMine: { color: colors.onAccent },
  labelStruck: { color: colors.danger },
});
