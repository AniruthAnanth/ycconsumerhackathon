import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel, TextField } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import { StakePicker } from "./StakePicker";
import type { Stake } from "./stakes";
import type { useJoinLeague } from "./useJoinLeague";

/**
 * A new league needs a name and a stake, nothing else: Create makes it at once
 * with the default settings (weekly payout, 8 weeks, round robin). A creator who
 * wants another payout, season length or format takes "League settings" first,
 * and that screen creates the league with what they picked.
 */
export function CreateLeagueSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const router = useRouter();
  const createLeague = useMutation(api.leagues.create);
  const { join, busy, failure } = joining;
  const [name, setName] = useState("");
  const [stakeUsd, setStakeUsd] = useState<Stake>(0);
  const leagueName = name.trim();
  return (
    <>
      <SectionLabel left="Create a league" />
      <View style={styles.body}>
        <TextField label="League name" value={name} onChangeText={setName} editable={!busy} returnKeyType="done" />
        <StakePicker value={stakeUsd} onChange={setStakeUsd} disabled={busy} />
        <View style={styles.actions}>
          <OutlinedPillButton
            label="League settings"
            disabled={busy || !leagueName}
            onPress={() =>
              router.push({
                pathname: "/league-settings",
                params: { name: leagueName, stakeUsd: String(stakeUsd), visibility: "private" },
              })
            }
          />
          <OutlinedPillButton
            label="Create"
            disabled={busy || !leagueName}
            // No settings sent: the server fills in the defaults.
            onPress={() => join("create", () => createLeague({ name: leagueName, stakeUsd, visibility: "private" }))}
          />
        </View>
        {failure?.section === "create" ? <ErrorLine message={failure.message} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.md },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
});
