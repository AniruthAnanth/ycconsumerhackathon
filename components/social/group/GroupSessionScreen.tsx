import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { socialApi } from "../contract";
import { Button, Header, Score, Screen, SectionLabel, colors, useCurrentLeague } from "../kit";
import { ScreenState } from "../ScreenState";
import { useMyUserId } from "../useMyUserId";
import { AttendeeRow } from "./AttendeeRow";
import { errorMessage, formatStart, sessionAction } from "./groupLogic";
import { PlaceMap } from "./PlaceMap";

export function GroupSessionScreen() {
  const router = useRouter();
  const { dropId } = useLocalSearchParams<{ dropId: string }>();
  const { leagueId } = useCurrentLeague();
  const drops = useQuery(socialApi.drops.active, leagueId ? { leagueId } : "skip");
  const myUserId = useMyUserId();
  const rsvp = useMutation(socialApi.drops.rsvp);
  const [joining, setJoining] = useState(false);

  const drop = drops?.find((candidate) => candidate.dropId === dropId && candidate.kind === "group");

  if (drops === undefined || myUserId === undefined) {
    return (
      <Screen>
        <Header title="Group Session" onBack={router.back} />
        <ScreenState loading />
      </Screen>
    );
  }
  if (!drop?.place) {
    return (
      <Screen>
        <Header title="Group Session" onBack={router.back} />
        <ScreenState message="This session has ended" />
      </Screen>
    );
  }

  const action = sessionAction(drop, myUserId);
  const attendees = drop.attendees ?? [];

  const onAction = async () => {
    if (action.kind === "checkIn") {
      router.push(`/proof/${drop.taskId}`);
      return;
    }
    setJoining(true);
    try {
      await rsvp({ dropId: drop.dropId });
    } catch (error) {
      Alert.alert("Couldn't join", errorMessage(error));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <Header title="Group Session" onBack={router.back} />
      <ScrollView>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{drop.title}</Text>
          <Score value={drop.points} />
        </View>
        <PlaceMap coordinate={drop.place} title={drop.place.name} />
        <View style={styles.details}>
          <Text style={styles.place}>{drop.place.name}</Text>
          <Text style={styles.start}>{formatStart(drop.opensAt)}</Text>
        </View>
        <SectionLabel left="Attendees" right={`${attendees.length}`} />
        {attendees.map((attendee) => (
          <AttendeeRow
            key={attendee.userId}
            name={attendee.name}
            checkedIn={attendee.checkedIn}
            onPress={() => router.push(`/profile/${attendee.userId}`)}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={action.label} onPress={onAction} loading={joining} disabled={action.disabled} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: "800" },
  details: { padding: 16, gap: 2 },
  place: { color: colors.text, fontSize: 16, fontWeight: "600" },
  start: { color: colors.muted, fontSize: 14 },
  footer: { padding: 16 },
});
