import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { capture } from "../backend";
import { bucketsMentioned, CORE_SLOTS, type CoreSlot } from "./bucketMatch";

/** The model pass runs at most this often while the words grow, so a take costs a handful of calls. */
const CLASSIFY_EVERY_MS = 3000;

/**
 * Which of the five buckets the live words have mentioned this take: keyword matches unioned with
 * a throttled model pass. A bucket stays lit once lit, and a new take (active turning on) starts
 * from none.
 */
export function useBucketCoverage(liveText: string, active: boolean): Set<CoreSlot> {
  const classify = useAction(capture.liveBuckets.classify);
  const [lit, setLit] = useState<Set<CoreSlot>>(() => new Set());
  const take = useRef(0);
  const lastSent = useRef({ at: 0, text: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The throttled call sends the words as they are when it fires, not when it was scheduled.
  const latest = useRef(liveText);
  latest.current = liveText;

  const light = (slots: Iterable<CoreSlot>) =>
    setLit((current) => {
      const next = new Set(current);
      for (const slot of slots) if (CORE_SLOTS.includes(slot)) next.add(slot);
      return next.size === current.size ? current : next;
    });

  useEffect(() => {
    if (!active) return;
    take.current += 1;
    lastSent.current = { at: 0, text: "" };
    setLit(new Set());
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    light(bucketsMentioned(liveText));
    if (liveText.trim() === "" || liveText === lastSent.current.text || timer.current) return;
    const send = () => {
      timer.current = null;
      const text = latest.current;
      if (text === lastSent.current.text) return;
      lastSent.current = { at: Date.now(), text };
      const thisTake = take.current;
      classify({ text })
        .then((slots) => thisTake === take.current && light(slots))
        .catch(() => {});
    };
    timer.current = setTimeout(send, Math.max(0, lastSent.current.at + CLASSIFY_EVERY_MS - Date.now()));
  }, [liveText, active, classify]);

  return lit;
}
