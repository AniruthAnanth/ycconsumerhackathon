import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent } from "react-native";

import { Button, OutlinedPillButton } from "@/components/ui";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

import { formatElapsed } from "../proofKinds";
import type { TimelapseReview as Review } from "./useProofCapture";

type Props = { review: Review; busy: boolean; bottomInset: number; onSubmit: () => void; onRetake: () => void };

/** Which frame a finger at `x` along a strip of `width` points at. */
export function frameAt(x: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
}

/** The stills a timelapse will send, to scrub through before choosing Submit or Retake. */
export function TimelapseReview({ review, busy, bottomInset, onSubmit, onRetake }: Props) {
  const [index, setIndex] = useState(review.frames.length - 1);
  const [stripWidth, setStripWidth] = useState(0);
  const scrub = (event: GestureResponderEvent) => setIndex(frameAt(event.nativeEvent.locationX, stripWidth, review.frames.length));

  return (
    <View style={styles.screen} testID="timelapse-review">
      <Image source={{ uri: review.frames[index].uri }} style={styles.frame} contentFit="cover" />
      <View style={[styles.panel, { paddingBottom: bottomInset + spacing.lg }]}>
        <Text style={styles.meta}>
          {formatElapsed(review.durationMs)} · frame {index + 1} of {review.frames.length}
        </Text>
        {/* Drag along the strip to scrub through the frames. */}
        <View
          style={styles.strip}
          onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={scrub}
          onResponderMove={scrub}
          testID="timelapse-filmstrip"
        >
          {review.frames.map((frame, i) => (
            <Image
              key={`${frame.at}-${i}`}
              source={{ uri: frame.uri }}
              style={[styles.thumb, i === index && styles.thumbActive]}
              contentFit="cover"
              pointerEvents="none"
            />
          ))}
        </View>
        <Button label="Submit" onPress={onSubmit} loading={busy} />
        <OutlinedPillButton label="Retake" onPress={onRetake} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.text },
  frame: { flex: 1 },
  panel: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.lg, gap: spacing.md, backgroundColor: colors.text },
  meta: { color: colors.onAccent, fontFamily: fontFamily.semiBold, fontSize: font.body, textAlign: "center" },
  strip: { flexDirection: "row", height: 56, gap: 2 },
  thumb: { flex: 1, height: 56, opacity: 0.5 },
  thumbActive: { opacity: 1, borderWidth: 2, borderColor: colors.onAccent },
});
