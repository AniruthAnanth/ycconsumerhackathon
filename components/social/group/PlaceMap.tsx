import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Coordinate } from "./PlaceMap.types";

const ZOOM = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

/** One pin on a map. Passing onPick makes a tap move the pin. */
export function PlaceMap({
  coordinate,
  title,
  onPick,
}: {
  coordinate: Coordinate;
  title?: string;
  onPick?: (coordinate: Coordinate) => void;
}) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    map.current?.animateToRegion({ latitude: coordinate.lat, longitude: coordinate.lng, ...ZOOM }, 250);
  }, [coordinate.lat, coordinate.lng]);

  return (
    <MapView
      ref={map}
      style={styles.map}
      initialRegion={{ latitude: coordinate.lat, longitude: coordinate.lng, ...ZOOM }}
      onPress={
        onPick
          ? (event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              onPick({ lat: latitude, lng: longitude });
            }
          : undefined
      }
    >
      <Marker coordinate={{ latitude: coordinate.lat, longitude: coordinate.lng }} title={title} />
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { height: 220, width: "100%" } });
