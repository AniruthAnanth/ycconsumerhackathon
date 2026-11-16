import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";

import { BackBar } from "@/components/join/BackBar";
import { Button, cardStyle, Screen } from "@/components/ui";
import { colors, layout, MIN_TARGET, radius, spacing, type } from "@/theme";

import { CARDS, type CardKey, exitOf } from "./cards";
import { Opening } from "./Opening";
import { BeatGraphic } from "./graphics/BeatGraphic";
import { DraftGraphic } from "./graphics/DraftGraphic";
import { PotGraphic } from "./graphics/PotGraphic";
import { ProveGraphic } from "./graphics/ProveGraphic";

const GRAPHICS: Record<CardKey, (props: { playing: boolean }) => React.ReactNode> = {
  draft: DraftGraphic,
  prove: ProveGraphic,
  beat: BeatGraphic,
  pot: PotGraphic,
};

/**
 * "How Lineup works": four swipeable cards, each a live picture of one part of the game, before a
 * new player signs up. Profile opens it again as a refresher, and Demo controls replays it with the
 * sign-up after it, so it can be shown on stage without reinstalling.
 */
export function HowItWorksScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const exit = exitOf(source);
  const pager = useRef<ScrollViewInstance>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const last = page === CARDS.length - 1;
  // Every way in plays the opening first: first launch, Replay onboarding, and the Profile or Settings refresher.
  const [opening, setOpening] = useState(true);

  // Coming Back from sign-up lands on the card that was left: the web drops a hidden pager's scroll position.
  const pageRef = useRef(page);
  pageRef.current = page;
  useFocusEffect(
    useCallback(() => {
      if (width > 0) pager.current?.scrollTo({ x: pageRef.current * width, animated: false });
    }, [width]),
  );

  function finish() {
    if (exit === "back") return router.canGoBack() ? router.back() : router.replace("/");
    // Pushed, not replaced: Back on sign-up returns to this card.
    router.push(exit === "replay" ? { pathname: "/onboarding", params: { replay: "1" } } : "/onboarding");
  }

  function goTo(index: number) {
    pager.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  }

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  if (opening) return <Opening onDone={() => setOpening(false)} />;

  return (
    <Screen>
      {/* Back steps to the previous card; on card 1 it only shows when opened from Profile, to return there. */}
      <BackBar
        onBack={page > 0 ? () => goTo(page - 1) : exit === "back" ? finish : undefined}
        right={
          exit === "back" ? undefined : (
            <Pressable
              style={styles.skip}
              onPress={finish}
              testID="how-it-works-skip"
              accessibilityRole="button"
              accessibilityLabel="Skip"
            >
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          )
        }
      />
      <View style={styles.flex} onLayout={(event) => setSize(event.nativeEvent.layout)}>
        {width > 0 ? (
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={settle}
            onScrollEndDrag={settle}
            scrollEventThrottle={16}
          >
            {CARDS.map((card, index) => {
              const Graphic = GRAPHICS[card.key];
              const art = artFrame(width, height);
              return (
                <View key={card.key} style={[styles.page, { width, height }]} accessible={false}>
                  <View style={[styles.card, { height: art.cardHeight }]} testID={`how-it-works-${card.key}`}>
                    {/* Drawn at its own size, then scaled up to fill the card: the picture is the point of each card. */}
                    <View style={{ width: art.drawWidth, height: GRAPHIC_HEIGHT, transform: [{ scale: art.scale }] }}>
                      <Graphic playing={page === index} />
                    </View>
                  </View>
                  <View style={styles.words}>
                    <Text style={styles.title} accessibilityRole="header">
                      {card.title}
                    </Text>
                    <Text style={styles.line}>{card.line}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={`Card ${page + 1} of ${CARDS.length}`}>
          {CARDS.map((card, index) => (
            <View key={card.key} style={[styles.dot, index === page && styles.dotOn]} />
          ))}
        </View>
        <Button
          label={last ? (exit === "back" ? "Done" : "Get started") : "Next"}
          onPress={() => (last ? finish() : goTo(page + 1))}
        />
      </View>
    </Screen>
  );
}

/** The height each graphic draws at, and the narrowest width it is designed to fit. */
const GRAPHIC_HEIGHT = 260;
const GRAPHIC_MIN_WIDTH = 260;

/**
 * The graphic is scaled up to the card's width inside a 16-point inset, no wider than its narrowest
 * design width allows and no taller than about half the page, and the card is exactly the scaled
 * graphic plus that inset, so every page has the same card with no empty band under the picture.
 */
function artFrame(pageWidth: number, pageHeight: number) {
  const innerWidth = pageWidth - 2 * layout.margin - 2 * spacing.lg;
  const scale = Math.max(1, Math.min(innerWidth / GRAPHIC_MIN_WIDTH, (pageHeight * 0.55 - 2 * spacing.lg) / GRAPHIC_HEIGHT));
  return { cardHeight: Math.round(GRAPHIC_HEIGHT * scale + 2 * spacing.lg), scale, drawWidth: innerWidth / scale };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // A 44 x 44 target, right-aligned so the word still sits on the margin edge.
  skip: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: "center", alignItems: "flex-end" },
  skipLabel: { ...type.label, color: colors.accent },
  page: { paddingHorizontal: layout.margin, paddingTop: spacing.lg },
  card: {
    ...cardStyle,
    alignItems: "center",
    justifyContent: "center",
  },
  // The words follow the card directly, at the same distance on every page.
  words: { paddingTop: spacing.xl, gap: spacing.sm, paddingHorizontal: spacing.sm },
  title: { ...type.title, color: colors.text, textAlign: "center" },
  line: { ...type.body, color: colors.textMuted, textAlign: "center" },
  footer: { paddingHorizontal: layout.margin, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.divider },
  dotOn: { width: spacing.xl, backgroundColor: colors.accent },
});
