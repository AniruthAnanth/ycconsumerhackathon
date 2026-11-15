import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { InviteButton } from "@/components/invite";
import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { PayBanner } from "@/components/roster/PayBanner";
import { Button, OutlinedPillButton } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, hairline, spacing } from "@/theme";

import type { Versus } from "./api";
import { outcomeLine, potLine } from "./versusText";

/**
 * What is at stake in a versus and the one thing to do about it: pay, wait for
 * the friend, or after the week, see the result and go again.
 */
export function VersusPot({ versus }: { versus: Versus }) {
  const router = useRouter();
  const { setLeagueId } = useCurrentLeague();
  const rematch = useMutation(api.versus.rematch);
  const toLeague = useMutation(api.versus.toLeague);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(call: () => Promise<void>) {
    setBusy(true);
    setFailure(null);
    try {
      await call();
    } catch (error) {
      setFailure(errorMessage(error));
    }
    setBusy(false);
  }

  // The current league drives every tab, and setParams moves the versus home
  // (which reads its id from the route) along with it; on the Matchup tab it is a no-op.
  function switchTo(leagueId: Id<"leagues">) {
    setLeagueId(leagueId);
    router.setParams({ leagueId });
  }

  const outcome = outcomeLine(versus);
  const opponentName = versus.opponent?.name ?? "your friend";
  return (
    <View>
      {/* Only once both are in: a stake paid while waiting would sit in a week that may never be played. */}
      {versus.status === "live" && versus.stakeUsd > 0 && !versus.me.paid ? (
        <PayBanner leagueId={versus.leagueId} stakeUsd={versus.stakeUsd} />
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.pot}>{potLine(versus)}</Text>
        {versus.status === "waiting" ? (
          <>
            <Text style={styles.detail}>
              Waiting for {opponentName} to accept. Code {versus.inviteCode}
            </Text>
            <InviteButton
              leagueId={versus.leagueId}
              label="Send challenge link"
            />
          </>
        ) : null}
        {versus.status === "live" && versus.opponent && versus.stakeUsd > 0 ? (
          <Text style={styles.detail}>
            {versus.opponent.name}{" "}
            {versus.opponent.paid ? "has paid" : "hasn't paid yet"}
          </Text>
        ) : null}
        {outcome ? (
          <>
            <Text style={styles.outcome}>{outcome.title}</Text>
            {outcome.detail ? (
              <Text style={styles.detail}>{outcome.detail}</Text>
            ) : null}
            {versus.opponent ? (
              <Button
                label="Rematch"
                loading={busy}
                onPress={() =>
                  run(async () =>
                    switchTo(
                      (await rematch({ leagueId: versus.leagueId })).leagueId,
                    ),
                  )
                }
              />
            ) : null}
          </>
        ) : null}
        {/* Growing switches to the league payout rule, so the server refuses it while stakes ride on this week. */}
        {versus.status === "settled" || versus.potUsd === 0 ? (
          <OutlinedPillButton
            label="Add friends, make it a league"
            icon="people-outline"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const { leagueId } = await toLeague({
                  leagueId: versus.leagueId,
                });
                setLeagueId(leagueId);
                router.push({ pathname: "/contacts", params: { leagueId } });
              })
            }
          />
        ) : null}
        {failure ? <ErrorLine message={failure} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: "flex-start",
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  pot: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.text },
  outcome: { fontSize: font.total, fontFamily: fontFamily.bold, color: colors.text },
  detail: { fontFamily: fontFamily.regular, fontSize: font.body, color: colors.textMuted },
});
