import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui";
import { layout, MIN_TARGET } from "@/theme";

type Props = {
  /** Shows the back chevron; without it the chevron's space stays empty so nothing shifts. */
  onBack?: () => void;
  /** The top right action, such as Skip. */
  right?: ReactNode;
};

/**
 * The top bar of the way in (intro, sign-up, Join), as on iOS onboarding: no title and no hairline,
 * only a back chevron on the left and an optional action on the right, each a 44-pt target.
 */
export function BackBar({ onBack, right }: Props) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.action} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-back" size={24} />
        </Pressable>
      ) : (
        <View style={styles.action} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: layout.bar, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.margin },
  action: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: "center" },
});
