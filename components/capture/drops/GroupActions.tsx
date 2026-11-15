import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { OutlinedPillButton } from "@/components/ui";
import { errorMessage } from "@/lib/errorMessage";
import { colors, font, fontFamily, spacing } from "@/theme";

import { capture } from "../backend";
import type { DropView } from "./dropView";

type GroupView = Extract<DropView, { type: "group" }>;

/** A group session: time to the start, or to the end once it is on, and who is in. One tap joins it. */
export function GroupActions({ view }: { view: GroupView }) {
  const router = useRouter();
  const rsvp = useMutation(capture.drops.rsvp);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phase = view.started ? "ENDS IN" : "STARTS IN";

  // drops.active is reactive: once the RSVP lands, view.going turns true and the button reads View.
  async function join() {
    setJoining(true);
    setError(null);
    try {
      await rsvp({ dropId: view.dropId });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't join. Try again."));
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.countdown}>{view.countdown}</Text>
          <Text style={styles.details} numberOfLines={1}>{`${phase}  ·  ${view.attending} ${view.started ? "HERE" : "GOING"}`}</Text>
        </View>
        {view.going ? (
          <OutlinedPillButton label="View" onPress={() => router.push(`/group/${view.dropId}`)} />
        ) : (
          <OutlinedPillButton label={joining ? "Joining…" : "I'm in"} disabled={joining} onPress={join} />
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flexShrink: 1, alignItems: "flex-end", gap: spacing.sm },
  row: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  info: { flexShrink: 1, alignItems: "flex-end", gap: 2 },
  countdown: {
    color: colors.onAccent,
    fontSize: font.total,
    fontFamily: fontFamily.extraBold,
    fontVariant: ["tabular-nums"],
  },
  details: { color: colors.divider, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
  error: { color: colors.onAccent, fontFamily: fontFamily.regular, fontSize: font.meta },
});
