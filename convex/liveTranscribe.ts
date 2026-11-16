/**
 * Live transcription for Voice Draft. The app cuts the recording into short segments and uploads
 * each one: chunk() gives the words shown while the player talks (fast model, best effort), and
 * whole() turns every segment into the full-quality text the draft is made from.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { LIVE_TRANSCRIPTION_MODEL, transcribe } from "./ai";
import { MAX_LIVE_CHUNKS, joinTranscripts } from "./lib/liveTranscript";

async function requireCaller(ctx: ActionCtx) {
  await ctx.runQuery(internal.lineup.callerId, {});
}

/** One segment's words, or "" when it can't be read: the live text is a preview, never an error. */
export const chunk = action({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { storageId }) => {
    await requireCaller(ctx);
    const audio = await ctx.storage.get(storageId);
    if (audio === null) return "";
    return await transcribe(audio, LIVE_TRANSCRIPTION_MODEL).catch((error) => {
      console.warn("live transcribe failed:", error instanceof Error ? error.message : error);
      return "";
    });
  },
});

/**
 * One live clip sent as WAV bytes rather than through storage: a phone streaming its microphone
 * sends a clip a second, and skipping the upload round trip is what makes the words keep up.
 */
export const chunkWav = action({
  args: { wav: v.bytes() },
  returns: v.string(),
  handler: async (ctx, { wav }) => {
    await requireCaller(ctx);
    // A second of 16 kHz mono is 32 KB; anything far past that isn't a live clip.
    if (wav.byteLength > 256_000) return "";
    return await transcribe(new Blob([wav], { type: "audio/wav" }), LIVE_TRANSCRIPTION_MODEL).catch((error) => {
      console.warn("live transcribe failed:", error instanceof Error ? error.message : error);
      return "";
    });
  },
});

/** Every segment in recording order, transcribed at full quality and joined into one text. */
export const whole = action({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.string(),
  handler: async (ctx, { storageIds }) => {
    await requireCaller(ctx);
    if (storageIds.length > MAX_LIVE_CHUNKS) {
      throw new ConvexError("That recording is too long. Keep it under a minute.");
    }
    const parts = await Promise.all(
      storageIds.map(async (storageId) => {
        const audio = await ctx.storage.get(storageId);
        return audio === null ? "" : await transcribe(audio);
      }),
    ).catch((error) => {
      console.error("transcribe failed:", error instanceof Error ? error.message : error);
      throw new ConvexError("Couldn't make out that recording. Try again.");
    });
    return joinTranscripts(parts);
  },
});
