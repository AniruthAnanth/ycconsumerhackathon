import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { SLOT_ORDER, SectionLabel } from "@/components/ui";

import { FADE_MS } from "@/lib/native/motion";

import { DraftRow } from "./DraftRow";
import type { DraftTask } from "../backend";

type Props = {
  tasks: DraftTask[];
  editable: boolean;
  /** The titles are suggestions the player has not chosen yet. */
  suggested: boolean;
  onRename: (index: number, title: string) => void;
  onRemove: (index: number) => void;
  /** A typed change is being applied: the rows shimmer until the new lineup arrives. */
  refining?: boolean;
  /** A title edited by hand, once the player leaves it. */
  onTitleDone?: (index: number, title: string) => void;
};

export function DraftLineup({ tasks, editable, suggested, onRename, onRemove, refining = false, onTitleDone }: Props) {
  const shimmer = useSharedValue(1);
  useEffect(() => {
    shimmer.value = refining ? withRepeat(withTiming(0.45, { duration: FADE_MS * 2 }), -1, true) : withTiming(1, { duration: FADE_MS });
  }, [refining, shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  const rows = useMemo(
    () =>
      tasks
        .map((task, index) => ({ task, index }))
        .sort((a, b) => SLOT_ORDER.indexOf(a.task.slot) - SLOT_ORDER.indexOf(b.task.slot)),
    [tasks],
  );

  return (
    <View>
      <SectionLabel left="LINEUP" right="PTS" />
      <Animated.View style={shimmerStyle}>
        {rows.map(({ task, index }) => (
          // Keyed by slot and point value, not title, so typing keeps a row in place while a redraft fades the changed rows in.
          <Animated.View key={`${task.slot}-${index}-${task.points}`} entering={FadeIn.duration(FADE_MS)} layout={LinearTransition.duration(FADE_MS)}>
            <DraftRow
              task={task}
              editable={editable && !refining}
              suggested={suggested}
              onRename={(title) => onRename(index, title)}
              onRemove={() => onRemove(index)}
              onTitleDone={(title) => onTitleDone?.(index, title)}
            />
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}
