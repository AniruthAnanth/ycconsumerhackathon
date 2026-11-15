import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useReduceMotion } from "@/components/motion";
import { EscrowFlow } from "@/components/money/EscrowFlow";
import type { EscrowMember } from "@/lib/escrow";
import { duration } from "@/theme";

const STAKE_USD = 20;
const NAMES = ["You", "Maya", "Dev", "Sam", "Priya", "Leo"];
const POT_USD = STAKE_USD * NAMES.length;

const memberList = (paidCount: number): EscrowMember[] =>
  NAMES.map((name, index) => ({ userId: name, name, paid: index < paidCount }));

/** "Win the pot": six members pay in one after another and the pot counts up to the prize. */
export function PotGraphic({ playing }: { playing: boolean }) {
  const reduceMotion = useReduceMotion();
  const [paidCount, setPaidCount] = useState(NAMES.length);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!playing || reduceMotion) {
      setPaidCount(NAMES.length);
      return;
    }
    setRun((current) => current + 1);
    setPaidCount(0);
    const timers = NAMES.map((_, index) => setTimeout(() => setPaidCount(index + 1), duration.slow * 2 + duration.base * index * 2));
    return () => timers.forEach(clearTimeout);
  }, [playing, reduceMotion]);

  return (
    <View style={styles.root}>
      <EscrowFlow
        key={run}
        compact
        members={memberList(paidCount)}
        stakeUsd={STAKE_USD}
        potUsd={paidCount * STAKE_USD}
        payout={{ label: "Winner takes", amountUsd: POT_USD }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 260, width: "100%", justifyContent: "center" },
});
