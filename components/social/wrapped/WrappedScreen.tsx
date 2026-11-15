import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Header, Screen } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors } from "@/theme";

import { socialApi } from "../contract";
import { ScreenState } from "../ScreenState";
import { WrappedCard } from "./WrappedCard";
import { indexAfterTap, pageIndexFromOffset } from "./wrappedLogic";

const WHITE = colors.background;
const SEGMENT_TRACK = "rgba(255,255,255,0.35)";

/** The weekly Wrapped: five full-screen story cards with progress segments and tap paging. */
export function WrappedScreen() {
  const params = useLocalSearchParams<{ leagueId?: string; weekNumber?: string }>();
  const currentLeague = useCurrentLeague();
  const leagueId = (params.leagueId as Id<"leagues"> | undefined) ?? currentLeague.leagueId;
  const weekNumber = params.weekNumber ? Number(params.weekNumber) : undefined;
  const wrapped = useQuery(
    socialApi.wrapped.get,
    leagueId ? { leagueId, ...(weekNumber === undefined ? {} : { weekNumber }) } : "skip",
  );

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  if (!wrapped || wrapped.cards.length === 0) {
    return (
      <Screen>
        <Header title="Wrapped" onBack={() => router.back()} />
        <ScreenState loading={wrapped === undefined} message="No wrapped yet" />
      </Screen>
    );
  }

  const { cards } = wrapped;
  const goTo = (target: number) => {
    if (target === index) return;
    list.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <FlatList
        ref={list}
        data={cards}
        keyExtractor={(card) => card.kind}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
        onMomentumScrollEnd={(event) =>
          setIndex(pageIndexFromOffset(event.nativeEvent.contentOffset.x, width, cards.length))
        }
        renderItem={({ item }) => (
          <WrappedCard
            card={item}
            width={width}
            height={height}
            topInset={insets.top}
            onTap={(tapX) => goTo(indexAfterTap(tapX, width, index, cards.length))}
          />
        )}
      />
      <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.segments} pointerEvents="none">
          {cards.map((card, position) => (
            <View key={card.kind} style={[styles.segment, position <= index && styles.segmentFilled]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>{"\u2715"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.text },
  top: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center" },
  segments: { flex: 1, flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: SEGMENT_TRACK },
  segmentFilled: { backgroundColor: WHITE },
  close: { color: WHITE, fontSize: 22, paddingLeft: 16 },
});
