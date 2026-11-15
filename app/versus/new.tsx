import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { FormBody } from "@/components/join/FormBody";
import { StakePicker } from "@/components/join/StakePicker";
import type { Stake } from "@/components/join/stakes";
import { Button, Header, Screen, SectionLabel } from "@/components/ui";
import { OpponentPicker } from "@/components/versus/OpponentPicker";
import { type Opponent, useChallenge } from "@/components/versus/useChallenge";
import { spacing } from "@/theme";

export { RouteError as ErrorBoundary } from "@/components/social/RouteError";

/** Pick a stake and one friend for a head-to-head week. */
export default function NewVersusScreen() {
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
  body: { padding: spacing.md, gap: spacing.sm },
});
