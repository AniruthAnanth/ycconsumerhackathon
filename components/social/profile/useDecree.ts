import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";

import { socialApi } from "../contract";

/**
 * The profile's decree: the cached proclamation when it still matches the stats, otherwise one
 * generate call per stats hash (so a re-render never asks the model twice), plus Reroll.
 */
export function useDecree(userId: Id<"users">) {
  const data = useQuery(socialApi.decree.get, { userId });
  const generate = useAction(socialApi.decree.generate);
  const requested = useRef<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.decree || requested.current === data.statsHash) return;
    requested.current = data.statsHash;
    setWriting(true);
    setError(null);
    generate({ userId })
      .catch((failure: unknown) => setError(errorMessage(failure)))
      .finally(() => setWriting(false));
  }, [data, generate, userId]);

  async function reroll() {
    setWriting(true);
    setError(null);
    try {
      await generate({ userId, reroll: true });
      haptics.success();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setWriting(false);
    }
  }

  return { data, writing, error, reroll };
}
