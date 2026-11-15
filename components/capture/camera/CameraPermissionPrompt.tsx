import { Linking, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui";
import { spacing } from "@/theme";

type Props = { canAskAgain: boolean; onRequest: () => void };

export function CameraPermissionPrompt({ canAskAgain, onRequest }: Props) {
  return (
    <View style={styles.center}>
      <Button
        label={canAskAgain ? "Allow camera" : "Open Settings"}
        onPress={canAskAgain ? onRequest : () => Linking.openSettings()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: "stretch", justifyContent: "center", paddingHorizontal: spacing.xl },
});
