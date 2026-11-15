import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { proofCameraHref } from "@/components/capture/proofRoute";
import { socialApi } from "@/components/social/contract";
import { errorMessage } from "@/components/social/errorMessage";
import { leaveScreen } from "@/components/social/leave";
import { notify } from "@/components/social/notify";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";
import { Button, Header, Score, Screen, SectionLabel } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, spacing } from "@/theme";

import { AttendeeRow } from "./AttendeeRow";
import { formatStart, sessionAction } from "./groupLogic";
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
        <Header title="Group Session" onBack={leaveScreen} />
        <ScreenState loading />
      </Screen>
    );
  }
  if (!drop?.place) {
    return (
      <Screen>
        <Header title="Group Session" onBack={leaveScreen} />
        <ScreenState message="This session has ended" />
      </Screen>
    );
  }

  const { place, taskId } = drop;
  const action = sessionAction(drop, myUserId);
  const attendees = drop.attendees ?? [];

  const onAction = async () => {
    if (action.kind === "checkIn") {
      // Checking in is a location proof: the camera needs the place to capture GPS against it.
      if (taskId) {
        router.push(
          proofCameraHref({ taskId, title: drop.title, points: drop.points, proofType: "photo_location", place }),
        );
      }
      return;
    }
    setJoining(true);
    try {
      await rsvp({ dropId: drop.dropId });
    } catch (error) {
      notify(errorMessage(error, "Couldn't join. Try again."));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <Header title="Group Session" onBack={leaveScreen} />
      <ScrollView>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{drop.title}</Text>
          <Score value={drop.points} />
        </View>
        <PlaceMap coordinate={place} title={place.name} />
        <View style={styles.details}>
          <Text style={styles.place}>{place.name}</Text>
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, padding: spacing.lg },
  title: { flex: 1, color: colors.text, fontSize: font.total, fontWeight: "800" },
  details: { padding: spacing.lg, gap: spacing.xs },
  place: { color: colors.text, fontSize: font.header, fontWeight: "700" },
  start: { color: colors.textMuted, fontSize: font.body },
  footer: { padding: spacing.lg },
});
