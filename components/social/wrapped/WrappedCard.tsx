import { Pressable, StyleSheet, Text, View } from "react-native";

import { Sunny } from "@/components/art";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

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
  height,
  topInset,
  onTap,
}: {
  card: WrappedCardData;
  /** A horizontal list sizes its items to their content, so a full-screen card is told both dimensions. */
  width: number;
  height: number;
  topInset: number;
  onTap: (tapX: number) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${KIND_LABEL[card.kind]}: ${card.title}`}
      // pageX, not locationX: a card spans the screen, so they agree, and pageX also exists for a mouse click.
      onPress={(event) => onTap(event.nativeEvent.pageX)}
      style={[styles.card, { width, height, backgroundColor: KIND_BACKGROUND[card.kind] }]}
    >
      {card.mediaUrl ? (
        <>
          <ProofMedia uri={card.mediaUrl} mediaType={card.mediaType ?? "photo"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
        </>
      ) : null}
      <View style={[styles.content, { paddingTop: topInset + spacing.xxl + spacing.lg }]} pointerEvents="none">
        {card.kind === "your_week" ? <View style={styles.sunny}><Sunny size={88} /></View> : null}
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
  card: { justifyContent: "center" },
  scrim: { backgroundColor: "rgba(0,0,0,0.5)" },
  content: { paddingHorizontal: SCREEN_MARGIN, paddingBottom: spacing.xxl + spacing.lg },
  sunny: { marginBottom: spacing.md },
  label: { color: WHITE, fontSize: font.meta, fontFamily: fontFamily.bold, letterSpacing: 1.2, opacity: 0.85 },
  stat: { color: WHITE, fontSize: 72, lineHeight: 84, fontFamily: fontFamily.extraBold, marginTop: spacing.md },
  title: { color: WHITE, fontSize: 28, lineHeight: 34, fontFamily: fontFamily.extraBold, marginTop: spacing.md },
  subtitle: { color: WHITE, fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 24, marginTop: spacing.sm, opacity: 0.9 },
});
