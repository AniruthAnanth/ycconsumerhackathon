import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { FormBody } from "@/components/join/FormBody";
import { StakePicker } from "@/components/join/StakePicker";
import type { Stake } from "@/components/join/stakes";
import { Button, Header, Screen, SectionLabel } from "@/components/ui";
import { OpponentPicker } from "./OpponentPicker";
import { type Opponent, useChallenge } from "./useChallenge";
import { SCREEN_MARGIN, spacing } from "@/theme";

/** Pick a stake and one friend for a head-to-head week. */
export function ChallengeScreen() {
  const router = useRouter();
  const [stakeUsd, setStakeUsd] = useState<Stake>(5);
  const [opponent, setOpponent] = useState<Opponent>({ kind: "link" });
  const { challenge, busy, failure } = useChallenge();
  return (
    <Screen>
      <Header title="Challenge a Friend" onBack={router.canGoBack() ? router.back : undefined} />
      <FormBody>
        <SectionLabel left="Stake each" />
        <View style={styles.body}>
          <StakePicker value={stakeUsd} onChange={setStakeUsd} disabled={busy} />
        </View>
        <OpponentPicker value={opponent} onChange={setOpponent} />
        <View style={styles.body}>
          <Button
            label={opponent.kind === "link" ? "Create and share invite" : `Challenge ${opponent.name}`}
            loading={busy}
            onPress={() => challenge(stakeUsd, opponent)}
          />
          {failure ? <ErrorLine message={failure} /> : null}
        </View>
      </FormBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.sm },
});
