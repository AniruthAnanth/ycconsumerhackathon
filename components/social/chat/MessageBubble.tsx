import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/social/kit";

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
  row: { paddingHorizontal: 16, paddingVertical: 4 },
  mineRow: { alignItems: "flex-end" },
  agentRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: colors.accent },
  agent: { backgroundColor: colors.wash },
  text: { color: colors.text, fontSize: 16, lineHeight: 21 },
  mineText: { color: colors.bg },
  failed: { color: colors.red, fontSize: 12, fontWeight: "600", marginTop: 4 },
  reason: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
