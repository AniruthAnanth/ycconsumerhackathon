import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReduceMotion } from "@/components/motion";
import { Icon } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { formatCountdown } from "@/lib/leagueText";
import { colors, font, fontFamily, hairline, money, SCREEN_MARGIN, spacing } from "@/theme";

import { usePayBuyIn } from "./usePayBuyIn";

/** The strip flashes once every few seconds, enough to keep catching the eye without strobing. */
const FLASH_EVERY_MS = 4_000;
const FLASH_MS = 450;
const MINUTE = 60_000;

/**
 * A sticky strip under the tabs' header while the player owes the selected league's buy-in. The
 * owner wants it to nag: gold tint, a flash every few seconds and the time left in the week, with
 * no dismiss. It sits beside the header's pay button and leaves when Whop's webhook marks it paid.
 */
export function PayBanner() {
  const { membership, league } = useCurrentLeague();
  if (!membership || membership.stakeUsd <= 0 || membership.paid) return null;
  return (
    <PayStrip
      key={membership._id}
      leagueId={membership._id}
      stakeUsd={membership.stakeUsd}
      weekEndsAt={league?._id === membership._id ? league.week.endsAt : undefined}
    />
  );
}

function PayStrip({ leagueId, stakeUsd, weekEndsAt }: { leagueId: Id<"leagues">; stakeUsd: number; weekEndsAt?: number }) {
  const { pay, opening } = usePayBuyIn(leagueId);
  const reduceMotion = useReduceMotion();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);

  const flash = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    flash.value = withRepeat(
      withDelay(FLASH_EVERY_MS, withSequence(withTiming(1, { duration: FLASH_MS }), withTiming(0, { duration: FLASH_MS }))),
      -1,
    );
    return () => cancelAnimation(flash);
  }, [flash, reduceMotion]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.5 }));

  const left = weekEndsAt !== undefined && weekEndsAt > now ? weekEndsAt - now : undefined;
  const title = `Pay your $${stakeUsd} buy-in to lock your spot`;
  const subtitle = opening ? "Opening checkout..." : left !== undefined ? `Week ends in ${formatCountdown(left)}` : undefined;
  return (
    <Pressable
      onPress={opening ? undefined : pay}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      testID="pay-banner"
      style={styles.strip}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      <Icon name="card-outline" size={20} color={money.text} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={18} color={money.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    backgroundColor: money.tint,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
    overflow: "hidden",
  },
  flash: { backgroundColor: money.coin },
  text: { flex: 1, gap: 1 },
  title: { fontSize: font.body, fontFamily: fontFamily.bold, color: colors.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: font.meta, color: money.text },
});
