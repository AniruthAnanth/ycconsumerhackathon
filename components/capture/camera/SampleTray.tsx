import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, spacing } from "@/theme";

import { SAMPLE_MEDIA, type SampleMedia } from "../samples";

type Props = {
  disabled: boolean;
  onPick: (sample: SampleMedia) => void;
  bottomInset: number;
  /** A timelapse task leads with the timelapse samples, so the one the hint names is on screen. */
  timelapseFirst?: boolean;
};

/** Bundled stand-ins for the camera on devices that have none. */
export function SampleTray({ disabled, onPick, bottomInset, timelapseFirst = false }: Props) {
  const samples = timelapseFirst ? [...SAMPLE_MEDIA].sort((a, b) => Number(!a.frames) - Number(!b.frames)) : SAMPLE_MEDIA;
  return (
    <View style={[styles.tray, { paddingBottom: bottomInset + spacing.md }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {samples.map((sample) => (
          <Pressable
            key={sample.key}
            disabled={disabled}
            onPress={() => onPick(sample)}
            accessibilityRole="button"
            accessibilityLabel={`Submit sample: ${sample.label}`}
            accessibilityState={{ disabled }}
            style={styles.item}
          >
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
  videoMark: { color: colors.onAccent, fontSize: 12, fontFamily: fontFamily.bold, letterSpacing: 1 },
  label: { color: colors.onAccent, fontFamily: fontFamily.regular, fontSize: 11, textAlign: "center" },
});
