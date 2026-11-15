import { describe, expect, it } from "vitest";
import { MAX_CLIP_SECONDS, clipSeconds, isClipTooLong } from "./clip";

/** Builds one container box: 4-byte size, 4-byte type, then the content. */
function box(type: string, ...content: Uint8Array[]): Uint8Array {
  const size = 8 + content.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, size);
  bytes.set([...type].map((c) => c.charCodeAt(0)), 4);
  let offset = 8;
  for (const part of content) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/** A movie header as phones write it: version 0, with 32-bit times. */
function movieHeader(timescale: number, duration: number): Uint8Array {
  const content = new Uint8Array(100);
  const view = new DataView(content.buffer);
  view.setUint32(12, timescale);
  view.setUint32(16, duration);
  return box("mvhd", content);
}

/** The version 1 header, with 64-bit times. */
function longMovieHeader(timescale: number, duration: number): Uint8Array {
  const content = new Uint8Array(112);
  const view = new DataView(content.buffer);
  content[0] = 1;
  view.setUint32(20, timescale);
  view.setBigUint64(24, BigInt(duration));
  return box("mvhd", content);
}

const join = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};

const fileType = box("ftyp", new Uint8Array(16));
const videoData = box("mdat", new Uint8Array(64));

describe("clipSeconds", () => {
  it("reads the length from the movie header", () => {
    const file = join(fileType, box("moov", movieHeader(600, 2400), box("trak", new Uint8Array(32))), videoData);
    expect(clipSeconds(file)).toBe(4);
  });

  it("finds the movie box when the phone wrote it after the video data", () => {
    const file = join(fileType, box("wide"), videoData, box("moov", movieHeader(1000, 9500)));
    expect(clipSeconds(file)).toBe(9.5);
  });

  it("reads a version 1 header", () => {
    const file = join(fileType, box("moov", longMovieHeader(90_000, 1_080_000)));
    expect(clipSeconds(file)).toBe(12);
  });

  it("skips a box whose size is written as 64 bits", () => {
    const large = new Uint8Array(16 + 40);
    const view = new DataView(large.buffer);
    view.setUint32(0, 1);
    large.set([..."mdat"].map((c) => c.charCodeAt(0)), 4);
    view.setBigUint64(8, BigInt(large.length));
    expect(clipSeconds(join(fileType, large, box("moov", movieHeader(600, 3000))))).toBe(5);
  });

  it("reads a file that is a view into a larger buffer", () => {
    const file = join(fileType, box("moov", movieHeader(600, 1800)));
    const padded = join(new Uint8Array(7), file);
    expect(clipSeconds(padded.subarray(7))).toBe(3);
  });

  it("answers null for anything it can't read", () => {
    expect(clipSeconds(new Uint8Array(0))).toBeNull();
    expect(clipSeconds(new TextEncoder().encode("this is not a video file at all"))).toBeNull();
    expect(clipSeconds(join(fileType, videoData))).toBeNull(); // no movie box
    expect(clipSeconds(join(fileType, box("moov", box("trak", new Uint8Array(8)))))).toBeNull(); // no header
    expect(clipSeconds(join(fileType, box("moov", movieHeader(0, 100))))).toBeNull(); // no timescale
    expect(clipSeconds(join(fileType, box("moov", movieHeader(600, 1200))).subarray(0, 40))).toBeNull(); // cut short
  });
});

describe("isClipTooLong", () => {
  it("accepts clips up to 10 seconds, with a little slack for the recorder", () => {
    expect(MAX_CLIP_SECONDS).toBe(10);
    expect(isClipTooLong(4)).toBe(false);
    expect(isClipTooLong(10)).toBe(false);
    expect(isClipTooLong(10.4)).toBe(false);
  });

  it("rejects longer clips", () => {
    expect(isClipTooLong(11)).toBe(true);
    expect(isClipTooLong(45)).toBe(true);
  });

  it("lets a clip of unknown length through", () => {
    expect(isClipTooLong(null)).toBe(false);
  });
});
