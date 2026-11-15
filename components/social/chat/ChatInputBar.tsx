import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { canSend } from "./chatLogic";

const MAX_INPUT_HEIGHT = 100;

export function ChatInputBar({
  text,
  pending,
  onChangeText,
  onSend,
}: {
  text: string;
  pending: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
}) {
  const enabled = canSend(text, pending);
  return (
    <View style={styles.bar}>
      <TextInput
        accessibilityLabel="Message"
        multiline
        value={text}
        onChangeText={onChangeText}
        placeholder="Message"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send"
        disabled={!enabled}
        onPress={onSend}
        style={[styles.send, !enabled && styles.sendDisabled]}
      >
        <Text style={styles.sendText}>Send</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: layout.rowMin,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.strip,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: font.title,
  },
  send: {
    minHeight: layout.rowMin,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.onAccent, fontSize: font.body, fontFamily: fontFamily.bold },
});
