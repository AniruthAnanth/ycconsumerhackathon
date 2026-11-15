import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import type { Precheck } from "@/lib/onDeviceReferee";
import { colors, font, fontFamily, spacing } from "@/theme";

type Props = {
  /** From useOnDeviceRead. Null until the device has looked. */
  read: Precheck | null;
  /** True while the player has to choose between Retake and Send anyway. */
  asking: boolean;
  onRetake: () => void;
  onSendAnyway: () => void;
};

/**
 * What the phone itself saw in the proof, shown under the photo while the server referee is
 * still working: "On-device: barbell, gym. Sending to the referee...".
 *
 * When the photo plainly shows something else it offers Retake before a server verification
 * is spent. Renders nothing when the device has nothing to say, which is always the case in
 * Expo Go, where the native module doesn't exist.
 */
export function OnDeviceRead({ read, asking, onRetake, onSendAnyway }: Props) {
  if (!read || read.hint === "") return null;
  return (
    <View>
      <Text style={styles.hint}>
        {read.hint}
        {asking ? "" : " Sending to the referee..."}
      </Text>
      {asking ? (
        <View style={styles.actions}>
          <Button label="Retake" onPress={onRetake} />
          <Pressable onPress={onSendAnyway} hitSlop={8} style={styles.sendAnyway} accessibilityRole="button">
            <Text style={styles.sendAnywayLabel}>Send anyway</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.title, lineHeight: 21 },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  sendAnyway: { alignItems: "center", paddingVertical: spacing.md },
  sendAnywayLabel: { color: colors.textMuted, fontSize: font.title, fontFamily: fontFamily.semiBold },
});
