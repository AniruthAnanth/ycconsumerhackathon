import type { Coords } from "@/lib/devFlags";

import { DeviceError } from "../errorMessage";

/** How long to wait for a GPS fix before telling the presenter instead of spinning. */
export const FIX_TIMEOUT_MS = 8000;

export type PhoneGps = {
  /** Asks for location access if the phone has not been asked yet. */
  requestPermission(): Promise<void>;
  hasPermission(): Promise<boolean>;
  current(): Promise<Coords | null>;
};

/**
 * Where the phone is standing right now, for "Pin check-in here". The location override is left
 * out on purpose: the point of the pin is the phone's real position on stage.
 */
export async function phoneCoords(gps: PhoneGps, timeoutMs = FIX_TIMEOUT_MS): Promise<Coords> {
  await gps.requestPermission();
  if (!(await gps.hasPermission())) throw new DeviceError("Location access is off. Turn it on in Settings.");

  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const fix = await Promise.race([gps.current().catch(() => null), expiry]).finally(() => clearTimeout(timer));
  if (!fix) throw new DeviceError("Couldn't get this phone's location. Try again.");
  return fix;
}
