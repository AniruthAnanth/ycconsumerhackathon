import { type ReactNode, useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useReduceMotion } from "@/components/motion";
import { colors, radius, spacing, spring } from "@/theme";

/** How tall each rolled end is, and how far it overhangs the sheet on each side. */
const ROLL = spacing.xl;
const OVERHANG = spacing.sm;

/**
 * A rolled parchment end: a cylinder lit from above, its shading built from theme colours at
 * partial opacity so the scroll adds no colours of its own.
 */
function Roll({ id, width }: { id: string; width: number }) {
  return (
    <Svg width={width} height={ROLL}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.canvas} stopOpacity={1} />
          <Stop offset="0.35" stopColor={colors.yellow} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.warning} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={ROLL} rx={ROLL / 2} fill={colors.play} />
      <Rect x={0} y={0} width={width} height={ROLL} rx={ROLL / 2} fill={`url(#${id})`} />
      <Rect x={ROLL / 2} y={ROLL * 0.2} width={width - ROLL} height={1} fill={colors.white} fillOpacity={0.6} />
    </Svg>
  );
}

/** The sheet between the rolls: warm paper, darker toward its edges like old parchment. */
function Sheet({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="decreeEdges" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.warning} stopOpacity={0.18} />
          <Stop offset="0.12" stopColor={colors.warning} stopOpacity={0} />
          <Stop offset="0.88" stopColor={colors.warning} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.warning} stopOpacity={0.18} />
        </LinearGradient>
        <LinearGradient id="decreeWarmth" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.warning} stopOpacity={0.12} />
          <Stop offset="0.08" stopColor={colors.yellow} stopOpacity={0.12} />
          <Stop offset="0.92" stopColor={colors.yellow} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.warning} stopOpacity={0.12} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={colors.play} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#decreeWarmth)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#decreeEdges)" />
    </Svg>
  );
}

/**
 * The profile's decree: a parchment scroll that unrolls with the gentle spring when the profile
 * opens and grows with its text as the proclamation arrives. Under Reduce Motion it is simply open.
 */
export function DecreeScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const open = useSharedValue(reduceMotion ? 1 : 0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (contentHeight === 0) return;
    open.value = reduceMotion ? 1 : withSpring(1, spring.gentle);
    height.value = reduceMotion || height.value === 0 ? contentHeight : withSpring(contentHeight, spring.gentle);
  }, [contentHeight, reduceMotion, open, height]);

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value * open.value }));

  const onContentLayout = (event: LayoutChangeEvent) => setContentHeight(Math.ceil(event.nativeEvent.layout.height));
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width));

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? <Roll id="decreeTop" width={width} /> : <View style={styles.rollSpace} />}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {width > 0 && contentHeight > 0 ? <Sheet width={width - OVERHANG * 2} height={contentHeight} /> : null}
        <View style={styles.content} onLayout={onContentLayout}>
          {children}
        </View>
      </Animated.View>
      {width > 0 ? <Roll id="decreeBottom" width={width} /> : <View style={styles.rollSpace} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.lg },
  rollSpace: { height: ROLL },
  sheet: {
    marginHorizontal: OVERHANG,
    marginVertical: -ROLL / 2,
    overflow: "hidden",
    borderRadius: radius.sm / 2,
    zIndex: -1,
  },
  content: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xlm,
    paddingTop: ROLL / 2 + spacing.lg,
    paddingBottom: ROLL / 2 + spacing.lg,
    gap: spacing.lg,
  },
});
