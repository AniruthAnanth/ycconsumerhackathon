import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui";
import { colors, spacing } from "@/theme";

import type { ProofTarget } from "../proofRoute";

type Props = { target: ProofTarget; onClose: () => void };

/** The task, its stakes and the required gesture, drawn over the live preview. */
export function CameraOverlay({ target, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close camera">
          <Icon name="close" size={28} color={colors.background} />
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {target.title}
          </Text>
          {target.place ? (
            <Text style={styles.place} numberOfLines={1}>
              @ {target.place.name}
            </Text>
          ) : null}
        </View>
        <Text style={styles.points}>{target.points} PTS</Text>
      </View>
      {target.gesture ? (
        <View style={styles.gesture}>
          <Text style={styles.gestureText}>{target.gesture.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titles: { flex: 1 },
  title: { color: colors.background, fontSize: 17, fontWeight: "700" },
  place: { color: colors.background, fontSize: 13, opacity: 0.85 },
  points: { color: colors.background, fontSize: 15, fontWeight: "700" },
  gesture: { backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: spacing.md, alignItems: "center" },
  gestureText: { color: colors.background, fontSize: 28, fontWeight: "900", letterSpacing: 1 },
});
