import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

const BAND_HEIGHT = 48;

type Props = { title: string };

/** A scan line sweeping the proof while the referee looks at it. */
export function ReviewingOverlay({ title }: Props) {
  const [height, setHeight] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-BAND_HEIGHT, height] });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={[styles.band, { transform: [{ translateY }] }]}>
        <View style={styles.line} />
      </Animated.View>
      <View style={styles.caption}>
        <Text style={styles.label}>REFEREE REVIEWING</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BAND_HEIGHT,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,105,255,0.16)",
  },
  line: { height: 2, backgroundColor: colors.accent },
  caption: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  label: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", letterSpacing: 1.6 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginTop: spacing.xs },
});
