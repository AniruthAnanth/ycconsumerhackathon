import { describe, expect, it } from "vitest";

import { createClipper, pcmLevel, wavFromPcm16 } from "./pcmChunks";

describe("wavFromPcm16", () => {
  it("writes a 44-byte mono 16-bit header and the samples little-endian", () => {
    const wav = wavFromPcm16(Int16Array.from([1, -2]), 16_000);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(40, true)).toBe(4);
    expect(view.getInt16(44, true)).toBe(1);
    expect(view.getInt16(46, true)).toBe(-2);
  });
});

describe("pcmLevel", () => {
  it("is 0 for silence and grows with loudness, capped at 1", () => {
    expect(pcmLevel(new Int16Array(10))).toBe(0);
    expect(pcmLevel(Int16Array.from([1000, -1000]))).toBeGreaterThan(0);
    expect(pcmLevel(Int16Array.from([32767, -32768]))).toBe(1);
  });
});

describe("createClipper", () => {
  // 10 samples a second keeps the arithmetic readable: a clip is 10 new samples with 2 repeated.
  const sampleRate = 10;
  const ramp = (from: number, count: number) => Int16Array.from({ length: count }, (_, i) => from + i);

  it("hands back a clip per second of new audio, each starting with the last 200 ms of the one before", () => {
    const clipper = createClipper(sampleRate);
    expect(clipper.push(ramp(0, 5))).toEqual([]);
    const [first, second] = clipper.push(ramp(5, 15)).concat(clipper.push(ramp(20, 5)));
    expect(Array.from(first)).toEqual(Array.from(ramp(0, 10)));
    expect(Array.from(second)).toEqual(Array.from(ramp(8, 12)));
  });

  it("flushes the leftover at the end, and nothing when it is too short to hold a word", () => {
    const clipper = createClipper(sampleRate);
    clipper.push(ramp(0, 13));
    expect(Array.from(clipper.flush() ?? [])).toEqual(Array.from(ramp(8, 5)));
    expect(clipper.flush()).toBeNull();
  });
});
