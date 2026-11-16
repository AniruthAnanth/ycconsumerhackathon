import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/components/ui";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { canSend } from "./chatLogic";

const MAX_INPUT_HEIGHT = 100;
const SEND = 34;

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
        <Icon name="arrow-up-circle" size={SEND} color={colors.accent} />
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
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: font.title,
  },
  send: { minWidth: layout.rowMin, minHeight: layout.rowMin, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.4 },
});
