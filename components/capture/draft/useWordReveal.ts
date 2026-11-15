import { useEffect, useMemo, useState } from "react";

import { REVEAL_INTERVAL_MS, revealedText, transcriptWords } from "./transcriptReveal";

/** Types the transcript out word by word while active, then calls onFinished once; shows it whole otherwise. */
export function useWordReveal(transcript: string, active: boolean, onFinished: () => void): string {
  const words = useMemo(() => transcriptWords(transcript), [transcript]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!active) return;
    const timer = setInterval(() => setCount((current) => current + 1), REVEAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, words]);

  useEffect(() => {
    if (active && count >= words.length) onFinished();
  }, [active, count, words, onFinished]);

  return revealedText(words, active ? count : words.length);
}
