import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Score } from "@/components/ui";
import { colors, font, fontFamily, spacing } from "@/theme";

import type { MatchupSide } from "../contract";

export function TeamHeaders({ me, opponent }: { me: MatchupSide; opponent: MatchupSide }) {
  return (
    <View style={styles.row}>
      <TeamHeader side={me} align="flex-start" />
      <TeamHeader side={opponent} align="flex-end" />
    </View>
  );
}

function TeamHeader({ side, align }: { side: MatchupSide; align: "flex-start" | "flex-end" }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${side.name}'s profile`}
      onPress={() => router.push(`/profile/${side.userId}`)}
      style={[styles.team, { alignItems: align }]}
    >
      <Avatar name={side.name} size={44} />
      <Text style={styles.name} numberOfLines={1}>
        {side.name}
      </Text>
      <Score value={side.total} size="total" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  team: { flex: 1, gap: spacing.xs },
  name: { color: colors.text, fontSize: font.title, fontFamily: fontFamily.bold, maxWidth: "100%" },
});
