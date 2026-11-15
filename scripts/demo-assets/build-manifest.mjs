#!/usr/bin/env node
/**
 * Measures every file listed in assets/demo/manifest.json and writes width, height, bytes and
 * sha256 back into it. Run it after adding or replacing a file:
 *
 *   node scripts/demo-assets/build-manifest.mjs           # measure and rewrite the manifest
 *   node scripts/demo-assets/build-manifest.mjs --check   # fail if the manifest is out of date
 *
 * It refuses a manifest that would mislead its readers: a listed file that is missing, a file
 * in assets/demo that is not listed, a photo larger than the app can show, or a proof without
 * the slot, task and referee reason the seed and the slides rely on.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DEMO_DIR, MANIFEST_PATH, MAX_LONG_SIDE, jpegSize, readManifest, sha256Hex } from "./lib.mjs";

const SLOTS = ["body", "mind", "recharge", "chores", "people", "flex"];
const KINDS = ["avatar", "proof", "gesture", "group", "wrong", "sample"];
/** A photo this heavy was encoded with the wrong settings; see encode.sh. */
const MAX_PHOTO_BYTES = 400 * 1024;

const check = process.argv.includes("--check");
const manifest = readManifest();
const problems = [];

const measured = manifest.files.map((entry) => {
  const label = entry.file ?? "(entry without a file)";
  let bytes;
  try {
    bytes = readFileSync(path.join(DEMO_DIR, entry.file));
  } catch {
    problems.push(`${label}: listed but not on disk`);
    return entry;
  }
  if (!KINDS.includes(entry.kind)) problems.push(`${label}: kind must be one of ${KINDS.join(", ")}`);
  if (!entry.key) problems.push(`${label}: needs a key`);
  if (entry.kind === "avatar") {
    if (!entry.player) problems.push(`${label}: an avatar names its player`);
  } else {
    if (!SLOTS.includes(entry.slot)) problems.push(`${label}: slot must be one of ${SLOTS.join(", ")}`);
    if (!entry.taskTitle || !entry.reason) problems.push(`${label}: needs taskTitle and reason`);
    if (typeof entry.pass !== "boolean") problems.push(`${label}: pass must be true or false`);
  }

  const size = entry.file.endsWith(".jpg") ? jpegSize(bytes) : {};
  if (size.width && Math.max(size.width, size.height) > MAX_LONG_SIDE) {
    problems.push(`${label}: ${size.width}x${size.height} is over ${MAX_LONG_SIDE} px, re-encode it with encode.sh`);
  }
  if (bytes.length > MAX_PHOTO_BYTES) problems.push(`${label}: ${bytes.length} bytes is over ${MAX_PHOTO_BYTES}`);
  // Measured fields go last, so the hand-written ones read first.
  const { width, height, bytes: _bytes, sha256, ...described } = entry;
  return { ...described, ...size, bytes: bytes.length, sha256: sha256Hex(bytes) };
});

const listed = new Set(manifest.files.map((entry) => entry.file));
for (const name of readdirSync(DEMO_DIR, { recursive: true })) {
  const file = name.split(path.sep).join("/");
  if (/\.(jpg|mp4)$/.test(file) && !listed.has(file)) problems.push(`${file}: on disk but not in the manifest`);
}
const seededKeys = measured.filter((entry) => entry.seeded).map((entry) => entry.key);
for (const key of new Set(seededKeys.filter((key, index) => seededKeys.indexOf(key) !== index))) {
  problems.push(`${key}: two seeded files share this key`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const next = JSON.stringify({ ...manifest, files: measured }, null, 2) + "\n";
if (check) {
  if (next !== readFileSync(MANIFEST_PATH, "utf8")) {
    console.error("assets/demo/manifest.json is out of date: run node scripts/demo-assets/build-manifest.mjs");
    process.exit(1);
  }
  console.log(`manifest is current: ${measured.length} files`);
} else {
  writeFileSync(MANIFEST_PATH, next);
  const total = measured.reduce((sum, entry) => sum + entry.bytes, 0);
  console.log(`wrote ${measured.length} files, ${(total / 1024 / 1024).toFixed(1)} MB in all`);
}
