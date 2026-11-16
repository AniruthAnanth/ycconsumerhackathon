import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ease, PressScale, useReduceMotion } from "@/components/motion";
import { type FeedItem, socialApi } from "@/components/social/contract";
import { useCurrentLeague } from "@/lib/currentLeague";
import { BORDER, colors, duration, layout, radius, SCREEN_MARGIN, spacing, spring, type } from "@/theme";

import { liveToastText, newLeagueEvents } from "./liveEvents";
import { onToast } from "./localToast";

/** One toast in the queue: a leaguemate's proof, which opens it in the feed, or a moment the app raised itself. */
type Toast = { key: string; text: string; proofId?: string };

/** How long a toast stays readable before it leaves: a reading time, not an animation. */
const HOLD_MS = 3_000;
/** Far enough above the top edge that the toast starts out of sight. */
const OFFSCREEN = -layout.control * 3;

/**
 * Says so when a leaguemate's proof verifies while the app is open, and shows the toasts the app
 * raises itself through showToast (components/live/localToast), such as the perfect week. It watches the league's
 * feed (the query the Feed tab already holds, so Convex sends no extra data), diffs each result
 * against the one before, and queues a toast per new item. The first result after mounting or
 * switching league is only the baseline, so opening the app never toasts history.
 */
export function LiveToastHost() {
  const router = useRouter();
  const { me, leagueId } = useCurrentLeague();
  const feed = useQuery(socialApi.feed.list, me && leagueId ? { leagueId } : "skip");
  const previous = useRef<{ leagueId: string | null; items: FeedItem[] | undefined }>({ leagueId: null, items: undefined });
  const [queue, setQueue] = useState<Toast[]>([]);
  const raised = useRef(0);

  useEffect(() => {
    if (feed === undefined) return;
    const before = previous.current.leagueId === leagueId ? previous.current.items : undefined;
    previous.current = { leagueId, items: feed };
    const arrived = newLeagueEvents(before, feed, me?._id);
    if (arrived.length > 0) {
      const toasts = arrived.map((item) => ({ key: item.proofId, text: liveToastText(item), proofId: item.proofId }));
      setQueue((current) => [...current, ...toasts]);
    }
  }, [feed, leagueId, me?._id]);

  useEffect(
    () =>
      onToast((text) => {
        raised.current += 1;
        setQueue((current) => [...current, { key: `raised-${raised.current}`, text }]);
      }),
    [],
  );

  // A league switch drops toasts that belong to the league no longer on screen.
  useEffect(() => setQueue((current) => current.filter((toast) => !toast.proofId)), [leagueId]);

  const current = queue[0];
  if (!current) return null;
  return (
    <LiveToast
      key={current.key}
      text={current.text}
      onDone={() => setQueue((rest) => rest.slice(1))}
      onPress={current.proofId ? () => router.navigate({ pathname: "/feed", params: { proofId: current.proofId } }) : undefined}
    />
  );
}

function LiveToast({ text, onDone, onPress }: { text: string; onDone: () => void; onPress?: () => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(reduceMotion ? 0 : OFFSCREEN);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!reduceMotion) offset.value = withSpring(0, spring.snappy);
    const leave = setTimeout(() => {
      if (!reduceMotion) offset.value = withTiming(OFFSCREEN, { duration: duration.base, easing: ease.standard });
    }, HOLD_MS);
    const finish = setTimeout(() => done.current(), HOLD_MS + (reduceMotion ? 0 : duration.base));
    return () => {
      clearTimeout(leave);
      clearTimeout(finish);
    };
  }, [offset, reduceMotion]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + spacing.sm }, slide]}>
      <PressScale
        style={styles.toast}
        onPress={() => {
          onPress?.();
          done.current();
        }}
        accessibilityRole="button"
        accessibilityLabel={onPress ? `${text}. Opens the feed` : text}
        accessibilityLiveRegion="polite"
        testID="live-toast"
      >
        <Text style={styles.text} numberOfLines={1}>
          {text}
        </Text>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: SCREEN_MARGIN, right: SCREEN_MARGIN, alignItems: "center" },
  toast: {
    minHeight: layout.rowMin,
    maxWidth: "100%",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  text: { ...type.label, color: colors.text },
});
