import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import { StakePicker } from "./StakePicker";
import type { Stake } from "./stakes";
import type { useJoinLeague } from "./useJoinLeague";

export function CreateLeagueSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const create = useMutation(backend.leagues.create);
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
        <View style={styles.action}>
          <OutlinedPillButton
            label="Create"
            disabled={busy || !leagueName}
            onPress={() => join("create", () => create({ name: leagueName, stakeUsd, visibility: "private" }))}
          />
        </View>
        {failure?.section === "create" ? <ErrorLine message={failure.message} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.md },
  action: { alignItems: "flex-end" },
});
