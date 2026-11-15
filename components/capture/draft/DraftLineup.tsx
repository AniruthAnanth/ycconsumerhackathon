import { useMemo } from "react";
import { View } from "react-native";

import { SLOT_ORDER, SectionLabel } from "@/components/ui";

import { DraftRow } from "./DraftRow";
import type { DraftTask } from "./types";

type Props = {
  tasks: DraftTask[];
  editable: boolean;
  onRename: (index: number, title: string) => void;
  onRemove: (index: number) => void;
};

export function DraftLineup({ tasks, editable, onRename, onRemove }: Props) {
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
      {rows.map(({ task, index }) => (
        <DraftRow
          key={index}
          task={task}
          editable={editable}
          onRename={(title) => onRename(index, title)}
          onRemove={() => onRemove(index)}
        />
      ))}
    </View>
  );
}
