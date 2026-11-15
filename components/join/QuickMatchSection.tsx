import { StyleSheet, View } from "react-native";
import { useMutation } from "convex/react";

import { OutlinedPillButton, SectionLabel } from "@/components/ui";
import { backend } from "@/lib/backend";
import { spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import { STAKES } from "./stakes";
import type { useJoinLeague } from "./useJoinLeague";

export function QuickMatchSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const quickMatch = useMutation(backend.leagues.quickMatch);
  const { join, busy, failure } = joining;
  return (
    <>
      <SectionLabel left="Quick match" />
      <View style={styles.body}>
        <View style={styles.row}>
          {STAKES.map(({ stakeUsd, label }) => (
            <OutlinedPillButton
              key={stakeUsd}
              label={label}
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
  body: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  pill: { flex: 1 },
});
