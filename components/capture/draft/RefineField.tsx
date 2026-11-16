import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { TextField } from "@/components/ui";
import { spacing } from "@/theme";

type Props = { busy: boolean; onSend: (instruction: string) => Promise<boolean> };

/** One line under the drafted lineup: type a change, press send, and the lineup is redrafted with it. As often as wanted before Lock. */
export function RefineField({ busy, onSend }: Props) {
  const [instruction, setInstruction] = useState("");
  const send = async () => {
    if (await onSend(instruction)) setInstruction("");
  };
  return (
    <View style={styles.container}>
      <TextField
        label="Change anything"
        value={instruction}
        onChangeText={setInstruction}
        placeholder="Swap laundry for dishes, make the gym harder"
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={() => void send()}
        editable={!busy}
        testID="draft-refine"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xs },
});
