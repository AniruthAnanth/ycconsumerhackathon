/** How long after a screen first shows that its rows still count as its first load (data arriving from Convex included). */
export const FIRST_LOAD_WINDOW_MS = 1500;

const firstShown = new Map<string, number>();

/** True while `path` is inside its first-load window; the first call for a path opens the window. */
export function firstLoad(path: string, now: number): boolean {
  const shown = firstShown.get(path);
  if (shown === undefined) {
    firstShown.set(path, now);
    return true;
  }
  return now - shown <= FIRST_LOAD_WINDOW_MS;
}

/** Test hook: forget every screen seen so far. */
export function resetFirstLoad() {
  firstShown.clear();
}
