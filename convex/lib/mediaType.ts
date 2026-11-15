export type SniffedMediaType =
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "heic"
  | "video"
  | "unknown";

const HEIC_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"];
const VIDEO_BRANDS = ["isom", "mp42", "qt"];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * Names a file by its leading bytes. Keiki's mimeType can be wrong or generic,
 * so the bytes decide what we convert, store and show.
 */
export function sniffMediaType(bytes: Uint8Array): SniffedMediaType {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (ascii(bytes, 1, 4) === "PNG" && bytes[0] === 0x89) {
    return "png";
  }
  if (ascii(bytes, 0, 4) === "GIF8") {
    return "gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "webp";
  }
  if (ascii(bytes, 4, 8) === "ftyp") {
    // Brands are four characters, space padded: "qt  ".
    const brand = ascii(bytes, 8, 12).trimEnd();
    if (HEIC_BRANDS.includes(brand)) {
      return "heic";
    }
    if (VIDEO_BRANDS.includes(brand)) {
      return "video";
    }
  }
  return "unknown";
}
