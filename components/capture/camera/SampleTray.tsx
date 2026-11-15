import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

import { SAMPLE_MEDIA, type SampleMedia } from "../samples";

type Props = { disabled: boolean; onPick: (sample: SampleMedia) => void; bottomInset: number };

/** Bundled stand-ins for the camera on devices that have none. */
export function SampleTray({ disabled, onPick, bottomInset }: Props) {
  return (
    <View style={[styles.tray, { paddingBottom: bottomInset + spacing.md }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {SAMPLE_MEDIA.map((sample) => (
          <Pressable key={sample.key} disabled={disabled} onPress={() => onPick(sample)} style={styles.item}>
            {sample.mediaType === "photo" ? (
              <Image source={sample.source} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.videoThumb]}>
                <Text style={styles.videoMark}>VIDEO</Text>
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>
              {sample.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { backgroundColor: "rgba(0,0,0,0.7)", paddingTop: spacing.md },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  item: { width: 72, gap: spacing.xs },
  thumb: { width: 72, height: 72, backgroundColor: colors.text },
  videoThumb: { alignItems: "center", justifyContent: "center" },
  videoMark: { color: colors.background, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  label: { color: colors.background, fontSize: 11, textAlign: "center" },
});
