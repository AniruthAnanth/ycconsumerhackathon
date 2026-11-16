import { StyleSheet, Text, View } from "react-native";

import { StampSlam } from "@/components/motion";
import { fontFamily, status } from "@/theme";

import { STAMP_DELAY_MS } from "./timing";


const VERIFIED_GREEN = status.verified;
const REJECTED_RED = status.danger;

type Props = { pass: boolean; onLand: () => void };

/** The referee's stamp: it slams down with a slight overshoot and sits slightly crooked, like ink. */
export function StampBadge({ pass, onLand }: Props) {
  const color = pass ? VERIFIED_GREEN : REJECTED_RED;
  return (
    <View style={styles.anchor} pointerEvents="none">
      <StampSlam delay={STAMP_DELAY_MS} onLand={onLand}>
        {/* The tilt sits inside the slam, whose animated transform would replace it. */}
        <View style={[styles.outer, { borderColor: color }]}>
          <View style={[styles.inner, { borderColor: color }]}>
            <Text style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {pass ? "VERIFIED" : "NOT VERIFIED"}
            </Text>
          </View>
        </View>
      </StampSlam>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  outer: { borderWidth: 4, padding: 4, backgroundColor: "rgba(255,255,255,0.9)", transform: [{ rotate: "-8deg" }] },
  inner: { borderWidth: 2, paddingHorizontal: 18, paddingVertical: 8 },
  label: { fontSize: 32, fontFamily: fontFamily.extraBold, letterSpacing: 4, textTransform: "uppercase" },
});
