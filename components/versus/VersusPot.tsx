import { useAction, useMutation } from "convex/react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { Banner, Button, OutlinedPillButton } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, hairline, spacing } from "@/theme";

import type { Versus } from "./api";
import { versusApi } from "./api";
import { shareInvite } from "./shareInvite";
import { outcomeLine, potLine } from "./versusText";

/**
 * What is at stake in a versus and the one thing to do about it: pay, wait for
 * the friend, or after the week, see the result and go again.
 */
export function VersusPot({ versus }: { versus: Versus }) {
  const router = useRouter();
  const { setLeagueId } = useCurrentLeague();
  const rematch = useMutation(versusApi.rematch);
  const toLeague = useMutation(versusApi.toLeague);
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
      {versus.stakeUsd > 0 && !versus.me.paid && versus.status !== "settled" ? (
        <PayStrip leagueId={versus.leagueId} stakeUsd={versus.stakeUsd} />
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.pot}>{potLine(versus)}</Text>
        {versus.status === "waiting" ? (
          <>
            <Text style={styles.detail}>Waiting for {opponentName} to accept. Code {versus.inviteCode}</Text>
            <OutlinedPillButton label="Share invite" icon="share-outline" onPress={() => shareInvite(versus.inviteCode)} />
          </>
        ) : null}
        {versus.status === "live" && versus.opponent && versus.stakeUsd > 0 ? (
          <Text style={styles.detail}>
            {versus.opponent.name} {versus.opponent.paid ? "has paid" : "hasn't paid yet"}
          </Text>
        ) : null}
        {outcome ? (
          <>
            <Text style={styles.outcome}>{outcome.title}</Text>
            {outcome.detail ? <Text style={styles.detail}>{outcome.detail}</Text> : null}
            <Button
              label="Rematch"
              loading={busy}
              onPress={() => run(async () => switchTo((await rematch({ leagueId: versus.leagueId })).leagueId))}
            />
          </>
        ) : null}
        <OutlinedPillButton
          label="Add friends, make it a league"
          icon="people-outline"
          disabled={busy}
          onPress={() =>
            run(async () => {
              const { leagueId } = await toLeague({ leagueId: versus.leagueId });
              setLeagueId(leagueId);
              router.push({ pathname: "/contacts", params: { leagueId } });
            })
          }
        />
        {failure ? <ErrorLine message={failure} /> : null}
      </View>
    </View>
  );
}

/** PayBanner's checkout flow; the strip goes once Whop's webhook marks the stake paid. */
function PayStrip({ leagueId, stakeUsd }: { leagueId: Id<"leagues">; stakeUsd: number }) {
  const createCheckout = useAction(backend.whop.createCheckout);
  const [state, setState] = useState<"idle" | "opening" | "failed">("idle");

  async function pay() {
    setState("opening");
    try {
      const { purchaseUrl } = await createCheckout({ leagueId });
      await WebBrowser.openBrowserAsync(purchaseUrl);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <Banner
      icon="card-outline"
      title={`Pay your $${stakeUsd} stake`}
      subtitle={PAY_SUBTITLE[state]}
      onPress={state === "opening" ? undefined : pay}
    />
  );
}

const PAY_SUBTITLE = {
  idle: "An unpaid player can't win the pot",
  opening: "Opening checkout...",
  failed: "Checkout didn't open. Tap to try again.",
} as const;

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: "flex-start",
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  pot: { fontSize: font.title, fontWeight: "700", color: colors.text },
  outcome: { fontSize: font.total, fontWeight: "700", color: colors.text },
  detail: { fontSize: font.body, color: colors.textMuted },
});
