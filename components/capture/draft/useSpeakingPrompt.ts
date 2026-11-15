import { useEffect, useState } from "react";

import { promptAt, PROMPT_ROTATE_MS } from "./speakingPrompts";

/** The example to show above the microphone. It moves on only while `rotating`, so it holds still once the player starts talking. */
export function useSpeakingPrompt(rotating: boolean): string {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => setTurn((current) => current + 1), PROMPT_ROTATE_MS);
    return () => clearInterval(timer);
  }, [rotating]);

  return promptAt(turn);
}
