import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, fontFamily } from "@/theme";

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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.strip,
    color: colors.text,
    fontFamily: fontFamily.regular, fontSize: 16,
  },
  send: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.onAccent, fontSize: 15, fontFamily: fontFamily.bold },
});
