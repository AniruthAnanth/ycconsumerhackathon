import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "@/components/social/kit";

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
        placeholderTextColor={colors.muted}
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
    borderTopColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.wash,
    color: colors.text,
    fontSize: 16,
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
  sendText: { color: colors.bg, fontSize: 15, fontWeight: "700" },
});
