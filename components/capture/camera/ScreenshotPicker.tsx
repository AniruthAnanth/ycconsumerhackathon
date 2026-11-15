import * as ImagePicker from "expo-image-picker";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton } from "@/components/ui";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

type Props = { busy: boolean; onPicked: (uri: string) => void; bottomInset: number };

/** A screenshot task has nothing to point a camera at: the proof is already in the photo library. */
export function ScreenshotPicker({ busy, onPicked, bottomInset }: Props) {
  async function pick() {
    // The library picker needs no permission prompt on iOS 14+ and Android 13+, and works in Expo Go.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset) onPicked(asset.uri);
  }

  return (
    <View style={[styles.container, { paddingBottom: bottomInset + spacing.xl }]} testID="proof-screenshot">
      <Text style={styles.lead}>Open the app that shows it done, take a screenshot, then pick it here.</Text>
      <OutlinedPillButton label="Choose screenshot" icon="image" onPress={() => void pick()} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end", gap: spacing.lg, paddingHorizontal: SCREEN_MARGIN },
  lead: { color: colors.onAccent, fontFamily: fontFamily.regular, fontSize: font.body, textAlign: "center", opacity: 0.85 },
});
