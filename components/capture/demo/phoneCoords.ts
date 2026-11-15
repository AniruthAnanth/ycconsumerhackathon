import type { Coords } from "@/lib/devFlags";
import { DeviceError } from "@/lib/errorMessage";

/** How long to wait for a GPS fix before settling for the last known one. */
export const FIX_TIMEOUT_MS = 6000;

export type PhoneGps = {
  /** Asks for location access if the phone has not been asked yet. */
  requestPermission(): Promise<void>;
  hasPermission(): Promise<boolean>;
  current(): Promise<Coords | null>;
  lastKnown(): Promise<Coords | null>;
};

/** A read that failed or ran out of time counts as no fix. */
function within(timeoutMs: number, read: () => Promise<Coords | null>): Promise<Coords | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([read().catch(() => null), expiry]).finally(() => clearTimeout(timer));
}

/**
 * Where the phone is standing, for "Pin check-in here": a fresh GPS fix, else the last known
 * one. That is the order a proof reads its own coordinates in (captureCoords.ts), so the pin
 * lands on the point the check-in will report even where a fresh fix is slow, as it is indoors.
 * The location override is left out on purpose: the pin is the phone's real position on stage.
 */
export async function phoneCoords(gps: PhoneGps, timeoutMs = FIX_TIMEOUT_MS): Promise<Coords> {
  // Not timed: on first use this waits for the person to answer the system's permission sheet.
  await gps.requestPermission();
  if (!(await gps.hasPermission())) throw new DeviceError("Location access is off. Turn it on in Settings.");

  const fix = (await within(timeoutMs, gps.current)) ?? (await within(timeoutMs, gps.lastKnown));
  if (!fix) throw new DeviceError("Couldn't get this phone's location. Try again.");
  return fix;
}
