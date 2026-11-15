import { StyleSheet, View } from "react-native";
import { useMutation } from "convex/react";

import { Button, OutlinedPillButton, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { SCREEN_MARGIN, spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import { STAKES } from "./stakes";
import type { useJoinLeague } from "./useJoinLeague";

/**
 * The fastest way into a league: pick a stake and the server seats the player in
 * a public league at it. The free match is the join screen's one filled button,
 * because it asks nothing of a new player; every other way in is outlined.
 */
export function QuickMatchSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const quickMatch = useMutation(backend.leagues.quickMatch);
  const { join, busy, failure } = joining;
  return (
    <>
      <SectionLabel left="Quick match" />
      <View style={styles.body}>
        <Button label="Quick match, Free" disabled={busy} onPress={() => join("quickMatch", () => quickMatch({ stakeUsd: 0 }))} />
        <View style={styles.row}>
          {STAKES.filter(({ stakeUsd }) => stakeUsd > 0).map(({ stakeUsd, label }) => (
            <OutlinedPillButton
              key={stakeUsd}
              label={label}
              accessibilityLabel={`Quick match, ${label}`}
              style={styles.pill}
              disabled={busy}
              onPress={() => join("quickMatch", () => quickMatch({ stakeUsd }))}
            />
          ))}
        </View>
        {failure?.section === "quickMatch" ? <ErrorLine message={failure.message} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  pill: { flex: 1 },
});
