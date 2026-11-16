import { StyleSheet, View } from "react-native";

import { doneMoment, spacing } from "@/theme";

import { DoneCheck } from "./DoneCheck";
import { PointsPill } from "./PointsPill";
import { ScoreGhost } from "./ScoreGhost";
import { SparkleBurst } from "./SparkleBurst";

type Props = {
  points: number;
  animate: boolean;
  /** The sparkles' colour: the slot's own tint. */
  color: string;
  /** The perfect week landed with this task: a bigger burst. */
  perfect?: boolean;
};

/** Where a done task shows its points everywhere it is listed: the check, then the +points pill with its burst and ghost. */
export function DonePoints({ points, animate, color, perfect = false }: Props) {
  return (
    <View style={styles.row}>
      <DoneCheck animate={animate} />
      <View>
        <SparkleBurst
          animate={animate}
          color={color}
          delay={doneMoment.pillDelayMs}
          count={perfect ? doneMoment.perfectSparkles : doneMoment.sparkles}
          distance={perfect ? doneMoment.perfectSparkleDistance : doneMoment.sparkleDistance}
        />
        <PointsPill points={points} animate={animate} />
        <ScoreGhost points={points} animate={animate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 0 },
});
