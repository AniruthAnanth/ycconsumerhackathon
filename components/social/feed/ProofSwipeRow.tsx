import { useRef, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { haptics } from "@/lib/native/haptics";
import { colors, font, fontFamily } from "@/theme";

const ACTION_WIDTH = 96;

/**
 * The byline row of a feed post, with iOS-style swipe actions: swipe right to react with
 * the first emoji, swipe left to challenge (only when the post can be challenged). Only the
 * 72 pt byline swipes, never the photo, so a horizontal drag on the media stays free and the
 * feed still scrolls vertically. The buttons under the post do the same things, so the web,
 * where a mouse drag would fight text selection, simply has no swipe.
 */
export function ProofSwipeRow({
  children,
  reactEmoji,
  onReact,
  onChallenge,
}: {
  children: ReactNode;
  reactEmoji: string;
  onReact: () => void;
  onChallenge?: () => void;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  const run = (action: () => void) => {
    swipeable.current?.close();
    action();
  };

  return (
    <Swipeable
      ref={swipeable}
      enabled={Platform.OS !== "web"}
      friction={2}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableWillOpen={() => haptics.tap()}
      renderLeftActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`React ${reactEmoji}`}
          onPress={() => run(onReact)}
          style={[styles.action, styles.react]}
        >
          <Text style={styles.emoji}>{reactEmoji}</Text>
        </Pressable>
      )}
      renderRightActions={
        onChallenge
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Veto"
                onPress={() => run(onChallenge)}
                style={[styles.action, styles.challenge]}
              >
                <Text style={styles.label}>Veto</Text>
              </Pressable>
            )
          : undefined
      }
      childrenContainerStyle={styles.row}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.background },
  action: { width: ACTION_WIDTH, alignItems: "center", justifyContent: "center" },
  react: { backgroundColor: colors.accent },
  challenge: { backgroundColor: colors.danger },
  emoji: { fontFamily: fontFamily.regular, fontSize: 24 },
  label: { color: colors.onAccent, fontSize: font.body, fontFamily: fontFamily.bold },
});
