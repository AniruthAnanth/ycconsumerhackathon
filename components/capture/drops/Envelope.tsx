import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

const WIDTH = 44;
const HEIGHT = 30;
const FLAP = HEIGHT * 0.62;
const SEAL = 8;

/** A sealed envelope drawn from Views: white body, blue flap, dark seal. */
export function Envelope() {
  return (
    <View style={styles.body}>
      <View style={styles.flap} />
      <View style={styles.seal} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: 3,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  flap: {
    width: 0,
    height: 0,
    borderLeftWidth: WIDTH / 2,
    borderRightWidth: WIDTH / 2,
    borderTopWidth: FLAP,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.accent,
  },
  seal: {
    position: "absolute",
    top: FLAP - SEAL / 2,
    left: (WIDTH - SEAL) / 2,
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    backgroundColor: colors.text,
  },
});
