import { useState } from "react";
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
  layout,
  radius,
  spacing,
  tabular,
} from "@/theme";

// The chip draws at the pill height; the slop takes its tap area to the 44-pt minimum.
const SLOP = (layout.rowMin - layout.pillHeight) / 2;

import { socialApi, type TaskVeto } from "../contract";
import { confirmAction, notify } from "../notify";
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
  // A tap toggles my vote, so a double tap would cast and take it back; ignore taps while one is in flight.
  const [pending, setPending] = useState(false);
  const send = () => {
    if (pending) return;
    setPending(true);
    haptics.veto();
    cast({ taskId: veto.taskId, leagueId })
      .catch((error) => notify(errorMessage(error)))
      .finally(() => setPending(false));
  };
  // Casting can strike a teammate's task, so it takes a second tap like the proof veto; taking a vote back does not.
  const onPress = () => {
    if (veto.mine) return send();
    const left = veto.needed - veto.votes;
    confirmAction({
      title: `Veto ${veto.title}?`,
      message:
        left <= 1
          ? `Your vote strikes it, and ${veto.ownerName} has to swap in another task.`
          : `${veto.needed} votes strike it. You can take yours back while the vote is open.`,
      confirmLabel: "Veto",
      onConfirm: send,
    });
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
          : quiet
            ? "Veto"
            : `Veto, ${veto.votes} of ${veto.needed}`
      }
      accessibilityState={{ selected: veto.mine, disabled: !veto.canVote }}
      disabled={!veto.canVote}
      onPress={onPress}
      hitSlop={{ top: SLOP, bottom: SLOP, left: spacing.sm, right: spacing.sm }}
      style={style}
    >
      <Text style={text}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.pillHeight,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  // Text-only, same height as the chip so the row doesn't jump when the first veto lands.
  quiet: {
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
