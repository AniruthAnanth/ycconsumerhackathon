import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, hairline, tabUnderlineHeight } from "@/theme";

type Props<Key extends string> = {
  tabs: readonly { key: Key; label: string }[];
  active: Key;
  onChange: (key: Key) => void;
};

/** The ROSTER / MATCHUP / FEED / LEAGUE strip under the header; a green underline marks the active tab. */
export function TopTabs<Key extends string>({ tabs, active, onChange }: Props<Key>) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label.toUpperCase()}</Text>
            <View style={[styles.underline, selected && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 40,
    flexDirection: "row",
    backgroundColor: colors.background,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: font.meta, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  labelActive: { color: colors.text },
  underline: { position: "absolute", left: 0, right: 0, bottom: 0, height: tabUnderlineHeight, backgroundColor: "transparent" },
  underlineActive: { backgroundColor: colors.tabActive },
});
