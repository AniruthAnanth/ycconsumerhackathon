import { useMutation } from "convex/react";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { socialApi } from "../contract";
import { Button, Header, OutlinedPillButton, Screen, TextField, useCurrentLeague } from "../kit";
import { canStartSession, errorMessage, startTimeOptions, type StartOption } from "./groupLogic";
import { PlaceMap } from "./PlaceMap";
import type { Coordinate } from "./PlaceMap.types";
import { StartTimePills } from "./StartTimePills";

const YC_OFFICE: Coordinate = { lat: 37.7604, lng: -122.3879 };

export function NewGroupSessionScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const createGroupSession = useMutation(socialApi.drops.createGroupSession);

  const [title, setTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [pin, setPin] = useState(YC_OFFICE);
  const [options] = useState(() => startTimeOptions(Date.now()));
  const [start, setStart] = useState<StartOption>();
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const pinMoved = useRef(false);

  useEffect(() => {
    // A slow location fix must not drag the pin away from a spot the player already chose.
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const { coords } = await Location.getCurrentPositionAsync();
      if (!pinMoved.current) setPin({ lat: coords.latitude, lng: coords.longitude });
    })().catch(() => {});
  }, []);

  const movePin = (coordinate: Coordinate) => {
    pinMoved.current = true;
    setPin(coordinate);
  };

  const findPlace = async () => {
    setFinding(true);
    try {
      const [match] = await Location.geocodeAsync(placeName.trim());
      if (!match) {
        Alert.alert("Place not found");
        return;
      }
      movePin({ lat: match.latitude, lng: match.longitude });
    } catch {
      Alert.alert("Couldn't look up that place");
    } finally {
      setFinding(false);
    }
  };

  const startSession = async () => {
    if (!leagueId || !start) return;
    setSaving(true);
    try {
      const dropId = await createGroupSession({
        leagueId,
        title: title.trim(),
        place: { name: placeName.trim(), ...pin },
        startsAt: start.startsAt,
      });
      router.replace(`/group/${dropId}`);
    } catch (error) {
      Alert.alert("Couldn't start the session", errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="New Session" onBack={router.back} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Sunset run" />
        <TextField label="Place" value={placeName} onChangeText={setPlaceName} placeholder="Dolores Park" />
        <View style={styles.find}>
          <OutlinedPillButton label="Find" onPress={findPlace} disabled={finding || placeName.trim() === ""} />
        </View>
        <PlaceMap coordinate={pin} title={placeName.trim() || undefined} onPick={movePin} />
        <StartTimePills options={options} selected={start} onSelect={setStart} />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label="Start Session"
          onPress={startSession}
          loading={saving}
          disabled={!leagueId || !canStartSession({ title, placeName, startsAt: start?.startsAt })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { paddingBottom: 16 },
  find: { alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 10 },
  footer: { padding: 16 },
});
