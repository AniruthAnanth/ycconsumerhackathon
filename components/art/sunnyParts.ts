import { ARTWORK } from "./artworkCatalog";

const PATHS = ARTWORK.sunny.match(/<path[^>]*\/>/g) ?? [];
const open = '<svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">';
const wrap = (paths: string[]) => `${open}${paths.join("")}</svg>`;

/**
 * Sunny's artwork cut into the pieces that move on their own: the two ears (the first two paths of
 * the illustration) and everything else. The drawing itself is untouched; stacked back together at
 * rest the layers are the original image.
 */
export const SUNNY_PARTS = {
  leftEar: wrap(PATHS.slice(0, 1)),
  rightEar: wrap(PATHS.slice(1, 2)),
  body: wrap(PATHS.slice(2)),
};

/** Where the eyes sit in the 400-point drawing, and the face colour a lid covers them with. */
export const SUNNY_EYES = [
  { x: 267.5, y: 133.3, rx: 6, ry: 6.5 },
  { x: 313.3, y: 147.5, rx: 4.2, ry: 5 },
] as const;
export const SUNNY_FACE = "#C6E59A";
