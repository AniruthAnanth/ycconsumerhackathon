import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, TextField } from "@/components/ui";
import { errorMessage } from "@/lib/errorMessage";
import { spacing } from "@/theme";

import { socialApi, type TaskVeto } from "../contract";
import { notify } from "../notify";

/** The owner's way out of a struck task: a new title in place of the old one. */
export function SwapEditor({ veto }: { veto: TaskVeto }) {
  const swap = useMutation(socialApi.vetoes.swap);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open)
    return (
      <Button label="Swap" onPress={() => setOpen(true)} style={styles.swap} />
    );

  const save = () => {
    setSaving(true);
    swap({ taskId: veto.taskId, title: title.trim() })
      .then(() => setOpen(false))
      .catch((error) => notify(errorMessage(error)))
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.editor}>
      <TextField
        label="New task"
        value={title}
        onChangeText={setTitle}
        placeholder="Something harder"
        autoFocus
      />
      <Button
        label="Save"
        onPress={save}
        loading={saving}
        disabled={title.trim().length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  swap: { alignSelf: "stretch" },
  editor: { gap: spacing.sm, paddingTop: spacing.sm },
});
