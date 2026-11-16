import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { getDevFlags } from "@/lib/devFlags";
import { errorMessage } from "@/lib/errorMessage";
import { colors, spacing, type } from "@/theme";

import { capture } from "../backend";
import { resolveCaptureCoords } from "../camera/captureCoords";
import { deviceGps, requestLocationFor } from "../camera/deviceLocation";

const NO_FIX = "Couldn't find where you are. Turn on Location and try again.";

/**
 * A check-in task drafted without a place ("the gym") is pinned where the player stands the first
 * time, and every check-in after that is measured from there. The roster updates by itself, so
 * once the pin lands the sheet shows Submit Proof instead.
 */
export function PinPlaceButton({ taskId, name }: { taskId: string; name: string }) {
  const pinPlace = useMutation(capture.lineup.pinPlace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pin() {
    setBusy(true);
    setError(null);
    try {
      await requestLocationFor("photo_location");
      const coords = await resolveCaptureCoords({ flags: getDevFlags(), gps: deviceGps });
      if (!coords) throw new Error(NO_FIX);
      await pinPlace({ taskId: taskId as Id<"tasks">, place: { name, lat: coords.lat, lng: coords.lng } });
    } catch (caught) {
      setError(errorMessage(caught, NO_FIX));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Button label="Pin this spot" onPress={() => void pin()} loading={busy} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  error: { ...type.small, color: colors.danger, textAlign: "center" },
});
