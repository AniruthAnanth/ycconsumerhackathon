import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, fontFamily, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { SunnyAvatar } from "../sunny/SunnyAvatar";
import { parseReply, type SunnyAction } from "../sunny/sunnyLogic";
import type { ChatMessage } from "./chatLogic";

const ACTION_LABEL = { swap: "Swap a task", veto: "Open vetoes", nudge: "Nudge" } as const;

/** Mine are blue and right-aligned; the agent's sit left on the wash. A failed one of mine retries on tap. */
export function MessageBubble({
  message,
  onRetry,
  onAction,
}: {
  message: ChatMessage;
  onRetry: (id: string) => void;
  onAction: (action: SunnyAction) => void;
}) {
  const mine = message.role === "user";
  // Sunny may end a reply with an action tag; it becomes a button instead of text.
  const { text, action } = mine ? { text: message.text, action: undefined } : parseReply(message.text);
  const bubble = (
    <View style={[styles.bubble, mine ? styles.mine : styles.agent]}>
      <Text style={[styles.text, mine && styles.mineText]}>{text}</Text>
    </View>
  );

  if (!mine) {
    return (
      <View style={[styles.row, styles.agentRow]}>
        <SunnyAvatar size={32} />
        <View style={styles.agentBody}>
          {bubble}
          {action ? (
            <Pressable accessibilityRole="button" onPress={() => onAction(action)} style={styles.action}>
              <Text style={styles.actionText}>{action.kind === "nudge" ? `Nudge ${action.name}` : ACTION_LABEL[action.kind]}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
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
  // Sunny sits level with the top of the bubble, beside every reply.
  agentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  agentBody: { flex: 1, alignItems: "flex-start", gap: spacing.xs },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.accentTint },
  actionText: { color: colors.accent, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.control },
  mine: { backgroundColor: colors.accent },
  // Sunny's replies sit on the card surface with the one outline, so they read as bubbles on the canvas.
  agent: { backgroundColor: colors.accentTint },
  text: { color: colors.text, fontFamily: fontFamily.regular, fontSize: font.title, lineHeight: type.body.lineHeight },
  mineText: { color: colors.onAccent },
  failed: { color: colors.danger, fontSize: font.meta, fontFamily: fontFamily.semiBold, marginTop: spacing.xs },
  reason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta, marginTop: spacing.xs },
});
