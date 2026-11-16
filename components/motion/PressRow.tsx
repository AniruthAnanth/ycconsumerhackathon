import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { haptics, type PressHaptic } from "@/lib/native/haptics";
import { colors } from "@/theme";

type Props = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** The tap felt on press; "none" when onPress fires its own haptic. */
  haptic?: PressHaptic;
};

/** The pressed wash over a row; a row that shares its press with a sibling control draws it itself. */
export function PressHighlight({ visible }: { visible: boolean }) {
  return visible ? <View pointerEvents="none" style={styles.pressed} /> : null;
}

/**
 * A list row's press feedback, the iOS table-cell way: the row darkens under the finger and
 * never scales, so a row's tint, divider and neighbours can't split from it. PressScale is for
 * buttons, chips and standalone cards.
 */
export function PressRow({ style, onPress, haptic = "light", children, ...pressable }: Props) {
  return (
    <Pressable
      {...pressable}
      style={style}
      onPress={
        onPress &&
        ((event) => {
          haptics.press(haptic);
          onPress(event);
        })
      }
    >
      {({ pressed }) => (
        <>
          {children}
          <PressHighlight visible={pressed} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.rowPressed },
});
