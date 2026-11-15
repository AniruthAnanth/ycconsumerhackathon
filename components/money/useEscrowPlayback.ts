import { useEffect, useRef, useState } from "react";
import { Easing, type SharedValue, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import type { EscrowMember } from "@/lib/escrow";
import { ESCROW_DROP_MS, ESCROW_PULSE_MS, ESCROW_SETTLE_MS } from "@/lib/native/motion";

import { escrowTimeline } from "./escrowTimeline";

/** One run of a member's dollars. A new token replays the lane; the same token never does. */
export type LanePlay = { token: number; delayMs: number };

type Args = {
  members: EscrowMember[];
  stakeUsd: number;
  potUsd: number;
  /** False until the diagram has been measured: nothing can fly before the curves exist. */
  ready: boolean;
  reduceMotion: boolean;
};

type Playback = {
  /** Keyed by userId: the lanes that have been told to play. */
  plays: Record<string, LanePlay>;
  /** What the pot reads right now: behind potUsd while money is in the air. */
  arrivedUsd: number;
  /** 0 at rest, 1 at the top of the pot's swell as money lands. */
  pulse: SharedValue<number>;
  /** 0 to 1: the line draws down from the pot, then the payout box settles in. */
  settle: SharedValue<number>;
};

/**
 * Decides what the escrow diagram plays and when. The first pass plays every paid member once;
 * after that only a member who has just paid plays, and an ordinary re-render plays nothing,
 * because the hook remembers whose payment it has already shown.
 */
export function useEscrowPlayback({ members, stakeUsd, potUsd, ready, reduceMotion }: Args): Playback {
  // A string, so the effect below runs when who has paid changes and not on every new array.
  const paidKey = members.filter((member) => member.paid).map((member) => member.userId).join("\n");
  const [plays, setPlays] = useState<Record<string, LanePlay>>({});
  const [arrivedUsd, setArrivedUsd] = useState(paidKey === "" ? potUsd : 0);
  const pulse = useSharedValue(0);
  const settle = useSharedValue(0);

  /** Members whose payment has been shown; null until the first pass. */
  const shown = useRef<Set<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Members whose money is still in the air. */
  const inFlight = useRef(0);
  const arrived = useRef(arrivedUsd);
  /** The newest total, for a landing that was scheduled before the pot last moved. */
  const target = useRef(potUsd);

  useEffect(() => {
    const scheduled = timers.current;
    return () => {
      scheduled.forEach(clearTimeout);
      scheduled.length = 0;
      inFlight.current = 0;
      // A remount (and React's development double-run of effects) starts from the first pass again.
      shown.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const show = (usd: number) => {
      arrived.current = usd;
      setArrivedUsd(usd);
    };
    const swell = () => {
      pulse.value = withSequence(
        withTiming(1, { duration: ESCROW_PULSE_MS * 0.35, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: ESCROW_PULSE_MS * 0.65, easing: Easing.out(Easing.quad) }),
      );
    };

    const paid = paidKey === "" ? [] : paidKey.split("\n");
    const firstPass = shown.current === null;
    const fresh = paid.filter((userId) => !shown.current?.has(userId));
    shown.current = new Set(paid);
    target.current = potUsd;

    if (reduceMotion) {
      timers.current.forEach(clearTimeout);
      timers.current.length = 0;
      inFlight.current = 0;
      pulse.value = 0;
      settle.value = 1;
      show(potUsd);
      return;
    }

    const timeline = escrowTimeline(fresh.length);
    if (firstPass) {
      settle.value = withDelay(
        timeline.settleAt,
        withTiming(1, { duration: ESCROW_DROP_MS + ESCROW_SETTLE_MS, easing: Easing.linear }),
      );
    }

    if (fresh.length === 0) {
      // Nobody new paid. If the pot moved anyway, CountUp ticks to it; money in the air lands on the new total itself.
      if (inFlight.current === 0 && arrived.current !== potUsd) {
        if (potUsd > arrived.current) swell();
        show(potUsd);
      }
      return;
    }

    setPlays((current) => {
      const next = { ...current };
      fresh.forEach((userId, index) => {
        next[userId] = { token: (current[userId]?.token ?? 0) + 1, delayMs: timeline.starts[index]! };
      });
      return next;
    });
    inFlight.current += fresh.length;
    for (const landsAt of timeline.landings) {
      timers.current.push(
        setTimeout(() => {
          inFlight.current -= 1;
          // Each landing adds one stake; the last one lands on the real total, whatever it is.
          show(inFlight.current === 0 ? target.current : Math.min(target.current, arrived.current + stakeUsd));
          swell();
        }, landsAt),
      );
    }
  }, [ready, reduceMotion, paidKey, potUsd, stakeUsd, pulse, settle]);

  return { plays, arrivedUsd, pulse, settle };
}
