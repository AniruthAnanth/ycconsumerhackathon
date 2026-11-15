import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import type { MyLeague } from "@/lib/backend";
import { stakeLine } from "@/lib/leagueText";
import { colors, font, hairline, spacing } from "@/theme";

type Props = {
  visible: boolean;
  leagues: readonly MyLeague[];
  currentId: Id<"leagues"> | null;
  onPick: (leagueId: Id<"leagues">) => void;
  /** The last row: join or create another league. */
  onJoin: () => void;
  onClose: () => void;
};

/** The list that drops from the header's league name: the player's leagues, then a way into another. */
export function LeagueSwitcher({ visible, leagues, currentId, onPick, onJoin, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim lies behind the list, not around it: a screen reader cannot reach a button nested in another. */}
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close league list" />
      {/* Starts under the header bar, so the list reads as dropping out of the title. */}
      <View style={[styles.list, { marginTop: insets.top + HEADER_HEIGHT }]}>
        {leagues.map((league) => (
          <Pressable
            key={league._id}
            style={styles.row}
            onPress={() => onPick(league._id)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${league.name}, ${stakeLine(league).replace(" | ", ", ")}`}
            accessibilityState={{ selected: league._id === currentId }}
          >
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {league.name}
              </Text>
              <Text style={styles.meta}>{stakeLine(league)}</Text>
            </View>
            {league._id === currentId ? <Icon name="checkmark" color={colors.tabActive} /> : null}
          </Pressable>
        ))}
        <Pressable style={styles.row} onPress={onJoin} accessibilityRole="button" accessibilityLabel="Join or create a league">
          <Icon name="add" color={colors.accent} />
          <Text style={styles.join}>Join or create a league</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Matches the Header primitive's bar. */
const HEADER_HEIGHT = 48;

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  list: { backgroundColor: colors.background },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 1 },
  name: { fontSize: font.title, fontWeight: "700", color: colors.text },
  meta: { fontSize: font.meta, color: colors.textMuted },
  join: { fontSize: font.title, fontWeight: "700", color: colors.accent },
});
