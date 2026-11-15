/**
 * Reads how long a video clip is, so a proof video can be held to 10 seconds
 * on the server and not only by the recorder in the app.
 *
 * Phones record MP4 and QuickTime files, which share one container layout: a
 * sequence of boxes, each a 4-byte size and a 4-byte type. The clip's length
 * lives in the movie header box (moov > mvhd) as a duration and the timescale
 * it is counted in. Nothing here decodes video, so it runs in a Convex action.
 */

/** The longest proof clip the league accepts. */
export const MAX_CLIP_SECONDS = 10;

// Recorders stop a fraction of a second after the limit they are given.
const CLIP_LENGTH_TOLERANCE_SECONDS = 0.75;

/** Whether a clip of this length is too long to be a proof. Unknown lengths are let through. */
export function isClipTooLong(seconds: number | null): boolean {
  return seconds !== null && seconds > MAX_CLIP_SECONDS + CLIP_LENGTH_TOLERANCE_SECONDS;
}

/**
 * The clip's length in seconds, or null when the bytes are not an MP4 or
 * QuickTime file we can read. Null means "can't tell", never "too long":
 * an odd file should reach the referee, not be turned away by a parser.
 */
export function clipSeconds(file: Uint8Array): number | null {
  const movie = findBox(file, 0, file.length, "moov");
  if (!movie) return null;
  const header = findBox(file, movie.start, movie.end, "mvhd");
  if (!header) return null;

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  // Version 1 headers use 64-bit times, which shifts where the fields sit.
  const version = file[header.start];
  const timescaleAt = header.start + (version === 1 ? 20 : 12);
  if (timescaleAt + (version === 1 ? 12 : 8) > header.end) return null;
  const timescale = view.getUint32(timescaleAt);
  const duration = version === 1 ? Number(view.getBigUint64(timescaleAt + 4)) : view.getUint32(timescaleAt + 4);
  if (timescale === 0) return null;
  return duration / timescale;
}

/** The content range of the first box of a type among the boxes laid end to end in [start, end). */
function findBox(file: Uint8Array, start: number, end: number, type: string): { start: number; end: number } | null {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    let headerSize = 8;
    if (size === 1) {
      // A size of 1 means the real size follows as 64 bits, which is how video data over 4 GB is written.
      if (offset + 16 > end) return null;
      size = Number(view.getBigUint64(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      // A size of 0 means the box runs to the end of the file.
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;
    const name = String.fromCharCode(file[offset + 4], file[offset + 5], file[offset + 6], file[offset + 7]);
    if (name === type) return { start: offset + headerSize, end: offset + size };
    offset += size;
  }
  return null;
}
