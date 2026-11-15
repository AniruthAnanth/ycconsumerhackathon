/**
 * Shared by the demo-asset scripts: where the media lives and how the manifest is read.
 *
 * assets/demo/manifest.json is the one list of demo media. People write the describing fields
 * (what the picture is for and what a referee would say about it); build-manifest.mjs measures
 * the rest from the files, so a hash or a size in the manifest is never typed by hand.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DEMO_DIR = path.join(REPO_ROOT, "assets/demo");
export const MANIFEST_PATH = path.join(DEMO_DIR, "manifest.json");

/** Photos are shown at most one phone screen wide (393 pt at 3x is 1179 px), so more is wasted bytes. */
export const MAX_LONG_SIDE = 1200;

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Width and height from a JPEG's start-of-frame segment. Reading the header by hand keeps these
 * scripts free of an image library, which the app itself has no use for.
 */
export function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a JPEG");
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("broken JPEG segment");
    const marker = bytes[offset + 1];
    // C0 to CF are start-of-frame markers, except C4, C8 and CC, which are tables.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error("JPEG has no frame header");
}
