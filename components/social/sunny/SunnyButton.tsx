import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, MIN_TARGET } from "@/theme";

import { SunnyAvatar } from "./SunnyAvatar";
import { SUNNY } from "./sunnyLogic";
import { useSunny } from "./useSunny";

/** The header's way into the chat: Sunny's face, with a dot when Sunny has a line the player hasn't opened. */
export function SunnyButton() {
  const router = useRouter();
  const { unread } = useSunny();
  return (
    <Pressable
      onPress={() => router.push("/chat")}
      style={styles.target}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Chat with ${SUNNY.name}, new` : `Chat with ${SUNNY.name}`}
    >
      <View>
        <SunnyAvatar size={32} />
        {unread ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: "flex-end", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
