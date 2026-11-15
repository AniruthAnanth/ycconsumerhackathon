import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { useDevFlags, type Coords } from "@/lib/devFlags";

const MAX_NAME_LENGTH = 60;

/**
 * What the phone's reverse geocoder calls where it is, such as "Fitness SF", so the prompt can
 * tell a gym from a street corner. Undefined until it answers, and whenever it cannot.
 *
 * One lookup per distinct coordinates: the OS rate-limits geocoding and asks apps to use it
 * sparingly, and coordinates are rounded to about 11 m, so a player standing still never repeats
 * it. It never asks for permission: coordinates only exist once location was granted. It does
 * nothing on web, where expo-location has no reverse geocoding, and nothing while the development
 * location override is on, because then the position is made up and so would be its name.
 */
export function usePlaceName(coords: Coords | null): string | undefined {
  const { locationOverride } = useDevFlags();
  const lat = coords?.lat;
  const lng = coords?.lng;
  const key = lat === undefined || lng === undefined ? null : `${lat}:${lng}`;
  const [found, setFound] = useState<{ key: string; name: string | undefined } | null>(null);
  const lookUp = key !== null && !locationOverride && Platform.OS !== "web";

  useEffect(() => {
    if (!lookUp || lat === undefined || lng === undefined) return;
    let active = true;
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      .then((places) => {
        const name = places[0]?.name?.trim().slice(0, MAX_NAME_LENGTH).trim();
        if (active) setFound({ key: `${lat}:${lng}`, name: name || undefined });
      })
      // A failed or throttled lookup only means no gym hint; it must never break the row.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lookUp, lat, lng]);

  // An answer for the previous fix must not label the new one.
  return lookUp && found?.key === key ? found.name : undefined;
}
