"use node";

import decodeHeic from "heic-decode";
import { encode as encodeJpeg } from "jpeg-js";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { sniffMediaType } from "./lib/mediaType";
import type { SniffedMediaType } from "./lib/mediaType";

const MAX_BYTES = 25 * 1024 * 1024;
const JPEG_QUALITY = 85;

const CONTENT_TYPES: Record<
  Exclude<SniffedMediaType, "heic" | "unknown">,
  string
> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  video: "video/mp4",
};

type IngestResult =
  | { ok: true; storageId: Id<"_storage">; mediaType: "photo" | "video" }
  | { ok: false; reason: "too_large" | "unsupported" | "download_failed" };

async function download(
  url: string,
  bearer: string | undefined,
): Promise<Uint8Array<ArrayBuffer> | "too_large" | "download_failed"> {
  const headers: Record<string, string> =
    bearer === undefined ? {} : { Authorization: `Bearer ${bearer}` };
  const response = await fetch(url, { headers }).catch(() => null);
  if (response === null || !response.ok) {
    return "download_failed";
  }
  // Refuse before buffering when the server tells us the size up front.
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_BYTES) {
    return "too_large";
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength > MAX_BYTES ? "too_large" : bytes;
}

// The vision model and the feed read JPEG, not HEIC, which is what iPhones send.
async function heicToJpeg(
  heic: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height, data } = await decodeHeic({ buffer: heic });
  return new Uint8Array(encodeJpeg({ width, height, data }, JPEG_QUALITY).data);
}

/**
 * Downloads one texted attachment and stores it in Convex file storage in a
 * form the app and the vision model can read: HEIC becomes JPEG, other photos
 * and videos are stored as sent. The type comes from the bytes, since Keiki's
 * mimeType can be generic or wrong.
 */
export const ingest = internalAction({
  args: {
    url: v.string(),
    mimeType: v.string(),
    bearer: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<IngestResult> => {
    const downloaded = await download(args.url, args.bearer);
    if (typeof downloaded === "string") {
      return { ok: false, reason: downloaded };
    }

    const sniffed = sniffMediaType(downloaded);
    if (sniffed === "unknown") {
      return { ok: false, reason: "unsupported" };
    }

    const isVideo = sniffed === "video";
    const [stored, contentType] =
      sniffed === "heic"
        ? [await heicToJpeg(downloaded), CONTENT_TYPES.jpeg]
        : [downloaded, CONTENT_TYPES[sniffed]];
    const storageId = await ctx.storage.store(
      new Blob([stored], { type: contentType }),
    );
    return { ok: true, storageId, mediaType: isVideo ? "video" : "photo" };
  },
});
