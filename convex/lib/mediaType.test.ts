import { describe, expect, it } from "vitest";

import { sniffMediaType } from "./mediaType";

function bytesOf(...parts: (string | number[])[]): Uint8Array {
  const flat = parts.flatMap((part) =>
    typeof part === "string"
      ? Array.from(part, (char) => char.charCodeAt(0))
      : part,
  );
  return Uint8Array.from(flat);
}

function isoBmff(brand: string): Uint8Array {
  return bytesOf([0, 0, 0, 0x1c], "ftyp", brand, [0, 0, 0, 0]);
}

describe("sniffMediaType", () => {
  it("recognises the web image formats", () => {
    expect(sniffMediaType(bytesOf([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffMediaType(bytesOf([0x89], "PNG\r\n"))).toBe("png");
    expect(sniffMediaType(bytesOf("GIF89a"))).toBe("gif");
    expect(
      sniffMediaType(bytesOf("RIFF", [1, 2, 3, 4], "WEBPVP8 ")),
    ).toBe("webp");
  });

  it.each(["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"])(
    "treats the %s brand as HEIC",
    (brand) => {
      expect(sniffMediaType(isoBmff(brand))).toBe("heic");
    },
  );

  it.each(["isom", "mp42", "qt  "])("treats the %s brand as video", (brand) => {
    expect(sniffMediaType(isoBmff(brand))).toBe("video");
  });

  it("does not mistake a RIFF wave file for WebP", () => {
    expect(sniffMediaType(bytesOf("RIFF", [1, 2, 3, 4], "WAVEfmt "))).toBe(
      "unknown",
    );
  });

  it("returns unknown for other brands, other formats and short input", () => {
    expect(sniffMediaType(isoBmff("avif"))).toBe("unknown");
    expect(sniffMediaType(bytesOf("%PDF-1.7"))).toBe("unknown");
    expect(sniffMediaType(new Uint8Array(0))).toBe("unknown");
    expect(sniffMediaType(bytesOf([0xff, 0xd8]))).toBe("unknown");
  });
});
