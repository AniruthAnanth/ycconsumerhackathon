import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useReduceMotion } from "@/components/motion";
import { EscrowFlow } from "@/components/money/EscrowFlow";
import type { EscrowMember } from "@/lib/escrow";

const STAKE_USD = 20;
const NAMES = ["You", "Maya", "Dev", "Sam", "Priya", "Leo"];
const POT_USD = STAKE_USD * NAMES.length;
const MEMBERS: EscrowMember[] = NAMES.map((name) => ({ userId: name, name, paid: true }));

/**
 * "Win the pot": six paid members send their buy-ins into the pot, then the line drops to the prize. Everyone is paid from the first frame, so the pot counts up to its total before
 * the payout box appears and never reads $0 beside it.
 */
export function PotGraphic({ playing }: { playing: boolean }) {
  const reduceMotion = useReduceMotion();
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (playing && !reduceMotion) setRun((current) => current + 1);
  }, [playing, reduceMotion]);

  return (
    <View style={styles.root}>
      <EscrowFlow
        key={run}
        compact
        members={MEMBERS}
        stakeUsd={STAKE_USD}
        potUsd={POT_USD}
        payout={{ label: "Winner takes", amountUsd: POT_USD }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center" },
});
