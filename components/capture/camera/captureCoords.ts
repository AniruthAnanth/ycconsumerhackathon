import { overrideCoords, type Coords, type DevFlags } from "../../../lib/devFlags";

/** How long a capture may wait for GPS before it settles for the last known fix. */
export const GPS_TIMEOUT_MS = 4000;

export type GpsReader = {
  hasPermission(): Promise<boolean>;
  current(): Promise<Coords | null>;
  lastKnown(): Promise<Coords | null>;
};

type Inputs = {
  flags: DevFlags;
  place?: Coords;
  gps: GpsReader;
  timeoutMs?: number;
};

function orNull(read: () => Promise<Coords | null>): Promise<Coords | null> {
  return read().catch(() => null);
}

function within(timeoutMs: number, pending: Promise<Coords | null>): Promise<Coords | null> {
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([pending, expiry]).finally(() => clearTimeout(timer));
}

/**
 * The coordinates a capture reports, decided at the moment the shutter fires: the development
 * override first, then a fresh GPS fix, then the last known one. A phone that cannot answer in
 * time sends no coordinates rather than holding the proof back.
 */
export async function resolveCaptureCoords({
  flags,
  place,
  gps,
  timeoutMs = GPS_TIMEOUT_MS,
}: Inputs): Promise<Coords | undefined> {
  const forced = overrideCoords(flags, place);
  if (forced) return forced;
  if (!(await gps.hasPermission().catch(() => false))) return undefined;
  const fresh = await within(timeoutMs, orNull(gps.current));
  if (fresh) return fresh;
  return (await within(timeoutMs, orNull(gps.lastKnown))) ?? undefined;
}
