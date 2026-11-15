import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel, TextField } from "@/components/ui";
import { SCREEN_MARGIN, spacing } from "@/theme";

import { StakePicker } from "./StakePicker";
import type { Stake } from "./stakes";
import type { useJoinLeague } from "./useJoinLeague";

export function CreateLeagueSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const router = useRouter();
  const { busy } = joining;
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
            // The league is created on the next screen, once its payout, season length and format are picked.
            onPress={() =>
              router.push({
                pathname: "/league-settings",
                params: { name: leagueName, stakeUsd: String(stakeUsd), visibility: "private" },
              })
            }
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.md },
  action: { alignItems: "flex-end" },
});
