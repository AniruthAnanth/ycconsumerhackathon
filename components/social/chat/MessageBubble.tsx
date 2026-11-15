import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import type { ChatMessage } from "./chatLogic";

/** Mine are blue and right-aligned; the agent's sit left on the wash. A failed one of mine retries on tap. */
export function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: (id: string) => void }) {
  const mine = message.role === "user";
  const bubble = (
    <View style={[styles.bubble, mine ? styles.mine : styles.agent]}>
      <Text style={[styles.text, mine && styles.mineText]}>{message.text}</Text>
    </View>
  );

  if (!mine) return <View style={[styles.row, styles.agentRow]}>{bubble}</View>;
  if (!message.error) return <View style={[styles.row, styles.mineRow]}>{bubble}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Not sent. Tap to retry"
      onPress={() => onRetry(message.id)}
      style={[styles.row, styles.mineRow]}
    >
      {bubble}
      <Text style={styles.failed}>Not sent. Tap to retry</Text>
      <Text style={styles.reason}>{message.error}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.xs },
  mineRow: { alignItems: "flex-end" },
  agentRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.control },
  mine: { backgroundColor: colors.accent },
  agent: { backgroundColor: colors.strip },
  text: { color: colors.text, fontFamily: fontFamily.regular, fontSize: font.title, lineHeight: type.body.lineHeight },
  mineText: { color: colors.onAccent },
  failed: { color: colors.danger, fontSize: font.meta, fontFamily: fontFamily.semiBold, marginTop: spacing.xs },
  reason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta, marginTop: spacing.xs },
});
