import { useEffect, useState } from "react";

/** The current time, re-rendering the caller every `intervalMs` so a countdown keeps moving. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
