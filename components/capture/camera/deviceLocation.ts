import * as Location from "expo-location";

import type { ProofType } from "../proofRoute";
import type { GpsReader } from "./captureCoords";

function toCoords(fix: Location.LocationObject | null) {
  return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
}

export const deviceGps: GpsReader = {
  hasPermission: async () => (await Location.getForegroundPermissionsAsync()).granted,
  current: async () => toCoords(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })),
  lastKnown: async () => toCoords(await Location.getLastKnownPositionAsync()),
};

/** Only a location task prompts; any other task reports coordinates when permission already exists. */
export async function requestLocationFor(proofType: ProofType): Promise<void> {
  if (proofType !== "photo_location") return;
  await Location.requestForegroundPermissionsAsync().catch(() => undefined);
}
