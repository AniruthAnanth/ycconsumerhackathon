import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";

import { Button, Header, Screen } from "@/components/ui";
import { colors, layout, radius, spacing, type } from "@/theme";

import { CARDS, type CardKey, exitOf } from "./cards";
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
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const last = page === CARDS.length - 1;

  function finish() {
    if (exit === "back") return router.canGoBack() ? router.back() : router.replace("/");
    router.replace(exit === "replay" ? { pathname: "/onboarding", params: { replay: "1" } } : "/onboarding");
  }

  function goTo(index: number) {
    pager.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  }

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width > 0) setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <Screen>
      <Header
        title="How Lineup works"
        onBack={exit === "back" ? finish : undefined}
        right={
          exit === "back" ? undefined : (
            <Pressable style={styles.skip} onPress={finish} testID="how-it-works-skip" accessibilityRole="button" accessibilityLabel="Skip">
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          )
        }
      />
      <View style={styles.flex} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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
              return (
                <View key={card.key} style={[styles.page, { width }]} accessible={false}>
                  <View style={styles.card} testID={`how-it-works-${card.key}`}>
                    <Graphic playing={page === index} />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skip: { minHeight: layout.rowMin, justifyContent: "center" },
  skipLabel: { ...type.label, color: colors.accent },
  page: { paddingHorizontal: layout.margin, paddingTop: spacing.xl, gap: spacing.xl },
  card: {
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  words: { gap: spacing.sm },
  title: { ...type.title, color: colors.text },
  line: { ...type.body, color: colors.textMuted },
  footer: { paddingHorizontal: layout.margin, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.divider },
  dotOn: { width: spacing.xl, backgroundColor: colors.accent },
});
