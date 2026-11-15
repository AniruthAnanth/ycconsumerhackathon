import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

import type { WrappedCard as WrappedCardData } from "../contract";
import { ProofMedia } from "../ProofMedia";
import { KIND_BACKGROUND, KIND_LABEL } from "./wrappedLogic";

const WHITE = colors.background;

/**
 * One full-screen story card: proof media under a flat scrim, or a solid colour
 * for its kind. It reports where it was tapped so the viewer can page.
 */
export function WrappedCard({
  card,
  width,
  topInset,
  onTap,
}: {
  card: WrappedCardData;
  width: number;
  topInset: number;
  onTap: (tapX: number) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${KIND_LABEL[card.kind]}: ${card.title}`}
      onPress={(event) => onTap(event.nativeEvent.locationX)}
      style={[styles.card, { width, backgroundColor: KIND_BACKGROUND[card.kind] }]}
    >
      {card.mediaUrl ? (
        <>
          <ProofMedia uri={card.mediaUrl} mediaType={card.mediaType ?? "photo"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
        </>
      ) : null}
      <View style={[styles.content, { paddingTop: topInset + 48 }]} pointerEvents="none">
        <Text style={styles.label}>{KIND_LABEL[card.kind]}</Text>
        <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
          {card.stat}
        </Text>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.subtitle}>{card.subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, justifyContent: "center" },
  scrim: { backgroundColor: "rgba(0,0,0,0.5)" },
  content: { paddingHorizontal: 24, paddingBottom: 48 },
  label: { color: WHITE, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, opacity: 0.85 },
  stat: { color: WHITE, fontSize: 72, lineHeight: 84, fontWeight: "800", marginTop: 12 },
  title: { color: WHITE, fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 12 },
  subtitle: { color: WHITE, fontSize: 17, lineHeight: 24, marginTop: 8, opacity: 0.9 },
});
