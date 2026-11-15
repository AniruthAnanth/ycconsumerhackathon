import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, TextField } from "@/components/ui";
import { spacing } from "@/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
};

/** Stands in for the microphone on simulators and when recording fails. */
export function TypedDraft({ value, onChangeText, onSubmit }: Props) {
  return (
    <View style={styles.container}>
      <TextField label="Your week" value={value} onChangeText={onChangeText} multiline numberOfLines={5} />
      <OutlinedPillButton label="Draft from text" onPress={onSubmit} disabled={value.trim().length === 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: "stretch" },
});
