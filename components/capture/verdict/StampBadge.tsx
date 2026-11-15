import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const VERIFIED_GREEN = "#1E9E4A";
const REJECTED_RED = "#D93025";

type Props = { pass: boolean };

/** The referee's stamp: it lands from three times its size and sits slightly crooked, like ink. */
export function StampBadge({ pass }: Props) {
  const scale = useRef(new Animated.Value(3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 140, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const color = pass ? VERIFIED_GREEN : REJECTED_RED;
  return (
    <View style={styles.anchor} pointerEvents="none">
      <Animated.View style={{ opacity, transform: [{ rotate: "-8deg" }, { scale }] }}>
        <View style={[styles.outer, { borderColor: color }]}>
          <View style={[styles.inner, { borderColor: color }]}>
            <Text style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {pass ? "VERIFIED" : "NOT VERIFIED"}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  outer: { borderWidth: 4, padding: 4, backgroundColor: "rgba(255,255,255,0.9)" },
  inner: { borderWidth: 2, paddingHorizontal: 18, paddingVertical: 8 },
  label: { fontSize: 32, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
});
