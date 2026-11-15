import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useMemo, useState } from "react";
import { AppState } from "react-native";

import { overrideCoords, useDevFlags, type Coords } from "@/lib/devFlags";

import { roundCoordinate } from "./coords";

const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 1000;

/** Reads the position only when permission is already granted; never asks. */
async function readCoords(): Promise<Coords | null> {
  try {
    // The prompt is passive. The proof camera is what asks for the permission,
    // and other device checks run on this screen, so a dialog here would collide.
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: roundCoordinate(position.coords.latitude), lng: roundCoordinate(position.coords.longitude) };
  } catch {
    return null;
  }
}

/**
 * The device's coordinates. Re-read when the screen gains focus, when the app
 * returns to the foreground, and every minute while both hold: Expo Go has no
 * background location on iOS, so a timer that outlives the screen would be wasted.
 *
 * With the development location override on, expo-location is never touched and
 * the override's coordinates come back instead. `overridePlace` is the pin the
 * "place" spot should land on.
 */
export function useForegroundCoords(overridePlace?: Coords): Coords | null {
  const flags = useDevFlags();
  const override = overrideCoords(flags, overridePlace);
  const overridden = override !== null;
  const [coords, setCoords] = useState<Coords | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (overridden) return;
      let active = true;
      const refresh = async () => {
        const next = await readCoords();
        if (!active) return;
        // Keep the same object when nothing moved so consumers do not re-render.
        setCoords((previous) => (previous?.lat === next?.lat && previous?.lng === next?.lng ? previous : next));
      };

      let timer: ReturnType<typeof setInterval> | undefined;
      const stopTimer = () => {
        clearInterval(timer);
        timer = undefined;
      };
      const startTimer = () => {
        stopTimer();
        timer = setInterval(refresh, REFRESH_INTERVAL_MS);
      };

      void refresh();
      if (AppState.currentState === "active") startTimer();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state !== "active") return stopTimer();
        void refresh();
        startTimer();
      });
      return () => {
        active = false;
        stopTimer();
        subscription.remove();
      };
    }, [overridden]),
  );

  // Keyed on the numbers so the override's fresh object does not look like a new fix.
  const overrideLat = override?.lat;
  const overrideLng = override?.lng;
  const stableOverride = useMemo(
    () => (overrideLat === undefined || overrideLng === undefined ? null : { lat: overrideLat, lng: overrideLng }),
    [overrideLat, overrideLng],
  );
  return overridden ? stableOverride : coords;
}
