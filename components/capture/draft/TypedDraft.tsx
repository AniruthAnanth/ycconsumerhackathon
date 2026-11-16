import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, TextField } from "@/components/ui";
import { fontFamily, spacing, type } from "@/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
};

/** Stands in for the microphone on simulators and when recording fails. */
export function TypedDraft({ value, onChangeText, onSubmit }: Props) {
  return (
    <View style={styles.container}>
      {/* Return closes the keyboard: a week is one paragraph, and without it nothing on the screen let go of the keyboard (ANI-52). */}
      <TextField
        label="Your week"
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={5}
        style={styles.input}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        testID="draft-typed-week"
      />
      <OutlinedPillButton label="Draft from text" onPress={onSubmit} disabled={value.trim().length === 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: "stretch" },
  input: { ...type.body, fontFamily: fontFamily.regular, minHeight: 120, paddingTop: spacing.md, paddingBottom: spacing.md, textAlignVertical: "top" },
});
