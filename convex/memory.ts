// The single place that talks to Supermemory. Everything else in the backend
// calls these helpers (or the internal actions below) so the SDK, the API key
// and the failure policy live in one file.
//
// The namespace is the user's id, so one player's history can never leak into
// another player's draft.
//
// Memory is a nice-to-have: a draft must never fail or stall because
// Supermemory is slow, down, or unconfigured, so reads degrade to [] and
// writes are best-effort.
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Supermemory } from "supermemory";

// Built per call, not at module load: Convex evaluates modules at deploy time,
// when the env var is not guaranteed to exist.
function client(): Supermemory | null {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  return apiKey ? new Supermemory({ apiKey }) : null;
}

export async function searchMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<string[]> {
  try {
    const sm = client();
    if (!sm) return [];
    // Hard 4s cap, no retries: a slow memory lookup must not hold up a pick.
    const res = await sm.search(
      userId,
      { query, limit },
      { timeoutInSeconds: 4, maxRetries: 0 },
    );
    return res.results.map((r) => r.chunk).filter((c): c is string => !!c);
  } catch (err) {
    console.warn("memory search failed:", err instanceof Error ? err.message : "unknown error");
    return [];
  }
}

export async function addMemory(
  userId: string,
  content: string,
  metadata?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    const sm = client();
    if (!sm) return;
    // "instant" indexes in a few seconds instead of waiting for background
    // consolidation, so a memory written after one draft helps the next.
    await sm.add(userId, { content, metadata, dreaming: "instant" }, { timeoutInSeconds: 10, maxRetries: 1 });
  } catch (err) {
    console.warn("memory add failed:", err instanceof Error ? err.message : "unknown error");
  }
}

// Thin wrappers so other modules can use memory via ctx.runAction without
// importing the SDK.
export const search = internalAction({
  args: { userId: v.string(), query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.string()),
  handler: async (_ctx, { userId, query, limit }) => searchMemories(userId, query, limit),
});

export const add = internalAction({
  args: { userId: v.string(), content: v.string() },
  returns: v.null(),
  handler: async (_ctx, { userId, content }) => {
    await addMemory(userId, content);
    return null;
  },
});
